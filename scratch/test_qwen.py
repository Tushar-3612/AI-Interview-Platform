import urllib.request, json, os
from dotenv import load_dotenv
load_dotenv()
key = os.getenv('AI_API_KEY')
req_body = {
    'model': 'qwen/qwen3.8-27b',
    'messages': [
        {'role': 'system', 'content': 'Output valid JSON starting immediately with {"questions": [...]} without any reasoning or commentary.'},
        {'role': 'user', 'content': 'Generate a JSON object with key "questions" containing 2 aptitude questions.'}
    ],
    'temperature': 0.1,
    'max_tokens': 500
}
req = urllib.request.Request('https://api.groq.com/openai/v1/chat/completions', data=json.dumps(req_body).encode('utf-8'), headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json', 'User-Agent': 'AI-Interview-Platform-PythonBridge/1.0'})
try:
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        print('SUCCESS qwen/qwen3.8-27b:', res['choices'][0]['message']['content'][:200])
except urllib.error.HTTPError as e:
    print('FAILED:', e.code, e.read().decode('utf-8'))
