from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.user import User
from app.services.auth import get_current_user, require_role
from app.ai.orchestrator import ai_status
from app.ai.modules import demand_forecast, insights, smart_alerts, customer_insights

settings = get_settings()
router = APIRouter(prefix="/api/ai", tags=["ai"])


# --- Status ---

@router.get("/status")
async def status(_user: User = Depends(get_current_user)):
    return await ai_status()


# --- Insights (natural language questions) ---

class AskRequest(BaseModel):
    question: str
    days: int = 7
    force_cloud: bool = False


class AskResponse(BaseModel):
    question: str
    answer: str
    days: int
    backend: str


@router.post("/ask", response_model=AskResponse)
async def ask_question(
    req: AskRequest,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    if not settings.ai_enabled:
        raise HTTPException(status_code=503, detail="AI está deshabilitado. Activa AI_ENABLED=true en .env")
    if not settings.ai_insights:
        raise HTTPException(status_code=503, detail="Módulo de insights deshabilitado. Activa AI_INSIGHTS=true")

    try:
        answer = await insights.ask(req.question, db, days=req.days, force_cloud=req.force_cloud)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    return AskResponse(
        question=req.question,
        answer=answer,
        days=req.days,
        backend="cloud" if req.force_cloud else "local",
    )


# --- Demand Forecast ---

@router.get("/forecast")
async def forecast(
    days: int = Query(14, description="Days of sales history to analyze"),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """
    Get restock suggestions based on sales velocity.
    Works without AI enabled (returns structured data).
    With AI_DEMAND_FORECAST=true, adds a narrative summary.
    """
    return await demand_forecast.get_restock_suggestions(db, days_history=days)


# --- Smart Alerts ---

@router.get("/alerts")
async def alerts(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """
    Run all alert checks: low stock, sales anomalies, void rate.
    Works without AI enabled (returns structured alerts).
    With AI_SMART_ALERTS=true, adds an AI summary.
    """
    return await smart_alerts.run_all_checks(db)


# --- Customer Insights ---

@router.get("/customers")
async def customer_analysis(
    days: int = Query(30, description="Days of transaction history to analyze"),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """
    Basket analysis: frequently bought together + AI promotion suggestions.
    Works without AI enabled (returns pair data).
    With AI_CUSTOMER_INSIGHTS=true, adds promo suggestions.
    """
    return await customer_insights.analyze_patterns(db, days=days)
