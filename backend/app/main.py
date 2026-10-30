from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.analyze import router as analyze_router
from app.config import settings

app = FastAPI(
    title="Waste Carbon Emission Calculator API",
    description="Backend API with TensorFlow Keras AI Model inference and PostgreSQL integration",
    version="1.0.0"
)

# Enable CORS for local development (Live Server / Python HTTP Server)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:3000",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(analyze_router)

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "Carbon Emission Calculator API",
        "version": "1.0.0",
        "docs": "/docs"
    }
