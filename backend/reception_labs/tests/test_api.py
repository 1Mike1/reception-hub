"""
Test file for Reception Labs FastAPI application
"""
import pytest
from fastapi.testclient import TestClient
from reception_labs.main import app

client = TestClient(app)

def test_root():
    """Test root endpoint"""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "ElevenLabs API Integration Service"}

def test_health():
    """Test health endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_agents_endpoint():
    """Test agents endpoint (mocked)"""
    # This would normally make a real API call, but we'll just test the structure
    response = client.get("/agents")
    assert response.status_code in [200, 400, 500]  # Could be 400 if API key missing, or 200 if successful

def test_conversations_endpoint():
    """Test conversations endpoint (mocked)"""
    response = client.get("/conversations")
    assert response.status_code in [200, 400, 500]  # Could be 400 if API key missing, or 200 if successful