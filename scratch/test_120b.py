import os, urllib.request, json
from dotenv import load_dotenv
load_dotenv()
k = os.getenv('REAL_INTERVIEW_TECHNICAL_API_KEY')
prompt = 'Generate a JSON object with key "questions" containing EXACTLY 15 placement-level aptitude questions. Each question has "question", "options" (array of 4 objects with "label" and "text"), "correctAnswer", "explanation", "difficulty", "topic", "questionType". Output JSON ONLY.'
req_body = {
    'model': 'openai/gpt-oss-120b',
    'messages': [
        {'role': 'system', 'content': 'Output valid JSON starting immediately with {"questions": [...]} without reasoning or markdown.'},
        {'role': 'user', 'content': prompt}
    ],
    'temperature': 0.1,
    'max_tokens': 3500
}
req = urllib.request.Request(
    'https://api.groq.com/openai/v1/chat/completions',
    data=json.dumps(req_body).encode('utf-8'),
    headers={'Authorization': f'Bearer {k}', 'Content-Type': 'application/json', 'User-Agent': 'Test/1.0'}
)
try:
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        content = res['choices'][0]['message']['content']
        print('gpt-oss-120b SUCCESS len:', len(content))
        data = json.loads(content)
        print('questions count:', len(data.get('questions', [])))
except Exception as e:
    print('gpt-oss-120b FAILED:', e)
