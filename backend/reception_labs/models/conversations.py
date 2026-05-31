"""
Pydantic models for ElevenLabs Conversations
"""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class Conversation(BaseModel):
    """Conversation model matching the ElevenLabs /convai/conversations list response."""
    conversation_id: str
    agent_id: str
    agent_name: Optional[str] = None
    branch_id: Optional[str] = None
    version_id: Optional[str] = None
    start_time_unix_secs: Optional[int] = None
    call_duration_secs: Optional[int] = None
    message_count: Optional[int] = None
    status: Optional[str] = None
    call_successful: Optional[str] = None
    termination_reason: Optional[str] = None
    transcript_summary: Optional[str] = None
    call_summary_title: Optional[str] = None
    main_language: Optional[str] = None
    conversation_initiation_source: Optional[str] = None
    tool_names: Optional[List[str]] = None
    direction: Optional[str] = None
    rating: Optional[Any] = None

    class Config:
        extra = "allow"


class ConversationMessage(BaseModel):
    role: Optional[str] = None
    message: Optional[str] = None
    time_in_call_secs: Optional[float] = None

    class Config:
        extra = "allow"


class ConversationDetails(BaseModel):
    """Detailed conversation model for the single-conversation endpoint."""
    conversation_id: str
    agent_id: Optional[str] = None
    status: Optional[str] = None
    transcript: Optional[List[ConversationMessage]] = None
    summary: Optional[Any] = None
    metadata: Optional[Dict[str, Any]] = None

    class Config:
        extra = "allow"
