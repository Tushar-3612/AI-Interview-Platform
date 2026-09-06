import os, urllib.request, json
from dotenv import load_dotenv
load_dotenv()
k = os.getenv('REAL_INTERVIEW_HR_API_KEY')
for m in ['qwen/qwen3.8-27b', 'qwen/qwen3.6-27b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b']:
    req = urllib.request.Request(
        'https://api.groq.com/openai/v1/chat/completions',
        data=json.dumps({
            'model': m,
            'messages': [
                {'role': 'system', 'content': 'Output valid JSON starting immediately with {"questions": [...]}'},
                {'role': 'user', 'content': 'Generate 5 HR behavioral interview questions in JSON with keys: id, question, category, difficulty, maxMarks, behavioralDimensions.'}
            ],
            'max_tokens': 950
        }).encode('utf-8'),
        headers={'Authorization': f'Bearer {k}', 'Content-Type': 'application/json', 'User-Agent': 'Test/1.0'}
    )
    try:
        with urllib.request.urlopen(req) as resp:
            res = json.loads(resp.read().decode('utf-8'))
            print(f'{m}: SUCCESS (len {len(res["choices"][0]["message"]["content"])})')
    except Exception as e:
        print(f'{m}: FAILED {e}')
