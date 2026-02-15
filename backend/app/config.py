from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "sqlite:///./data/tiendaos.db"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True

    # Store
    store_id: str = "store-1"
    store_name: str = "Tienda Centro"

    # Auth
    secret_key: str = "change-this-to-a-random-secret-key-at-least-32-chars"
    access_token_expire_minutes: int = 480

    # AI
    ai_enabled: bool = False
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1:8b"
    anthropic_api_key: str = ""
    claude_model: str = "claude-sonnet-4-5-20250929"

    # AI Modules
    ai_demand_forecast: bool = False
    ai_insights: bool = False
    ai_smart_alerts: bool = False
    ai_customer_insights: bool = False

    # Sync
    cloud_api_url: str = ""
    sync_interval_seconds: int = 60

    # Receipt Printer
    printer_type: str = "thermal"
    printer_name: str = "default"

    # Business
    currency: str = "MXN"
    currency_symbol: str = "$"
    tax_rate: float = 0.16

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
