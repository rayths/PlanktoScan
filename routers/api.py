import os
import time
from utils import predict_img, get_cache_info, get_detailed_cache_info, get_model_mapping, MODEL_CACHE, generate_stored_filename, save_upload_to_database, get_image_metadata
from uuid import uuid4
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, Request, Response, Depends
from sqlalchemy.orm import Session
from database import get_db
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi import HTTPException

import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()
templates = Jinja2Templates(directory="templates")

result_cache = {}

@router.get("/cache-status")
async def get_cache_status():
    """Get current model cache status"""
    try:
        cache_info = get_cache_info()
        detailed_info = get_detailed_cache_info()
        
        return JSONResponse(content={
            "status": "success",
            "cache_info": cache_info,
            "detailed_info": detailed_info,
            "cache_keys": list(MODEL_CACHE.keys()),
            "timestamp": time.time()
        })
    except Exception as e:
        logger.error(f"Error getting cache status: {str(e)}")
        return JSONResponse(status_code=500, content={
            "status": "error",
            "error": str(e)
        })

@router.get("/preload-status")
async def get_preload_status():
    """Check if models are preloaded"""
    try:
        model_mapping = get_model_mapping()
        priority_models = ['efficientnetv2b0', 'mobilenetv2', 'resnet50']
        
        preload_status = {}
        for model_name in priority_models:
            if model_name in model_mapping:
                model_path, display_name = model_mapping[model_name]
                preload_status[model_name] = {
                    "display_name": display_name,
                    "path": model_path,
                    "file_exists": os.path.exists(model_path),
                    "cached": model_path in MODEL_CACHE
                }
        
        return JSONResponse(content={
            "status": "success",
            "preload_status": preload_status,
            "total_cached": len(MODEL_CACHE)
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={
            "status": "error",
            "error": str(e)
        })

@router.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Main dashboard route with welcome popup on first visit"""
    try:
        # Clean up previous uploads
        for file in os.listdir('static/uploads/temp'):
            os.remove(os.path.join('static/uploads/temp', file))
    except Exception as e:
        logger.warning(f"Error cleaning up uploads: {str(e)}")
    
    # Check if user has seen welcome popup before
    welcome_seen = request.cookies.get("welcome_seen")
    show_welcome = not bool(welcome_seen)
    
    logger.info(f"Welcome popup check - Cookie: {welcome_seen}, Show welcome: {show_welcome}")
    
    return templates.TemplateResponse("dashboard.html", {
        "request": request, 
        "show_welcome": show_welcome
    })

@router.post("/set-welcome-seen")
async def set_welcome_seen(response: Response):
    """Set cookie when welcome popup is closed"""
    logger.info("Setting welcome_seen cookie")
    response.set_cookie("welcome_seen", "true", max_age=24*60*60)  # 1 day
    return JSONResponse(content={"message": "Welcome popup marked as seen"})

@router.get("/reset-welcome")
async def reset_welcome(response: Response):
    """Reset welcome popup cookie"""
    response.delete_cookie("welcome_seen")
    return JSONResponse(content={"message": "Welcome popup reset successfully"})

@router.get("/check-cookie")
async def check_cookie(request: Request):
    """Check current cookie status"""
    welcome_seen = request.cookies.get("welcome_seen")
    all_cookies = dict(request.cookies)
    return JSONResponse(content={
        "welcome_seen": welcome_seen,
        "all_cookies": all_cookies,
        "show_welcome": not bool(welcome_seen)
    })

@router.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    if not file.filename:
        return JSONResponse(status_code=400, content={"error": "No selected file"})

    path = os.path.join("static/uploads/temp", file.filename)
    with open(path, "wb") as f:
        f.write(await file.read())

    return JSONResponse(content={
        "img_path": path
    })

@router.get("/admin/database-info")
async def get_database_info(db: Session = Depends(get_db)):
    """Get database information and table details"""
    try:
        from database import get_database_info
        from sqlalchemy import inspect, text
        
        # Get basic database info
        db_info = get_database_info()
        
        # Get table information
        inspector = inspect(db.bind)
        tables = inspector.get_table_names()
        
        table_details = {}
        for table in tables:
            columns = inspector.get_columns(table)
            table_details[table] = {
                "columns": [{"name": col["name"], "type": str(col["type"])} for col in columns],
                "column_count": len(columns)
            }
        
        # Get record counts
        record_counts = {}
        for table in tables:
            try:
                result = db.execute(text(f"SELECT COUNT(*) FROM {table}"))
                count = result.scalar()
                record_counts[table] = count
            except Exception as e:
                record_counts[table] = f"Error: {str(e)}"
        
        return JSONResponse(content={
            "database_info": db_info,
            "tables": table_details,
            "record_counts": record_counts,
            "total_tables": len(tables)
        })
        
    except Exception as e:
        logger.error(f"Error getting database info: {str(e)}")
        return JSONResponse(status_code=500, content={"error": str(e)})

@router.get("/admin/database-test")
async def test_database_connection(db: Session = Depends(get_db)):
    """Test database connection and basic operations"""
    try:
        from database import PlanktonUpload
        from sqlalchemy import text
        
        test_results = {
            "connection": "Success",
            "table_exists": False,
            "sample_data": None,
            "total_records": 0,
            "recent_uploads": []
        }
        
        # Test basic connection
        db.execute(text("SELECT 1"))
        
        # Check if table exists and get sample data
        try:
            total_count = db.query(PlanktonUpload).count()
            test_results["table_exists"] = True
            test_results["total_records"] = total_count
            
            # Get recent uploads (last 5)
            recent = db.query(PlanktonUpload)\
                      .order_by(PlanktonUpload.upload_date.desc())\
                      .limit(5)\
                      .all()
            
            test_results["recent_uploads"] = [
                {
                    "id": upload.id,
                    "filename": upload.stored_filename,
                    "class": upload.top_class,
                    "probability": f"{upload.top_probability:.2%}",
                    "location": upload.location,
                    "date": upload.upload_date.isoformat() if upload.upload_date else None
                }
                for upload in recent
            ]
            
        except Exception as table_error:
            test_results["table_error"] = str(table_error)
        
        return JSONResponse(content={
            "status": "success",
            "test_results": test_results,
            "timestamp": time.time()
        })
        
    except Exception as e:
        logger.error(f"Database test failed: {str(e)}")
        return JSONResponse(status_code=500, content={
            "status": "error",
            "error": str(e),
            "timestamp": time.time()
        })

@router.get("/admin/database-stats")
async def get_detailed_database_stats(db: Session = Depends(get_db)):
    """Get detailed database statistics"""
    try:
        from database import PlanktonUpload
        from sqlalchemy import func, text
        
        stats = {}
        
        # Basic counts
        total_uploads = db.query(PlanktonUpload).count()
        stats["total_uploads"] = total_uploads
        
        if total_uploads > 0:
            # Classification statistics
            classification_stats = db.query(
                PlanktonUpload.top_class,
                func.count(PlanktonUpload.top_class).label('count'),
                func.avg(PlanktonUpload.top_probability).label('avg_confidence')
            ).group_by(PlanktonUpload.top_class)\
             .order_by(func.count(PlanktonUpload.top_class).desc())\
             .all()
            
            stats["classifications"] = [
                {
                    "class": item[0],
                    "count": item[1],
                    "percentage": round((item[1] / total_uploads) * 100, 1),
                    "avg_confidence": round(item[2], 3) if item[2] else 0
                }
                for item in classification_stats
            ]
            
            # Location statistics
            location_stats = db.query(
                PlanktonUpload.location,
                func.count(PlanktonUpload.location).label('count')
            ).group_by(PlanktonUpload.location)\
             .order_by(func.count(PlanktonUpload.location).desc())\
             .all()
            
            stats["locations"] = [
                {
                    "location": item[0],
                    "count": item[1],
                    "percentage": round((item[1] / total_uploads) * 100, 1)
                }
                for item in location_stats
            ]
            
            # Model usage statistics
            model_stats = db.query(
                PlanktonUpload.model_used,
                func.count(PlanktonUpload.model_used).label('count')
            ).group_by(PlanktonUpload.model_used)\
             .order_by(func.count(PlanktonUpload.model_used).desc())\
             .all()
            
            stats["models"] = [
                {
                    "model": item[0],
                    "count": item[1],
                    "percentage": round((item[1] / total_uploads) * 100, 1)
                }
                for item in model_stats
            ]
            
            # Performance statistics
            performance_stats = db.query(
                func.avg(PlanktonUpload.processing_time).label('avg_processing_time'),
                func.min(PlanktonUpload.processing_time).label('min_processing_time'),
                func.max(PlanktonUpload.processing_time).label('max_processing_time'),
                func.avg(PlanktonUpload.file_size).label('avg_file_size')
            ).first()
            
            stats["performance"] = {
                "avg_processing_time": round(performance_stats[0], 3) if performance_stats[0] else 0,
                "min_processing_time": round(performance_stats[1], 3) if performance_stats[1] else 0,
                "max_processing_time": round(performance_stats[2], 3) if performance_stats[2] else 0,
                "avg_file_size_kb": round(performance_stats[3] / 1024, 1) if performance_stats[3] else 0
            }
            
            # Recent activity (last 24 hours)
            from datetime import datetime, timedelta
            yesterday = datetime.now() - timedelta(days=1)
            
            recent_count = db.query(PlanktonUpload)\
                           .filter(PlanktonUpload.upload_date >= yesterday)\
                           .count()
            
            stats["recent_activity"] = {
                "uploads_last_24h": recent_count,
                "percentage_of_total": round((recent_count / total_uploads) * 100, 1) if total_uploads > 0 else 0
            }
            
        else:
            stats["message"] = "No uploads found in database"
        
        return JSONResponse(content={
            "status": "success",
            "statistics": stats,
            "timestamp": time.time()
        })
        
    except Exception as e:
        logger.error(f"Error getting database stats: {str(e)}")
        return JSONResponse(status_code=500, content={"error": str(e)})

@router.get("/admin", response_class=HTMLResponse)
async def admin_dashboard(request: Request):
    """Admin dashboard to view database information"""
    admin_html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>PlanktoScan - Database Admin</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
            .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: #2c3e50; color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; text-align: center; }
            .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
            .btn { background: #3498db; color: white; padding: 10px 15px; border: none; border-radius: 5px; cursor: pointer; margin: 5px; text-decoration: none; display: inline-block; }
            .btn:hover { background: #2980b9; }
            .btn-success { background: #27ae60; } .btn-success:hover { background: #229954; }
            .btn-warning { background: #f39c12; } .btn-warning:hover { background: #e67e22; }
            .btn-danger { background: #e74c3c; } .btn-danger:hover { background: #c0392b; }
            .result { background: #ecf0f1; padding: 15px; border-radius: 5px; margin: 10px 0; font-family: monospace; white-space: pre-wrap; }
            .loading { color: #3498db; font-style: italic; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #34495e; color: white; }
            .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
            .stat-card { background: #3498db; color: white; padding: 20px; border-radius: 8px; text-align: center; }
            .stat-number { font-size: 2em; font-weight: bold; }
            .stat-label { font-size: 0.9em; opacity: 0.9; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>PlanktoScan Database Admin</h1>
                <p>Database monitoring and management interface</p>
            </div>
            
            <div class="section">
                <h3>Quick Actions</h3>
                <a href="#" class="btn btn-success" onclick="testConnection()">Test Database Connection</a>
                <a href="#" class="btn" onclick="getDatabaseInfo()">Get Database Info</a>
                <a href="#" class="btn" onclick="getUploads()">View Recent Uploads</a>
                <a href="#" class="btn" onclick="getStats()">Get Statistics</a>
                <a href="#" class="btn btn-warning" onclick="getDetailedStats()">Detailed Statistics</a>
                <a href="/" class="btn btn-danger">← Back to Dashboard</a>
            </div>
            
            <div class="section">
                <h3>Quick Stats</h3>
                <div class="stats" id="quickStats">
                    <div class="stat-card">
                        <div class="stat-number" id="totalUploads">-</div>
                        <div class="stat-label">Total Uploads</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="totalClasses">-</div>
                        <div class="stat-label">Unique Classes</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="totalLocations">-</div>
                        <div class="stat-label">Unique Locations</div>
                    </div>
                </div>
            </div>
            
            <div class="section">
                <h3>Results</h3>
                <div id="results" class="result">Click any button above to start...</div>
            </div>
        </div>
        
        <script>
            function showLoading() {
                document.getElementById('results').innerHTML = '<div class="loading">Loading...</div>';
            }
            
            function showResult(data) {
                document.getElementById('results').innerHTML = JSON.stringify(data, null, 2);
            }
            
            function testConnection() {
                showLoading();
                fetch('/admin/database-test')
                    .then(response => response.json())
                    .then(data => showResult(data))
                    .catch(error => showResult({error: error.message}));
            }
            
            function getDatabaseInfo() {
                showLoading();
                fetch('/admin/database-info')
                    .then(response => response.json())
                    .then(data => showResult(data))
                    .catch(error => showResult({error: error.message}));
            }
            
            function getUploads() {
                showLoading();
                fetch('/admin/uploads?limit=10')
                    .then(response => response.json())
                    .then(data => showResult(data))
                    .catch(error => showResult({error: error.message}));
            }
            
            function getStats() {
                showLoading();
                fetch('/admin/stats')
                    .then(response => response.json())
                    .then(data => {
                        showResult(data);
                        updateQuickStats(data);
                    })
                    .catch(error => showResult({error: error.message}));
            }
            
            function getDetailedStats() {
                showLoading();
                fetch('/admin/database-stats')
                    .then(response => response.json())
                    .then(data => showResult(data))
                    .catch(error => showResult({error: error.message}));
            }
            
            function updateQuickStats(data) {
                document.getElementById('totalUploads').textContent = data.total_uploads || 0;
                document.getElementById('totalClasses').textContent = data.common_classifications ? data.common_classifications.length : 0;
                document.getElementById('totalLocations').textContent = data.common_locations ? data.common_locations.length : 0;
            }
            
            // Load quick stats on page load
            window.onload = function() {
                getStats();
            };
        </script>
    </body>
    </html>
    """
    
    return HTMLResponse(content=admin_html)

@router.post("/predict")
async def predict(
    request: Request,
    model_option: str = Form(...),
    location: Optional[str] = Form("unknown"),
    file: Optional[UploadFile] = File(None),
    img_path: Optional[str] = Form(None),
    has_captured_file: Optional[bool] = Form(False),
    db: Session = Depends(get_db)
):
    start_time = time.time()

    try:
        logger.info(f"Prediction request: model={model_option}, has_file={file is not None}, has_captured={has_captured_file}")
        
        # Get user IP
        user_ip = request.client.host if request.client else "unknown"

        original_filename = None

        # Handle different image sources
        if file:
            # Handle uploaded file
            original_filename = file.filename
            file_extension = os.path.splitext(original_filename)[1].lower()
            
            # Generate temporary path for prediction
            temp_file_path = f"static/uploads/temp/temp_{int(time.time())}_{file.filename}"
            
            # Save uploaded file temporarily
            with open(temp_file_path, "wb") as buffer:
                content = await file.read()
                buffer.write(content)
            
            file_path_for_prediction = temp_file_path
            
        elif has_captured_file:
            # Handle camera capture
            original_filename = "camera-capture.jpg"
            file_extension = ".jpg"
            file_path_for_prediction = "static/uploads/temp/camera-capture.jpg"
            
            if not os.path.exists(file_path_for_prediction):
                raise FileNotFoundError(f"Camera capture file not found: {file_path_for_prediction}")
            
        elif img_path:
            # Handle existing image path
            original_filename = os.path.basename(img_path)
            file_extension = os.path.splitext(original_filename)[1].lower()
            file_path_for_prediction = img_path
            
        else:
            raise ValueError("No image source provided")
        
        # Verify image file exists before prediction
        if not os.path.exists(file_path_for_prediction):
            raise FileNotFoundError(f"Image file not found: {file_path_for_prediction}")

        # Run prediction
        logger.info(f"Starting prediction with model: {model_option}")
        actual_class, probability_class, response = predict_img(model_option, file_path_for_prediction)
        
        processing_time = time.time() - start_time

        # Generate filename for storage
        top_classification = actual_class[0] if actual_class else "unknown"
        stored_filename = generate_stored_filename(
            location=location,
            classification_result=top_classification,
            original_extension=file_extension
        )
        
        # Move file to final location
        final_file_path = f"static/uploads/results/{stored_filename}"
        
        if file or has_captured_file:
            # Move/rename file to final location
            if os.path.exists(file_path_for_prediction):
                os.rename(file_path_for_prediction, final_file_path)
                logger.info(f"File renamed: {file_path_for_prediction} -> {final_file_path}")
        else:
            # For existing files, copy to new location
            import shutil
            shutil.copy2(file_path_for_prediction, final_file_path)
        
        # Save upload record to database
        try:
            upload_record = save_upload_to_database(
                db,
                original_filename,
                stored_filename,
                final_file_path,
                location,
                model_option,
                (actual_class, probability_class, response),
                user_ip,
                processing_time
            )
            
            logger.info(f"Upload saved to database with ID: {upload_record.id}")
            
        except Exception as db_error:
            logger.error(f"Database save failed: {str(db_error)}")
            # Continue even if database save fails

        # Generate unique result ID
        result_id = str(uuid4())
        
        result_cache[result_id] = {
            "image_path": f"/static/uploads/results/{stored_filename}",
            "img_path": f"/static/uploads/results/{stored_filename}",
            "class1": actual_class[0],
            "class2": actual_class[1],
            "class3": actual_class[2],
            "probability1": f"{probability_class[0]:.1%}",
            "probability2": f"{probability_class[1]:.1%}",
            "probability3": f"{probability_class[2]:.1%}",
            "response": response,
            "location": location,
            "model_used": model_option,
            "stored_filename": stored_filename,
            "processing_time": f"{processing_time:.2f}s",
            "timestamp": time.time()
        }
        
        logger.info(f"Prediction successful. Result ID: {result_id}")
        logger.info(f"Final file: {stored_filename}")

        return JSONResponse(content={
            "success": True,
            "result_id": result_id,
            "stored_filename": stored_filename,
            "redirect_url": f"/result/{result_id}"
        })
        
    except Exception as e:
        logger.error(f"Prediction failed: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )

@router.get("/result/{result_id}", response_class=HTMLResponse)
async def result(request: Request, result_id: str):
    """Result page route"""
    data = result_cache.get(result_id)
    if not data:
        raise HTTPException(status_code=404, detail="Result not found")

    logger.info(f"Serving result for ID: {result_id}")
    logger.info(f"Cached data keys: {list(data.keys())}")
    logger.info(f"Image path from cache: {data.get('image_path', 'NOT_FOUND')}")

    return templates.TemplateResponse("result.html", {
        "request": request,
        "image_path": data.get("image_path", ""),
        "class1": data.get("class1", "Unknown"),
        "probability1": data.get("probability1", "0%"),
        "class2": data.get("class2", "Unknown"), 
        "probability2": data.get("probability2", "0%"),
        "class3": data.get("class3", "Unknown"),
        "probability3": data.get("probability3", "0%"),
        "response": data.get("response", "No response available")
    })

@router.get("/admin/uploads")
async def get_uploads(
    skip: int = 0, 
    limit: int = 50, 
    db: Session = Depends(get_db)
):
    """Get list of uploads"""
    try:
        from database import PlanktonUpload
        
        uploads = db.query(PlanktonUpload)\
                   .order_by(PlanktonUpload.upload_date.desc())\
                   .offset(skip)\
                   .limit(limit)\
                   .all()
        
        upload_list = []
        for upload in uploads:
            upload_list.append({
                "id": upload.id,
                "stored_filename": upload.stored_filename,
                "original_filename": upload.original_filename,
                "upload_date": upload.upload_date.isoformat(),
                "location": upload.location,
                "model_used": upload.model_used,
                "top_class": upload.top_class,
                "top_probability": upload.top_probability,
                "processing_time": upload.processing_time,
                "file_size": upload.file_size
            })
        
        return JSONResponse(content={
            "uploads": upload_list,
            "total": len(upload_list)
        })
        
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@router.get("/admin/stats")
async def get_upload_stats(db: Session = Depends(get_db)):
    """Get upload statistics"""
    try:
        from database import PlanktonUpload
        from sqlalchemy import func
        
        # Total uploads
        total_uploads = db.query(PlanktonUpload).count()
        
        # Most common classifications
        common_classes = db.query(
            PlanktonUpload.top_class,
            func.count(PlanktonUpload.top_class).label('count')
        ).group_by(PlanktonUpload.top_class)\
         .order_by(func.count(PlanktonUpload.top_class).desc())\
         .limit(10).all()
        
        # Most common locations
        common_locations = db.query(
            PlanktonUpload.location,
            func.count(PlanktonUpload.location).label('count')
        ).group_by(PlanktonUpload.location)\
         .order_by(func.count(PlanktonUpload.location).desc())\
         .limit(10).all()
        
        return JSONResponse(content={
            "total_uploads": total_uploads,
            "common_classifications": [{"class": c[0], "count": c[1]} for c in common_classes],
            "common_locations": [{"location": l[0], "count": l[1]} for l in common_locations]
        })
        
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})