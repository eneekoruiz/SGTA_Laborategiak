"""MongoDB konexio eta bilduma laguntzaileak."""
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING

from ..config import settings

client = AsyncIOMotorClient(settings.MONGODB_URI)
db = client[settings.MONGODB_DB]


def get_database():
    """Datu-basearen instantzia itzuli."""
    return db


def get_users_collection():
    """Erabiltzaileen bilduma itzuli."""
    return db["users"]


def get_games_collection():
    """Jokoen bilduma itzuli."""
    return db["games"]


async def init_db():
    """Datu-basearen indeizeak hasieratu."""
    users = get_users_collection()
    games = get_games_collection()

    await users.create_index("email", unique=True)
    await users.create_index("username", unique=True)
    await games.create_index([("user_id", ASCENDING), ("last_saved", ASCENDING)])
