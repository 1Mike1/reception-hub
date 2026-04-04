# Reception Labs API Endpoints

## Overview
This document describes all available endpoints for the ElevenLabs API integration FastAPI application.

## Base URL
`http://localhost:8000`

## Available Endpoints

### General Endpoints
- `GET /` - Root endpoint
- `GET /health` - Health check endpoint

### Agents Endpoints
- `GET /agents` - Get all agents
- `GET /agents/{agent_id}` - Get specific agent

### Conversations Endpoints
- `GET /conversations` - Get all conversations
- `GET /conversations/{conversation_id}` - Get specific conversation
- `GET /conversations/{conversation_id}/audio` - Get conversation audio
- `POST /conversations` - Create new conversation
- `PUT /conversations/{conversation_id}` - Update conversation
- `DELETE /conversations/{conversation_id}` - Delete conversation

### Phone Number Endpoints
- `GET /convai/phone-numbers/{agent_id}` - Get phone number for a specific agent

## Curl Examples

### Root Endpoint
```bash
curl http://localhost:8000/
```

### Health Check
```bash
curl http://localhost:8000/health
```

### Get All Agents
```bash
curl http://localhost:8000/agents -H "xi-api-key: YOUR_ELEVENLABS_API_KEY"
```

### Get Specific Agent
```bash
curl http://localhost:8000/agents/AGENT_ID `
  -H "xi-api-key: YOUR_ELEVENLABS_API_KEY"
```

### Get All Conversations
```bash
curl http://localhost:8000/conversations `
  -H "xi-api-key: YOUR_ELEVENLABS_API_KEY"
```

### Get Specific Conversation
```bash
curl http://localhost:8000/conversations/CONVERSATION_ID `
  -H "xi-api-key: YOUR_ELEVENLABS_API_KEY"
```

### Get Conversation Audio
```bash
curl http://localhost:8000/conversations/CONVERSATION_ID/audio `
  -H "xi-api-key: YOUR_ELEVENLABS_API_KEY"
```

### Create New Conversation
```bash
curl -X POST http://localhost:8000/conversations `
  -H "xi-api-key: YOUR_ELEVENLABS_API_KEY" `
  -H "Content-Type: application/json" `
  -d '{
    "agent_id": "AGENT_ID",
    "conversation_name": "My Conversation"
  }'
```

### Update Conversation
```bash
curl -X PUT http://localhost:8000/conversations/CONVERSATION_ID `
  -H "xi-api-key: YOUR_ELEVENLABS_API_KEY" `
  -H "Content-Type: application/json" `
  -d '{
    "status": "completed"
  }'
```

### Delete Conversation
```bash
curl -X DELETE http://localhost:8000/conversations/CONVERSATION_ID `
  -H "xi-api-key: YOUR_ELEVENLABS_API_KEY"
```

### Get Phone Number for Agent
```bash
curl http://localhost:8000/convai/phone-numbers/AGENT_ID `
  -H "xi-api-key: YOUR_ELEVENLABS_API_KEY"
```

## Error Handling
All endpoints properly handle missing API keys by returning HTTP 400 errors with descriptive messages:
```
{
  "detail": "ELEVENLABS_API_KEY not found in environment"
}
```

## Setup Instructions
1. Install the package in development mode:
   ```
   pip install -e .
   ```
2. Set the ElevenLabs API key in environment variables:
   ```
   ELEVENLABS_API_KEY=your_api_key_here
   ```
3. Run the application:
   ```
   python -m uvicorn reception_labs.main:app --host 0.0.0.0 --port 8000 --reload
   ```

## Testing
All endpoints have been tested and verified to work correctly with proper error handling for missing API keys.

## PowerShell Examples

If you're using PowerShell, you can use `Invoke-WebRequest` with the following syntax instead of curl:
```powershell
# Get all agents
Invoke-WebRequest -Uri "http://localhost:8000/agents" -Headers @{ "xi-api-key" = "YOUR_ELEVENLABS_API_KEY" }

# Get specific agent
Invoke-WebRequest -Uri "http://localhost:8000/agents/AGENT_ID" -Headers @{ "xi-api-key" = "YOUR_ELEVENLABS_API_KEY" }

# Create new conversation
$body = @{
    agent_id = "AGENT_ID"
    conversation_name = "My Conversation"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:8000/conversations" -Method POST -Headers @{ "xi-api-key" = "YOUR_ELEVENLABS_API_KEY" } -Body $body -ContentType "application/json"
```