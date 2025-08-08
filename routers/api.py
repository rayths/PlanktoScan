import os
import time
import logging
import requests
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, Request, Response, Depends, HTTPException
from fastapi.responses import JSONResponse, HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from utils import predict_img, get_cache_info, get_model_mapping, MODEL_CACHE, generate_uuid_28, preload_models_async, clear_model_cache
from database import get_db, FirestoreDB, AppUser, ClassificationEntry, UserRole, create_guest_user

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()
templates = Jinja2Templates(directory="templates")

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_current_user(request: Request, db: FirestoreDB = Depends(get_db)) -> Optional[AppUser]:
    """Get current user from session"""
    user_id = request.session.get('user_id')
    if user_id:
        return db.get_user_by_uid(user_id)
    return None

# ============================================================================
# AUTHENTICATION ROUTES
# ============================================================================

# Login Routes
@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request, next: str = "/"):
    """Main login selection page"""
    return templates.TemplateResponse("login.html", {
        "request": request,
        "next": next
    })

# Firebase config endpoint
@router.get("/api/firebase-config")
async def get_firebase_config():
    """Get Firebase configuration for frontend"""
    config = {
        "apiKey": os.getenv("FIREBASE_API_KEY"),
        "authDomain": os.getenv("FIREBASE_AUTH_DOMAIN"),
        "projectId": os.getenv("FIREBASE_PROJECT_ID"),
        "storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET"),
        "messagingSenderId": os.getenv("FIREBASE_MESSAGING_SENDER_ID"),
        "appId": os.getenv("FIREBASE_APP_ID")
    }
    
    logger.info(f"Firebase config - apiKey: {'***' if config['apiKey'] else 'MISSING'}")
    logger.info(f"Firebase config - projectId: {config['projectId']}")
    
    return JSONResponse(content=config)

@router.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    """Registration page"""
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
                "redirect": "/login"
            }
        )
        
    except Exception as e:
        logger.error(f"Expert registration error: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Registration failed"}
        )
    
@router.post("/login/guest")
async def guest_login(request: Request, next_url: str = Form("/")):
    """Guest login endpoint - handles both API and form requests"""
    try:
        # Create temporary guest user
        guest_uid = generate_uuid_28()
        user = create_guest_user(guest_uid)
        
        # Set session
        request.session['user_id'] = user.uid
        request.session['user_name'] = "Guest User"
        request.session['user_role'] = user.role.value
        
        logger.info(f"Guest user created: {guest_uid}")
        
        # Check if request expects JSON (API call) or redirect (form submission)
        content_type = request.headers.get("content-type", "")
        accept_header = request.headers.get("accept", "")
        
        if "application/json" in accept_header or "application/json" in content_type:
            # API response
            response = JSONResponse(content={
                "success": True, 
                "role": "Guest", 
                "message": "Guest access granted",
                "redirect_url": next_url
            })
        else:
            # Form submission - redirect response
            response = RedirectResponse(url=next_url, status_code=302)
        
        # Set welcome cookie for both response types
        response.set_cookie("welcome_seen", "true", max_age=24*60*60)  # 1 day
        return response
        
    except Exception as e:
        logger.error(f"Guest login error: {str(e)}")
        
        # Error handling based on request type
        content_type = request.headers.get("content-type", "")
        accept_header = request.headers.get("accept", "")
        
        if "application/json" in accept_header or "application/json" in content_type:
            return JSONResponse(
                status_code=500,
                content={"success": False, "message": "Guest access failed"}
            )
        else:
            return RedirectResponse(url="/login?error=guest_failed", status_code=302)

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

# ============================================================================
# LOCATION AND UTILITY ROUTES
# ============================================================================

# Location Routes
@router.get("/api/reverse-geocode")
async def reverse_geocode(lat: float, lon: float):
    headers = {
        "User-Agent": "PlanktoScanApp/1.0"
    }

    url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=14&addressdetails=1"
    
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()  
        data = resp.json()
        
        if data and 'display_name' in data:
            return JSONResponse(content=data)
        else:
            return JSONResponse(content={
                "display_name": f"GPS: {lat:.4f}, {lon:.4f}",
                "address": {}
            })
            
    except requests.exceptions.HTTPError as e:
        print(f"HTTP Error: {e}")
        return JSONResponse(content={
            "display_name": f"GPS: {lat:.4f}, {lon:.4f}",
            "address": {},
            "error": f"Geocoding service error: {str(e)}"
        })
        
    except requests.exceptions.RequestException as e:
        print(f"Request Error: {e}")
        return JSONResponse(content={
            "display_name": f"GPS: {lat:.4f}, {lon:.4f}",
            "address": {},
            "error": f"Network error: {str(e)}"
        })
        
    except Exception as e:
        print(f"Unexpected Error: {e}")
        return JSONResponse(content={
            "display_name": f"GPS: {lat:.4f}, {lon:.4f}",
            "address": {},
            "error": f"Unexpected error: {str(e)}"
        })

# ============================================================================
# CACHE MANAGEMENT ROUTES
# ============================================================================

@router.get("/cache/status")
async def get_cache_status():
    """Get detailed cache status and performance metrics"""
    try:
        cache_info = get_cache_info()
        
        return JSONResponse(content={
            "status": "success",
            "cache_info": cache_info,
            "timestamp": time.time()
        })
    except Exception as e:
        logger.error(f"Error getting cache status: {str(e)}")
        return JSONResponse(status_code=500, content={
            "status": "error",
            "error": str(e)
        })

@router.post("/cache/clear")
async def clear_cache():
    """Clear model cache (admin only)"""
    try:
        # Note: Add admin authentication here
        clear_model_cache()
        
        return JSONResponse(content={
            "status": "success",
            "message": "Model cache cleared successfully"
        })
    except Exception as e:
        logger.error(f"Error clearing cache: {str(e)}")
        return JSONResponse(status_code=500, content={
            "status": "error", 
            "error": str(e)
        })
    
@router.post("/cache/preload")
async def preload_models_endpoint():
    """Manually trigger model preloading"""
    try:
        results = preload_models_async()
        
        return JSONResponse(content={
            "status": "success",
            "preload_results": results
        })
    except Exception as e:
        logger.error(f"Error preloading models: {str(e)}")
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

# ============================================================================
# MAIN APPLICATION ROUTES
# ============================================================================

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
    
    # Don't show welcome popup if user is logged in OR if they've seen it before
    show_welcome = not user_logged_in and not bool(welcome_seen)
    
    logger.info(f"Welcome popup check - User logged in: {user_logged_in}, Show welcome: {show_welcome}")
    
    return templates.TemplateResponse("index.html", {
        "request": request, 
        "show_welcome": show_welcome
    })

# ============================================================================
# WELCOME POPUP MANAGEMENT
# ============================================================================

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

# ============================================================================
# FILE UPLOAD AND PREDICTION
# ============================================================================

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
            "img_path": file_path,
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

@router.post("/predict")
async def predict_image(
    request: Request,
    img_path: UploadFile = File(...),
    model_option: str = Form(...),
    location: str = Form(...),
    db: FirestoreDB = Depends(get_db)
):
    """Enhanced prediction endpoint with performance monitoring"""
    
    request_start_time = time.time()
    
    try:
        # Validate user session
        user_id = request.session.get('user_id')
        if not user_id:
            raise HTTPException(status_code=401, detail="User not authenticated")
        
        current_user = get_current_user(request, db)
        if not current_user:
            raise HTTPException(status_code=401, detail="User not found")
        
        logger.info(f"Prediction request from user: {user_id}")
        logger.info(f"Model requested: {model_option}")

        # Validate file
        if not img_path.filename:
            raise HTTPException(status_code=400, detail="No file uploaded")
        
        # Check file size (10MB limit)
        MAX_FILE_SIZE = 10 * 1024 * 1024
        content = await img_path.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large (max 10MB)")
        
        # Validate file type
        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
        if img_path.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="Invalid file type")

        # Ensure results directory exists
        results_dir = "static/uploads/results"
        os.makedirs(results_dir, exist_ok=True)

        # Create filename with timestamp and prediction info
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Clean location for filename (remove spaces, special chars)
        location_clean = location.replace(" ", "").replace(",", "").replace("(", "").replace(")", "")[:20] if location else "Unknown"
        
        # Generate filename
        uuid_suffix = generate_uuid_28()[:6]  # Short UUID for uniqueness
        file_extension = os.path.splitext(img_path.filename)[1]
        filename = f"{timestamp}_{location_clean}_{os.path.splitext(img_path.filename)[0]}_{uuid_suffix}{file_extension}"
        
        # Full path for saving
        file_path = os.path.join(results_dir, filename)

        # Save uploaded file
        file_save_start = time.time()        
        with open(file_path, "wb") as buffer:
            buffer.write(content)
        
        file_save_time = time.time() - file_save_start
        logger.info(f"File saved in {file_save_time:.3f}s: {filename}")

        stored_image_path = file_path.replace('\\', '/')  

        # Run prediction with enhanced function
        prediction_result = predict_img(
            model_option=model_option,
            img_path=file_path,
            use_cache=True
        )
        
        # Extract results
        predicted_class = prediction_result['predicted_class']
        confidence = prediction_result['confidence']
        response_message = prediction_result['response_message']
        performance_metrics = prediction_result.get('performance_metrics', {})
        
        # Get top 3 predictions for additional classes
        top_3_predictions = prediction_result.get('top_3_predictions', [])
        
        # Create new filename with predicted class
        predicted_class_clean = predicted_class.replace(" ", "").replace(",", "")
        final_filename = f"{timestamp}_{location_clean}_{predicted_class_clean}_{uuid_suffix}{file_extension}"
        final_file_path = os.path.join(results_dir, final_filename)
        
        # Rename file to include prediction
        try:
            os.rename(file_path, final_file_path)
            stored_image_path = final_file_path.replace('\\', '/') 
            logger.info(f"File renamed to include prediction: {final_file_path}")
        except Exception as rename_error:
            logger.warning(f"Could not rename file: {rename_error}")
            # Continue with original filename if rename fails
            stored_image_path = file_path.replace('\\', '/')

        # Generate unique ID for the classification
        classification_id = str(datetime.now().timestamp() * 1000)

        # Create classification entry
        classification_entry = ClassificationEntry(
            id=classification_id,
            user_id=user_id,
            user_role=current_user.role.value,
            image_path=stored_image_path,
            classification_result=predicted_class,
            confidence=confidence,
            model_used=model_option,
            location=location,
            timestamp=datetime.now(),
            second_class=top_3_predictions[1]['class'] if len(top_3_predictions) > 1 else None,
            second_confidence=top_3_predictions[1]['confidence'] if len(top_3_predictions) > 1 else None,
            third_class=top_3_predictions[2]['class'] if len(top_3_predictions) > 2 else None,
            third_confidence=top_3_predictions[2]['confidence'] if len(top_3_predictions) > 2 else None,
            user_feedback=None,
            is_correct=None,
            correct_class=None
        )

        # Save to database
        db_save_start = time.time()
        doc_id = db.save_classification(classification_entry)
        db_save_time = time.time() - db_save_start
        
        total_request_time = time.time() - request_start_time
        
        # Enhanced response with performance metrics
        response_data = {
            "success": True,
            "message": "success",
            "classification_result": predicted_class,
            "confidence": f"{confidence:.4f}",
            "response": response_message,
            "result_id": doc_id,
            "image_path": stored_image_path,
            "top_3_predictions": prediction_result.get('top_3_predictions', []),
            "performance": {
                **performance_metrics,
                "file_save_time": f"{file_save_time:.3f}s",
                "db_save_time": f"{db_save_time:.3f}s",
                "total_request_time": f"{total_request_time:.3f}s"
            }
        }
        
        logger.info(f"Prediction completed successfully in {total_request_time:.3f}s")
        
        return JSONResponse(content=response_data)
        
    except HTTPException:
        raise
    except Exception as e:
        total_request_time = time.time() - request_start_time
        logger.error(f"Prediction failed after {total_request_time:.3f}s: {str(e)}")
        
        # Cleanup uploaded file if it exists
        if 'file_path' in locals() and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except:
                pass
        if 'final_file_path' in locals() and os.path.exists(final_file_path):
            try:
                os.remove(final_file_path)
            except:
                pass
        
        return JSONResponse(
            status_code=500,
            content={
                "message": "error",
                "error": str(e),
                "request_time": f"{total_request_time:.3f}s"
            }
        )

# ============================================================================
# RESULT AND FEEDBACK ROUTES
# ============================================================================

@router.get("/result/{result_id}", response_class=HTMLResponse)
async def get_result(
    result_id: str, 
    request: Request, 
    edit_feedback: bool = False,
    db: FirestoreDB = Depends(get_db)
):
    """Get analysis result """
    try:
        # Get the classification result from database
        classification = db.get_classification_by_id(result_id)
        
        if not classification:
            raise HTTPException(status_code=404, detail="Result not found")
    
        # Get current user
        current_user = get_current_user(request, db)
        
        # Generate image URL for result
        image_path = classification.image_path
        logger.info(f"Original image path from database: {image_path}")

        if image_path:
            # Normalize path separators
            normalized_path = image_path.replace('\\', '/')
            
            # If path already starts with 'static/', prepend with '/'
            if normalized_path.startswith('static/'):
                img_url = '/' + normalized_path
            # If path already starts with '/static/', use as is
            elif normalized_path.startswith('/static/'):
                img_url = normalized_path
            # If path is just filename, assume it's in results directory
            else:
                img_url = f"/static/uploads/results/{normalized_path}"
            
            # Check if file exists (convert URL back to file path for checking)
            file_check_path = img_url.lstrip('/').replace('/', os.sep)
            
            if not os.path.exists(file_check_path):
                logger.warning(f"Image file not found at: {file_check_path}")
                logger.warning(f"Attempting to use placeholder image")
                img_url = "/static/assets/placeholder-image.png"
                
                # Ensure placeholder exists
                placeholder_path = "static/assets/placeholder-image.png"
                if not os.path.exists(placeholder_path):
                    logger.error(f"Placeholder image also missing: {placeholder_path}")
                    # Create a simple placeholder or use a default
                    img_url = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBOb3QgRm91bmQ8L3RleHQ+PC9zdmc+"
            else:
                logger.info(f"Image file found at: {file_check_path}")
                logger.info(f"Final image URL: {img_url}")
                
        else:
            logger.warning(f"No image path found for result {result_id}")
            img_url = "/static/assets/placeholder-image.png"

        # Prepare context for rendering
        context = {
            "request": request,
            "result_id": result_id,
            "classification": classification,
            "current_user": current_user,
            "can_edit": current_user and current_user.role in [UserRole.EXPERT, UserRole.ADMIN],
            "img_path": img_url,
            "class1": classification.classification_result,
            "class2": classification.second_class or "Unknown",
            "class3": classification.third_class or "Unknown", 
            "confidence1": f"{classification.confidence:.1%}",
            "confidence2": f"{classification.second_confidence:.1%}" if classification.second_confidence else "0.0%",
            "confidence3": f"{classification.third_confidence:.1%}" if classification.third_confidence else "0.0%",
            "response": f"Analisis menunjukkan {classification.classification_result} dengan tingkat keyakinan {classification.confidence:.1%}. Model yang digunakan: {classification.model_used}."
        }
        
        return templates.TemplateResponse("result.html", context)
        
    except Exception as e:
        logger.error(f"Error loading result {result_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error loading result")
    
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
            "img_path": image_url,
            "class1": classification.classification_result,
            "class2": classification.second_class or "Unknown",
            "class3": classification.third_class or "Unknown", 
            "confidence1": f"{classification.confidence:.1%}",
            "confidence2": f"{classification.second_confidence:.1%}" if classification.second_confidence else "0.0%",
            "confidence3": f"{classification.third_confidence:.1%}" if classification.third_confidence else "0.0%",
            "response": f"Analisis menunjukkan {classification.classification_result} dengan tingkat keyakinan {classification.confidence:.1%}. Model yang digunakan: {classification.model_used}."
        }
        
        return templates.TemplateResponse("expert_feedback.html", context)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error loading feedback page for {result_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error loading feedback page")


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

# ============================================================================
# HISTORY AND ADMIN ROUTES
# ============================================================================

@router.get("/history", response_class=HTMLResponse)
async def user_history(request: Request, db: FirestoreDB = Depends(get_db)):
    """User prediction history with role-based access"""
    current_user = get_current_user(request, db)
    if not current_user:
        return RedirectResponse(url="/login?next=/history", status_code=302)
    
    try:
        # Role-based data retrieval
        if current_user.role == UserRole.ADMIN:
            # Only Admin can see all classifications
            classifications_data = db.get_all_classifications_from_database(current_user.role)
            logger.info(f"Admin {current_user.uid} accessing all predictions: {len(classifications_data)} results")
        else:
            # Basic and Expert users see only their own
            classifications_data = db.get_classifications_by_user_id(current_user.uid)
            logger.info(f"{current_user.role.value} user {current_user.uid} accessing own predictions: {len(classifications_data)} results")
        
        # Convert to objects for template
        predictions = []
        for data in classifications_data:
            try:
                # Use the ID that's already in the data
                classification = ClassificationEntry.from_dict(data, data.get('id'))
                predictions.append(classification)
            except Exception as e:
                logger.warning(f"Error converting classification data: {e}")
                # Create a basic object with available data
                prediction = type('obj', (object,), {
                    'id': data.get('id'),
                    'stored_filename': data.get('imagePath', '').split('/')[-1] if data.get('imagePath') else '',
                    'classification_result': data.get('classificationResult'),
                    'confidence': data.get('confidence', 0),
                    'location': data.get('location'),
                    'model_used': data.get('modelUsed'),
                    'timestamp': data.get('timestamp') or data.get('createdAt'),
                    'user_id': data.get('userId'),
                    'user_role': data.get('userRole'),
                    'user_feedback': data.get('userFeedback'),
                    'is_correct': data.get('isCorrect')
                })
                predictions.append(prediction)
        
        return templates.TemplateResponse("history.html", {
            "request": request,
            "predictions": predictions,
            "current_user": current_user,
            "is_admin": current_user.role == UserRole.ADMIN,
            "is_expert": current_user.role == UserRole.EXPERT,
            "is_expert_or_admin": current_user.role in [UserRole.EXPERT, UserRole.ADMIN]
        })
        
    except Exception as e:
        logger.error(f"History error for user {current_user.uid}: {e}")
        return templates.TemplateResponse("history.html", {
            "request": request,
            "predictions": [],
            "current_user": current_user,
            "is_admin": current_user.role == UserRole.ADMIN,
            "is_expert": current_user.role == UserRole.EXPERT,
            "is_expert_or_admin": current_user.role in [UserRole.EXPERT, UserRole.ADMIN],
            "error": "Failed to load prediction history"
        })

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

# ============================================================================
# DEBUG ROUTES (for development only)
# ============================================================================

@router.get("/debug/user")
async def debug_user_info(request: Request, db: FirestoreDB = Depends(get_db)):
    """Debug route to check current user info"""
    try:
        current_user = get_current_user(request, db)
        if not current_user:
            return JSONResponse(content={"authenticated": False, "session": dict(request.session)})
        
        return JSONResponse(content={
            "authenticated": True,
            "user_id": current_user.uid,
            "user_role": current_user.role.value,
            "user_name": current_user.display_name,
            "session": dict(request.session)
        })
    except Exception as e:
        return JSONResponse(content={"error": str(e)})

@router.get("/debug/classifications")
async def debug_classifications(request: Request, db: FirestoreDB = Depends(get_db)):
    """Debug route to check classifications data"""
    try:
        current_user = get_current_user(request, db)
        if not current_user:
            return JSONResponse(content={"error": "Not authenticated"})
        
        if current_user.role == UserRole.ADMIN:
            classifications_data = db.get_all_classifications_from_database(current_user.role)
        else:
            classifications_data = db.get_classifications_by_user_id(current_user.uid)
        
        return JSONResponse(content={
            "user_role": current_user.role.value,
            "classifications_count": len(classifications_data),
            "sample_data": classifications_data[:2] if classifications_data else []
        })
    except Exception as e:
        return JSONResponse(content={"error": str(e)})