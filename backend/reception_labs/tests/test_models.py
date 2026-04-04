"""
Test file for Pydantic models
"""
import pytest
from reception_labs.models.agents import Agent
from reception_labs.models.conversations import Conversation, ConversationDetails
from datetime import datetime

def test_agent_model():
    """Test Agent model"""
    agent_data = {
        "agent_id": "agent-123",
        "name": "Test Agent",
        "description": "A test agent",
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
        "status": "active",
        "is_public": True,
        "is_archived": False
    }
    
    agent = Agent(**agent_data)
    assert agent.agent_id == "agent-123"
    assert agent.name == "Test Agent"

def test_conversation_model():
    """Test Conversation model"""
    conversation_data = {
        "conversation_id": "conv-123",
        "agent_id": "agent-123",
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
        "status": "active",
        "is_archived": False
    }
    
    conversation = Conversation(**conversation_data)
    assert conversation.conversation_id == "conv-123"
    assert conversation.agent_id == "agent-123"

def test_conversation_details_model():
    """Test ConversationDetails model"""
    conversation_details_data = {
        "conversation_id": "conv-123",
        "agent_id": "agent-123",
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
        "status": "active",
        "messages": [{"role": "user", "content": "Hello"}],
        "is_archived": False
    }
    
    conversation_details = ConversationDetails(**conversation_details_data)
    assert conversation_details.conversation_id == "conv-123"
    assert conversation_details.messages[0]["role"] == "user"

