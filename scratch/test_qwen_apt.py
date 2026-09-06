import urllib.request, json, os
from dotenv import load_dotenv
load_dotenv()
k = os.getenv('REAL_INTERVIEW_APTITUDE_API_KEY')
prompt = 'Generate a JSON object with key "questions" containing 15 short aptitude questions with question, options (4 strings), correctAnswer (A/B/C/D), difficulty. Output JSON ONLY.'
req_body = {
    'model': 'qwen/qwen3.8-27b',
    'messages': [
        {'role': 'system', 'content': 'Output valid JSON starting immediately with {"questions": [...]} without commentary.'},
        {'role': 'user', 'content': prompt}
    ],
    'max_tokens': 900
}
req = urllib.request.Request(
    'https://api.groq.com/openai/v1/chat/completions',
    data=json.dumps(req_body).encode('utf-8'),
    headers={'Authorization': f'Bearer {k}', 'Content-Type': 'application/json', 'User-Agent': 'AI-Interview-Platform-PythonBridge/1.0'}
)
try:
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        print('QWEN APTITUDE SUCCESS!')
        print('Content length:', len(res['choices'][0]['message']['content']))
        print('Usage:', res['usage'])
        print('Output:', res['choices'][0]['message']['content'][:300])
except urllib.error.HTTPError as e:
    print('FAILED:', e.code, e.read().decode('utf-8'))
