import os
import uvicorn
import asyncio
import logging
import psutil 
import gc
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Load environment variables first
load_dotenv()

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from routers import api
from utils import preload_models_async, get_cache_info, clear_model_cache

# ============================================================================
# LOGGING CONFIGURATION
# ============================================================================

logger = logging.getLogger(__name__)

# ============================================================================
# ENVIRONMENT VALIDATION
# ============================================================================

# Validate critical environment variables
required_env_vars = [
    'FIREBASE_API_KEY',
    'FIREBASE_PROJECT_ID', 
    'FIREBASE_AUTH_DOMAIN',
    'MIDDLEWARE_KEY'
]

missing_vars = [var for var in required_env_vars if not os.getenv(var)]
if missing_vars:
    logger.error(f"Missing required environment variables: {missing_vars}")
    raise RuntimeError(f"Missing environment variables: {missing_vars}")

logger.info("Environment variables validated successfully")

# ============================================================================
# BACKGROUND TASKS
# ============================================================================

async def background_model_preload():
    """Enhanced background model preloading"""
    logger.info("Starting enhanced background model preloading...")
    
    # Wait for server to fully start
    await asyncio.sleep(3)
    
    try:
        # Log initial system state
        memory_before = psutil.virtual_memory().percent
        cache_before = get_cache_info()

        logger.info(f"System memory usage before preloading: {memory_before:.1f}%")
        logger.info(f"Cache before preloading: {cache_before['cached_models']} models")
        
        # Run enhanced preloading
        preload_start = asyncio.get_event_loop().time()
        preload_results = preload_models_async()
        preload_duration = asyncio.get_event_loop().time() - preload_start
        
        # Log final status
        memory_after = psutil.virtual_memory().percent
        cache_after = get_cache_info()
        
        logger.info(f"System memory usage after preloading: {memory_after:.1f}%")
        logger.info(f"Models cached after preloading: {cache_after['cached_models']}")
        logger.info(f"Memory increase: {memory_after - memory_before:.1f}%")
        logger.info(f"Actual preloading duration: {preload_duration:.2f}s")
        
        # Log detailed results
        success_count = len(preload_results['success'])
        failed_count = len(preload_results['failed'])
        skipped_count = len(preload_results['skipped'])

        if success_count > 0:
            logger.info(f"Successfully preloaded {success_count} models:")
            for model_info in preload_results['success']:
                logger.info(f"  - {model_info['name']} ({model_info['load_time']})")
        
        if failed_count > 0:
            logger.warning(f"Failed to preload {failed_count} models:")
            for failed in preload_results['failed']:
                logger.warning(f"  - {failed}")
        
        if skipped_count > 0:
            logger.info(f"Skipped {skipped_count} models:")
            for skipped in preload_results['skipped']:
                logger.info(f"  - {skipped}")
        
        logger.info(f"Background preloading completed in {preload_results['total_time']}")
        
        return preload_results
        
    except Exception as e:
        logger.error(f"Error in enhanced background preloading: {str(e)}")

# ============================================================================
# APPLICATION LIFECYCLE
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    # Startup
    startup_time = asyncio.get_event_loop().time()
    logger.info("Starting PlanktoScan Application...")
    
    try:
        # System info logging
        memory_info = psutil.virtual_memory()
        logger.info(f"System Memory: {memory_info.total // (1024**3)}GB total, {memory_info.available // (1024**3)}GB available")
        logger.info(f"Memory usage: {memory_info.percent:.1f}%")
        
        # Initialize directories
        os.makedirs("static/uploads", exist_ok=True)
        os.makedirs("static/uploads/temp", exist_ok=True)
        os.makedirs("static/uploads/results", exist_ok=True)
        logger.info("Upload directories initialized")
        
        # Start background preloading (non-blocking)
        preload_task = asyncio.create_task(background_model_preload())
        
        startup_duration = asyncio.get_event_loop().time() - startup_time
        logger.info(f"Application startup completed in {startup_duration:.2f}s")

        yield
    
    except Exception as e:
        logger.error(f"Startup error: {str(e)}")
        raise e
    
    finally:
        # Shutdown
        shutdown_time = asyncio.get_event_loop().time()
        logger.info("Shutting down PlanktoScan Application...")
        
        try:
            # Cancel background tasks
            if 'preload_task' in locals() and not preload_task.done():
                preload_task.cancel()
                try:
                    await preload_task
                except asyncio.CancelledError:
                    logger.info("Background preload task cancelled")
            
            # Cache cleanup
            logger.info("Cleaning up model cache...")
            cache_before_cleanup = get_cache_info()
            logger.info(f"Models in cache before cleanup: {cache_before_cleanup['cached_models']}")
            
            clear_model_cache()
            
            # Force garbage collection
            collected = gc.collect()
            logger.info(f"Garbage collection freed {collected} objects")

            # Final memory report
            final_memory = psutil.virtual_memory().percent
            logger.info(f"Final memory usage: {final_memory:.1f}%")

            shutdown_duration = asyncio.get_event_loop().time() - shutdown_time
            logger.info(f"Application shutdown completed in {shutdown_duration:.2f}s")

        except Exception as e:
            logger.error(f"Shutdown error: {str(e)}")

# ============================================================================
# FASTAPI APPLICATION SETUP
# ============================================================================
app = FastAPI(
    title="PlanktoScan - Plankton Identification System",
    description="Plankton identification system",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
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
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# STATIC FILES AND CORE ROUTES
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
    try:
        cache_info = get_cache_info()
        memory = psutil.virtual_memory()

        return {
            "status": "healthy",
            "timestamp": asyncio.get_event_loop().time(),
            "cache": {
                "models_cached": cache_info["cached_models"],
                "max_cache_size": cache_info.get("max_cache_size", "unknown"),
                "system_memory_usage": cache_info.get("system_memory_usage", "unknown")
            },
            "system":{
                "memory_percent": f"{memory.percent:.1f}%",
                "memory_available_gb": f"{memory.available // (1024**3):.1f}GB"
            },
            "environment": {
                "firebase_configured": bool(os.getenv("FIREBASE_PROJECT_ID")),
                "middleware_configured": bool(os.getenv("MIDDLEWARE_KEY"))
            }
        }
    except Exception as e:
        logger.error(f"Health check error: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": asyncio.get_event_loop().time()
        }
    
@app.get("/api/system-info")
async def system_info():
    """Detailed system information endpoint"""
    try:
        memory = psutil.virtual_memory()
        cache_info = get_cache_info()
        
        return {
            "system": {
                "memory": {
                    "total_gb": f"{memory.total // (1024**3):.1f}",
                    "available_gb": f"{memory.available // (1024**3):.1f}",
                    "used_percent": f"{memory.percent:.1f}%"
                }
            },
            "cache": cache_info,
            "environment": {
                "variables_loaded": {
                    "FIREBASE_API_KEY": bool(os.getenv("FIREBASE_API_KEY")),
                    "FIREBASE_PROJECT_ID": bool(os.getenv("FIREBASE_PROJECT_ID")),
                    "FIREBASE_AUTH_DOMAIN": bool(os.getenv("FIREBASE_AUTH_DOMAIN")),
                    "MIDDLEWARE_KEY": bool(os.getenv("MIDDLEWARE_KEY"))
                }
            }
        }
    except Exception as e:
        return {"error": str(e)}

# Include API router
app.include_router(api.router)

# ============================================================================
# APPLICATION ENTRY POINT
# ============================================================================
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info",
        access_log=True
    )