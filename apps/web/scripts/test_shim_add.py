import requests
url = 'http://127.0.0.1:8788/add'
payload = {
    'user_id': 'test-user',
    'session_id': 's1',
    'messages': [{'content': 'hello world', 'role': 'user'}]
}
resp = requests.post(url, json=payload)
print(resp.status_code, resp.text)
