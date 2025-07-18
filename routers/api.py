import os

from utils import predict_img
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
    file: Optional[UploadFile] = File(None),
    img_path: Optional[str] = Form(None),
    model_option: str = Form(...)
):
    try:
        # Validate and set defaults for any undefined or invalid values
        if not model_option or model_option in ['undefined', 'null', '']:
            model_option = 'efficientnetv2b0'
            logger.warning(f"Invalid model_option received, defaulting to: {model_option}")
        
        # Handle file upload (camera capture) vs existing file path
        if file and file.filename:
            # Handle uploaded file (camera capture)
            file_path = os.path.join("static/uploads", "camera-capture.jpg")
            with open(file_path, "wb") as f:
                content = await file.read()
                f.write(content)
            image_path = file_path
            logger.info(f"Processing camera capture file: {file_path}, model: {model_option}")
        elif img_path:
            # Handle existing file path
            image_path = img_path
            logger.info(f"Processing existing image: {img_path}, model: {model_option}")
        else:
            raise ValueError("Either file or img_path must be provided")
        
        try:
            actual_class, probability_class, response = predict_img(model_option, image_path)
        except Exception as prediction_error:
            logger.error(f"Error during prediction: {str(prediction_error)}")
            # Provide default values to prevent unpacking errors
            actual_class = ["Error", "Unknown", "Unknown"]
            probability_class = [0.0, 0.0, 0.0]
            response = f"Error during prediction: {str(prediction_error)}"

        result_id = str(uuid4())
        result_cache[result_id] = {
            "img_path": image_path,
            "actual_class": actual_class,
            "probability_class": probability_class,
            "response": response
        }

        return JSONResponse(content={
            "result_id": result_id
        })
    except Exception as e:
        logger.error(f"Prediction error: {str(e)}")
        return JSONResponse(status_code=500, content={
            "error": f"Gagal memprediksi gambar: {str(e)}"
        })

@router.get("/result/{result_id}", response_class=HTMLResponse)
async def result(request: Request, result_id: str):
    """Result page route"""
    data = result_cache.get(result_id)
    if not data:
        raise HTTPException(status_code=404, detail="Result not found")

    # Ensure all expected keys exist in the data with safe default
    actual_class = data.get("actual_class", ["Unknown", "Unknown", "Unknown"])
    probability_class = data.get("probability_class", [0.0, 0.0, 0.0])
    
    # Make sure we have at least 3 values for each
    while len(actual_class) < 3:
        actual_class.append("Unknown")
    while len(probability_class) < 3:
        probability_class.append(0.0)

    return templates.TemplateResponse("result.html", {
        "request": request,
        "img_path": data.get("img_path", ""),
        "class1": actual_class[0],
        "probability1": f'{float(probability_class[0]):.6f}',
        "class2": actual_class[1],
        "probability2": f'{float(probability_class[1]):.6f}',
        "class3": actual_class[2],
        "probability3": f'{float(probability_class[2]):.6f}',
        "response": data.get("response", "No response available")
    })