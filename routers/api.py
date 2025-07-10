import os

from utils import predict_img, implement_roi_image, detect_and_save_contours, get_available_segmentation_models
from uuid import uuid4

from fastapi import APIRouter, UploadFile, File, Form, Request
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
    return templates.TemplateResponse("dashboard.html", {"request": request, "show_welcome": True})

@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    return templates.TemplateResponse("dashboard.html", {"request": request, "show_welcome": False})

@router.get("/home", response_class=HTMLResponse)
async def delete_upload(request: Request):
    for file in os.listdir('static/uploads'):
        if file not in {'original_image.jpg', 'predicted_mask.jpg', 'output_image.jpg'}:
            os.remove(os.path.join('static/uploads', file))
            
    return templates.TemplateResponse("dashboard.html", {"request": request, "show_welcome": False})

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
        actual_class, probability_class, response = predict_img(model_option, roi)

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
async def result_by_id(request: Request, result_id: str):
    data = result_cache.get(result_id)
    if not data:
        raise HTTPException(status_code=404, detail="Result not found")

    detect_and_save_contours(
        "static/uploads/original_image.jpg",
        "static/uploads/predicted_mask.jpg",
        "static/uploads/output_image.jpg"
    )

    return templates.TemplateResponse("result.html", {
        "request": request,
        "img_path": "/static/uploads/output_image.jpg",
        "class1": data["actual_class"][0],
        "probability1": f'{float(data["probability_class"][0]):.6f}',
        "class2": data["actual_class"][1],
        "probability2": f'{float(data["probability_class"][1]):.6f}',
        "class3": data["actual_class"][2],
        "probability3": f'{float(data["probability_class"][2]):.6f}',
        "response": data["response"]
    })

@router.get("/segmentation-models")
async def get_segmentation_models():
    """Endpoint untuk mendapatkan daftar model segmentasi yang tersedia"""
    return JSONResponse(content=get_available_segmentation_models())