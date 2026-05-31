import httpx

api_key = '20b4cb08a0c5b9b591233a8c69b81396818e5c8d372fa2f90a1c37231a9a8296'
agent_id = 'agent_3701ksy7tz77fw0bm68z30tyxyse'

resp = httpx.get(
    f'https://api.us.elevenlabs.io/v1/convai/conversations?agent_id={agent_id}&page_size=100',
    headers={'xi-api-key': api_key},
    timeout=15
)

convs = resp.json().get('conversations', [])
print(f'\nTotal conversations for Real Agent: {len(convs)}\n')

if convs:
    print('Recent conversations:')
    for c in convs[:10]:
        print(f"  - {c['conversation_id']} ({c['call_duration_secs']}s) - {c.get('start_time_unix_secs', 'N/A')}")
else:
    print('No conversations found.')
