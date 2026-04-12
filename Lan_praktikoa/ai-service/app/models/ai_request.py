from pydantic import BaseModel, Field
from typing import Dict, Any

class AIRequest(BaseModel):
    """
    AI zerbitzuari bidaltzen zaion eskaera eredua.

    Attributes:
        game_state (dict): Jokoaren uneko egoera JSON formatuan.
        historia (list): Azken 5 hilabeteetako laburpena.
    """
    game_state: Dict[str, Any] = Field(..., description="Jokoaren uneko egoera JSON formatuan")
    historia: list = Field(..., description="Azken 5 hilabeteetako laburpena")