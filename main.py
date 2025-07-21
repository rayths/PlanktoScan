import uvicorn
import asyncio
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from routers import api
from contextlib import asynccontextmanager
import logging

from utils import preload_models, get_cache_info, get_detailed_cache_info, clear_model_cache

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

async def background_model_preload():
    """Preload models in background"""
    logger.info("Starting background model preloading...")
    
    # Wait a bit to let the server fully start
    await asyncio.sleep(2)
    
    try:        
        cache_before = get_cache_info()
        logger.info(f"Cache BEFORE preloading: {cache_before}")
        
        # Preload models
        logger.info("Starting model preloading process...")
        loaded_count = preload_models()

        # Log cache status after preloading
        cache_after = get_cache_info()
        logger.info(f"Cache AFTER preloading: {cache_after}")

        # Log detailed cache info
        cache_info = get_detailed_cache_info()
        logger.info(f"Detailed Cache Info: {cache_info}")
        
        if loaded_count > 0:
            logger.info(f"Background preloading completed: {loaded_count} models ready")
        else:
            logger.warning(f"Background preloading completed but no models were loaded")
        
    except Exception as e:
        logger.error(f"Error in background preloading: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    # Startup events
    logger.info("Starting PlanktoScan Application...")
    
    # Start background preloading
    preload_task = asyncio.create_task(background_model_preload())
    
    logger.info("PlanktoScan Application ready! (Models loading in background)")
    
    yield  # Application runs here
    
    # Cleanup
    if not preload_task.done():
        logger.info("Cancelling background preload task...")
        preload_task.cancel()

    # Shutdown events
    logger.info("Shutting down PlanktoScan Application...")
    try:
        clear_model_cache()
        logger.info("Model cache cleared")
    except Exception as e:
        logger.error(f"Error during shutdown: {str(e)}")

app = FastAPI(
    title="Plankton Detection App",
    lifespan=lifespan
)

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

@app.on_event("startup")
async def startup_event():
    """Initialize application on startup"""
    logger.info("Starting PlanktoScan application...")
    
    # Preload models for better performance
    logger.info("Preloading models...")
    try:
        preloaded_count = preload_models()
        logger.info(f"Preloaded {preloaded_count} models successfully")
    except Exception as e:
        logger.error(f"Model preloading failed: {e}")
        logger.warning("Application will continue without preloaded models")
    
    logger.info("PlanktoScan startup completed!")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on application shutdown"""
    logger.info("Shutting down PlanktoScan application...")
    
    # Clear model cache
    from utils import clear_model_cache
    clear_model_cache()
    
    logger.info("PlanktoScan shutdown completed!")

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)