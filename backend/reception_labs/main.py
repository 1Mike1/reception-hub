"""
FastAPI application for ElevenLabs API integration
"""
import logging
import os
import json
import hashlib
import secrets
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

# Load environment variables
# Get the directory where this script is located
script_dir = os.path.dirname(os.path.abspath(__file__))
# Load .env file from the script's directory
env_path = os.path.join(script_dir, '.env')
load_dotenv(env_path)

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
    yield
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

CLIENTS_JSON_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "clients.json")


def _load_clients() -> List[Dict[str, Any]]:
    if not os.path.exists(CLIENTS_JSON_PATH):
        return []
    with open(CLIENTS_JSON_PATH, "r") as f:
        return json.load(f)


def _save_clients(clients: List[Dict[str, Any]]) -> None:
    with open(CLIENTS_JSON_PATH, "w") as f:
        json.dump(clients, f, indent=2)


def _hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000).hex()


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
    company_name: str
    agent_id: str
    service_area: Optional[str] = ""
    created_at: str


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
    if not os.path.exists(PLANS_JSON_PATH):
        return []
    with open(PLANS_JSON_PATH, "r") as f:
        plans = json.load(f)
    return [_normalize_plan(p) for p in plans]


def _save_plans(plans: List[Dict[str, Any]]) -> None:
    with open(PLANS_JSON_PATH, "w") as f:
        json.dump(plans, f, indent=2)


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
        import asyncio
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_enforce_token_limit(agent_id, archive=False))
        except RuntimeError:
            # No running loop (called during sync registration) — skip async unarchive
            logger.info(f"Skipping async unarchive for agent {agent_id} (no event loop)")

    return new_plan


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)