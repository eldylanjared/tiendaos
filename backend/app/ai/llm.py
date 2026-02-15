"""
LLM client that routes between local Ollama and Claude API.

- Ollama (local RTX 5070): free, used for daily operations
- Claude API: pay-per-use, used only when force_cloud=True or Ollama is unavailable
"""

import httpx
from app.config import get_settings

settings = get_settings()

OLLAMA_TIMEOUT = 120.0  # local models can take a moment on first load
CLAUDE_TIMEOUT = 60.0


async def _query_ollama(prompt: str, system: str = "") -> str:
    """Send a prompt to the local Ollama instance."""
    payload = {
        "model": settings.ollama_model,
        "prompt": prompt,
        "stream": False,
    }
    if system:
        payload["system"] = system

    async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
        resp = await client.post(f"{settings.ollama_url}/api/generate", json=payload)
        resp.raise_for_status()
        return resp.json()["response"]


async def _query_claude(prompt: str, system: str = "") -> str:
    """Send a prompt to the Anthropic Claude API."""
    if not settings.anthropic_api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not configured")

    messages = [{"role": "user", "content": prompt}]
    body = {
        "model": settings.claude_model,
        "max_tokens": 2048,
        "messages": messages,
    }
    if system:
        body["system"] = system

    headers = {
        "x-api-key": settings.anthropic_api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    async with httpx.AsyncClient(timeout=CLAUDE_TIMEOUT) as client:
        resp = await client.post("https://api.anthropic.com/v1/messages", json=body, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        return data["content"][0]["text"]


async def ollama_available() -> bool:
    """Check if the local Ollama server is reachable."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.ollama_url}/api/tags")
            return resp.status_code == 200
    except Exception:
        return False


async def query(prompt: str, system: str = "", force_cloud: bool = False) -> str:
    """
    Main entry point. Routes to local Ollama by default.
    Falls back to Claude API if Ollama is down and ANTHROPIC_API_KEY is set.
    Use force_cloud=True for complex multi-store analysis.
    """
    if not settings.ai_enabled:
        raise RuntimeError("AI is disabled. Set AI_ENABLED=true in .env")

    if force_cloud and settings.anthropic_api_key:
        return await _query_claude(prompt, system)

    # Try local first
    if await ollama_available():
        return await _query_ollama(prompt, system)

    # Fallback to cloud
    if settings.anthropic_api_key:
        return await _query_claude(prompt, system)

    raise RuntimeError(
        "No AI backend available. Start Ollama (ollama serve) or set ANTHROPIC_API_KEY."
    )
