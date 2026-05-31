"""
FastAPI application for ElevenLabs API integration
"""
import asyncio
import logging
import os
import json
import hashlib
import hmac
import secrets
import time
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import httpx
import stripe
from dotenv import load_dotenv

from reception_labs.db import db
from reception_labs import email_service

# Load environment variables
# Get the directory where this script is located
script_dir = os.path.dirname(os.path.abspath(__file__))
# Load .env file from the script's directory — override=True ensures .env
# always takes precedence over system/user environment variables.
env_path = os.path.join(script_dir, '.env')
load_dotenv(env_path, override=True)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── Stripe configuration ─────────────────────────────────────────────────────
stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:8080")

# Secret used to sign mock payment tokens so they can't be forged
_MOCK_SIGNING_KEY = os.getenv("MOCK_PAYMENT_SECRET", secrets.token_hex(32))

# Track confirmed session IDs to prevent replay attacks
_confirmed_sessions: set = set()

# ElevenLabs base URL — use env var to allow regional override (e.g. api.us.elevenlabs.io)
ELEVENLABS_BASE = os.getenv("ELEVENLABS_BASE_URL", "https://api.us.elevenlabs.io/v1")


def _headers() -> dict:
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ELEVENLABS_API_KEY not configured")
    return {"Accept": "application/json", "xi-api-key": api_key}


# ─── Shared HTTP client (re-used across requests for connection pooling) ──────
_http_client: httpx.AsyncClient | None = None


def _client() -> httpx.AsyncClient:
    """Return the shared httpx client (created at startup)."""
    if _http_client is None:
        raise RuntimeError("HTTP client not initialised — app not started")
    return _http_client


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _http_client
    _http_client = httpx.AsyncClient(timeout=30.0)
    # Initialise DB backend (Mongo or JSON fallback)
    db.init()
    logger.info(f"[STARTUP] Database backend: {db.backend} | Email: {'configured' if email_service.is_configured() else 'disabled (no SMTP_HOST)'}")
    
    # Create default admin if no admins exist
    admins = db.admins.find_all()
    if not admins:
        default_admin = {
            "id": secrets.token_hex(16),
            "email": os.getenv("DEFAULT_ADMIN_EMAIL", "admin@example.com"),
            "password_hash": _hash_password(
                os.getenv("DEFAULT_ADMIN_PASSWORD", "admin123"),
                (salt := secrets.token_hex(16))
            ),
            "salt": salt,
            "name": "Default Admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        db.admins.insert(default_admin)
        logger.warning(f"[STARTUP] Created default admin: {default_admin['email']} (password: {os.getenv('DEFAULT_ADMIN_PASSWORD', 'admin123')})")
    
    # Start background call-notification poller (no-op if email isn't configured)
    poll_task = asyncio.create_task(_call_notification_poller())
    try:
        yield
    finally:
        poll_task.cancel()
        try:
            await poll_task
        except asyncio.CancelledError:
            pass
        await _http_client.aclose()
        _http_client = None


# Initialize FastAPI app
app = FastAPI(
    title="ElevenLabs API Integration",
    description="FastAPI application for ElevenLabs API integration with agents and conversations",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow all origins for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import models
from reception_labs.models.agents import Agent
from reception_labs.models.conversations import Conversation, ConversationDetails

# API endpoints
@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "ElevenLabs API Integration Service"}

@app.get("/agents", response_model=List[Agent])
async def get_agents():
    """Get all agents including archived ones (fetched in parallel)."""
    try:
        import asyncio
        headers = _headers()
        client = _client()
        active_resp, archived_resp = await asyncio.gather(
            client.get(f"{ELEVENLABS_BASE}/convai/agents", headers=headers),
            client.get(f"{ELEVENLABS_BASE}/convai/agents", headers=headers, params={"archived": "true"}),
        )
        active_resp.raise_for_status()

        def _extract(resp: httpx.Response) -> list:
            if resp.status_code != 200:
                return []
            data = resp.json()
            return data.get("agents", data) if isinstance(data, dict) else data

        active_agents = _extract(active_resp)
        archived_agents = _extract(archived_resp)

        # Deduplicate — archived call may include active agents too
        seen_ids = {a["agent_id"] for a in active_agents if isinstance(a, dict) and "agent_id" in a}
        for agent in archived_agents:
            if isinstance(agent, dict) and agent.get("agent_id") not in seen_ids:
                active_agents.append(agent)

        logger.info(f"Returning {len(active_agents)} agents total (active + archived)")
        return active_agents
    except httpx.RequestError as e:
        logger.error(f"Request error: {e}")
        raise HTTPException(status_code=500, detail="Error connecting to ElevenLabs API")
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error: {e}")
        raise HTTPException(status_code=e.response.status_code, detail="Error from ElevenLabs API")

@app.get("/agents/{agent_id}", response_model=Agent)
async def get_agent(agent_id: str):
    """Get specific agent details"""
    try:
        response = await _client().get(f"{ELEVENLABS_BASE}/convai/agents/{agent_id}", headers=_headers())
        response.raise_for_status()
        return response.json()
    except httpx.RequestError as e:
        logger.error(f"Request error: {e}")
        raise HTTPException(status_code=500, detail="Error connecting to ElevenLabs API")
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error: {e}")
        raise HTTPException(status_code=e.response.status_code, detail="Error from ElevenLabs API")

class AgentArchiveRequest(BaseModel):
    archived: bool

@app.patch("/agents/{agent_id}/archive")
async def set_agent_archived(agent_id: str, body: AgentArchiveRequest):
    """Set an agent's archived status (archive or restore to active)."""
    try:
        response = await _client().patch(
            f"{ELEVENLABS_BASE}/convai/agents/{agent_id}",
            headers={**_headers(), "Content-Type": "application/json"},
            json={"platform_settings": {"archived": body.archived}},
        )
        if not response.is_success:
            logger.error(f"ElevenLabs PATCH error {response.status_code}: {response.text}")
            raise httpx.HTTPStatusError(
                f"ElevenLabs returned {response.status_code}: {response.text}",
                request=response.request,
                response=response,
            )
        logger.info(f"Agent {agent_id} archived={body.archived}")
        return response.json()
    except httpx.RequestError as e:
        logger.error(f"Request error: {e}")
        raise HTTPException(status_code=500, detail="Error connecting to ElevenLabs API")
    except httpx.HTTPStatusError as e:
        body_text = e.response.text if hasattr(e, 'response') else str(e)
        logger.error(f"HTTP error: {e} | body: {body_text}")
        raise HTTPException(status_code=e.response.status_code, detail=body_text)


@app.delete("/agents/{agent_id}")
async def delete_agent(agent_id: str):
    """Delete an agent via ElevenLabs API."""
    try:
        response = await _client().delete(
            f"{ELEVENLABS_BASE}/convai/agents/{agent_id}",
            headers=_headers(),
        )
        if not response.is_success:
            logger.error(f"ElevenLabs DELETE error {response.status_code}: {response.text}")
            raise httpx.HTTPStatusError(
                f"ElevenLabs returned {response.status_code}: {response.text}",
                request=response.request,
                response=response,
            )
        logger.info(f"Agent {agent_id} deleted")
        return {"status": "deleted", "agent_id": agent_id}
    except httpx.RequestError as e:
        logger.error(f"Request error: {e}")
        raise HTTPException(status_code=500, detail="Error connecting to ElevenLabs API")
    except httpx.HTTPStatusError as e:
        body_text = e.response.text if hasattr(e, 'response') else str(e)
        logger.error(f"HTTP error: {e} | body: {body_text}")
        raise HTTPException(status_code=e.response.status_code, detail=body_text)


class AgentConfigUpdate(BaseModel):
    """Updatable agent configuration fields (mirrors ElevenLabs PATCH structure)."""
    name: Optional[str] = None
    prompt: Optional[str] = Field(None, description="System prompt for the agent")
    first_message: Optional[str] = Field(None, description="Agent greeting message")
    language: Optional[str] = Field(None, description="Agent language code e.g. en")
    max_duration_seconds: Optional[int] = None


@app.patch("/agents/{agent_id}/config")
async def update_agent_config(agent_id: str, body: AgentConfigUpdate):
    """Update an agent's conversation configuration (prompt, first message, language, etc.)."""
    try:
        payload: Dict[str, Any] = {}
        if body.name is not None:
            payload["name"] = body.name
        # Build conversation_config only if any sub-field is set
        conversation_config: Dict[str, Any] = {}
        agent_block: Dict[str, Any] = {}
        if body.prompt is not None:
            agent_block["prompt"] = {"prompt": body.prompt}
        if body.first_message is not None:
            agent_block["first_message"] = body.first_message
        if body.language is not None:
            agent_block["language"] = body.language
        if agent_block:
            conversation_config["agent"] = agent_block
        if body.max_duration_seconds is not None:
            conversation_config["conversation"] = {"max_duration_seconds": body.max_duration_seconds}
        if conversation_config:
            payload["conversation_config"] = conversation_config
        if not payload:
            raise HTTPException(status_code=400, detail="No fields to update")

        response = await _client().patch(
            f"{ELEVENLABS_BASE}/convai/agents/{agent_id}",
            headers={**_headers(), "Content-Type": "application/json"},
            json=payload,
        )
        if not response.is_success:
            logger.error(f"ElevenLabs PATCH config error {response.status_code}: {response.text}")
            raise httpx.HTTPStatusError(
                f"ElevenLabs returned {response.status_code}: {response.text}",
                request=response.request,
                response=response,
            )
        logger.info(f"Agent {agent_id} config updated: {list(payload.keys())}")
        return response.json()
    except httpx.RequestError as e:
        logger.error(f"Request error: {e}")
        raise HTTPException(status_code=500, detail="Error connecting to ElevenLabs API")
    except httpx.HTTPStatusError as e:
        body_text = e.response.text if hasattr(e, 'response') else str(e)
        logger.error(f"HTTP error: {e} | body: {body_text}")
        raise HTTPException(status_code=e.response.status_code, detail=body_text)


@app.get("/conversations", response_model=List[Conversation])
async def get_conversations(
    agent_id: Optional[str] = None,
    page_size: Optional[int] = 50,
    summary_mode: Optional[str] = "include",
    search: Optional[str] = None,
    conversation_initiation_source: Optional[str] = None,
    branch_id: Optional[str] = None,
    # ── Advanced ElevenLabs filters ──
    call_successful: Optional[str] = None,
    call_start_after_unix: Optional[int] = None,
    call_start_before_unix: Optional[int] = None,
    call_duration_min_secs: Optional[int] = None,
    call_duration_max_secs: Optional[int] = None,
    rating_min: Optional[int] = None,
    rating_max: Optional[int] = None,
    direction: Optional[str] = None,
):
    """Get conversations with optional filtering (all ElevenLabs filter params supported)."""
    try:
        params = {
            "agent_id": agent_id,
            "page_size": page_size,
            "summary_mode": summary_mode,
            "search": search,
            "conversation_initiation_source": conversation_initiation_source,
            "branch_id": branch_id,
            "call_successful": call_successful,
            "call_start_after_unix": call_start_after_unix,
            "call_start_before_unix": call_start_before_unix,
            "call_duration_min_secs": call_duration_min_secs,
            "call_duration_max_secs": call_duration_max_secs,
            "rating_min": rating_min,
            "rating_max": rating_max,
            "direction": direction,
        }
        params = {k: v for k, v in params.items() if v is not None}

        response = await _client().get(
            f"{ELEVENLABS_BASE}/convai/conversations",
            headers=_headers(),
            params=params,
        )
        response.raise_for_status()
        data = response.json()
        return data.get("conversations", data) if isinstance(data, dict) else data
    except httpx.RequestError as e:
        logger.error(f"Request error: {e}")
        raise HTTPException(status_code=500, detail="Error connecting to ElevenLabs API")
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error: {e}")
        raise HTTPException(status_code=e.response.status_code, detail="Error from ElevenLabs API")

@app.get("/conversations/stats/active")
async def get_active_calls_stats(agent_id: Optional[str] = None):
    """Get statistics about active/in-progress calls.
    
    Returns:
        - active_count: Number of calls currently in progress
        - in_progress_calls: List of active call summaries
    """
    try:
        # Fetch all conversations
        params = {"page_size": 100}
        if agent_id:
            params["agent_id"] = agent_id
            
        response = await _client().get(
            f"{ELEVENLABS_BASE}/convai/conversations",
            headers=_headers(),
            params=params,
        )
        response.raise_for_status()
        data = response.json()
        conversations = data.get("conversations", data) if isinstance(data, dict) else data
        
        # Filter for in-progress calls (status != "done")
        active_calls = [
            c for c in conversations 
            if isinstance(c, dict) and c.get("status") not in ("done", "error", "failed", "cancelled")
        ]
        
        # Build summary response
        active_summaries = []
        for call in active_calls:
            active_summaries.append({
                "conversation_id": call.get("conversation_id"),
                "agent_id": call.get("agent_id"),
                "agent_name": call.get("agent_name"),
                "status": call.get("status"),
                "start_time_unix_secs": call.get("start_time_unix_secs"),
                "duration_so_far": int(time.time()) - call.get("start_time_unix_secs", int(time.time())),
            })
        
        return {
            "active_count": len(active_calls),
            "in_progress_calls": active_summaries,
        }
    except httpx.RequestError as e:
        logger.error(f"Request error: {e}")
        raise HTTPException(status_code=500, detail="Error connecting to ElevenLabs API")
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error: {e}")
        raise HTTPException(status_code=e.response.status_code, detail="Error from ElevenLabs API")

@app.get("/conversations/{conversation_id}", response_model=ConversationDetails)
async def get_conversation(conversation_id: str):
    """Get specific conversation details"""
    try:
        response = await _client().get(
            f"{ELEVENLABS_BASE}/convai/conversations/{conversation_id}",
            headers=_headers(),
        )
        response.raise_for_status()
        return response.json()
    except httpx.RequestError as e:
        logger.error(f"Request error: {e}")
        raise HTTPException(status_code=500, detail="Error connecting to ElevenLabs API")
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error: {e}")
        raise HTTPException(status_code=e.response.status_code, detail="Error from ElevenLabs API")

@app.get("/conversations/{conversation_id}/audio")
async def get_conversation_audio(conversation_id: str):
    """Stream audio for a specific conversation directly from ElevenLabs."""
    try:
        response = await _client().get(
            f"{ELEVENLABS_BASE}/convai/conversations/{conversation_id}/audio",
            headers=_headers(),
        )
        response.raise_for_status()
        content_type = response.headers.get("content-type", "audio/mpeg")
        return StreamingResponse(
            iter([response.content]),
            media_type=content_type,
            headers={"Content-Disposition": f'inline; filename="conversation_{conversation_id}.mp3"'},
        )
    except httpx.RequestError as e:
        logger.error(f"Request error: {e}")
        raise HTTPException(status_code=500, detail="Error connecting to ElevenLabs API")
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error: {e}")
        raise HTTPException(status_code=e.response.status_code, detail="Error from ElevenLabs API")

@app.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    """Delete a conversation from ElevenLabs."""
    try:
        response = await _client().delete(
            f"{ELEVENLABS_BASE}/convai/conversations/{conversation_id}",
            headers=_headers(),
        )
        if not response.is_success:
            logger.error(f"ElevenLabs DELETE error {response.status_code}: {response.text}")
            raise httpx.HTTPStatusError(
                f"ElevenLabs returned {response.status_code}: {response.text}",
                request=response.request,
                response=response,
            )
        logger.info(f"Conversation {conversation_id} deleted")
        return {"status": "deleted", "conversation_id": conversation_id}
    except httpx.RequestError as e:
        logger.error(f"Request error: {e}")
        raise HTTPException(status_code=500, detail="Error connecting to ElevenLabs API")
    except httpx.HTTPStatusError as e:
        body_text = e.response.text if hasattr(e, 'response') else str(e)
        logger.error(f"HTTP error: {e} | body: {body_text}")
        raise HTTPException(status_code=e.response.status_code, detail=body_text)

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


# ─── Client JSON Auth ─────────────────────────────────────────────────────────
# (path retained for backwards compat / migration; data now flows through db.clients)
CLIENTS_JSON_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "clients.json")


def _load_clients() -> List[Dict[str, Any]]:
    return db.clients.find_all()


def _save_clients(clients: List[Dict[str, Any]]) -> None:
    db.clients.replace_all(clients)


def _hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000).hex()


def _load_admins() -> List[Dict[str, Any]]:
    return db.admins.find_all()


def _save_admins(admins: List[Dict[str, Any]]) -> None:
    db.admins.replace_all(admins)


class ClientRegisterRequest(BaseModel):
    email: str
    password: str
    company_name: str
    agent_id: str
    service_area: Optional[str] = ""


class ClientLoginRequest(BaseModel):
    email: str
    password: str


class ClientResponse(BaseModel):
    id: str
    email: str
    business_email: Optional[str] = None  # Alias for email (frontend compatibility)
    company_name: str
    agent_id: str
    service_area: Optional[str] = ""
    created_at: str

    def __init__(self, **data):
        # Ensure business_email matches email if not provided
        if 'business_email' not in data and 'email' in data:
            data['business_email'] = data['email']
        super().__init__(**data)


@app.get("/clients", response_model=List[ClientResponse])
async def get_clients():
    """Get all clients (admin endpoint)"""
    clients = _load_clients()
    return [ClientResponse(**{k: v for k, v in c.items() if k not in ("password_hash", "salt")}) for c in clients]


@app.post("/auth/client/register", response_model=ClientResponse)
async def client_register(req: ClientRegisterRequest):
    """Register a new client account (stored in clients.json)"""
    if not req.agent_id.strip():
        raise HTTPException(status_code=400, detail="agent_id is required")
    clients = _load_clients()
    if any(c["email"].lower() == req.email.lower() for c in clients):
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    salt = secrets.token_hex(16)
    client: Dict[str, Any] = {
        "id": secrets.token_hex(16),
        "email": req.email.lower().strip(),
        "password_hash": _hash_password(req.password, salt),
        "salt": salt,
        "company_name": req.company_name.strip(),
        "agent_id": req.agent_id.strip(),
        "service_area": (req.service_area or "").strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    clients.append(client)
    _save_clients(clients)

    # Auto-create a free starter plan for the new client
    _activate_plan(
        client_id=client["id"],
        tier_id="starter",
        agent_id=client["agent_id"],
        client_email=client["email"],
        company_name=client["company_name"],
        stripe_payment_id="free_signup",
    )

    return ClientResponse(**{k: v for k, v in client.items() if k not in ("password_hash", "salt")})


@app.post("/auth/client/login", response_model=ClientResponse)
async def client_login(req: ClientLoginRequest):
    """Authenticate a client against clients.json"""
    clients = _load_clients()
    client = next((c for c in clients if c["email"].lower() == req.email.lower().strip()), None)
    if not client:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if _hash_password(req.password, client["salt"]) != client["password_hash"]:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return ClientResponse(**{k: v for k, v in client.items() if k not in ("password_hash", "salt")})


@app.get("/auth/client/profile", response_model=ClientResponse)
async def client_profile(email: str):
    """Fetch a client profile by email (used by dashboard on load)"""
    clients = _load_clients()
    client = next((c for c in clients if c["email"].lower() == email.lower().strip()), None)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return ClientResponse(**{k: v for k, v in client.items() if k not in ("password_hash", "salt")})


class ClientSelfUpdateRequest(BaseModel):
    """Client can update their own profile (email, company_name, service_area)"""
    email: Optional[str] = None
    company_name: Optional[str] = None
    service_area: Optional[str] = None


@app.patch("/auth/client/profile", response_model=ClientResponse)
async def update_client_profile(current_email: str, req: ClientSelfUpdateRequest):
    """Allow client to update their own profile"""
    clients = _load_clients()
    client = next((c for c in clients if c["email"].lower() == current_email.lower().strip()), None)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Check if new email is already taken
    if req.email and req.email.lower() != client["email"].lower():
        if any(c["email"].lower() == req.email.lower() for c in clients if c["id"] != client["id"]):
            raise HTTPException(status_code=400, detail="Email already in use")
        client["email"] = req.email.lower().strip()
    
    if req.company_name is not None:
        client["company_name"] = req.company_name.strip()
    
    if req.service_area is not None:
        client["service_area"] = req.service_area.strip()
    
    _save_clients(clients)
    logger.info(f"Client {client['id']} updated their profile")
    
    return ClientResponse(**{k: v for k, v in client.items() if k not in ("password_hash", "salt")})


class ClientUpdateRequest(BaseModel):
    email: Optional[str] = None
    company_name: Optional[str] = None
    agent_id: Optional[str] = None
    service_area: Optional[str] = None


@app.patch("/clients/{client_id}", response_model=ClientResponse)
async def update_client(client_id: str, req: ClientUpdateRequest):
    """Update client information (admin endpoint)"""
    clients = _load_clients()
    client = next((c for c in clients if c["id"] == client_id), None)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Check if new email is already taken
    if req.email and req.email.lower() != client["email"].lower():
        if any(c["email"].lower() == req.email.lower() for c in clients if c["id"] != client_id):
            raise HTTPException(status_code=400, detail="Email already in use")
        client["email"] = req.email.lower().strip()
    
    if req.company_name is not None:
        client["company_name"] = req.company_name.strip()
    
    if req.agent_id is not None:
        client["agent_id"] = req.agent_id.strip()
    
    if req.service_area is not None:
        client["service_area"] = req.service_area.strip()
    
    _save_clients(clients)
    logger.info(f"Client {client_id} updated by admin")
    
    return ClientResponse(**{k: v for k, v in client.items() if k not in ("password_hash", "salt")})


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN AUTHENTICATION (MongoDB/JSON backend)
# ═══════════════════════════════════════════════════════════════════════════════

class AdminResponse(BaseModel):
    id: str
    email: str
    name: str
    created_at: str


class AdminRegisterRequest(BaseModel):
    email: str
    password: str
    name: str


class AdminLoginRequest(BaseModel):
    email: str
    password: str


@app.post("/auth/admin/register", response_model=AdminResponse)
async def admin_register(req: AdminRegisterRequest):
    """Register a new admin account (stored in admins collection/JSON).
    
    In production, you should restrict this endpoint or remove it after
    creating the first admin account.
    """
    admins = _load_admins()
    if any(a["email"].lower() == req.email.lower() for a in admins):
        raise HTTPException(status_code=400, detail="An admin with this email already exists")
    
    salt = secrets.token_hex(16)
    admin: Dict[str, Any] = {
        "id": secrets.token_hex(16),
        "email": req.email.lower().strip(),
        "password_hash": _hash_password(req.password, salt),
        "salt": salt,
        "name": req.name.strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    admins.append(admin)
    _save_admins(admins)
    logger.info(f"Admin registered: {admin['email']}")
    return AdminResponse(**{k: v for k, v in admin.items() if k not in ("password_hash", "salt")})


@app.post("/auth/admin/login", response_model=AdminResponse)
async def admin_login(req: AdminLoginRequest):
    """Authenticate an admin against the admins collection/JSON."""
    admins = _load_admins()
    admin = next((a for a in admins if a["email"].lower() == req.email.lower().strip()), None)
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if _hash_password(req.password, admin["salt"]) != admin["password_hash"]:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    logger.info(f"Admin logged in: {admin['email']}")
    return AdminResponse(**{k: v for k, v in admin.items() if k not in ("password_hash", "salt")})


@app.get("/auth/admin/profile", response_model=AdminResponse)
async def admin_profile(email: str):
    """Fetch an admin profile by email."""
    admins = _load_admins()
    admin = next((a for a in admins if a["email"].lower() == email.lower().strip()), None)
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    return AdminResponse(**{k: v for k, v in admin.items() if k not in ("password_hash", "salt")})


# ═══════════════════════════════════════════════════════════════════════════════
# PLANS & USAGE SYSTEM
# ═══════════════════════════════════════════════════════════════════════════════

PLANS_JSON_PATH = os.path.join(script_dir, "plans.json")

# Available plan tiers (token-based)
PLAN_TIERS = {
    "starter": {"name": "Starter", "tokens": 50_000, "price_cents": 1999, "description": "50,000 LLM tokens"},
    "growth": {"name": "Growth", "tokens": 100_000, "price_cents": 2999, "description": "100,000 LLM tokens"},
    "pro": {"name": "Pro", "tokens": 200_000, "price_cents": 3999, "description": "200,000 LLM tokens"},
}

USAGE_ALERT_THRESHOLD = 0.80  # 80%


def _normalize_plan(plan: Dict[str, Any]) -> Dict[str, Any]:
    """Backward compat: convert legacy minutes-based plan records to token-based."""
    if "total_tokens" not in plan and "total_minutes" in plan:
        tier = PLAN_TIERS.get(plan.get("tier_id", ""))
        if tier:
            plan["total_tokens"] = tier["tokens"]
        else:
            plan["total_tokens"] = int(plan["total_minutes"] * TOKENS_PER_MINUTE)
        plan["used_tokens"] = round(plan.get("used_minutes", 0) * TOKENS_PER_MINUTE, 2)
        plan["remaining_tokens"] = max(0, plan["total_tokens"] - plan["used_tokens"])
        plan["usage_percent"] = round((plan["used_tokens"] / plan["total_tokens"]) * 100, 1) if plan["total_tokens"] > 0 else 0
        for key in ("total_minutes", "used_minutes", "remaining_minutes"):
            plan.pop(key, None)
    return plan


def _load_plans() -> List[Dict[str, Any]]:
    plans = db.plans.find_all()
    return [_normalize_plan(p) for p in plans]


def _save_plans(plans: List[Dict[str, Any]]) -> None:
    db.plans.replace_all(plans)


def _get_client_plan(client_id: str) -> Optional[Dict[str, Any]]:
    """Get the active plan for a client."""
    plans = _load_plans()
    # Return the latest active plan for this client
    client_plans = [p for p in plans if p["client_id"] == client_id and p["status"] == "active"]
    if not client_plans:
        return None
    # Sort by created_at descending, return latest
    client_plans.sort(key=lambda p: p.get("created_at", ""), reverse=True)
    return client_plans[0]


# ─── Plan Models ──────────────────────────────────────────────────────────────

class PlanTierResponse(BaseModel):
    tier_id: str
    name: str
    tokens: int
    price_cents: int
    description: str


class ClientPlanResponse(BaseModel):
    id: str
    client_id: str
    client_email: str
    company_name: str
    tier_id: str
    tier_name: str
    total_tokens: int
    used_tokens: float
    remaining_tokens: float
    usage_percent: float
    alert_triggered: bool
    status: str
    stripe_payment_id: Optional[str] = None
    created_at: str
    updated_at: str


class UsageAlertResponse(BaseModel):
    alert: bool
    usage_percent: float
    used_tokens: float
    total_tokens: int
    message: str


class CheckoutRequest(BaseModel):
    client_id: str
    tier_id: str


class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str


import hmac as _hmac

def _sign_mock_token(client_id: str, tier_id: str) -> str:
    """Create an HMAC-signed mock session ID that can't be forged."""
    payload = f"{client_id}:{tier_id}"
    sig = _hmac.new(_MOCK_SIGNING_KEY.encode(), payload.encode(), "sha256").hexdigest()[:24]
    return f"mock_{sig}_{client_id}_{tier_id}"

def _verify_mock_token(session_id: str, client_id: str, tier_id: str) -> bool:
    """Verify a mock session ID was signed by us."""
    expected = _sign_mock_token(client_id, tier_id)
    return _hmac.compare_digest(session_id, expected)


# ─── Plan Endpoints ───────────────────────────────────────────────────────────

# ─── LLM Usage Calculate ──────────────────────────────────────────────────────

class LlmUsageCalculateRequest(BaseModel):
    prompt_length: Optional[int] = None
    number_of_pages: Optional[int] = None
    rag_enabled: Optional[bool] = None


class LlmPriceItem(BaseModel):
    llm: str
    price_per_minute: float


class LlmUsageCalculateResponse(BaseModel):
    llm_prices: List[LlmPriceItem]


@app.post("/agents/{agent_id}/llm-usage/calculate", response_model=LlmUsageCalculateResponse)
async def calculate_llm_usage(agent_id: str, body: LlmUsageCalculateRequest = LlmUsageCalculateRequest()):
    """Calculate expected LLM token usage for an agent (proxy to ElevenLabs)."""
    try:
        payload: Dict[str, Any] = {}
        if body.prompt_length is not None:
            payload["prompt_length"] = body.prompt_length
        if body.number_of_pages is not None:
            payload["number_of_pages"] = body.number_of_pages
        if body.rag_enabled is not None:
            payload["rag_enabled"] = body.rag_enabled

        response = await _client().post(
            f"{ELEVENLABS_BASE}/convai/agent/{agent_id}/llm-usage/calculate",
            headers={**_headers(), "Content-Type": "application/json"},
            json=payload,
        )
        if not response.is_success:
            logger.error(f"ElevenLabs LLM usage calc error {response.status_code}: {response.text}")
            raise httpx.HTTPStatusError(
                f"ElevenLabs returned {response.status_code}: {response.text}",
                request=response.request,
                response=response,
            )
        data = response.json()
        logger.info(f"LLM usage calculated for agent {agent_id}: {len(data.get('llm_prices', []))} models")
        return data
    except httpx.RequestError as e:
        logger.error(f"Request error: {e}")
        raise HTTPException(status_code=500, detail="Error connecting to ElevenLabs API")
    except httpx.HTTPStatusError as e:
        body_text = e.response.text if hasattr(e, 'response') else str(e)
        logger.error(f"HTTP error: {e} | body: {body_text}")
        raise HTTPException(status_code=e.response.status_code, detail=body_text)


@app.get("/plans/tiers", response_model=List[PlanTierResponse])
async def get_plan_tiers():
    """Get all available plan tiers."""
    return [
        PlanTierResponse(tier_id=tid, **tier)
        for tid, tier in PLAN_TIERS.items()
    ]


@app.get("/plans/client/{client_id}", response_model=Optional[ClientPlanResponse])
async def get_client_plan(client_id: str):
    """Get the active plan for a specific client (with live LLM token usage).
    Auto-creates a free Starter plan if the client exists but has no plan."""
    plan = _get_client_plan(client_id)

    # Auto-seed: if client exists in clients.json but has no plan, create one
    if not plan:
        clients = _load_clients()
        client = next((c for c in clients if c["id"] == client_id), None)
        if not client:
            return None
        plan = _activate_plan(
            client_id=client_id,
            tier_id="starter",
            agent_id=client.get("agent_id", ""),
            client_email=client.get("email", ""),
            company_name=client.get("company_name", ""),
            stripe_payment_id="free_starter",
        )

    # Calculate token usage from ElevenLabs conversations + LLM pricing
    used_tokens = await _calculate_client_token_usage(plan["agent_id"])
    total_tokens = plan["total_tokens"]
    remaining = max(0, total_tokens - used_tokens)
    usage_pct = round((used_tokens / total_tokens) * 100, 1) if total_tokens > 0 else 0

    # Enforce: archive agent if tokens exceeded
    if used_tokens >= total_tokens and plan["status"] == "active":
        await _enforce_token_limit(plan["agent_id"], archive=True)
        logger.warning(f"Agent {plan['agent_id']} archived: token limit exceeded ({used_tokens}/{total_tokens})")

    # Send alert email when crossing 80% threshold for the first time
    alert_now = usage_pct >= (USAGE_ALERT_THRESHOLD * 100)
    if alert_now and not plan.get("alert_triggered") and plan.get("client_email"):
        try:
            subj, html, text = email_service.render_plan_alert_email(
                company_name=plan.get("company_name") or plan["client_email"],
                usage_percent=usage_pct,
                total_tokens=total_tokens,
            )
            email_service.send_email([plan["client_email"]], subj, html, text)
        except Exception as e:
            logger.error(f"Failed to send usage alert email: {e}")

    # Update stored usage
    plans = _load_plans()
    for p in plans:
        if p["id"] == plan["id"]:
            p["used_tokens"] = round(used_tokens, 2)
            p["remaining_tokens"] = round(remaining, 2)
            p["usage_percent"] = usage_pct
            p["alert_triggered"] = usage_pct >= (USAGE_ALERT_THRESHOLD * 100)
            p["updated_at"] = datetime.now(timezone.utc).isoformat()
            break
    _save_plans(plans)

    return ClientPlanResponse(
        id=plan["id"],
        client_id=plan["client_id"],
        client_email=plan.get("client_email", ""),
        company_name=plan.get("company_name", ""),
        tier_id=plan["tier_id"],
        tier_name=PLAN_TIERS.get(plan["tier_id"], {}).get("name", plan["tier_id"]),
        total_tokens=total_tokens,
        used_tokens=round(used_tokens, 2),
        remaining_tokens=round(remaining, 2),
        usage_percent=usage_pct,
        alert_triggered=usage_pct >= (USAGE_ALERT_THRESHOLD * 100),
        status=plan["status"],
        stripe_payment_id=plan.get("stripe_payment_id"),
        created_at=plan["created_at"],
        updated_at=plan.get("updated_at", plan["created_at"]),
    )


@app.get("/plans/usage-alert/{client_id}", response_model=UsageAlertResponse)
async def check_usage_alert(client_id: str):
    """Check if a client has hit 80% token usage threshold."""
    plan = _get_client_plan(client_id)
    if not plan:
        # Auto-seed for existing clients without a plan
        clients = _load_clients()
        client = next((c for c in clients if c["id"] == client_id), None)
        if client:
            plan = _activate_plan(
                client_id=client_id, tier_id="starter",
                agent_id=client.get("agent_id", ""),
                client_email=client.get("email", ""),
                company_name=client.get("company_name", ""),
                stripe_payment_id="free_starter",
            )
    if not plan:
        return UsageAlertResponse(
            alert=False, usage_percent=0, used_tokens=0, total_tokens=0,
            message="No active plan found.",
        )

    used_tokens = await _calculate_client_token_usage(plan["agent_id"])
    total = plan["total_tokens"]
    pct = round((used_tokens / total) * 100, 1) if total > 0 else 0
    alert = pct >= (USAGE_ALERT_THRESHOLD * 100)
    msg = (
        f"Warning: You have used {pct}% of your {total:,} tokens. Please purchase a new plan."
        if alert
        else f"You have used {pct}% of your {total:,} token plan."
    )
    return UsageAlertResponse(
        alert=alert, usage_percent=pct, used_tokens=round(used_tokens, 2),
        total_tokens=total, message=msg,
    )


@app.get("/plans/all", response_model=List[ClientPlanResponse])
async def get_all_plans():
    """Admin: Get all client plans with token usage info."""
    plans = _load_plans()
    results = []
    for plan in plans:
        used = plan.get("used_tokens", 0)
        total = plan.get("total_tokens", 0)
        remaining = max(0, total - used)
        pct = round((used / total) * 100, 1) if total > 0 else 0
        results.append(ClientPlanResponse(
            id=plan["id"],
            client_id=plan["client_id"],
            client_email=plan.get("client_email", ""),
            company_name=plan.get("company_name", ""),
            tier_id=plan["tier_id"],
            tier_name=PLAN_TIERS.get(plan["tier_id"], {}).get("name", plan["tier_id"]),
            total_tokens=total,
            used_tokens=round(used, 2),
            remaining_tokens=round(remaining, 2),
            usage_percent=pct,
            alert_triggered=pct >= (USAGE_ALERT_THRESHOLD * 100),
            status=plan["status"],
            stripe_payment_id=plan.get("stripe_payment_id"),
            created_at=plan["created_at"],
            updated_at=plan.get("updated_at", plan["created_at"]),
        ))
    return results


# Estimated tokens per minute of conversation (configurable)
TOKENS_PER_MINUTE = int(os.getenv("TOKENS_PER_MINUTE", "800"))


async def _calculate_client_token_usage(agent_id: str) -> float:
    """Estimate token usage for an agent by combining call duration with LLM price data.

    Uses the ElevenLabs LLM usage calculate endpoint to get the agent's configured
    LLM, then estimates tokens from total conversation duration.
    """
    try:
        # Fetch conversations to get total call duration
        conv_resp = await _client().get(
            f"{ELEVENLABS_BASE}/convai/conversations",
            headers=_headers(),
            params={"agent_id": agent_id, "page_size": 100},
        )
        if conv_resp.status_code != 200:
            return 0
        data = conv_resp.json()
        convos = data.get("conversations", data) if isinstance(data, dict) else data
        total_secs = sum(c.get("call_duration_secs", 0) for c in convos if isinstance(c, dict))
        total_minutes = total_secs / 60

        # Estimate tokens: total_minutes × TOKENS_PER_MINUTE
        estimated_tokens = round(total_minutes * TOKENS_PER_MINUTE, 2)
        return estimated_tokens
    except Exception as e:
        logger.error(f"Error calculating token usage for agent {agent_id}: {e}")
        return 0


async def _enforce_token_limit(agent_id: str, archive: bool) -> None:
    """Archive or unarchive an agent based on token limit enforcement."""
    try:
        await _client().patch(
            f"{ELEVENLABS_BASE}/convai/agents/{agent_id}",
            headers={**_headers(), "Content-Type": "application/json"},
            json={"platform_settings": {"archived": archive}},
        )
        action = "archived" if archive else "restored"
        logger.info(f"Token enforcement: agent {agent_id} {action}")
    except Exception as e:
        logger.error(f"Failed to enforce token limit for agent {agent_id}: {e}")


# ─── Stripe Payment ──────────────────────────────────────────────────────────

@app.post("/payments/create-checkout", response_model=CheckoutResponse)
async def create_checkout_session(req: CheckoutRequest):
    """Create a Stripe Checkout Session for a plan purchase, or mock it if Stripe is not configured."""
    tier = PLAN_TIERS.get(req.tier_id)
    if not tier:
        raise HTTPException(status_code=400, detail=f"Invalid tier: {req.tier_id}")

    # Find client info
    clients = _load_clients()
    client = next((c for c in clients if c["id"] == req.client_id), None)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # ── Mock mode (no Stripe key) ─────────────────────────────────────────────
    if not stripe.api_key:
        mock_session_id = _sign_mock_token(req.client_id, req.tier_id)
        mock_url = f"{FRONTEND_URL}/dashboard?payment=success&session_id={mock_session_id}&mock=1&tier={req.tier_id}&client_id={req.client_id}"
        logger.info(f"[MOCK] Checkout for client {req.client_id}, tier {req.tier_id}")
        return CheckoutResponse(checkout_url=mock_url, session_id=mock_session_id)

    # ── Real Stripe ───────────────────────────────────────────────────────────
    try:
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": f"2nd Wave AI - {tier['name']} Plan",
                        "description": tier["description"],
                    },
                    "unit_amount": tier["price_cents"],
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=f"{FRONTEND_URL}/dashboard?payment=success&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{FRONTEND_URL}/dashboard?payment=cancelled",
            metadata={
                "client_id": req.client_id,
                "tier_id": req.tier_id,
                "agent_id": client.get("agent_id", ""),
                "client_email": client.get("email", ""),
                "company_name": client.get("company_name", ""),
            },
        )
        return CheckoutResponse(checkout_url=checkout_session.url, session_id=checkout_session.id)
    except stripe.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=500, detail=f"Payment error: {str(e)}")


@app.post("/payments/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events (payment completion)."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if STRIPE_WEBHOOK_SECRET:
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid payload")
        except stripe.SignatureVerificationError:
            raise HTTPException(status_code=400, detail="Invalid signature")
    else:
        # No webhook secret configured — reject in production, allow in dev only
        logger.warning("[SECURITY] Webhook received without STRIPE_WEBHOOK_SECRET configured — rejecting")
        raise HTTPException(status_code=403, detail="Webhook signature verification not configured")

    if event.get("type") == "checkout.session.completed":
        session_data = event["data"]["object"]
        metadata = session_data.get("metadata", {})
        _activate_plan(
            client_id=metadata.get("client_id", ""),
            tier_id=metadata.get("tier_id", ""),
            agent_id=metadata.get("agent_id", ""),
            client_email=metadata.get("client_email", ""),
            company_name=metadata.get("company_name", ""),
            stripe_payment_id=session_data.get("payment_intent", session_data.get("id", "")),
        )
        logger.info(f"Plan activated for client {metadata.get('client_id')} — tier: {metadata.get('tier_id')}")

    return {"status": "ok"}


@app.post("/payments/confirm")
async def confirm_payment(session_id: str, tier_id: Optional[str] = None, client_id: Optional[str] = None):
    """Confirm a checkout session and activate the plan. Supports both real Stripe and mock mode."""

    # ── Replay protection ────────────────────────────────────────────────────
    if session_id in _confirmed_sessions:
        raise HTTPException(status_code=409, detail="This payment has already been confirmed")

    # ── Mock mode (session_id starts with "mock_") ──────────────────────────
    if session_id.startswith("mock_"):
        if not tier_id or not client_id:
            raise HTTPException(status_code=400, detail="tier_id and client_id required for mock confirmation")

        # Verify HMAC signature — prevents forged mock session IDs
        if not _verify_mock_token(session_id, client_id, tier_id):
            logger.warning(f"[SECURITY] Forged mock token rejected: {session_id}")
            raise HTTPException(status_code=403, detail="Invalid mock payment token")

        clients = _load_clients()
        client = next((c for c in clients if c["id"] == client_id), None)
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")

        plan = _activate_plan(
            client_id=client_id,
            tier_id=tier_id,
            agent_id=client.get("agent_id", ""),
            client_email=client.get("email", ""),
            company_name=client.get("company_name", ""),
            stripe_payment_id=session_id,
        )
        _confirmed_sessions.add(session_id)
        logger.info(f"[MOCK] Plan activated for {client_id}: {tier_id}")
        return plan

    # ── Real Stripe confirmation ─────────────────────────────────────────────
    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    try:
        session_data = stripe.checkout.Session.retrieve(session_id)
        if session_data.payment_status != "paid":
            raise HTTPException(status_code=400, detail="Payment not completed")

        metadata = session_data.metadata or {}
        plan = _activate_plan(
            client_id=metadata.get("client_id", ""),
            tier_id=metadata.get("tier_id", ""),
            agent_id=metadata.get("agent_id", ""),
            client_email=metadata.get("client_email", ""),
            company_name=metadata.get("company_name", ""),
            stripe_payment_id=session_data.payment_intent or session_data.id,
        )
        _confirmed_sessions.add(session_id)
        return plan
    except stripe.StripeError as e:
        logger.error(f"Stripe confirm error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _activate_plan(
    client_id: str, tier_id: str, agent_id: str,
    client_email: str, company_name: str, stripe_payment_id: str,
) -> Dict[str, Any]:
    """Create or replace the active plan for a client. Unarchives the agent (restores to active)."""
    tier = PLAN_TIERS.get(tier_id)
    if not tier:
        raise HTTPException(status_code=400, detail=f"Invalid tier: {tier_id}")

    plans = _load_plans()
    # Mark previous active plans as expired
    for p in plans:
        if p["client_id"] == client_id and p["status"] == "active":
            p["status"] = "expired"
            p["updated_at"] = datetime.now(timezone.utc).isoformat()

    now = datetime.now(timezone.utc).isoformat()
    new_plan: Dict[str, Any] = {
        "id": secrets.token_hex(16),
        "client_id": client_id,
        "client_email": client_email,
        "company_name": company_name,
        "agent_id": agent_id,
        "tier_id": tier_id,
        "total_tokens": tier["tokens"],
        "used_tokens": 0,
        "remaining_tokens": tier["tokens"],
        "usage_percent": 0,
        "alert_triggered": False,
        "status": "active",
        "stripe_payment_id": stripe_payment_id,
        "created_at": now,
        "updated_at": now,
    }
    plans.append(new_plan)
    _save_plans(plans)

    # Unarchive the agent when a new plan is purchased (restore to active)
    if agent_id:
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_enforce_token_limit(agent_id, archive=False))
        except RuntimeError:
            # No running loop (called during sync registration) — skip async unarchive
            logger.info(f"Skipping async unarchive for agent {agent_id} (no event loop)")

    # Send plan-purchased email (skip for the auto-created free starter)
    if client_email and stripe_payment_id not in ("free_signup", "free_starter"):
        try:
            subj, html, text = email_service.render_plan_purchased_email(
                company_name=company_name or client_email,
                tier_name=tier["name"],
                tokens=tier["tokens"],
            )
            email_service.send_email([client_email], subj, html, text)
        except Exception as e:
            logger.error(f"Failed to send plan-purchased email: {e}")

    return new_plan


# ═══════════════════════════════════════════════════════════════════════════════
# POST-CALL EMAIL NOTIFICATIONS
# ═══════════════════════════════════════════════════════════════════════════════

# Polling interval (seconds) for checking new completed conversations.
CALL_POLL_INTERVAL = int(os.getenv("CALL_POLL_INTERVAL_SECONDS", "60"))

# Optional shared secret for ElevenLabs webhook verification.
ELEVENLABS_WEBHOOK_SECRET = os.getenv("ELEVENLABS_WEBHOOK_SECRET", "")


def _was_email_sent(conversation_id: str) -> bool:
    return db.sent_emails.find_one({"conversation_id": conversation_id}) is not None


def _mark_email_sent(conversation_id: str, recipient: str) -> None:
    db.sent_emails.insert({
        "conversation_id": conversation_id,
        "recipient": recipient,
        "sent_at": datetime.now(timezone.utc).isoformat(),
    })


async def _fetch_transcript(conversation_id: str) -> List[Dict[str, Any]]:
    """Fetch full transcript for a conversation."""
    try:
        resp = await _client().get(
            f"{ELEVENLABS_BASE}/convai/conversations/{conversation_id}",
            headers=_headers(),
        )
        if resp.status_code != 200:
            return []
        data = resp.json()
        return data.get("transcript", []) or []
    except Exception as e:
        logger.error(f"Failed to fetch transcript for {conversation_id}: {e}")
        return []


async def _send_call_notification(conversation: Dict[str, Any]) -> None:
    """Send post-call summary email to the client owning the agent.

    Accepts either a `GET /conversations/{id}` response (flat fields) or a
    webhook payload `data` object (where fields are nested under `metadata`
    and `analysis`). Normalises before passing to the email renderer.
    """
    conv_id = conversation.get("conversation_id", "")
    if not conv_id or _was_email_sent(conv_id):
        return

    agent_id = conversation.get("agent_id")
    if not agent_id:
        return

    # Find the client that owns this agent
    client = db.clients.find_one({"agent_id": agent_id})
    if not client or not client.get("email"):
        logger.warning(f"[CALL-NOTIFY] No client/email for agent {agent_id} (conv {conv_id})")
        return

    # Normalise: webhook payloads nest metadata/analysis; conversation list flattens them.
    metadata = conversation.get("metadata") or {}
    analysis = conversation.get("analysis") or {}
    normalised = {
        "conversation_id": conv_id,
        "agent_id": agent_id,
        "start_time_unix_secs": (
            conversation.get("start_time_unix_secs")
            or metadata.get("start_time_unix_secs")
        ),
        "call_duration_secs": (
            conversation.get("call_duration_secs")
            or metadata.get("call_duration_secs", 0)
        ),
        "transcript_summary": (
            conversation.get("transcript_summary")
            or analysis.get("transcript_summary")
            or conversation.get("call_summary_title")
        ),
        "call_successful": (
            conversation.get("call_successful")
            or analysis.get("call_successful")
        ),
    }

    # Prefer transcript embedded in payload (webhook); else fetch via API (poller).
    transcript = conversation.get("transcript") or []
    if not transcript:
        transcript = await _fetch_transcript(conv_id)

    try:
        subject, html, text = email_service.render_call_summary_email(
            company_name=client.get("company_name") or client["email"],
            conversation=normalised,
            transcript=transcript,
        )
        email_service.send_email([client["email"]], subject, html, text)
        _mark_email_sent(conv_id, client["email"])
        logger.info(f"[CALL-NOTIFY] Email queued for conversation {conv_id} -> {client['email']}")
    except Exception as e:
        logger.error(f"[CALL-NOTIFY] Failed for {conv_id}: {e}")


async def _call_notification_poller() -> None:
    """Background task: poll ElevenLabs for newly completed conversations and email them."""
    # Skip polling entirely if email isn't configured
    if not email_service.is_configured():
        logger.info("[CALL-NOTIFY] Polling disabled (SMTP not configured)")
        return

    # Initial seed: mark all existing conversations as already-notified so we
    # only email NEW calls going forward (not the entire backlog on first run).
    try:
        await asyncio.sleep(5)  # let the HTTP client and DB settle
        seed_resp = await _client().get(
            f"{ELEVENLABS_BASE}/convai/conversations",
            headers=_headers(),
            params={"page_size": 100},
        )
        if seed_resp.status_code == 200:
            seed_data = seed_resp.json()
            seed_convs = seed_data.get("conversations", []) if isinstance(seed_data, dict) else []
            for c in seed_convs:
                cid = c.get("conversation_id")
                if cid and not _was_email_sent(cid):
                    _mark_email_sent(cid, "<seed>")
            logger.info(f"[CALL-NOTIFY] Seeded {len(seed_convs)} existing conversations")
    except Exception as e:
        logger.error(f"[CALL-NOTIFY] Seed failed: {e}")

    logger.info(f"[CALL-NOTIFY] Polling every {CALL_POLL_INTERVAL}s")
    while True:
        try:
            await asyncio.sleep(CALL_POLL_INTERVAL)
            resp = await _client().get(
                f"{ELEVENLABS_BASE}/convai/conversations",
                headers=_headers(),
                params={"page_size": 50},
            )
            if resp.status_code != 200:
                continue
            data = resp.json()
            convs = data.get("conversations", []) if isinstance(data, dict) else []
            for c in convs:
                # Only notify completed calls (have duration)
                if c.get("call_duration_secs", 0) > 0:
                    await _send_call_notification(c)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error(f"[CALL-NOTIFY] Poll cycle failed: {e}")


# ─── ElevenLabs webhook (configured at https://elevenlabs.io/app/agents/settings) ─

# Max age (seconds) of webhook events — reject older to prevent replay attacks
WEBHOOK_TOLERANCE_SECONDS = 30 * 60  # 30 minutes (ElevenLabs default)


def _verify_elevenlabs_signature(
    raw_body: bytes,
    signature_header: str,
    secret: str,
) -> None:
    """Verify ElevenLabs webhook signature per their HMAC spec.

    Header format: `t=<unix_timestamp>,v0=<hmac_sha256_hex>`
    Signed payload: `<timestamp>.<raw_body>` using SHA-256 HMAC.

    Raises HTTPException on any verification failure.
    """
    if not signature_header:
        raise HTTPException(status_code=401, detail="Missing ElevenLabs-Signature header")

    # Parse `t=...,v0=...`
    parts = {}
    for kv in signature_header.split(","):
        if "=" in kv:
            k, _, v = kv.strip().partition("=")
            parts[k] = v

    timestamp = parts.get("t")
    signature = parts.get("v0")
    if not timestamp or not signature:
        raise HTTPException(status_code=401, detail="Malformed ElevenLabs-Signature header")

    # Timestamp tolerance check (replay protection)
    try:
        event_ts = int(timestamp)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid timestamp")
    now = int(time.time())
    if abs(now - event_ts) > WEBHOOK_TOLERANCE_SECONDS:
        raise HTTPException(status_code=401, detail="Webhook timestamp outside tolerance window")

    # Recompute HMAC SHA-256 of "<timestamp>.<raw_body>"
    signed_payload = f"{timestamp}.{raw_body.decode('utf-8')}"
    expected_sig = hmac.new(
        secret.encode("utf-8"),
        signed_payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected_sig, signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")


@app.post("/webhooks/elevenlabs")
async def elevenlabs_webhook(request: Request):
    """Receive post-call events from ElevenLabs.

    Per https://elevenlabs.io/docs/agents-platform/workflows/post-call-webhooks:
      - Validates HMAC signature via `ElevenLabs-Signature` header
      - Handles `post_call_transcription` events (triggers email with summary + transcript)
      - Ignores `post_call_audio` and `call_initiation_failure` events
      - Returns HTTP 200 on success (required by EL)
    """
    raw_body = await request.body()

    # Signature verification (required when secret is configured)
    if ELEVENLABS_WEBHOOK_SECRET:
        sig_header = request.headers.get("elevenlabs-signature", "")
        _verify_elevenlabs_signature(raw_body, sig_header, ELEVENLABS_WEBHOOK_SECRET)
    else:
        logger.warning("[WEBHOOK] ELEVENLABS_WEBHOOK_SECRET not set — accepting unsigned event (DEV ONLY)")

    # Parse JSON
    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    event_type = payload.get("type")
    data = payload.get("data") or {}

    logger.info(f"[WEBHOOK] Received event_type={event_type} conv={data.get('conversation_id', '?')}")

    # We only care about transcription events for emailing
    if event_type != "post_call_transcription":
        return {"status": "ignored", "type": event_type}

    conv_id = data.get("conversation_id")
    if not conv_id:
        return {"status": "ignored", "reason": "no conversation_id"}

    # The webhook payload contains the full conversation (transcript + metadata + analysis).
    # No need to re-fetch from the API — pass `data` directly to the notifier.
    await _send_call_notification(data)
    return {"status": "ok", "conversation_id": conv_id}


@app.post("/conversations/{conversation_id}/send-transcript")
async def send_transcript_email(conversation_id: str, email: Optional[str] = None):
    """Manually send a conversation transcript by email.

    If `email` is omitted, sends to the agent's owning client.
    Bypasses the duplicate-send guard so users can manually re-send.
    """
    resp = await _client().get(
        f"{ELEVENLABS_BASE}/convai/conversations/{conversation_id}",
        headers=_headers(),
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv = resp.json()

    recipient = email
    company_name = "Customer"
    if not recipient:
        client = db.clients.find_one({"agent_id": conv.get("agent_id", "")})
        if not client:
            raise HTTPException(status_code=400, detail="No email provided and no client linked to agent")
        recipient = client["email"]
        company_name = client.get("company_name") or recipient

    transcript = conv.get("transcript", []) or []
    subject, html, text = email_service.render_call_summary_email(
        company_name=company_name, conversation=conv, transcript=transcript,
    )
    if not email_service.is_configured():
        raise HTTPException(status_code=503, detail="Email service not configured (set SMTP_HOST in .env)")
    email_service.send_email([recipient], subject, html, text)
    return {"status": "queued", "recipient": recipient}


# ═══════════════════════════════════════════════════════════════════════════════
# DEBUG / OPS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/system/info")
async def system_info():
    """Operational info: which backend / which integrations are active."""
    return {
        "db_backend": db.backend,
        "email_configured": email_service.is_configured(),
        "stripe_configured": bool(stripe.api_key),
        "elevenlabs_webhook_secret_set": bool(ELEVENLABS_WEBHOOK_SECRET),
        "call_poll_interval_seconds": CALL_POLL_INTERVAL,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)