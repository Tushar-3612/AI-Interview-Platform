import urllib.request, json, os
from dotenv import load_dotenv
load_dotenv()
keys = {
    'REAL_INTERVIEW_APTITUDE_API_KEY': os.getenv('REAL_INTERVIEW_APTITUDE_API_KEY'),
    'REAL_INTERVIEW_TECHNICAL_API_KEY': os.getenv('REAL_INTERVIEW_TECHNICAL_API_KEY'),
    'REAL_INTERVIEW_PROJECT_API_KEY': os.getenv('REAL_INTERVIEW_PROJECT_API_KEY'),
    'REAL_INTERVIEW_CODING_API_KEY': os.getenv('REAL_INTERVIEW_CODING_API_KEY'),
    'REAL_INTERVIEW_HR_API_KEY': os.getenv('REAL_INTERVIEW_HR_API_KEY'),
    'AI_API_KEY': os.getenv('AI_API_KEY'),
    'MOCK_INTERVIEW_API_KEY': os.getenv('MOCK_INTERVIEW_API_KEY')
}
for name, k in keys.items():
    if not k: continue
    req_body = {'model': 'openai/gpt-oss-20b', 'messages': [{'role': 'user', 'content': 'hi'}], 'max_tokens': 10}
    req = urllib.request.Request('https://api.groq.com/openai/v1/chat/completions', data=json.dumps(req_body).encode('utf-8'), headers={'Authorization': f'Bearer {k}', 'Content-Type': 'application/json', 'User-Agent': 'AI-Interview-Platform-PythonBridge/1.0'})
    try:
        with urllib.request.urlopen(req) as resp:
            print(f'{name}: READY!')
    except urllib.error.HTTPError as e:
        err = e.read().decode('utf-8')
        print(f'{name}: {e.code} -> {err[:90]}')
