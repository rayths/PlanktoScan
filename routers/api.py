import os

from utils import predict_img, implement_roi_image, detect_and_save_contours
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
    return templates.TemplateResponse("home.html", {"request": request})

@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    return templates.TemplateResponse("dashboard.html", {"request": request})

@router.get("/home", response_class=HTMLResponse)
async def delete_upload(request: Request):
    for file in os.listdir('static/uploads'):
        if file not in {'original_image.jpg', 'predicted_mask.jpg', 'output_image.jpg'}:
            os.remove(os.path.join('static/uploads', file))
            
    return templates.TemplateResponse("home.html", {"request": request})

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
    llm_option: str = Form(...)
):
    roi, _ = implement_roi_image(img_path)
    actual_class, probability_class, response = predict_img(model_option, llm_option, roi)

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