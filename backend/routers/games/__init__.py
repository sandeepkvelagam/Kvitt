"""Games package: lifecycle, players, chips, settlement, thread."""

from fastapi import APIRouter

from .lifecycle import router as lifecycle_router
from .players import router as players_router
from .chips import router as chips_router
from .settlements import router as settlements_router
from .thread import router as thread_router

# Re-export models for external consumers
from .models import GameNight, Player, Transaction, GameThread  # noqa: F401

router = APIRouter(prefix="/api", tags=["games"])
router.include_router(lifecycle_router)
router.include_router(players_router)
router.include_router(chips_router)
router.include_router(settlements_router)
router.include_router(thread_router)
