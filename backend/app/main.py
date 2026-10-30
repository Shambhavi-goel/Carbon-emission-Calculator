from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.analyze import router as analyze_router

app = FastAPI(
    title="Waste Carbon Emission Calculator API",
    description="Backend API with ONNX AI Model inference and PostgreSQL integration",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze_router)

@app.get("/")
@app.get("/api")
def root():
    return {
        "status": "online",
        "service": "Carbon Emission Calculator API",
        "version": "1.0.0"
    }
