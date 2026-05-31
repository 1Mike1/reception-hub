"""
Test ElevenLabs webhook with proper HMAC signature
"""
import requests
import hmac
import hashlib
import time
import json
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from correct path
env_path = Path(__file__).parent / "reception_labs" / ".env"
load_dotenv(env_path)

WEBHOOK_SECRET = os.getenv("ELEVENLABS_WEBHOOK_SECRET")

if not WEBHOOK_SECRET:
    print(f"❌ Error: ELEVENLABS_WEBHOOK_SECRET not found in {env_path}")
    print(f"Checking if file exists: {env_path.exists()}")
    exit(1)

BACKEND_URL = "http://localhost:8000/webhooks/elevenlabs"

# Test webhook payload (post_call_transcription event)
payload = {
    "type": "post_call_transcription",
    "data": {
        "conversation_id": "test_conv_123",
        "agent_id": "agent_3701ksy7tz77fw0bm68z30tyxyse",
        "status": "done",
        "call_successful": "success",
        "call_duration_secs": 120,
        "transcript": "Test conversation transcript",
        "analysis": {
            "call_successful": "success"
        }
    }
}

# Convert payload to JSON string
payload_json = json.dumps(payload)
raw_body = payload_json.encode('utf-8')

# Generate HMAC signature (same as backend logic)
timestamp = str(int(time.time()))
signed_payload = f"{timestamp}.{payload_json}"
signature = hmac.new(
    WEBHOOK_SECRET.encode('utf-8'),
    signed_payload.encode('utf-8'),
    hashlib.sha256
).hexdigest()

# Create signature header (ElevenLabs format)
signature_header = f"t={timestamp},v0={signature}"

print("=" * 70)
print("Testing ElevenLabs Webhook")
print("=" * 70)
print(f"\nWebhook URL: {BACKEND_URL}")
print(f"Secret configured: {WEBHOOK_SECRET[:10]}...{WEBHOOK_SECRET[-10:]}")
print(f"Timestamp: {timestamp}")
print(f"Signature: {signature[:20]}...")
print(f"Header: {signature_header[:30]}...")
print(f"\nDebug Info:")
print(f"  Signed payload (first 100 chars): {signed_payload[:100]}...")
print(f"  Raw body length: {len(raw_body)} bytes")
print(f"\nSending test payload...")
print("-" * 70)

# Send webhook request
headers = {
    "Content-Type": "application/json",
    "ElevenLabs-Signature": signature_header
}

try:
    response = requests.post(BACKEND_URL, data=raw_body, headers=headers)
    
    print(f"\n✓ Response Status: {response.status_code}")
    print(f"✓ Response Body: {response.text}")
    
    if response.status_code == 200:
        print("\n" + "=" * 70)
        print("✅ WEBHOOK TEST SUCCESSFUL!")
        print("=" * 70)
        print("✓ Signature verification passed")
        print("✓ Payload processed successfully")
        print("✓ Webhook is production-ready!")
    else:
        print("\n" + "=" * 70)
        print("❌ WEBHOOK TEST FAILED")
        print("=" * 70)
        print(f"Status: {response.status_code}")
        print(f"Error: {response.text}")
        
except Exception as e:
    print(f"\n❌ Error: {e}")
    print("\nMake sure the backend server is running:")
    print("  cd backend")
    print("  python -m uvicorn reception_labs.main:app --reload")
