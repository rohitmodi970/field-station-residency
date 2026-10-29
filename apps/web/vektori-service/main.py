import os
import sqlite3
from typing import List, Optional

import psycopg2
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Vektori Production API")

DATABASE_URL = os.getenv("DATABASE_URL", "")
API_KEY = os.getenv("API_KEY", "")
SQLITE_DB_PATH = os.getenv("SQLITE_DB_PATH", "vektori.sqlite3")


class Message(BaseModel):
    role: str
    content: str


class AddRequest(BaseModel):
    user_id: str
    session_id: Optional[str] = None
    messages: List[Message]


class SearchRequest(BaseModel):
    user_id: str
    query: str


def get_conn():
    if DATABASE_URL:
        return psycopg2.connect(DATABASE_URL)
    return sqlite3.connect(SQLITE_DB_PATH)


def get_placeholder():
    return "?" if not DATABASE_URL else "%s"


def init_db():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS memory_items (
            id INTEGER PRIMARY KEY,
            user_id TEXT NOT NULL,
            session_id TEXT,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()
    cur.close()
    conn.close()


@app.on_event("startup")
def startup_event():
    try:
        init_db()
        print("[vektori] DB initialized successfully")
    except Exception as e:
        print(f"[vektori] WARNING: DB init failed at startup: {e}")
        print("[vektori] App will still run - DB errors will surface per request")



@app.get("/health")
def health():
    return {"ok": True, "status": "healthy"}


@app.post("/add")
def add(payload: AddRequest, authorization: Optional[str] = Header(None)):
    if API_KEY and authorization != f"Bearer {API_KEY}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    conn = get_conn()
    cur = conn.cursor()
    placeholder = get_placeholder()

    for msg in payload.messages:
        cur.execute(
            f"INSERT INTO memory_items (user_id, session_id, role, content) VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder})",
            (payload.user_id, payload.session_id, msg.role, msg.content),
        )

    conn.commit()
    cur.close()
    conn.close()

    return {"ok": True, "stored": len(payload.messages)}


@app.get("/search")
def search(user_id: str, q: str, authorization: Optional[str] = Header(None)):
    if API_KEY and authorization != f"Bearer {API_KEY}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    conn = get_conn()
    cur = conn.cursor()
    placeholder = get_placeholder()
    cur.execute(
        f"""
        SELECT role, content
        FROM memory_items
        WHERE user_id = {placeholder}
          AND LOWER(content) LIKE LOWER({placeholder})
        ORDER BY created_at DESC
        LIMIT 10
        """,
        (user_id, f"%{q}%"),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    return {
        "facts": [{"text": row[1], "score": 1.0} for row in rows],
        "episodes": [],
        "sentences": [],
    }