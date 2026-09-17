
import urllib.request, json, os
from dotenv import load_dotenv
load_dotenv()
k = os.getenv('MOCK_INTERVIEW_API_KEY')
req_body = {
    'model': 'openai/gpt-oss-20b',
    'messages': [
        {'role': 'system', 'content': 'Output valid JSON starting immediately with {"questions": [...]} without commentary.'},
        {'role': 'user', 'content': 'Generate a JSON object with key "questions" containing 15 aptitude questions.'}
    ],
    'max_tokens': 2000
}
req = urllib.request.Request(
    'https://api.groq.com/openai/v1/chat/completions',
    data=json.dumps(req_body).encode('utf-8'),
    headers={'Authorization': f'Bearer {k}', 'Content-Type': 'application/json', 'User-Agent': 'AI-Interview-Platform-PythonBridge/1.0'}
)
try:
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        print('SUCCESS! Content length:', len(res['choices'][0]['message']['content']))
        print('Usage:', res['usage'])
except urllib.error.HTTPError as e:
    print('FAILED:', e.code, e.read().decode('utf-8'))
