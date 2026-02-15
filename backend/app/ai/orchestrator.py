"""
AI Orchestrator — central hub that manages all AI modules.

Each module can be toggled on/off via environment variables.
The orchestrator provides a unified interface and handles
module lifecycle, error isolation, and status reporting.
"""

from dataclasses import dataclass
from app.config import get_settings
from app.ai import llm

settings = get_settings()


@dataclass
class ModuleStatus:
    name: str
    enabled: bool
    description: str


def get_module_statuses() -> list[ModuleStatus]:
    """Return the on/off status of every AI module."""
    return [
        ModuleStatus("demand_forecast", settings.ai_demand_forecast, "Demand prediction and restock alerts"),
        ModuleStatus("insights", settings.ai_insights, "Natural language business reports"),
        ModuleStatus("smart_alerts", settings.ai_smart_alerts, "Anomaly detection and low-stock warnings"),
        ModuleStatus("customer_insights", settings.ai_customer_insights, "Purchase pattern analysis"),
    ]


async def ai_status() -> dict:
    """Full AI system status: which backend is available, which modules are on."""
    is_ollama = await llm.ollama_available()
    has_claude = bool(settings.anthropic_api_key)
    return {
        "ai_enabled": settings.ai_enabled,
        "ollama_available": is_ollama,
        "ollama_model": settings.ollama_model if is_ollama else None,
        "claude_available": has_claude,
        "modules": [
            {"name": m.name, "enabled": m.enabled, "description": m.description}
            for m in get_module_statuses()
        ],
    }
