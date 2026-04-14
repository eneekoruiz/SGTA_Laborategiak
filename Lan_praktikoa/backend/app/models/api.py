"""API response models."""
from typing import Any, List, Dict, Optional, Literal
from pydantic import BaseModel


class APIResponse(BaseModel):
    """API erantzun estandar batentzako eredu basea."""

    success: bool
    message: str
    data: Optional[Any] = None
    error_type: Optional[str] = None  # ValidationError, AuthError, NotFoundError, ServerError
    fields: Optional[List[str]] = None  # Field names affected by validation error
    details: Optional[Dict[str, Any]] = None  # Additional error details


class ErrorDetail(BaseModel):
    """Error detail for validation errors."""
    field: str
    message: str
    error_type: str


class AITurnResponse(BaseModel):
    """AI txandaren erantzun estandar batentzako eredu basea."""

    actions: List[Dict[str, Any]]
    reasoning: str