import uvicorn
import asyncio
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from routers import api
from contextlib import asynccontextmanager
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def background_model_preload():
    """Preload models in background"""
    logger.info("Starting background model preloading...")
    
    # Wait a bit to let the server fully start
    await asyncio.sleep(2)
    
    try:
        from utils import preload_models, get_detailed_cache_info
        
        # Preload models
        loaded_count = preload_models()

        # Log detailed cache info
        cache_info = get_detailed_cache_info()
        logger.info(f"Detailed Cache Info: {cache_info}")
        
        logger.info(f"Background preloading completed: {loaded_count} models ready")
        
    except Exception as e:
        logger.error(f"Error in background preloading: {str(e)}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    # Startup events
    logger.info("Starting PlanktoScan Application...")
    
    # Start background preloading
    asyncio.create_task(background_model_preload())
    
    logger.info("PlanktoScan Application ready! (Models loading in background)")
    
    yield  # Application runs here
    
    # Shutdown events
    logger.info("Shutting down PlanktoScan Application...")
    try:
        from utils import clear_model_cache
        clear_model_cache()
        logger.info("Model cache cleared")
    except Exception as e:
        logger.error(f"Error during shutdown: {str(e)}")

app = FastAPI(title="Plankton Detection App")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get('/favicon.ico', include_in_schema=False)
async def favicon():
    return FileResponse('static/assets/judul.png')

app.include_router(api.router)

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)