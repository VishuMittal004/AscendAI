import requests
import json
from typing import Dict, Any, Optional

OLLAMA_API_URL = "http://localhost:11434/api/generate"
# Switching to phi3 for vastly improved generation speed
DEFAULT_MODEL = "phi3"

def generate_completion(prompt: str, model: str = DEFAULT_MODEL) -> Optional[str]:
    """
    Sends a prompt to the local Ollama instance and returns the generated text.
    Assumes Ollama is running locally at http://localhost:11434
    """
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False # Set to true if you want streaming responses
    }
    
    try:
        response = requests.post(OLLAMA_API_URL, json=payload, timeout=120)
        response.raise_for_status()

        data = response.json()
        
        if "response" in data:
            return data["response"]
        else:
            print(f"Unexpected response format from Ollama: {data}")
            return None
            
    except requests.exceptions.ConnectionError:
        print("Error: Could not connect to Ollama. Is it running on http://localhost:11434?")
        return None
    except requests.exceptions.Timeout:
        print("Error: Request to Ollama timed out.")
        return None
    except requests.exceptions.RequestException as e:
        print(f"Error communicating with Ollama: {e}")
        return None
    except json.JSONDecodeError:
         print("Error: Received invalid JSON from Ollama.")
         return None

# For testing independently
if __name__ == "__main__":
    test_prompt = "What is the capital of France?"
    print(f"Sending test prompt to Ollama ({DEFAULT_MODEL}): '{test_prompt}'")
    result = generate_completion(test_prompt)
    
    if result:
         print(f"\nResponse:\n{result}")
    else:
         print("\nFailed to get a response.")
