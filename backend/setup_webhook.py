"""
Setup ElevenLabs webhook via API
"""
import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
AGENT_ID = "agent_3701ksy7tz77fw0bm68z30tyxyse"
WEBHOOK_URL = "https://salesbot-usa.loca.lt/webhooks/elevenlabs"

# ElevenLabs API endpoint for webhook configuration
# Try multiple possible endpoints
endpoints_to_try = [
    f"https://api.elevenlabs.io/v1/convai/agents/{AGENT_ID}",
    f"https://api.elevenlabs.io/v1/agents/{AGENT_ID}",
]

headers = {
    "xi-api-key": ELEVENLABS_API_KEY,
    "Content-Type": "application/json"
}

# Get current agent configuration
print("Trying to fetch agent configuration...\n")
url = None
for endpoint in endpoints_to_try:
    print(f"Trying endpoint: {endpoint}")
    response = requests.get(endpoint, headers=headers)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        url = endpoint
        print(f"✓ Found working endpoint!")
        print(f"Agent data: {response.json()}\n")
        break
    else:
        print(f"✗ Not found, trying next...\n")

if not url:
    print("❌ Could not find working API endpoint for agent.")
    print("This might mean webhooks need to be configured in the dashboard.")
    print("\nAlternative: Look for 'Settings' → 'Integrations' → 'Webhooks' in your dashboard")
    exit(1)

# Try to update with webhook configuration
# Note: The exact payload might vary based on ElevenLabs API version
payload = {
    "conversation_config": {
        "post_call_webhook": {
            "url": WEBHOOK_URL,
            "events": ["post_call_transcription"]
        }
    }
}

# Alternative payload structure (if above doesn't work)
payload_alt = {
    "webhook": {
        "url": WEBHOOK_URL,
        "events": ["post_call_transcription"]
    }
}

print(f"Attempting to set webhook to: {WEBHOOK_URL}")
print(f"For agent: {AGENT_ID}\n")

# Try updating agent with webhook
update_response = requests.patch(url, headers=headers, json=payload)
print(f"Update response status: {update_response.status_code}")
print(f"Update response: {update_response.text}")

if update_response.status_code != 200:
    print("\nTrying alternative payload structure...")
    update_response2 = requests.patch(url, headers=headers, json=payload_alt)
    print(f"Alternative update status: {update_response2.status_code}")
    print(f"Alternative response: {update_response2.text}")
