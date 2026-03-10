"""Game Pydantic models, request models, and constants."""

import uuid
import random
from datetime import datetime, timezone
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional


# --- Constants ---

GAME_NAME_PREFIXES = ["Friday Night", "Saturday Showdown", "The Big Game", "Cash Game",
                      "Tournament Time", "High Stakes", "Dealer's Choice", "Wild Card Night",
                      "Poker Party", "All-In Action", "River Run", "Final Table", "House Game"]

def generate_default_game_name():
    """Generate a fun default game name."""
    prefix = random.choice(GAME_NAME_PREFIXES)
    return prefix


# --- Domain Models ---

class GameNight(BaseModel):
    model_config = ConfigDict(extra="ignore")
    game_id: str = Field(default_factory=lambda: f"game_{uuid.uuid4().hex[:12]}")
    group_id: str
    host_id: str  # user_id
    title: Optional[str] = None
    location: Optional[str] = None  # e.g., "Host's place"
    scheduled_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    status: str = "scheduled"  # scheduled, active, ended, settled, cancelled
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    is_finalized: bool = False
    chip_value: float = 1.0  # Value per chip for this game
    chips_per_buy_in: int = 20  # Chips given per buy-in
    buy_in_amount: float = 20.0  # Dollar amount per buy-in
    total_chips_distributed: int = 0  # Track total chips in play
    total_chips_returned: int = 0  # Track chips returned
    cancelled_by: Optional[str] = None
    cancel_reason: Optional[str] = None

class Player(BaseModel):
    model_config = ConfigDict(extra="ignore")
    player_id: str = Field(default_factory=lambda: f"plr_{uuid.uuid4().hex[:12]}")
    game_id: str
    user_id: str
    total_buy_in: float = 0.0
    total_chips: int = 0  # Total chips received
    chips_returned: Optional[int] = None  # Chips returned at end
    cash_out: Optional[float] = None
    net_result: Optional[float] = None
    rsvp_status: str = "pending"  # pending, yes, maybe, no
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    cashed_out_at: Optional[datetime] = None

class Transaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    transaction_id: str = Field(default_factory=lambda: f"txn_{uuid.uuid4().hex[:12]}")
    game_id: str
    user_id: str
    type: str  # buy_in, cash_out, rebuy
    amount: float
    chips: int = 0  # Number of chips involved
    chip_value: float = 1.0  # Value per chip at time of transaction
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    notes: Optional[str] = None

class GameThread(BaseModel):
    model_config = ConfigDict(extra="ignore")
    message_id: str = Field(default_factory=lambda: f"msg_{uuid.uuid4().hex[:12]}")
    game_id: str
    user_id: str
    content: str
    type: str = "user"  # user, system
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# --- Request Models ---

class GameNightCreate(BaseModel):
    group_id: str
    title: Optional[str] = None
    location: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    buy_in_amount: float = 20.0
    chips_per_buy_in: int = 20
    initial_players: Optional[List[str]] = None  # List of user_ids to add with default buy-in

class GameNightUpdate(BaseModel):
    title: Optional[str] = None
    location: Optional[str] = None
    scheduled_at: Optional[datetime] = None

class BuyInRequest(BaseModel):
    amount: float
    chips: Optional[int] = None  # If not provided, calculated from game settings

class CashOutRequest(BaseModel):
    chips_returned: int  # Number of chips being returned

class RSVPRequest(BaseModel):
    status: str  # yes, maybe, no

class ThreadMessageCreate(BaseModel):
    content: str

class CancelGameRequest(BaseModel):
    reason: Optional[str] = None

class AddPlayerRequest(BaseModel):
    user_id: str

class AdminBuyInRequest(BaseModel):
    user_id: str
    amount: float

class RequestBuyInRequest(BaseModel):
    amount: float

class RequestCashOutRequest(BaseModel):
    chips_count: int

class AdminCashOutRequest(BaseModel):
    user_id: str
    chips_count: int

class EditPlayerChipsRequest(BaseModel):
    user_id: str
    chips_count: int
    reason: Optional[str] = None
