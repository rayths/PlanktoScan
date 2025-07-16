import os

from utils import predict_img, implement_roi_image, detect_and_save_contours, get_available_segmentation_models
from uuid import uuid4

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
    img_path: str = Form(...),
    model_option: str = Form(...),
    segmentation_model: str = Form(default="deeplab")
):
    try:
        # Validate and set defaults for any undefined or invalid values
        if not model_option or model_option in ['undefined', 'null', '']:
            model_option = 'efficientnetv2b0'
            logger.warning(f"Invalid model_option received, defaulting to: {model_option}")
        
        if not segmentation_model or segmentation_model in ['undefined', 'null', '']:
            segmentation_model = 'deeplab'
            logger.warning(f"Invalid segmentation_model received, defaulting to: {segmentation_model}")
        
        logger.info(f"Processing prediction for: {img_path}, model: {model_option}, segmentation: {segmentation_model}")
        
        roi, _ = implement_roi_image(img_path, segmentation_model)
        
        try:
            actual_class, probability_class, response = predict_img(model_option, roi)
        except Exception as prediction_error:
            logger.error(f"Error during prediction: {str(prediction_error)}")
            # Provide default values to prevent unpacking errors
            actual_class = ["Error", "Unknown", "Unknown"]
            probability_class = [0.0, 0.0, 0.0]
            response = f"Error during prediction: {str(prediction_error)}"

        result_id = str(uuid4())
        result_cache[result_id] = {
            "img_path": img_path,
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

    try:
        detect_and_save_contours(
            "static/uploads/original_image.jpg",
            "static/uploads/predicted_mask.jpg",
            "static/uploads/output_image.jpg"
        )
    except Exception as e:
        logger.error(f"Error generating contour image: {str(e)}")

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
        "img_path": "/static/uploads/output_image.jpg",
        "class1": actual_class[0],
        "probability1": f'{float(probability_class[0]):.6f}',
        "class2": actual_class[1],
        "probability2": f'{float(probability_class[1]):.6f}',
        "class3": actual_class[2],
        "probability3": f'{float(probability_class[2]):.6f}',
        "response": data.get("response", "No response available")
    })

@router.get("/segmentation-models")
async def get_segmentation_models():
    """Endpoint untuk mendapatkan daftar model segmentasi yang tersedia"""
    return JSONResponse(content=get_available_segmentation_models())