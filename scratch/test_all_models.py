import urllib.request, json, os
from dotenv import load_dotenv
load_dotenv()
k = os.getenv('AI_API_KEY')
models_to_test = [
    'llama-3.3-70b-versatile',
    'llama-3.3-70b-specdec',
    'llama-3.1-70b-versatile',
    'llama-3.1-8b-instant',
    'llama-3.2-1b-preview',
    'llama-3.2-3b-preview',
    'llama-3.2-11b-vision-preview',
    'llama-3.2-90b-vision-preview',
    'deepseek-r1-distill-llama-70b',
    'deepseek-r1-distill-qwen-32b',
    'qwen-2.5-32b',
    'qwen-2.5-coder-32b',
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-20b'
]
for m in models_to_test:
    req_body = {'model': m, 'messages': [{'role': 'user', 'content': '1+1='}], 'max_tokens': 5}
    req = urllib.request.Request('https://api.groq.com/openai/v1/chat/completions', data=json.dumps(req_body).encode('utf-8'), headers={'Authorization': f'Bearer {k}', 'Content-Type': 'application/json', 'User-Agent': 'AI-Interview-Platform-PythonBridge/1.0'})
    try:
        with urllib.request.urlopen(req) as resp:
            print(f'{m}: AVAILABLE & WORKING!')
    except urllib.error.HTTPError as e:
        err = e.read().decode('utf-8')
        if 'does not exist' in err or 'decommissioned' in err:
            pass
        else:
            print(f'{m}: {e.code} -> {err[:80]}')
