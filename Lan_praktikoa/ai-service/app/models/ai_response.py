from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class Reasoning(BaseModel):
    """
    AA-ren reasoning eta analisiaren eredua.

    Attributes:
        testuingurua (str): AA-ren testuinguruaren azalpena.
        analisia (str): AA-ren ekintzen analisia.
    """
    testuingurua: str = Field(..., description="AA-ren testuinguruaren azalpena")
    analisia: str = Field(..., description="AA-ren ekintzen analisia")

class Action(BaseModel):
    """
    AA-k proposatutako ekintzaren eredua.

    Attributes:
        mota (str): Ekintzaren mota.
        parametroak (dict): Ekintzaren parametroak.
    """
    mota: str = Field(..., description="Ekintzaren mota")
    parametroak: Dict[str, Any] = Field(..., description="Ekintzaren parametroak")

class AIResponse(BaseModel):
    """
    AI zerbitzuaren erantzun eredua.

    Attributes:
        ekintzak (List[Action]): AA-k proposatutako ekintzak.
        reasoning (Reasoning): AA-ren reasoning eta analisia.
        success (bool): Eragiketaren arrakasta.
        erroreak (Optional[List[str]]): Erroreen zerrenda, badaude.
    """
    ekintzak: List[Action] = Field(..., description="AA-k proposatutako ekintzak")
    reasoning: Reasoning = Field(..., description="AA-ren reasoning eta analisia")
    success: bool = Field(..., description="Eragiketaren arrakasta")
    erroreak: Optional[List[str]] = Field(None, description="Erroreen zerrenda, badaude")