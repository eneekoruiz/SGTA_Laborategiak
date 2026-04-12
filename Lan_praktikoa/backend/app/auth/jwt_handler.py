"""JWT token sortzeko eta egiaztatzeko utilitateak."""
import jwt
from datetime import datetime, timedelta

from ..config import settings


def create_access_token(user_id: str):
    """Erabiltzaile IDrako JWT tokena sortu."""
    expiration = datetime.utcnow() + timedelta(hours=settings.JWT_EXPIRATION_HOURS)
    payload = {
        "sub": user_id,
        "exp": expiration,
        "iat": datetime.utcnow(),
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token


def verify_access_token(token: str) -> dict:
    """JWT tokena egiaztatu eta payload-a itzuli."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise ValueError("Tokena iraungi egin da") from exc
    except jwt.InvalidTokenError as exc:
        raise ValueError("Tokena baliogabea da") from exc

    return payload
