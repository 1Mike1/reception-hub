"""
Pydantic models for ElevenLabs Agents
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class Agent(BaseModel):
    """Agent model matching the ElevenLabs /convai/agents list response."""
    agent_id: str
    name: str
    tags: Optional[List[str]] = None
    created_at_unix_secs: Optional[int] = None
    last_call_time_unix_secs: Optional[int] = None
    archived: Optional[bool] = None
    last_7_day_call_count: Optional[int] = None
    access_info: Optional[Dict[str, Any]] = None
    # Extra fields returned by single-agent endpoint
    metadata: Optional[Dict[str, Any]] = None

    class Config:
        extra = "allow"  # pass through any extra fields we haven't listed
