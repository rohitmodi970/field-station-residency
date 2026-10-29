import json
from urllib.request import Request, urlopen
url = 'http://127.0.0.1:8788/add'
payload = {
    'user_id': 'test-user',
    'session_id': 's1',
    'messages': [{'content': 'hello world', 'role': 'user'}]
}
req = Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
resp = urlopen(req)
print(resp.status, resp.read().decode())
