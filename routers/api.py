import os
import time
import uuid
import requests
from datetime import datetime
from typing import Optional
from utils import predict_img, get_cache_info, get_detailed_cache_info, get_model_mapping, MODEL_CACHE, generate_stored_filename, get_image_metadata, generate_uuid_28

from fastapi import APIRouter, UploadFile, File, Form, Request, Response, Depends, HTTPException
from fastapi.responses import JSONResponse, HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from database import (
    get_db, FirestoreDB, AppUser, ClassificationEntry, UserRole,
    create_guest_user, create_basic_user, create_expert_user, create_admin_user,
    convert_numpy_types
)

import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()
templates = Jinja2Templates(directory="templates")

result_cache = {}

# Auth helper functions
def get_current_user(request: Request, db: FirestoreDB = Depends(get_db)) -> Optional[AppUser]:
    """Get current user from session"""
    user_id = request.session.get('user_id')
    if user_id:
        return db.get_user_by_uid(user_id)
    return None

def require_role(required_role: UserRole):
    """Decorator to require specific user role"""
    def decorator(func):
        async def wrapper(request: Request, *args, **kwargs):
            user = get_current_user(request)
            if not user or user.role != required_role:
                raise HTTPException(status_code=403, detail="Insufficient permissions")
            return await func(request, *args, **kwargs)
        return wrapper
    return decorator

# Login Routes
@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request, next: str = "/"):
    """Main login selection page"""
    return templates.TemplateResponse("login.html", {
        "request": request,
        "next": next
    })

@router.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    """Registration page"""
    # Firebase config for frontend (public config only)
    firebase_config = {
        "api_key": os.getenv("FIREBASE_API_KEY"),
        "auth_domain": os.getenv("FIREBASE_AUTH_DOMAIN"),
        "project_id": os.getenv("FIREBASE_PROJECT_ID"),
        "storage_bucket": os.getenv("FIREBASE_STORAGE_BUCKET"),
        "messaging_sender_id": os.getenv("FIREBASE_MESSAGING_SENDER_ID"),
        "app_id": os.getenv("FIREBASE_APP_ID")
    }
    
    return templates.TemplateResponse("register.html", {
        "request": request,
        "firebase_config": firebase_config
    })

@router.post("/auth/expert/register")
async def expert_register(
    request: Request,
    id_token: str = Form(...),
    organization: str = Form(None),
    db: FirestoreDB = Depends(get_db)
):
    """Expert registration endpoint"""
    try:        
        # Verify Firebase token
        firebase_user_info = db.verify_firebase_token(id_token)
        
        if not firebase_user_info:
            return JSONResponse(
                status_code=401,
                content={"success": False, "message": "Invalid authentication token"}
            )
        
        # Validate expert email domain
        email = firebase_user_info.get('email')
        if not email or not email.endswith('@brin.go.id'):
            return JSONResponse(
                status_code=403,
                content={"success": False, "message": "Expert role requires @brin.go.id email address"}
            )
        
        # Create or update user with expert role
        user = db.authenticate_with_firebase(id_token)
        if not user:
            return JSONResponse(
                status_code=401,
                content={"success": False, "message": "User authentication failed"}
            )
        
        # Update to expert role
        from database import UserRole
        user.role = UserRole.EXPERT
        user.organization = organization or 'BRIN (Badan Riset dan Inovasi Nasional)'
        
        # Save user
        db.save_user(user)
        
        # Set session
        request.session['user_id'] = user.uid
        request.session['user_name'] = user.display_name
        request.session['user_role'] = user.role.value
        request.session['user_email'] = user.email
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": "Expert registration successful",
                "redirect": "/dashboard"
            }
        )
        
    except Exception as e:
        logger.error(f"Expert registration error: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Registration failed"}
        )

@router.get("/login/guest")
async def guest_login_direct(request: Request, next: str = "/"):
    """Direct guest login without form"""
    try:
        # Create temporary guest user
        guest_uid = f"guest_{int(time.time() * 1000)}"
        user = create_guest_user(guest_uid)
        
        # Set session
        request.session['user_id'] = user.uid
        request.session['user_name'] = "Guest User"
        request.session['user_role'] = user.role.value
        
        logger.info(f"Guest user created: {guest_uid}")
        
        # Create redirect response with welcome_seen cookie
        response = RedirectResponse(url=next, status_code=302)
        response.set_cookie("welcome_seen", "true", max_age=24*60*60)  # 1 day
        return response
        
    except Exception as e:
        logger.error(f"Guest login error: {str(e)}")
        return RedirectResponse(url="/login?error=guest_failed", status_code=302)

@router.post("/login/guest")
async def guest_login_api(request: Request):
    """Guest login API endpoint"""
    try:
        # Create temporary guest user
        guest_uid = f"guest_{int(time.time() * 1000)}"
        user = create_guest_user(guest_uid)
        
        # Set session
        request.session['user_id'] = user.uid
        request.session['user_name'] = "Guest User"
        request.session['user_role'] = user.role.value
        
        logger.info(f"Guest user created: {guest_uid}")
        
        # Create response with welcome_seen cookie
        response = JSONResponse(content={"success": True, "role": "guest", "message": "Guest access granted"})
        response.set_cookie("welcome_seen", "true", max_age=24*60*60)  # 1 day
        return response
        
    except Exception as e:
        logger.error(f"Guest login error: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Guest access failed"}
        )

@router.post("/auth/firebase")
async def authenticate_with_firebase(
    request: Request,
    id_token: str = Form(...),
    next_url: str = Form("/"),
    role: str = Form(None),
    organization: str = Form(None),
    db: FirestoreDB = Depends(get_db)
):
    """Authenticate user using Firebase ID token"""
    try:
        logger.info(f"Firebase auth attempt - Role: {role}")
        logger.info(f"ID token length: {len(id_token) if id_token else 0}")
        
        # Verify Firebase token first
        firebase_user_info = db.verify_firebase_token(id_token)
        
        if not firebase_user_info:
            logger.error("Firebase token verification failed")
            return JSONResponse(
                status_code=401,
                content={"success": False, "message": "Invalid authentication token"}
            )
        
        logger.info(f"Firebase token verified for: {firebase_user_info['uid']}")
        
        # Authenticate with Firebase
        user = db.authenticate_with_firebase(id_token)
        
        if not user:
            logger.error("Firebase authentication failed - user creation failed")
            return JSONResponse(
                status_code=401,
                content={"success": False, "message": "User authentication failed"}
            )
        
        logger.info(f"Firebase user authenticated: {user.uid}")
        
        # For new registrations, update additional info if provided
        if role and role.lower() != user.role.value.lower():
            # Validate role based on email for security
            if role.lower() == 'expert' and not user.email.endswith('@brin.go.id'):
                return JSONResponse(
                    status_code=403,
                    content={"success": False, "message": "Expert role requires @brin.go.id email"}
                )
            
            # Update user role and organization
            from database import UserRole  # Import here to avoid circular import
            
            if role.lower() == 'expert':
                user.role = UserRole.EXPERT
                user.organization = 'BRIN (Badan Riset dan Inovasi Nasional)'
            elif role.lower() == 'basic':
                user.role = UserRole.BASIC
                user.organization = organization or 'External User'
            
            # Save updated user info
            db.save_user(user)
            logger.info(f"User role updated to: {user.role.value}")

        # Set session
        request.session['user_id'] = user.uid
        request.session['user_name'] = user.display_name
        request.session['user_role'] = user.role.value
        request.session['user_email'] = user.email
        
        logger.info(f"Firebase authentication successful: {user.uid}")
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": "Authentication successful",
                "user": {
                    "uid": user.uid,
                    "email": user.email,
                    "name": user.display_name,
                    "role": user.role.value,
                    "organization": user.organization
                },
                "redirect_url": next_url
            }
        )
        
    except Exception as e:
        logger.error(f"Firebase authentication error: {str(e)}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Authentication failed: {str(e)}"}
        )

@router.post("/auth/verify-token")
async def verify_firebase_token(
    request: Request,
    id_token: str = Form(...),
    db: FirestoreDB = Depends(get_db)
):
    """Verify Firebase ID token and return user info"""
    try:
        firebase_user_info = db.verify_firebase_token(id_token)
        
        if not firebase_user_info:
            return JSONResponse(
                status_code=401,
                content={"success": False, "message": "Invalid token"}
            )
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "user": firebase_user_info
            }
        )
        
    except Exception as e:
        logger.error(f"Token verification error: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Token verification failed"}
        )

@router.post("/logout")
async def logout(request: Request):
    """Logout user (clear session)"""
    try:
        # Clear session
        request.session.clear()
        
        return JSONResponse(
            status_code=200,
            content={"success": True, "message": "Logged out successfully"}
        )
        
    except Exception as e:
        logger.error(f"Logout error: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Logout failed"}
        )
    
@router.post("/change-password")
async def change_password(
    request: Request,
    current_password: str = Form(...),
    new_password: str = Form(...),
    confirm_password: str = Form(...),
    db: FirestoreDB = Depends(get_db)
):
    """Change user password"""
    try:
        # Check if user logged in
        user_id = request.session.get("user_id")
        if not user_id:
            return JSONResponse(
                status_code=401,
                content={"success": False, "error": "Not authenticated"}
            )
        
        # Validate new password
        if new_password != confirm_password:
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": "Passwords do not match"}
            )
        
        if len(new_password) < 6:
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": "Password must be at least 6 characters"}
            )
        
        # Get user
        user = db.get_user_by_uid(user_id)
        if not user or not user.email:
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": "User not found"}
            )
        
        # Verify current password
        user_data = db.authenticate_user(user.email, current_password)
        if not user_data:
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": "Current password is incorrect"}
            )
        
        # Update password
        success = db.update_user_password(user_id, new_password)
        
        if success:
            return JSONResponse(
                status_code=200,
                content={"success": True, "message": "Password updated successfully"}
            )
        else:
            return JSONResponse(
                status_code=500,
                content={"success": False, "error": "Failed to update password"}
            )
            
    except Exception as e:
        logger.error(f"Change password error: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": "Failed to change password"}
        )
    
# Location Routes
@router.get("/api/reverse-geocode")
async def reverse_geocode(lat: float, lon: float):
    headers = {
        "User-Agent": "PlanktoScanApp/1.0"
    }

    # URL untuk Nominatim API
    url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=14&addressdetails=1"
    
    try:
        # Request ke Nominatim dengan headers yang benar
        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()  # Raise exception jika status code error
        
        data = resp.json()
        
        # Pastikan response valid
        if data and 'display_name' in data:
            return JSONResponse(content=data)
        else:
            # Jika tidak ada display_name, return koordinat
            return JSONResponse(content={
                "display_name": f"GPS: {lat:.4f}, {lon:.4f}",
                "address": {}
            })
            
    except requests.exceptions.HTTPError as e:
        print(f"HTTP Error: {e}")
        # Return koordinat jika HTTP error
        return JSONResponse(content={
            "display_name": f"GPS: {lat:.4f}, {lon:.4f}",
            "address": {},
            "error": f"Geocoding service error: {str(e)}"
        })
        
    except requests.exceptions.RequestException as e:
        print(f"Request Error: {e}")
        # Return koordinat jika request error
        return JSONResponse(content={
            "display_name": f"GPS: {lat:.4f}, {lon:.4f}",
            "address": {},
            "error": f"Network error: {str(e)}"
        })
        
    except Exception as e:
        print(f"Unexpected Error: {e}")
        # Return koordinat jika error lainnya
        return JSONResponse(content={
            "display_name": f"GPS: {lat:.4f}, {lon:.4f}",
            "address": {},
            "error": f"Unexpected error: {str(e)}"
        })
    
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
async def index(request: Request, db: FirestoreDB = Depends(get_db)):
    """Main dashboard route with welcome popup on first visit"""
    try:
        # Clean up previous uploads
        for file in os.listdir('static/uploads/temp'):
            os.remove(os.path.join('static/uploads/temp', file))
    except Exception as e:
        logger.warning(f"Error cleaning up uploads: {str(e)}")
    
    # Check if user is logged in
    current_user = get_current_user(request, db)
    user_logged_in = current_user is not None
    
    # Check if user has seen welcome popup before
    welcome_seen = request.cookies.get("welcome_seen")
    
    # Get session info for debugging
    session_info = dict(request.session)
    
    # Don't show welcome popup if user is logged in OR if they've seen it before
    show_welcome = not user_logged_in and not bool(welcome_seen)
    
    logger.info(f"Welcome popup check - User logged in: {user_logged_in}, Cookie: {welcome_seen}, Session: {session_info}, Show welcome: {show_welcome}")
    if current_user:
        logger.info(f"Current user: {current_user.uid} ({current_user.role.value})")
    
    return templates.TemplateResponse("index.html", {
        "request": request, 
        "show_welcome": show_welcome
    })

@router.post("/set-welcome-seen")
async def set_welcome_seen(response: Response):
    """Set cookie when welcome popup is closed"""
    logger.info("Setting welcome_seen cookie")
    response.set_cookie("welcome_seen", "true", max_age=24*60*60)  # 1 day
    return JSONResponse(content={"message": "Welcome popup marked as seen"})

@router.post("/api/set-welcome-seen")
async def api_set_welcome_seen():
    """API endpoint to set welcome_seen cookie after login"""
    logger.info("Setting welcome_seen cookie via API")
    response = JSONResponse(content={"success": True, "message": "Welcome cookie set"})
    response.set_cookie("welcome_seen", "true", max_age=24*60*60)  # 1 day
    return response

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
    """Upload image file to server and return server path"""
    try:
        if not file.filename:
            return JSONResponse(status_code=400, content={"error": "No selected file"})

        # Validate file type
        if not file.content_type.startswith('image/'):
            return JSONResponse(status_code=400, content={"error": "Invalid file type"})
        
        # Create uploads directory if not exists
        upload_dir = "static/uploads/temp"
        os.makedirs(upload_dir, exist_ok=True)

        # Generate unique filename to avoid conflicts
        timestamp = int(time.time())
        file_extension = os.path.splitext(file.filename)[1]
        filename = f"{timestamp}_{file.filename}"
        file_path = os.path.join(upload_dir, filename)
        
        # Save file to server
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Verify file was saved
        if not os.path.exists(file_path):
            raise Exception("Failed to save file to server")
        
        # Get file size for response
        file_size = os.path.getsize(file_path)
        
        logger.info(f"File uploaded successfully: {file_path} ({file_size} bytes)")
        
        # Return server path (not data URL)
        return JSONResponse(content={
            "success": True,
            "img_path": file_path,  # This is the server file path
            "filename": filename,
            "original_filename": file.filename,
            "file_size": file_size
        })
        
    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
        return JSONResponse(
            status_code=500, 
            content={"error": f"Upload failed: {str(e)}"}
        )

def require_auth(request: Request):
    """Middleware function to require authentication"""
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user_id

# Classification prediction endopoint
@router.post("/predict")
async def predict(
    request: Request,
    model_option: str = Form(...),
    location: Optional[str] = Form("unknown"),
    file: Optional[UploadFile] = File(None),
    img_path: Optional[str] = Form(None),
    has_captured_file: Optional[bool] = Form(False),
    db: FirestoreDB = Depends(get_db)
):
    start_time = time.time()

    try:
        logger.info(f"Prediction request: model={model_option}, has_file={file is not None}, has_captured={has_captured_file}")
        logger.info(f"img_path received: {img_path}")
        
        # Validate image path
        if img_path and img_path.startswith('data:'):
            raise ValueError("Data URL received instead of file path. File upload may have failed.")
        
        # Get current user or create guest
        current_user = get_current_user(request, db)
        if not current_user:
            # Create temporary guest user
            guest_uid = f"temp_guest_{int(time.time())}"
            current_user = create_guest_user(guest_uid)
            current_user = db.save_user(current_user)
            
            # Set session
            request.session['user_id'] = current_user.uid
            request.session['user_role'] = current_user.role.value
        
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
            if not os.path.exists(img_path):
                raise FileNotFoundError(f"Image file not found: {img_path}")
            
            original_filename = os.path.basename(img_path)
            file_extension = os.path.splitext(original_filename)[1].lower()
            file_path_for_prediction = img_path
            
        else:
            raise ValueError("No image source provided")

        # Run prediction
        logger.info(f"Starting prediction with model: {model_option}")
        actual_class, probability_class, response = predict_img(model_option, file_path_for_prediction)
        
        processing_time = time.time() - start_time

        # Generate unique ID for this classification
        classification_id = str(int(time.time() * 1000)) 
        
        # Generate filename for storage
        top_classification = actual_class[0] if actual_class else "unknown"
        stored_filename = generate_stored_filename(
            location=location,
            classification_result=top_classification,
            original_extension=file_extension
        )
        
        # Move file to final location
        final_file_path = f"static/uploads/results/{stored_filename}"

        # Create results directory if not exists
        os.makedirs(os.path.dirname(final_file_path), exist_ok=True)
        
        if file or has_captured_file:
            # Move/rename file to final location
            if os.path.exists(file_path_for_prediction):
                os.rename(file_path_for_prediction, final_file_path)
                logger.info(f"File renamed: {file_path_for_prediction} -> {final_file_path}")
        else:
            # For existing files, copy to new location
            import shutil
            shutil.copy2(file_path_for_prediction, final_file_path)
        
        # Get image metadata
        metadata = get_image_metadata(final_file_path)
        
        # Create ClassificationEntry object
        classification_entry = ClassificationEntry(
            id=classification_id,
            user_id=current_user.uid,
            user_role=current_user.role.value,
            image_path=final_file_path,
            classification_result=actual_class[0] if len(actual_class) > 0 else "Unknown",
            confidence=convert_numpy_types(probability_class[0]) if len(probability_class) > 0 else 0.0,
            model_used=model_option,
            timestamp=datetime.utcnow(),
            location=location,
            second_class=actual_class[1] if len(actual_class) > 1 else None,
            second_confidence=convert_numpy_types(probability_class[1]) if len(probability_class) > 1 else None,
            third_class=actual_class[2] if len(actual_class) > 2 else None,
            third_confidence=convert_numpy_types(probability_class[2]) if len(probability_class) > 2 else None,
        )
        
        # Save to Firestore using Android-compatible method
        result_id = db.save_classification_to_database(classification_entry)
        
        logger.info(f"Classification saved to Firestore with ID: {result_id}")

        # Store in cache
        result_cache[str(result_id)] = {
            "img_path": f"/static/uploads/results/{stored_filename}",
            "class1": actual_class[0],
            "class2": actual_class[1] if len(actual_class) > 1 else "Unknown",
            "class3": actual_class[2] if len(actual_class) > 2 else "Unknown",
            "probability1": f"{probability_class[0]:.1%}",
            "probability2": f"{probability_class[1]:.1%}" if len(probability_class) > 1 else "0.0%",
            "probability3": f"{probability_class[2]:.1%}" if len(probability_class) > 2 else "0.0%",
            "response": response,
            "location": location,
            "model_used": model_option,
            "timestamp": time.time()
        }
        
        logger.info(f"Prediction successful. Result ID: {result_id}")

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
async def get_result(
    result_id: str, 
    request: Request, 
    edit_feedback: bool = False,
    db: FirestoreDB = Depends(get_db)
):
    """Get analysis result """
    try:
        # Get the classification result from Firestore
        classification = db.get_classification_by_id(result_id)
        
        if not classification:
            raise HTTPException(status_code=404, detail="Result not found")
    
        # Get current user
        current_user = get_current_user(request, db)
        
        # Generate image URL for result
        filename = os.path.basename(classification.image_path)
        image_url = f"/static/uploads/results/{filename}"

        # Prepare context for rendering
        context = {
            "request": request,
            "result_id": result_id,
            "classification": classification,
            "current_user": current_user,
            "can_edit": current_user and current_user.role in [UserRole.EXPERT, UserRole.ADMIN],
            
            # Template variables for compatibility
            "img_path": image_url,
            "class1": classification.classification_result,
            "class2": classification.second_class or "Unknown",
            "class3": classification.third_class or "Unknown", 
            "probability1": f"{classification.confidence:.1%}",
            "probability2": f"{classification.second_confidence:.1%}" if classification.second_confidence else "0.0%",
            "probability3": f"{classification.third_confidence:.1%}" if classification.third_confidence else "0.0%",
            "response": f"Analisis menunjukkan {classification.classification_result} dengan tingkat keyakinan {classification.confidence:.1%}. Model yang digunakan: {classification.model_used}."
        }
        
        return templates.TemplateResponse("result.html", context)
        
    except Exception as e:
        logger.error(f"Error loading result {result_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error loading result")

# Expert feedback
@router.post("/feedback/{result_id}")
async def submit_expert_feedback(
    result_id: str,
    request: Request,
    user_feedback: str = Form(...),
    is_correct: bool = Form(...),
    correct_class: str = Form(None),
    db: FirestoreDB = Depends(get_db)
):
    """Submit expert feedback for classification result"""
    try:
        # Get current user
        current_user = get_current_user(request, db)
        if not current_user or current_user.role not in [UserRole.EXPERT, UserRole.ADMIN]:
            raise HTTPException(status_code=403, detail="Only experts and admins can provide feedback")
        
        # Get classification
        classification = db.get_classification_by_id(result_id)
        if not classification:
            raise HTTPException(status_code=404, detail="Classification not found")
        
        # Convert string to boolean
        is_correct_bool = is_correct == 'true' if isinstance(is_correct, str) else is_correct
        
        # Update classification with feedback
        classification.user_feedback = user_feedback
        classification.is_correct = is_correct_bool
        classification.correct_class = correct_class if not is_correct_bool and correct_class else None
        
        # Update in database using Android-compatible method
        success = db.update_classification_in_database(classification, current_user.uid)
        
        if success:
            # Redirect back to result page with success message
            return RedirectResponse(
                url=f"/result/{result_id}?feedback_success=1", 
                status_code=302
            )
        else:
            # Redirect back to feedback page with error
            return RedirectResponse(
                url=f"/feedback/{result_id}?error=save_failed", 
                status_code=302
            )
        
    except Exception as e:
        logger.error(f"Submit feedback error: {str(e)}")
        # Redirect back to feedback page with error
        return RedirectResponse(
            url=f"/feedback/{result_id}?error=general", 
            status_code=302
        )

# Expert feedback page
@router.get("/feedback/{result_id}", response_class=HTMLResponse)
async def expert_feedback_page(
    result_id: str,
    request: Request,
    db: FirestoreDB = Depends(get_db)
):
    """Expert feedback page for classification result"""
    try:
        # Get current user and check if expert
        current_user = get_current_user(request, db)
        if not current_user or current_user.role not in [UserRole.EXPERT, UserRole.ADMIN]:
            raise HTTPException(status_code=403, detail="Only experts and admins can access feedback page")
        
        # Get classification
        classification = db.get_classification_by_id(result_id)
        if not classification:
            raise HTTPException(status_code=404, detail="Classification not found")
        
        # Generate image URL for result
        filename = os.path.basename(classification.image_path)
        image_url = f"/static/uploads/results/{filename}"

        # Prepare context for rendering
        context = {
            "request": request,
            "result_id": result_id,
            "classification": classification,
            "current_user": current_user,
            
            # Template variables for compatibility
            "img_path": image_url,
            "class1": classification.classification_result,
            "class2": classification.second_class or "Unknown",
            "class3": classification.third_class or "Unknown", 
            "probability1": f"{classification.confidence:.1%}",
            "probability2": f"{classification.second_confidence:.1%}" if classification.second_confidence else "0.0%",
            "probability3": f"{classification.third_confidence:.1%}" if classification.third_confidence else "0.0%",
            "response": f"Analisis menunjukkan {classification.classification_result} dengan tingkat keyakinan {classification.confidence:.1%}. Model yang digunakan: {classification.model_used}."
        }
        
        return templates.TemplateResponse("expert_feedback.html", context)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error loading feedback page for {result_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error loading feedback page")
    
# History and admin routes
@router.get("/history", response_class=HTMLResponse)
async def user_history(request: Request, db: FirestoreDB = Depends(get_db)):
    """User prediction history"""
    current_user = get_current_user(request, db)
    if not current_user:
        return RedirectResponse(url="/login?next=/history", status_code=302)
    
    try:
        # Get user's classifications
        if current_user.role == UserRole.ADMIN:
            # Admin can see all
            classifications_data = db.get_all_classifications_from_database(current_user.role)
            classifications = [ClassificationEntry.from_dict(data) for data in classifications_data]
        else:
            # Users see only their own
            classifications_data = db.get_classifications_by_user_id(current_user.uid)
            classifications = [ClassificationEntry.from_dict(data) for data in classifications_data]
        
        return templates.TemplateResponse("history.html", {
            "request": request,
            "user": current_user,
            "classifications": classifications
        })
        
    except Exception as e:
        logger.error(f"History error: {e}")
        return RedirectResponse(url="/", status_code=302)

@router.get("/admin/export")
async def export_classifications(request: Request, db: FirestoreDB = Depends(get_db)):
    """Export all classifications to CSV (admin only)"""
    current_user = get_current_user(request, db)
    if not current_user or current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        csv_content = db.export_all_classifications_to_csv(current_user.role)
        
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=classifications_export.csv"}
        )
        
    except Exception as e:
        logger.error(f"Export error: {e}")
        raise HTTPException(status_code=500, detail="Export failed")

@router.get("/admin/stats")
async def get_admin_stats(request: Request, db: FirestoreDB = Depends(get_db)):
    """Get admin statistics"""
    current_user = get_current_user(request, db)
    if not current_user or current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        stats = db.get_classification_stats()
        return JSONResponse(content=stats)
        
    except Exception as e:
        logger.error(f"Stats error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})