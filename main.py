from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import Dict, List
import json
import os

from backend.database import engine, Base, run_sqlite_migrations
from backend import models
from backend.routes import auth, spaces, bookings, reviews, ml, admin, owner

# Import models before create_all so SQLAlchemy registers every table.
run_sqlite_migrations()
Base.metadata.create_all(bind=engine)

app = FastAPI(title="SpaceSync API", version="1.0.0", description="Multi-space booking platform for India 🏟️")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(spaces.router, prefix="/spaces", tags=["Spaces"])
app.include_router(bookings.router, prefix="/bookings", tags=["Bookings"])
app.include_router(reviews.router, prefix="/reviews", tags=["Reviews"])
app.include_router(ml.router, prefix="/ml", tags=["ML"])
app.include_router(admin.router, prefix="/admin", tags=["Admin"])
app.include_router(owner.router, prefix="/owner", tags=["Owner"])

# Serve frontend static files if present
frontend_path = os.path.join(os.path.dirname(__file__), "frontend")
if os.path.exists(frontend_path):
    app.mount("/app", StaticFiles(directory=frontend_path, html=True), name="frontend")


# ── WebSocket: real-time slot availability ────────────────────────────────────

class SlotConnectionManager:
    """Manages WebSocket connections grouped by space_id."""

    def __init__(self):
        self.active: Dict[int, List[WebSocket]] = {}

    async def connect(self, space_id: int, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(space_id, []).append(ws)

    def disconnect(self, space_id: int, ws: WebSocket):
        if space_id in self.active:
            self.active[space_id].discard(ws) if hasattr(self.active[space_id], "discard") else None
            try:
                self.active[space_id].remove(ws)
            except ValueError:
                pass

    async def broadcast(self, space_id: int, message: dict):
        dead = []
        for ws in self.active.get(space_id, []):
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(space_id, ws)


manager = SlotConnectionManager()


@app.websocket("/ws/slots/{space_id}")
async def slot_websocket(space_id: int, websocket: WebSocket):
    await manager.connect(space_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Client can send: {"action": "book", "slot_date": "...", "slot_time": "..."}
            payload = json.loads(data)
            await manager.broadcast(space_id, {
                "event": "slot_update",
                "space_id": space_id,
                "slot_date": payload.get("slot_date"),
                "slot_time": payload.get("slot_time"),
                "status": payload.get("status", "booked"),
            })
    except WebSocketDisconnect:
        manager.disconnect(space_id, websocket)


@app.get("/")
def root():
    return {
        "message": "SpaceSync API is live 🏟️",
        "docs": "/docs",
        "redoc": "/redoc",
    }
