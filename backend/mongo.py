from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "ascendai")

client: AsyncIOMotorClient = None
db = None

async def connect_db():
    global client, db
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DB_NAME]
    # Create indexes for fast lookups
    await db.users.create_index("email", unique=True)
    await db.users.create_index("username", unique=True)
    await db.users.create_index("verification_token")
    await db.sessions.create_index("user_id")
    await db.goals.create_index("session_id")
    await db.tasks.create_index("session_id")
    await db.tasks.create_index("goal_id")
    await db.stats.create_index([("user_id", 1), ("session_id", 1)])
    await db.notes.create_index([("user_id", 1), ("session_id", 1)], unique=True)
    print("✅ Connected to MongoDB Atlas")

async def close_db():
    global client
    if client:
        client.close()

def get_db():
    return db
