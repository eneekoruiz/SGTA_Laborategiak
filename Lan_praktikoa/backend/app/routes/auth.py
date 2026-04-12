"""Autentikazio bideak MongoDB eta JWT-rekin."""
from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime
from uuid import uuid4

from ..models import UserCreate, UserLogin, UserResponse, APIResponse
from ..db.database import get_users_collection
from ..auth.password import hash_password, verify_password
from ..auth.jwt_handler import create_access_token
from ..auth.dependencies import get_current_user

router = APIRouter()


@router.post("/register", response_model=APIResponse, status_code=status.HTTP_201_CREATED, tags=["Authentication"])
async def register(user: UserCreate):
    """Erabiltzaile berria erregistratu eta JWT token bat itzuli."""
    users_collection = get_users_collection()

    existing_user = await users_collection.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Helbide elektronikoa jadanik erregistratuta dago",
        )

    user_id = f"user_{uuid4().hex}"
    now = datetime.utcnow()

    user_doc = {
        "_id": user_id,
        "username": user.username,
        "email": user.email,
        "password_hash": hash_password(user.password),
        "created_at": now,
        "last_login": None,
        "games_count": 0,
    }

    await users_collection.insert_one(user_doc)

    token = create_access_token(user_id)

    return APIResponse(
        success=True,
        message="Erabiltzailea ongi sortu da",
        data={
            "access_token": token,
            "token_type": "bearer",
            "user": UserResponse(
                id=user_doc["_id"],
                username=user_doc["username"],
                email=user_doc["email"],
                created_at=user_doc["created_at"],
            ).model_dump(),
        },
    )


@router.post("/login", response_model=APIResponse, tags=["Authentication"])
async def login(credentials: UserLogin):
    """Erabiltzailearen sarrerako kredentzialak egiaztatu eta JWT token bat itzuli."""
    users_collection = get_users_collection()

    user_doc = await users_collection.find_one({"email": credentials.email})
    if not user_doc or not verify_password(credentials.password, user_doc.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Posta elektronikoa edo pasahitza eskuzkoa da",
        )

    await users_collection.update_one(
        {"_id": user_doc["_id"]},
        {"$set": {"last_login": datetime.utcnow()}},
    )

    token = create_access_token(user_doc["_id"])

    return APIResponse(
        success=True,
        message="Sarrera ongi burutu da",
        data={
            "access_token": token,
            "token_type": "bearer",
            "user": UserResponse(
                id=user_doc["_id"],
                username=user_doc["username"],
                email=user_doc["email"],
                created_at=user_doc["created_at"],
            ).model_dump(),
        },
    )


@router.get("/profile", response_model=APIResponse, tags=["Authentication"])
async def get_profile(current_user: dict = Depends(get_current_user)):
    """Autentikatutako erabiltzailearen profila itzuli."""
    return APIResponse(
        success=True,
        message="Erabiltzailearen profila lortu da",
        data={
            "user": UserResponse(
                id=current_user["_id"],
                username=current_user["username"],
                email=current_user["email"],
                created_at=current_user["created_at"],
            ).model_dump(),
        },
    )
