import os
import time
from utils import predict_img, get_cache_info, get_detailed_cache_info, get_model_mapping, MODEL_CACHE
from uuid import uuid4
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, Request, Response
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
        for file in os.listdir('static/uploads'):
            if file not in {'original_image.jpg', 'predicted_mask.jpg', 'output_image.jpg'}:
                os.remove(os.path.join('static/uploads', file))
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

    path = os.path.join("static/uploads", file.filename)
    with open(path, "wb") as f:
        f.write(await file.read())

    return JSONResponse(content={
        "img_path": path
    })

@router.post("/predict")
async def predict(
    request: Request,
    model_option: str = Form(...),
    file: Optional[UploadFile] = File(None),
    img_path: Optional[str] = Form(None),
    has_captured_file: Optional[bool] = Form(False)
):
    try:
        logger.info(f"Prediction request: model={model_option}, has_file={file is not None}, has_captured={has_captured_file}")
        
        # Handle different image sources
        if file:
            # Handle uploaded file
            file_path = f"static/uploads/{file.filename}"
            
            # Save uploaded file
            with open(file_path, "wb") as buffer:
                content = await file.read()
                buffer.write(content)
            
            # Path for template (with leading slash)
            image_path_for_template = f"/static/uploads/{file.filename}"
            logger.info(f"File uploaded: {file_path}")
            
        elif has_captured_file:
            # Handle camera capture
            file_path = "static/uploads/camera-capture.jpg"
            image_path_for_template = "/static/uploads/camera-capture.jpg"
            
            # Verify file exists
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"Camera capture file not found: {file_path}")
            
            logger.info(f"Using camera capture: {file_path}")
            
        elif img_path:
            # Handle existing image path
            file_path = img_path
            
            # Convert relative path to absolute for template
            if img_path.startswith("static/"):
                image_path_for_template = f"/{img_path}"
            else:
                image_path_for_template = img_path
            
            logger.info(f"Using existing image: {file_path}")
            
        else:
            raise ValueError("No image source provided")
        
        # Verify image file exists before prediction
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Image file not found: {file_path}")
        
        # Run prediction
        logger.info(f"Starting prediction with model: {model_option}")
        actual_class, probability_class, response = predict_img(model_option, file_path)
        
        # Generate unique result ID
        result_id = str(uuid4())
        
        # Store results in cache
        result_cache[result_id] = {
            "image_path": image_path_for_template,
            "class1": actual_class[0],
            "class2": actual_class[1],
            "class3": actual_class[2],
            "probability1": f"{probability_class[0]:.1%}",
            "probability2": f"{probability_class[1]:.1%}",
            "probability3": f"{probability_class[2]:.1%}",
            "response": response,
            "timestamp": time.time()
        }
        
        logger.info(f"Prediction successful. Result ID: {result_id}")
        logger.info(f"Image path for template: {image_path_for_template}")
        
        return JSONResponse(content={
            "success": True,
            "result_id": result_id,
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