"""FastAPI bideetarako autentikazio mendekotasunak."""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from ..db.database import get_users_collection
from .jwt_handler import verify_access_token

security = HTTPBearer()


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """JWT bidezko egiaztapena egin eta erabiltzaile egokia lortu."""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ez zaude autentifikatuta",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        payload = verify_access_token(token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload-a baliogabea da",
            headers={"WWW-Authenticate": "Bearer"},
        )

    users_collection = get_users_collection()
    user = await users_collection.find_one({"_id": user_id})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Erabiltzailea ez da aurkitu",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_current_user_id(current_user: dict = Depends(get_current_user)) -> str:
    return str(current_user["_id"])
