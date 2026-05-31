import httpx

# Test the NEW API key directly
api_key = '20b4cb08a0c5b9b591233a8c69b81396818e5c8d372fa2f90a1c37231a9a8296'
print(f'Testing NEW API key (last 8 chars): ...{api_key[-8:]}')

resp = httpx.get(
    'https://api.us.elevenlabs.io/v1/convai/agents',
    headers={'xi-api-key': api_key},
    timeout=15
)

print(f'Status: {resp.status_code}')
agents = resp.json().get('agents', [])
print(f'\nTotal agents: {len(agents)}\n')

for a in agents:
    print(f'  - {a["name"]} (ID: {a["agent_id"]})')
