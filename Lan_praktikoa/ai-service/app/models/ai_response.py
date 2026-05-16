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
    Formatua hibridoa da: Backend-erako 'mota/parametroak' eta Frontend-erako propietate planoak.
    """
    mota: str = Field(..., description="Ekintzaren mota (Backend)")
    parametroak: Dict[str, Any] = Field(..., description="Ekintzaren parametroak (Backend)")
    
    # Propietate planoak Frontend-erako (Hibridoa)
    type: Optional[str] = Field(None, description="Ekintzaren mota (Frontend)")
    position: Optional[Dict[str, int]] = Field(None, description="Posizioa (Frontend)")
    building_type: Optional[str] = Field(None, description="Eraikin mota (Frontend)")
    zone_type: Optional[str] = Field(None, description="Zona mota (Frontend)")
    infrastructure_type: Optional[str] = Field(None, description="Azpiegitura mota (Frontend)")
    size: Optional[Dict[str, int]] = Field(None, description="Tamaina (Frontend)")
    start_position: Optional[Dict[str, int]] = Field(None, description="Hasierako posizioa (Frontend)")
    end_position: Optional[Dict[str, int]] = Field(None, description="Amaierako posizioa (Frontend)")

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