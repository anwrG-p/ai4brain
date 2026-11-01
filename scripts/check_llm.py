"""CLI diagnostic script to verify LLM connection and provider status."""

import os
import sys

try:
    import truststore
    truststore.inject_into_ssl()
except Exception:
    pass

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

from app.settings import load_env_file
load_env_file()

from ai_coach.llm_config import active_llm_config
from ai_coach.llm_openrouter import OpenRouterRunner, OpenRouterError
from ai_coach.llm_gemini import GeminiRunner, GeminiError

def main():
    cfg = active_llm_config()
    if cfg is None:
        print("[-] No LLM API key detected.")
        print("    Please set OPENROUTER_API_KEY or GEMINI_API_KEY in backend/.env")
        sys.exit(1)

    provider, key, model = cfg
    masked_key = f"{key[:8]}...{key[-4:]}" if len(key) > 12 else "***"
    print(f"[*] Detected Active Provider : {provider.upper()}")
    print(f"[*] Key                      : {masked_key}")
    print(f"[*] Configured Model         : {model}")
    print(f"[*] Sending test prompt to {provider.upper()} API...")

    if provider == "openrouter":
        runner = OpenRouterRunner(key, model=model, timeout_s=10.0)
    else:
        runner = GeminiRunner(key, model=model, timeout_s=10.0)

    try:
        reply = runner([
            {"role": "system", "content": "You are Loti, a friendly cognitive coach."},
            {"role": "user", "content": "Hello Loti! Say hello in under 10 words."}
        ])
        print("\n[+] SUCCESS! Response received from LLM:")
        print(f"    \"{reply}\"")
        print("\n[+] LLM integration is 100% operational!")
    except (OpenRouterError, GeminiError) as e:
        err = str(e)
        print(f"\n[-] Provider returned error: {err}")
        if "429" in err:
            print("\n[!] Diagnosis: HTTP 429 (Rate Limit).")
            print(f"    OpenRouter's upstream shared pool for '{model}' is temporarily rate-limited.")
            print("    Tips:")
            print("    1. Wait 1-2 minutes and retry.")
            print("    2. Or try another model in backend/.env (e.g. google/gemini-2.0-flash-exp:free or standard paid models).")
        elif "402" in err:
            print("\n[!] Diagnosis: HTTP 402 (Payment Required / Insufficient Credits).")
            print("    The account balance is insufficient for this model or maximum token reservation.")
            print("    Tips: Check your OpenRouter credit balance or select a free model.")
        elif "401" in err:
            print("\n[!] Diagnosis: HTTP 401 (Unauthorized).")
            print("    Your API key was rejected by OpenRouter. Please check the key in backend/.env.")
        elif "ConnectError" in err or "SSL" in err:
            print("\n[!] Diagnosis: Network / SSL Error.")
            print("    Could not establish TLS connection to OpenRouter API.")

if __name__ == "__main__":
    main()
