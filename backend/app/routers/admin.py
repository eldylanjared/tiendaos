import asyncio
import os
import signal
import subprocess
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate, UserResponse
from app.services.auth import get_current_user, require_role, hash_password

# Repo root: backend/app/routers/admin.py → go up 3 levels
REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent

# Store PCs run Windows; the VPS runs Linux — tool paths differ
IS_WINDOWS = os.name == "nt"
PIP = REPO_ROOT / "backend" / ".venv" / ("Scripts/pip.exe" if IS_WINDOWS else "bin/pip")
NPM = "npm.cmd" if IS_WINDOWS else "npm"

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# System endpoints
# ---------------------------------------------------------------------------

def _run(cmd: list[str], cwd: Path) -> str:
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=180)
    out = (result.stdout + result.stderr).strip()
    return out


def _git_info() -> dict:
    try:
        commit = _run(["git", "rev-parse", "--short", "HEAD"], REPO_ROOT)
        message = _run(["git", "log", "-1", "--format=%s"], REPO_ROOT)
        date = _run(["git", "log", "-1", "--format=%ci"], REPO_ROOT)
        branch = _run(["git", "rev-parse", "--abbrev-ref", "HEAD"], REPO_ROOT)
        return {"commit": commit, "message": message, "date": date, "branch": branch}
    except Exception as e:
        return {"commit": "unknown", "message": str(e), "date": "", "branch": ""}


@router.get("/system/version")
def system_version(_admin: User = Depends(require_role("admin", "manager"))):
    return _git_info()


@router.post("/system/update")
async def system_update(
    background_tasks: BackgroundTasks,
    _admin: User = Depends(require_role("admin")),
):
    log_lines: list[str] = []

    def run_step(label: str, cmd: list[str], cwd: Path):
        log_lines.append(f"\n--- {label} ---")
        try:
            out = _run(cmd, cwd)
            log_lines.append(out if out else "(sin salida)")
        except subprocess.TimeoutExpired:
            log_lines.append("ERROR: timeout")
        except Exception as e:
            log_lines.append(f"ERROR: {e}")

    run_step("Git pull", ["git", "pull", "origin", "master"], REPO_ROOT)
    run_step(
        "Dependencias backend",
        [str(PIP), "install", "-r", "requirements.txt", "-q"],
        REPO_ROOT / "backend",
    )
    run_step("Dependencias frontend", [NPM, "install", "--silent"], REPO_ROOT / "frontend")
    run_step("Build frontend", [NPM, "run", "build"], REPO_ROOT / "frontend")

    after = _git_info()
    log_lines.append(f"\n=== Listo — version {after['commit']}: {after['message']} ===")

    # Restart after the response is sent. On Windows there is no systemctl —
    # exiting the process is enough: start.bat relaunches uvicorn in 5s.
    async def restart():
        await asyncio.sleep(2)
        if IS_WINDOWS:
            os.kill(os.getpid(), signal.SIGTERM)
        else:
            subprocess.Popen(["systemctl", "restart", "tiendaos"], start_new_session=True)

    background_tasks.add_task(restart)

    return {"log": "\n".join(log_lines), "version": after}


@router.get("/users", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("admin", "manager")),
):
    return db.query(User).order_by(User.full_name).all()


@router.post("/users", response_model=UserResponse)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
):
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    if db.query(User).filter(User.pin_code == data.pin_code).first():
        raise HTTPException(status_code=400, detail="PIN already in use")

    user = User(
        username=data.username,
        full_name=data.full_name,
        pin_code=data.pin_code,
        hashed_password=hash_password(data.password),
        role=data.role,
        store_id=data.store_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    data: UserUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    updates = data.model_dump(exclude_unset=True)

    if "pin_code" in updates:
        existing = db.query(User).filter(User.pin_code == updates["pin_code"], User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="PIN already in use")

    if "password" in updates:
        user.hashed_password = hash_password(updates.pop("password"))

    for field, value in updates.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user
