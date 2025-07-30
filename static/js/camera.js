// CAMERA MANAGEMENT MODULE

window.isCameraActive = false;

/**
 * Start camera stream
 */
async function startCamera() {
    // Check if camera is already active
    if (window.isCameraActive) return;
    window.isCameraActive = true;

    // Stop any existing camera stream
    await stopCamera();

    console.log('Starting camera stream...');

    // Initialize facing mode if not set
    try {
        const constraints = {
            video: {
                facingMode: PlanktoScanApp.facingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };
        
        PlanktoScanApp.currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        const video = document.getElementById('camera-preview');
        if (video) {
            video.srcObject = PlanktoScanApp.currentStream;
        }
        
        // Ensure camera container is visible
        const container = document.getElementById('camera-container');
        if (container) {
            container.style.opacity = '0';
            container.style.display = 'block';
            setTimeout(() => {
                container.style.transition = 'opacity 0.3s ease';
                container.style.opacity = '1';
            }, 10);
        }
        
        window.isCameraActive = true;
    } catch (error) {
        window.isCameraActive = false;
        console.error('Error accessing camera:', error);
        alert('Error accessing camera. Please make sure you have granted camera permissions.');
        switchToFileMode();
    }
}

/**
 * Stop camera stream
 */
function stopCamera() {
    window.isCameraActive = false;
    console.log('Stopping camera stream...');

    // Stop stream from PlanktoScanApp
    if (window.PlanktoScanApp && PlanktoScanApp.currentStream) {
        PlanktoScanApp.currentStream.getTracks().forEach(track => track.stop());
        PlanktoScanApp.currentStream = null;
    }
    // Stop stream from video element directly (in case it's not the same as PlanktoScanApp.currentStream)
    const video = document.getElementById('camera-preview');
    if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }

    // Reset camera state
    if (window.CameraState) {
        if (CameraState.stream) {
            CameraState.stream.getTracks().forEach(track => track.stop());
            CameraState.stream = null;
        }
        CameraState.isActive = false;
    }

    console.log('Camera stopped successfully');
}

/**
 * Switch between front and back camera
 */
function switchCamera() {
    PlanktoScanApp.facingMode = PlanktoScanApp.facingMode === 'user' ? 'environment' : 'user';
    stopCamera();
    startCamera();
}

/**
 * Capture photo from camera
 */
function capturePhoto() {
    const video = document.getElementById('camera-preview');
    const canvas = document.getElementById('camera-canvas');
    const cameraContainer = document.getElementById('camera-container');
    
    if (!video || !canvas) {
        console.error('Camera preview or canvas not found');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0);
    
    // Convert to blob and create file
    canvas.toBlob(function(blob) {
        const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
        
        // Show image preview from canvas in camera container
        const dataURL = canvas.toDataURL('image/jpeg', 1);

        // Store captured file globally
        PlanktoScanApp.capturedImageFile = file;
        PlanktoScanApp.uploadedImagePath = dataURL;

        // Upload the captured image
        uploadCapturedImage(file, dataURL, cameraContainer);
        
    }, 'image/jpeg', 0.9);
}

/**
 * Clean camera state by removing overlays and resetting video
 */
function cleanCameraState() {
    // Remove any existing preview overlays
    const existingOverlays = document.querySelectorAll('#camera-preview-overlay');
    existingOverlays.forEach(overlay => overlay.remove());
    
    // Reset camera container state
    const cameraContainer = document.getElementById('camera-container');
    if (cameraContainer) {
        cameraContainer.classList.remove('success');
    }

    // Ensure video is visible
    const video = document.getElementById('camera-preview');
    if (video) {
        video.style.display = 'block';
        video.style.visibility = 'visible';
        video.style.opacity = '1';
        video.style.zIndex = '1';
    }
    
    // Ensure camera controls are visible
    const cameraControls = document.querySelector('.camera-controls');
    if (cameraControls) {
        cameraControls.style.display = 'flex';
        cameraControls.style.visibility = 'visible';
    }
    
    console.log('Camera state cleaned');
}

/**
 * Switch to camera mode and initialize camera
 */
function switchToCameraMode() {
    const fileModeBtn = document.getElementById('file-mode-btn');
    const cameraModeBtn = document.getElementById('camera-mode-btn');
    const uploadZone = document.getElementById('upload-zone');
    const cameraContainer = document.getElementById('camera-container');
    
    if (cameraModeBtn) cameraModeBtn.classList.add('active');
    if (fileModeBtn) fileModeBtn.classList.remove('active');
    if (uploadZone) uploadZone.style.display = 'none';
    if (cameraContainer) cameraContainer.style.display = 'block';
 
    // Reset state variables
    PlanktoScanApp.uploadedImagePath = '';
    window.capturedImageFile = null;

    // Clean camera state to ensure fresh start
    cleanCameraState();
    
    startCamera();
}

/**
 * Switch to file upload mode and stop camera
 */
function switchToFileMode() {
    const fileModeBtn = document.getElementById('file-mode-btn');
    const cameraModeBtn = document.getElementById('camera-mode-btn');
    const uploadZone = document.getElementById('upload-zone');
    const cameraContainer = document.getElementById('camera-container');
    
    if (fileModeBtn) fileModeBtn.classList.add('active');
    if (cameraModeBtn) cameraModeBtn.classList.remove('active');
    if (uploadZone) uploadZone.style.display = 'block';
    if (cameraContainer) cameraContainer.style.display = 'none';
    
    // Clean camera state
    cleanCameraState();
    
    // Reset state variables
    window.capturedImageFile = null;    
    
    // Hide camera preview overlay if exists
    const previewOverlay = document.getElementById('camera-preview-overlay');
    if (previewOverlay) {
        previewOverlay.style.display = 'none';
    }
    
    // Show video again if exists
    const video = document.getElementById('camera-preview');
    if (video) {
        video.style.display = 'block';
    }
    
    // Show camera controls again
    const cameraControls = document.querySelector('.camera-controls');
    if (cameraControls) {
        cameraControls.style.display = 'flex';
    }
    
    stopCamera();
}


/**
 * Upload captured image to server
 */
function uploadCapturedImage(file, dataURL, cameraContainer) {
    const formData = new FormData();
    formData.append('file', file);

    // Show uploading state
    const $imageUploadInput = $('#image-upload');
    const $fileName = $('#file-name');
    const $fileInfo = $('#file-info');
    const $uploadZone = $('.upload-zone');
    const $predictButton = $('.btn-predict-image');
    
    $fileName.text('Uploading camera capture...');
    $fileInfo.show();
    $predictButton.prop('disabled', true);
    
    // Stop camera stream
    stopCamera();

    // Add success state to camera container
    if (cameraContainer) {
        cameraContainer.classList.add('success');
        console.log('Camera container success state added');
    }
    
    // Show camera preview
    showCameraPreview(dataURL);
    console.log('Photo captured successfully, camera stopped, and preview displayed');

    // Upload to server
    $.ajax({
        url: '/upload',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: (data) => {
            PlanktoScanApp.uploadedImagePath = data.img_path;
            $imageUploadInput.val(data.img_path);
            $fileName.text('Camera capture: ' + file.name);
            $fileInfo.show();
            $predictButton.prop('disabled', false);
            $uploadZone.removeClass('uploading');
            $uploadZone.addClass('success');
            
            // Update camera preview with success indicator
            updateCameraPreviewSuccess();
            
            console.log('Camera image uploaded successfully:', data.img_path);
            stopCamera();
        },
        error: () => {
            $uploadZone.removeClass('uploading');
            $fileName.text('Upload failed');
            showError("Failed to upload camera image. Please try again.");
        }
    });
}

/**
 * Show camera capture preview with overlay
 */
function showCameraPreview(dataURL) {
    const cameraContainer = document.getElementById('camera-container');
    const cameraPreviewWrapper = cameraContainer.querySelector('.camera-preview-wrapper');
    
    if (!cameraContainer || !cameraPreviewWrapper) {
        console.error('Camera container or preview wrapper not found');
        return;
    }
    
    // Add success state to camera container
    cameraContainer.classList.add('success');

    // Hide camera controls
    const cameraControls = document.querySelector('.camera-controls');
    if (cameraControls) {
        cameraControls.style.display = 'none';
    }
    
    // Create temporary image to get original dimensions
    const tempImg = new Image();
    tempImg.onload = function() {
        const originalWidth = this.width;
        const originalHeight = this.height;
        
        // Create or update camera preview overlay
        let previewOverlay = document.getElementById('camera-preview-overlay');
        if (!previewOverlay) {
            previewOverlay = document.createElement('div');
            previewOverlay.id = 'camera-preview-overlay';
            cameraContainer.appendChild(previewOverlay);
        }
        
        // Set overlay content and styles
        setupCameraPreviewOverlay(previewOverlay, dataURL, originalWidth, originalHeight);
        
        console.log('Camera preview overlay created');
    };
    
    tempImg.onerror = function() {
        console.error('Failed to load captured image for preview');
    };
    
    tempImg.src = dataURL;
}

/**
 * Setup camera preview overlay with interactive elements
 */
function setupCameraPreviewOverlay(previewOverlay, dataURL, originalWidth, originalHeight) {
    // Set overlay styles
    previewOverlay.style.position = 'absolute';
    previewOverlay.style.top = '0';
    previewOverlay.style.left = '0';
    previewOverlay.style.width = '100%';
    previewOverlay.style.height = '100%';
    previewOverlay.style.zIndex = '20';
    previewOverlay.style.background = '#000';
    previewOverlay.style.borderRadius = '15px';
    previewOverlay.style.display = 'flex';
    previewOverlay.style.alignItems = 'center';
    previewOverlay.style.justifyContent = 'center';
    
    previewOverlay.innerHTML = `
        <div class="camera-image-preview" style="
            position: relative;
            width: ${originalWidth}px;
            height: ${originalHeight}px;
            max-width: 100%;
            max-height: 100%;
            background: #000;
            border-radius: 15px;
            overflow: hidden;
            cursor: pointer;
            pointer-events: auto;
        ">
            <img src="${dataURL}" alt="Camera Capture" style="
                width: ${originalWidth}px;
                height: ${originalHeight}px;
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
                border-radius: 15px;
                display: block;
                pointer-events: none;
            ">
            <div class="camera-success-indicator" style="
                position: absolute;
                top: 15px;
                right: 15px;
                background: #27AE60;
                color: white;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.2rem;
                box-shadow: 0 4px 12px rgba(39, 174, 96, 0.4);
                z-index: 30;
                pointer-events: none;
            ">
                <i class="fas fa-check"></i>
            </div>
            <div class="camera-overlay" style="
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.8);
                color: white;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.3s ease;
                border-radius: 15px;
                z-index: 25;
                pointer-events: none;
            ">
                <i class="fas fa-check-circle" style="font-size: 3rem; margin-bottom: 15px; color: #27AE60;"></i>
                <div style="font-size: 1.2rem; color: #27AE60; margin-bottom: 5px;">Photo Captured!</div>
                <div style="font-size: 1rem; color: #fff; text-align: center;">Click to take another photo</div>
            </div>
        </div>
    `;
    
    // Add click functionality to retake photo
    previewOverlay.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        retakePhoto();
    };
    
    // Add hover effects
    setupCameraOverlayHover(previewOverlay);
}

/**
 * Setup hover effects for camera overlay
 */
function setupCameraOverlayHover(previewOverlay) {
    const overlay = previewOverlay.querySelector('.camera-overlay');
    if (overlay) {
        previewOverlay.onmouseenter = function() {
            overlay.style.opacity = '1';
        };
        previewOverlay.onmouseleave = function() {
            overlay.style.opacity = '0';
        };
    }
}

/**
 * Retake photo functionality
 */
function retakePhoto() {
    console.log('Retake photo clicked');
    
    const cameraContainer = document.getElementById('camera-container');
    
    // Remove success state from camera container
    if (cameraContainer) {
        cameraContainer.classList.remove('success');
    }

    // Reset camera capture state
    resetCameraCapture();
}

/**
 * Reset camera capture state to initial state
 */
function resetCameraCapture() {
    const cameraContainer = document.getElementById('camera-container');
    const $fileName = $('#file-name');
    const $fileInfo = $('#file-info');
    const $predictButton = $('.btn-predict-image');
    const $locationInput = $('#sampling-location');
    
    // Reset global variables
    window.capturedImageFile = null;
    PlanktoScanApp.uploadedImagePath = '';
    
    // Reset location input to default if no GPS position
    if ($locationInput.length) {
        if (!gpsState.lastKnownPosition) {
            $locationInput.val('Unknown');
            console.log('Location input reset to default: Unknown');
        } else {
            console.log('Keeping GPS location after reset');
        }
    }

    // Reset UI elements
    $fileName.text('No file selected');
    $fileInfo.hide();
    $predictButton.prop('disabled', true);
    
    // Remove success state from camera container
    if (cameraContainer) {
        cameraContainer.classList.remove('success');
    }
    
    // Clean camera state completely
    cleanCameraState();
    
    // Restart camera stream
    setTimeout(() => {
        if (PlanktoScanApp.currentStream) {
            stopCamera();
            setTimeout(() => {
                startCamera();
            }, 300);
        } else {
            startCamera();
        }
    }, 100);
    
    console.log('Camera capture state reset completely');
}

/**
 * Update camera preview with success indicator
 */
function updateCameraPreviewSuccess() {
    const previewOverlay = document.getElementById('camera-preview-overlay');
    if (!previewOverlay) return;
    
    // Update the success indicator
    const successIndicator = previewOverlay.querySelector('.camera-success-indicator');
    if (successIndicator) {
        successIndicator.innerHTML = '<i class="fas fa-check"></i>';
        successIndicator.style.background = '#27AE60';
    }
    
    // Update overlay text
    const overlay = previewOverlay.querySelector('.camera-overlay');
    if (overlay) {
        overlay.innerHTML = `
            <i class="fas fa-check-circle" style="font-size: 3rem; margin-bottom: 15px; color: #27AE60;"></i>
            <div style="font-size: 1.2rem; color: #27AE60; margin-bottom: 5px;">Upload Successful!</div>
            <div style="font-size: 1rem; color: #fff; text-align: center;">Click to take another photo</div>
        `;
    }
    
    console.log('Camera preview updated with success indicator');
}

/**
 * Setup camera event handlers
 */
function setupCameraHandlers() {
    // Camera mode button
    const cameraModeBtn = document.getElementById('camera-mode-btn');
    if (cameraModeBtn) {
        cameraModeBtn.addEventListener('click', switchToCameraMode);
    }
    
    // File mode button
    const fileModeBtn = document.getElementById('file-mode-btn');
    if (fileModeBtn) {
        fileModeBtn.addEventListener('click', switchToFileMode);
    }
    
    // Camera control buttons
    const captureBtn = document.getElementById('capture-btn');
    if (captureBtn) {
        captureBtn.addEventListener('click', capturePhoto);
    }
    
    const switchCameraBtn = document.getElementById('switch-camera-btn');
    if (switchCameraBtn) {
        switchCameraBtn.addEventListener('click', switchCamera);
    }
    
    console.log('Camera event handlers setup complete');
}

// Cleanup camera when page unloads
window.addEventListener('beforeunload', function() {
    stopCamera();
});

// Export to global scope
if (typeof window !== 'undefined') {
    window.cleanCameraState = cleanCameraState;
    window.switchToCameraMode = switchToCameraMode;
    window.switchToFileMode = switchToFileMode;
    window.startCamera = startCamera;
    window.stopCamera = stopCamera;
    window.switchCamera = switchCamera;
    window.capturePhoto = capturePhoto;
    window.showCameraPreview = showCameraPreview;
    window.updateCameraPreviewSuccess = updateCameraPreviewSuccess;
    window.resetCameraCapture = resetCameraCapture;
    window.setupCameraHandlers = setupCameraHandlers;
}