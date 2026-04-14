"""API response models."""
from typing import Any, List, Dict, Optional
from pydantic import BaseModel


class APIResponse(BaseModel):
    """API erantzun estandar batentzako eredu basea."""

    success: bool
    message: str
    data: Optional[Any] = None


class AITurnResponse(BaseModel):
    """AI txandaren erantzun estandar batentzako eredu basea."""

    actions: List[Dict[str, Any]]
    reasoning: str