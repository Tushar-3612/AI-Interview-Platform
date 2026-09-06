import sys
import json
import urllib.request
import urllib.error

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

def main():
    try:
        raw_input = sys.stdin.read()
        if not raw_input:
            print(json.dumps({"success": False, "error": "Empty input provided to Python Groq bridge"}))
            sys.exit(1)

        payload = json.loads(raw_input)
        api_key = payload.get("apiKey", "").strip()
        model = payload.get("model", "openai/gpt-oss-20b").strip()
        messages = payload.get("messages", [])
        temperature = payload.get("temperature", 0.2)
        max_tokens = payload.get("max_tokens", 4000)

        if not api_key:
            print(json.dumps({"success": False, "error": "Missing API key in payload"}))
            sys.exit(1)

        req_body = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        data = json.dumps(req_body).encode("utf-8")
        req = urllib.request.Request(
            GROQ_URL,
            data=data,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "AI-Interview-Platform-PythonBridge/1.0"
            },
            method="POST"
        )

        with urllib.request.urlopen(req, timeout=60) as response:
            res_data = response.read().decode("utf-8")
            res_json = json.loads(res_data)
            
            choices = res_json.get("choices", [])
            if not choices:
                print(json.dumps({"success": False, "error": "No choices returned by Groq API"}))
                sys.exit(1)

            message = choices[0].get("message", {})
            content = message.get("content", "")
            
            if not content and "reasoning" in message:
                content = message["reasoning"]

            print(json.dumps({
                "success": True,
                "content": content,
                "usage": res_json.get("usage", {})
            }))
            sys.exit(0)

    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8") if e.fp else ""
        print(json.dumps({
            "success": False,
            "status": e.code,
            "error": f"Groq HTTP {e.code}: {err_body or e.reason}"
        }))
        sys.exit(0)
    except urllib.error.URLError as e:
        print(json.dumps({
            "success": False,
            "error": f"Network error connecting to Groq: {str(e.reason)}"
        }))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": f"Internal bridge error: {str(e)}"
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()
