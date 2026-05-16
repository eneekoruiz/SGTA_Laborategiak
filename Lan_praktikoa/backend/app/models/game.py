"""Game state model."""
from typing import List, Dict, Optional
from enum import Enum
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from .city import CityState


class Difficulty(str, Enum):
    """Game difficulty levels."""

    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class AIPersonality(str, Enum):
    """AI personality types."""

    EXPANSIONIST = "expansionist"
    ECOLOGIST = "ecologist"
    INDUSTRIALIST = "industrialist"
    BALANCED = "balanced"
    TAX_COLLECTOR = "tax_collector"


class VictoryStatus(str, Enum):
    """Victory status values."""

    ONGOING = "ongoing"
    PLAYER_POPULATION = "player_population"
    PLAYER_SCORE = "player_score"
    PLAYER_RIVAL_BANKRUPT = "player_rival_bankrupt"
    AI_POPULATION = "ai_population"
    AI_SCORE = "ai_score"
    PLAYER_BANKRUPT = "player_bankrupt"
    PLAYER_ARKOLOGY_EXODUS = "player_arkology_exodus"
    PLAYER_WON = "player_won"
    AI_WON = "ai_won"


class CurrentDate(BaseModel):
    """Current game date."""

    year: int = Field(default=1900)
    month: int = Field(default=1, ge=1, le=12)


class DisasterAttacks(BaseModel):
    """Disaster attack tracking."""

    player_attacks_used: int = Field(default=0, ge=0)
    ai_attacks_used: int = Field(default=0, ge=0)
    last_player_attack_date: Optional[CurrentDate] = None
    last_ai_attack_date: Optional[CurrentDate] = None


class AIContext(BaseModel):
    """AI context for decision making."""

    conversation_history: List[Dict] = Field(default_factory=list)
    strategy_notes: str = Field(default="")


class MapData(BaseModel):
    """Map data model."""

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "size": {"width": 100, "height": 100},
            "tiles": [],
            "water_level": 2,
        }
    })

    size: Dict = Field(...)  # {"width": int, "height": int}
    tiles: List[List[Dict]] = Field(default_factory=list)  # 2D array of Tile objects
    water_level: int = Field(default=2)


class GameState(BaseModel):
    """Main game state data model."""

    model_config = ConfigDict(populate_by_name=True, use_enum_values=False, json_schema_extra={
        "example": {
            "user_id": "507f1f77bcf86cd799439011",
            "name": "My First Game",
            "scenario_id": "city_new",
            "created_at": "2024-01-15T10:30:00",
            "last_saved": "2024-01-15T10:30:00",
            "is_autosave": False,
            "current_date": {"year": 1900, "month": 1},
            "current_player": "player",
            "difficulty": "medium",
            "disasters_enabled": True,
            "player_city": {
                "name": "Player City",
                "owner": "player",
                "population": 0,
                "treasury": 10000,
                "months_bankrupt": 0,
            },
            "ai_city": {
                "name": "AI City",
                "owner": "ai",
                "population": 0,
                "treasury": 10000,
                "months_bankrupt": 0,
            },
            "ai_personality": "balanced",
            "map": {"size": {"width": 100, "height": 100}, "tiles": [], "water_level": 2},
            "disaster_attacks": {
                "player_attacks_used": 0,
                "ai_attacks_used": 0,
                "last_player_attack_date": None,
                "last_ai_attack_date": None,
            },
            "cheats_used": [],
            "victory_status": "ongoing",
        }
    })

    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    name: str
    scenario_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_saved: datetime = Field(default_factory=datetime.utcnow)
    is_autosave: bool = Field(default=False)
    current_date: CurrentDate = Field(default_factory=CurrentDate)
    current_player: str = Field(default="player")  # "player" or "ai"
    difficulty: Difficulty = Field(default=Difficulty.MEDIUM)
    disasters_enabled: bool = Field(default=True)
    player_city: CityState = Field(default_factory=lambda: CityState(name="Player City", owner="player"))
    ai_city: CityState = Field(default_factory=lambda: CityState(name="AI City", owner="ai"))
    ai_personality: AIPersonality = Field(default=AIPersonality.BALANCED)
    map: MapData = Field(...)
    disaster_attacks: DisasterAttacks = Field(default_factory=DisasterAttacks)
    cheats_used: List[str] = Field(default_factory=list)
    victory_status: VictoryStatus = Field(default=VictoryStatus.ONGOING)
    ai_context: AIContext = Field(default_factory=AIContext)


class GameCreate(BaseModel):
    """Game creation request model."""

    model_config = ConfigDict(use_enum_values=False, json_schema_extra={
        "example": {
            "name": "My First Game",
            "scenario_id": "city_new",
            "difficulty": "medium",
            "ai_personality": "balanced",
        }
    })

    name: str = Field(..., min_length=1, max_length=100)
    scenario_id: str
    difficulty: Difficulty = Field(default=Difficulty.MEDIUM)
    ai_personality: AIPersonality = Field(default=AIPersonality.BALANCED)


class CreateGameResponse(BaseModel):
    """Response model for POST /api/games."""

    game_id: str
    game_state: GameState


class GetGameResponse(BaseModel):
    """Response model for GET /api/games/{gameId}."""

    game_state: GameState
