import os
import uvicorn
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from routers import api
from utils import preload_models, get_cache_info, clear_model_cache

# ============================================================================
# LOGGING CONFIGURATION
# ============================================================================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# BACKGROUND TASKS
# ============================================================================

async def background_model_preload():
    """Preload models in background"""
    logger.info("Starting background model preloading...")
    
    # Wait for server fully start
    await asyncio.sleep(2)
    
    try:
        # Log initial cache status   
        cache_before = get_cache_info()
        logger.info(f"Cache before preloading: {cache_before['cache_size']} models")
        
        # Preload models
        loaded_count = preload_models()

        # Log final cache status
        cache_after = get_cache_info()
        logger.info(f"Cache after preloading: {cache_after['cache_size']} models")
        
        if loaded_count > 0:
            logger.info(f"Background preloading completed: {loaded_count} models ready")
        else:
            logger.warning(f"Background preloading completed but no models were loaded")
        
    except Exception as e:
        logger.error(f"Error in background preloading: {str(e)}")

# ============================================================================
# APPLICATION LIFECYCLE
# ============================================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    # Startup
    logger.info("Starting PlanktoScan Application...")
    
    # Start background model preloading
    preload_task = asyncio.create_task(background_model_preload())
    
    logger.info("PlanktoScan Application ready! (Models loading in background)")
    
    yield  # Application runs here
    
    # Shutdown
    logger.info("Shutting down PlanktoScan Application...")
    
    # Cancel background task if still running
    if not preload_task.done():
        logger.info("Cancelling background preload task...")
        preload_task.cancel()
        try:
            await preload_task
        except asyncio.CancelledError:
            logger.info("Background preload task cancelled")

    # Clear model cache
    try:
        clear_model_cache()
        logger.info("Model cache cleared")
    except Exception as e:
        logger.error(f"Error during shutdown: {str(e)}")

    logger.info("PlanktoScan Application shutdown complete")

# ============================================================================
# FASTAPI APPLICATION SETUP
# ============================================================================
app = FastAPI(
    title="Plankton Detection App",
    description="Plankton classification system",
    version="1.0.0",
    lifespan=lifespan
)

# ============================================================================
# MIDDLEWARE CONFIGURATION
# ============================================================================

# Session middleware for user authentication
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("MIDDLEWARE_KEY"),
    max_age=86400,  # 24 hours
    same_site="lax",
    https_only=False,  # Set to True in production with HTTPS
    session_cookie="planktoscan_session"
)

# CORS Middleware for cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ============================================================================
# STATIC FILES AND ROUTES
# ============================================================================
# Mount static files directory
app.mount("/static", StaticFiles(directory="static"), name="static")

# Favicon endpoint
@app.get('/favicon.ico', include_in_schema=False)
async def favicon():
    """Serve the favicon icon"""
    return FileResponse('static/assets/icon.png')

# Health check endpoint
@app.get("/health", include_in_schema=False)
async def health_check():
    """Simple health check endpoint"""
    cache_info = get_cache_info()
    return {
        "status": "healthy",
        "models_cached": cache_info["cache_size"],
        "labels_cached": cache_info["labels_cached"]
    }

# Include API router
app.include_router(api.router)

# ============================================================================
# APPLICATION ENTRY POINT
# ============================================================================
if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True, log_level="info")