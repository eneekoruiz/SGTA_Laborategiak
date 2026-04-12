"""Erabiltzaile ereduak eta balidazioak."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, EmailStr, ConfigDict, field_validator


class User(BaseModel):
    """Erabiltzailea deskribatzen duen datu eredua."""

    model_config = ConfigDict(populate_by_name=True)

    id: Optional[str] = Field(None, alias="_id")
    username: str = Field(..., min_length=3, max_length=30)
    email: EmailStr
    password_hash: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None
    games_count: int = Field(default=0, ge=0)

    @field_validator("username")
    @classmethod
    def username_alphanumeric(cls, v):
        """Izen erabiltzaileak alfanumerikoak eta beheraxeak soilik izan behar ditu."""
        if not v.replace("_", "").isalnum():
            raise ValueError("Erabiltzaile izena alfanumerikoa eta beheraxeak bakarrik izan behar ditu")
        return v


class UserCreate(BaseModel):
    """Erabiltzaile berria sortzeko eskaera eredua."""

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "username": "john_doe",
            "email": "john@example.com",
            "password": "securepass123",
        }
    })

    username: str = Field(..., min_length=3, max_length=30)
    email: EmailStr
    password: str = Field(..., min_length=8)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        """Pasahitzak gutxienez letra eta digit bat izan behar ditu."""
        if not any(c.isalpha() for c in v):
            raise ValueError("Pasahitzak gutxienez letra bat izan behar du")
        if not any(c.isdigit() for c in v):
            raise ValueError("Pasahitzak gutxienez digit bat izan behar du")
        return v


class UserLogin(BaseModel):
    """Erabiltzailearen sarrera eskaera eredua."""

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "email": "john@example.com",
            "password": "securepass123",
        }
    })

    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """Erabiltzailearen erantzun eredua."""

    model_config = ConfigDict(populate_by_name=True, json_schema_extra={
        "example": {
            "id": "507f1f77bcf86cd799439011",
            "username": "john_doe",
            "email": "john@example.com",
            "created_at": "2024-01-15T10:30:00",
        }
    })

    id: str = Field(alias="_id")
    username: str
    email: str
    created_at: datetime


class TokenResponse(BaseModel):
    """Tokenaren erantzun eredua."""

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            "token_type": "bearer",
            "user": {
                "id": "507f1f77bcf86cd799439011",
                "username": "john_doe",
                "email": "john@example.com",
                "created_at": "2024-01-15T10:30:00",
            },
        }
    })

    access_token: str
    token_type: str = "bearer"
    user: UserResponse
