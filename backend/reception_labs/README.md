# Reception Labs FastAPI Application

A FastAPI application for integrating with the ElevenLabs API with proper structure and Pydantic models.

## Features

- Complete ElevenLabs API integration
- FastAPI with proper routing
- Pydantic models for data validation
- Async HTTP requests with HTTPX
- Environment variable support
- Proper error handling
- Docker support

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd reception_labs

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## Usage

### Environment Variables

Create a `.env` file in the project root with:

```env
ELEVENLABS_API_KEY=your_api_key_here
```

### Running the Application

```bash
# Run with uvicorn
uvicorn reception_labs.main:app --host 0.0.0.0 --port 8000 --reload

# Or run directly
python reception_labs/main.py
```

### API Endpoints

- `GET /` - Root endpoint
- `GET /health` - Health check
- `GET /agents` - Get all agents
- `GET /agents/{agent_id}` - Get specific agent
- `GET /conversations` - Get conversations
- `GET /conversations/{conversation_id}` - Get conversation details
- `GET /conversations/{conversation_id}/audio` - Get conversation audio
- `POST /conversations` - Create conversation
- `PUT /conversations/{conversation_id}` - Update conversation
- `DELETE /conversations/{conversation_id}` -enty conversation

## Project Structure

```
reception_labs/
├── __init__.py
├── main.py
├── api/
│   ├── __init__.py
│   └── endpoints.py
├── models/
│   ├── __init__.py
│   ├── agents.py
│   ├── conversations.py
│   └── audio.py
├── services/
│   ├── __init__.py
│   └── elevenlabs_service.py
├── utils/
│   ├── __init__.py
│   └── helpers.py
├── tests/
│   ├── __init__.py
│   └── test_api.py
├── requirements.txt
├── setup.py
└── README.md
```

## Testing

```bash
# Run tests
python -m pytest tests/
```

## Docker Support

```bash
# Build Docker image
docker build -t reception-labs .

# Run Docker container
docker run -p 8000:8000 reception-labs
```

## License

MIT License
