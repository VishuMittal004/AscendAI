import os
import time
import requests
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "openai/gpt-4o-mini")

MAX_RETRIES = 2
RETRY_DELAY = 3  # seconds


def generate_completion(
    prompt: str, 
    model: str = OPENROUTER_MODEL,
    image_base64: Optional[str] = None,
    image_mime_type: Optional[str] = None
) -> Optional[str]:
    """
    Sends a prompt and an optional image to OpenRouter.
    Includes retry logic with exponential backoff.
    """
    if not OPENROUTER_API_KEY:
        print("Error: OPENROUTER_API_KEY is not set.")
        return None

    url = "https://openrouter.ai/api/v1/chat/completions"

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:8000",
        "X-Title": "Goal Architect"
    }

    messages = []
    if image_base64 and image_mime_type:
        messages.append({
            "role": "user",
            "content": [
                {"type": "text", "text": prompt + "\n\n(See attached Image/Syllabus for context)"},
                {"type": "image_url", "image_url": {"url": f"data:{image_mime_type};base64,{image_base64}"}}
            ]
        })
    else:
        messages.append({"role": "user", "content": prompt})

    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.7,
    }

    last_error = None

    for attempt in range(MAX_RETRIES + 1):
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=90)
            response.raise_for_status()
            data = response.json()

            text = data["choices"][0]["message"]["content"]
            return text

        except requests.exceptions.Timeout:
            last_error = "Request timed out"
            print(f"Attempt {attempt + 1}: Timeout. Retrying...")
        except requests.exceptions.ConnectionError:
            last_error = "Connection failed"
            print(f"Attempt {attempt + 1}: Connection error. Retrying...")
        except requests.exceptions.HTTPError as e:
            last_error = f"HTTP {e.response.status_code}"
            print(f"Attempt {attempt + 1}: HTTP error {e.response.status_code}")
            if e.response.status_code == 429:
                print("Rate limited. Waiting before retry...")
                time.sleep(RETRY_DELAY * (attempt + 2))
                continue
            elif e.response.status_code >= 500:
                print("Server error. Retrying...")
            else:
                # Client error (4xx) — don't retry
                print(f"Response: {e.response.text[:300]}")
                return None
        except (KeyError, IndexError) as e:
            print(f"Unexpected response structure: {e}")
            return None
        except Exception as e:
            last_error = str(e)
            print(f"Attempt {attempt + 1}: Unexpected error: {e}")

        if attempt < MAX_RETRIES:
            delay = RETRY_DELAY * (2 ** attempt)
            print(f"Waiting {delay}s before retry...")
            time.sleep(delay)

    print(f"All {MAX_RETRIES + 1} attempts failed. Last error: {last_error}")
    return None


if __name__ == "__main__":
    test_prompt = "What is the capital of France? Reply in one word."
    print(f"Testing OpenRouter ({OPENROUTER_MODEL})...")
    result = generate_completion(test_prompt)
    if result:
        print(f"Response: {result}")
    else:
        print("Failed to get a response.")
