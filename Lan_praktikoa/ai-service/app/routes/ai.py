import logging
from fastapi import APIRouter, HTTPException
from app.models.ai_request import AIRequest
from app.models.ai_response import AIResponse
from app.services.ai_service import AIService

logger = logging.getLogger("ai_routes")

router = APIRouter()

@router.post("/", response_model=AIResponse, summary="AA-k hurrengo ekintzak erabakitzen ditu")
async def get_next_action(eskaera: AIRequest) -> AIResponse:
    """
    Backend-etik jokoaren uneko egoera eta historia jasotzen ditu, 
    eta AA-ren hurrengo ekintzak eta analisia itzultzen ditu.
    """
    logger.info("Eskaera berria jaso da AA zerbitzuan.")
    
    try:
        # Zerbitzua instantziatu
        ai_service = AIService()
        
        # AA-ren erantzuna lortu
        erantzuna = await ai_service.get_ai_response(eskaera.game_state, eskaera.historia)
        
        logger.info("AA-k erantzuna ondo sortu eta balioztatu du.")
        return erantzuna
        
    except Exception as e:
        logger.error(f"Errore larria gertatu da AA zerbitzuan prozesatzean: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Zerbitzariaren barne-errorea AA prozesatzean. Ezin izan da erantzuna sortu."
        )