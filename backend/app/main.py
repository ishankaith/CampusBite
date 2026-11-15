from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base
from . import models
from .ai_routes import router as ai_router
from .review_routes import router as review_router
from .routes import router as restaurant_router
from .order_routes import router as order_router
from .delivery_routes import router as delivery_router
from .auth_routes import router as auth_router
from .user_routes import router as user_router
from .admin_routes import router as admin_router

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="CampusBite API",
    description="Backend API for the CampusBite food ordering application",
    version="1.0.0"
) 

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(restaurant_router) 
app.include_router(order_router) 
app.include_router(delivery_router)
app.include_router(auth_router) 
app.include_router(user_router)
app.include_router(admin_router)
app.include_router(review_router)

@app.get("/")
def home():
    return {
        "message": "Welcome to CampusBite API!",
        "status": "Running successfully"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.get("/database-status")
def database_status():
    return {
        "status": "Database connected",
        "tables": list(Base.metadata.tables.keys())
    }
app.include_router(ai_router)
