from fastapi import APIRouter, Depends
from app.models.user import User
from app.services.auth import require_role
from app.services.sync import get_sync_status, run_sync

router = APIRouter(prefix="/api/sync", tags=["sync"])


@router.get("/status")
def sync_status(_user: User = Depends(require_role("admin", "manager"))):
    """Return last sync timestamps and pending sale count."""
    return get_sync_status()


@router.post("/now")
async def sync_now(_user: User = Depends(require_role("admin", "manager"))):
    """Trigger an immediate sync cycle."""
    results = await run_sync()
    return results
