import urllib.request, json, os
from dotenv import load_dotenv
load_dotenv()
key = os.getenv('AI_API_KEY')
prompt = 'Generate a JSON object with key "questions" containing EXACTLY 15 placement-level aptitude questions. Each question has "question", "options" (array of 4 objects with "label" and "text"), "correctAnswer", "explanation", "difficulty", "topic", "questionType". Output JSON ONLY.'
req_body = {
    'model': 'openai/gpt-oss-20b',
    'messages': [
        {'role': 'system', 'content': 'Output valid JSON starting immediately with {"questions": [...]} without any reasoning, thinking, or commentary.'},
        {'role': 'user', 'content': prompt}
    ],
    'temperature': 0.1,
    'max_tokens': 4000
}
req = urllib.request.Request(
    'https://api.groq.com/openai/v1/chat/completions',
    data=json.dumps(req_body).encode('utf-8'),
    headers={
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
        'User-Agent': 'AI-Interview-Platform-PythonBridge/1.0'
    }
)
with urllib.request.urlopen(req) as resp:
    res = json.loads(resp.read().decode('utf-8'))
    print('finish_reason:', res['choices'][0].get('finish_reason'))
    print('usage:', res.get('usage'))
    message = res['choices'][0].get('message', {})
    content = message.get('content', '')
    print('content length:', len(content))
    if not content and 'reasoning' in message:
        print('has reasoning of length:', len(message['reasoning']))
    print('content start:', content[:200])
    print('content end:', content[-200:])
    try:
        parsed = json.loads(content)
        print('SUCCESS parsed questions count:', len(parsed.get('questions', [])))
    except Exception as e:
        print('JSON parse error:', e)
