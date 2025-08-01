// CAMERA MANAGEMENT MODULE
const CameraElements = {
    container: null, video: null, canvas: null, controls: null, preview: null,
    fileName: null, fileInfo: null, predictButton: null, locationInput: null,
    cameraModeBtn: null, fileModeBtn: null, uploadZone: null,
    
    init() {
        this.container = document.getElementById('camera-container');
        this.video = document.getElementById('camera-preview');
        this.canvas = document.getElementById('camera-canvas');
        this.controls = document.querySelector('.camera-controls');
        this.preview = document.getElementById('camera-preview-overlay');
        this.fileName = document.getElementById('file-name');
        this.fileInfo = document.getElementById('file-info');
        this.predictButton = document.querySelector('.btn-predict-image');
        this.locationInput = document.getElementById('sampling-location');
        this.cameraModeBtn = document.getElementById('camera-mode-btn');
        this.fileModeBtn = document.getElementById('file-mode-btn');
        this.uploadZone = document.getElementById('upload-zone');
    },
    
    refresh() { this.init(); }
};

window.isCameraActive = false;

// Unified stream management
function stopAllStreams() {
    const streamSources = [
        PlanktoScanApp?.currentStream,
        CameraElements.video?.srcObject,
        window.CameraState?.stream
    ];
    
    streamSources.forEach(stream => {
        if (stream && stream.getTracks) {
            stream.getTracks().forEach(track => {
                track.stop();
                console.log(`Stopped ${track.kind} track`);
            });
        }
    });
    
    // Reset all references
    if (PlanktoScanApp) PlanktoScanApp.currentStream = null;
    if (window.CameraState) {
        CameraState.stream = null;
        CameraState.isActive = false;
    }
    
    if (CameraElements.video) {
        CameraElements.video.srcObject = null;
    }
    
    console.log('All camera streams stopped and references cleared');
}

/**
 * Unified camera management
 */
async function manageCamera(action, facingMode = null) {
    try {
        switch(action) {
            case 'start':
                if (window.isCameraActive) {
                    console.log('Camera already active, skipping start');
                    return;
                }
                
                await stopAllStreams();
                window.isCameraActive = true;
                
                const constraints = {
                    video: {
                        facingMode: PlanktoScanApp.facingMode || 'environment',
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                };
                
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                PlanktoScanApp.currentStream = stream;
                
                if (CameraElements.video) {
                    CameraElements.video.srcObject = stream;
                    await CameraElements.video.play();
                }
                
                console.log('Camera started successfully');
                break;
                
            case 'stop':
                window.isCameraActive = false;
                stopAllStreams();
                console.log('Camera stopped successfully');
                break;
                
            case 'switch':
                if (facingMode) {
                    PlanktoScanApp.facingMode = facingMode;
                } else {
                    PlanktoScanApp.facingMode = PlanktoScanApp.facingMode === 'user' ? 'environment' : 'user';
                }
                
                console.log(`Switching camera to: ${PlanktoScanApp.facingMode}`);
                await manageCamera('stop');
                await new Promise(resolve => setTimeout(resolve, 300)); // Brief delay
                await manageCamera('start');
                break;
        }
    } catch (error) {
        console.error(`Camera management error (${action}):`, error);
        window.isCameraActive = false;
        throw error;
    }
}

/**
 * Start camera stream
 */
async function startCamera() {
    return await manageCamera('start');
}

/**
 * Stop camera stream
 */
async function stopCamera() {
    return await manageCamera('stop');
}

/**
 * Switch  camera
 */
async function switchCamera() {
    return await manageCamera('switch');
}

/**
 * Capture photo from camera
 */
function capturePhoto() {
    if (!CameraElements.video || !CameraElements.canvas || !CameraElements.container) {
        console.error('Camera elements not found');
        return;
    }
    
    const ctx = CameraElements.canvas.getContext('2d');
    
    // Set canvas dimensions to match video
    CameraElements.canvas.width = CameraElements.video.videoWidth;
    CameraElements.canvas.height = CameraElements.video.videoHeight;
    
    // Draw video frame to canvas
    ctx.drawImage(CameraElements.video, 0, 0);
    
    // Convert to blob and create file
    CameraElements.canvas.toBlob(function(blob) {
        const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
        
        // Show image preview from canvas in camera container
        const dataURL = CameraElements.canvas.toDataURL('image/jpeg', 1);

        // Store captured file globally
        PlanktoScanApp.capturedImageFile = file;
        PlanktoScanApp.uploadedImagePath = dataURL;

        // Upload the captured image using createCameraPreview
        uploadCapturedImage(file, dataURL, CameraElements.container);
        
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
    if (CameraElements.container) {
        CameraElements.container.classList.remove('success');
    }

    // Ensure video is visible and reset
    if (CameraElements.video) {
        CameraElements.video.style.display = 'block';
        CameraElements.video.style.visibility = 'visible';
        CameraElements.video.style.opacity = '1';
        CameraElements.video.style.zIndex = '1';
    }
    
    // Ensure camera controls are visible
    if (CameraElements.controls) {
        CameraElements.controls.style.display = 'flex';
        CameraElements.controls.style.visibility = 'visible';
    }

    // Clear cached preview overlay reference
    CameraElements.preview = null;
    
    console.log('Camera state cleaned');
}

/**
 * Unified mode switching function
 */
function switchMode(mode) {
    console.log(`Switching to ${mode} mode`);
    
    // Reset state first
    window.capturedImageFile = null;
    PlanktoScanApp.uploadedImagePath = '';
    
    // Reset UI elements
    if (CameraElements.fileName) CameraElements.fileName.textContent = 'No file selected';
    if (CameraElements.fileInfo) CameraElements.fileInfo.style.display = 'none';
    if (CameraElements.predictButton) CameraElements.predictButton.disabled = true;
    
    // Reset location if no GPS
    if (CameraElements.locationInput && (!gpsState || !gpsState.lastKnownPosition)) {
        CameraElements.locationInput.value = 'Unknown';
    }
    
    if (mode === 'camera') {
        // Camera mode activation
        CameraElements.cameraModeBtn?.classList.add('active');
        CameraElements.fileModeBtn?.classList.remove('active');
        
        if (CameraElements.uploadZone) CameraElements.uploadZone.style.display = 'none';
        if (CameraElements.container) CameraElements.container.style.display = 'block';
        
        cleanCameraState();
        startCamera().catch(error => {
            console.error('Failed to start camera:', error);
            showError('Failed to start camera. Please check permissions.');
        });
        
    } else if (mode === 'file') {
        // File mode activation
        CameraElements.fileModeBtn?.classList.add('active');
        CameraElements.cameraModeBtn?.classList.remove('active');
        
        if (CameraElements.uploadZone) CameraElements.uploadZone.style.display = 'block';
        if (CameraElements.container) CameraElements.container.style.display = 'none';
        
        cleanCameraState();
        stopCamera();
        
        // Reset upload zone to initial state
        if (typeof resetFileUpload === 'function') {
            resetFileUpload();
        }
    }
    
    console.log(`Successfully switched to ${mode} mode`);
}

/**
 * Switch to camera mode and initialize camera
 */
function switchToCameraMode() {
    switchMode('camera');
}

/**
 * Switch to file upload mode
 */
function switchToFileMode() {
    switchMode('file');
}

/**
 * Upload captured image to server
 */
function uploadCapturedImage(file, dataURL, cameraContainer) {
    const formData = new FormData();
    formData.append('file', file);

    // Show uploading state menggunakan cached elements
    if (CameraElements.fileName) CameraElements.fileName.textContent = 'Uploading camera capture...';
    if (CameraElements.fileInfo) CameraElements.fileInfo.style.display = 'block';
    if (CameraElements.predictButton) CameraElements.predictButton.disabled = true;
    
    // Stop camera stream
    stopCamera();

    // Add success state to camera container
    if (cameraContainer) {
        cameraContainer.classList.add('success');
        console.log('Camera container success state added');
    }
    
    // Show camera preview
    createCameraPreview(dataURL, 'captured');
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

            // Update UI using cached elements
            if (CameraElements.fileName) CameraElements.fileName.textContent = 'Camera capture: ' + file.name;
            if (CameraElements.fileInfo) CameraElements.fileInfo.style.display = 'block';
            if (CameraElements.predictButton) CameraElements.predictButton.disabled = false;
            
            // Update jQuery elements
            $('.upload-zone').removeClass('uploading').addClass('success');
            $('#image-upload').val(data.img_path);
            
            // Update camera preview with success using optimized function
            createCameraPreview(dataURL, 'uploaded');
            
            console.log('Camera image uploaded successfully:', data.img_path);
        },
        error: () => {
            $('.upload-zone').removeClass('uploading');
            if (CameraElements.fileName) CameraElements.fileName.textContent = 'Upload failed';
            showError("Failed to upload camera image. Please try again.");
        }
    });
}

/**
 * Unified camera preview creation and management
 */
function createCameraPreview(dataURL, status = 'captured') {
    if (!CameraElements.container) {
        console.error('Camera container not found');
        return;
    }
    
    // Create temp image to get dimensions
    const tempImg = new Image();
    tempImg.onload = function() {
        const originalWidth = this.width;
        const originalHeight = this.height;
        
        // Setup or update preview overlay
        setupPreviewOverlay(dataURL, originalWidth, originalHeight, status);
        
        // Update container state based on status
        if (status === 'captured') {
            CameraElements.container.classList.add('success');
            
            // Hide camera controls when photo is captured
            if (CameraElements.controls) {
                CameraElements.controls.style.display = 'none';
            }
            
            // Update UI elements
            if (CameraElements.fileName) {
                CameraElements.fileName.textContent = 'camera-capture.jpg';
            }
            if (CameraElements.fileInfo) {
                CameraElements.fileInfo.style.display = 'block';
            }
            if (CameraElements.predictButton) {
                CameraElements.predictButton.disabled = false;
            }
            
        } else if (status === 'uploaded') {
            // Keep success state, just update message
            console.log('Preview updated to show upload success');
        }
        
        console.log(`Camera preview ${status === 'captured' ? 'created' : 'updated'} with status: ${status}`);
    };
    
    tempImg.onerror = function() {
        console.error('Failed to load camera preview image');
        showError('Failed to process camera image');
    };
    
    tempImg.src = dataURL;
}

/**
 * Setup/Update preview overlay
 */
function setupPreviewOverlay(dataURL, originalWidth, originalHeight, status) {
    // Get or create overlay
    let previewOverlay = CameraElements.preview;
    if (!previewOverlay) {
        previewOverlay = document.createElement('div');
        previewOverlay.id = 'camera-preview-overlay';
        CameraElements.container.appendChild(previewOverlay);
        CameraElements.preview = previewOverlay; // Cache it
    }
    
    // Determine message based on status
    const message = status === 'captured' ? 'Photo Captured!' : 'Upload Successful!';
    
    // Set content using CSS classes (styles moved to CSS)
    previewOverlay.innerHTML = `
        <div class="camera-image-preview" style="width: ${originalWidth}px; height: ${originalHeight}px;">
            <img src="${dataURL}" alt="Camera Capture">
            <div class="camera-overlay">
                <i class="fas fa-check-circle"></i>
                <div class="success-text">${message}</div>
                <div class="change-text">Click to take another photo</div>
            </div>
        </div>
    `;
    
    // Add click functionality only for captured status
    if (status === 'captured') {
        previewOverlay.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            resetCameraCapture();
        };
    }
}

/**
 * Update preview to show upload success
 */
function updateCameraPreviewSuccess() {
    if (window.capturedImageFile && window.capturedImageFile.dataURL) {
        createCameraPreview(window.capturedImageFile.dataURL, 'uploaded');
    } else {
        console.warn('No captured image data found for upload success update');
    }
}

/**
 * Reset camera capture state to initial state
 */
function resetCameraCapture() {    
    // Reset global variables
    window.capturedImageFile = null;
    PlanktoScanApp.uploadedImagePath = '';
    
    // Reset location input to default if no GPS position
    if (CameraElements.locationInput) {
        if (!gpsState || !gpsState.lastKnownPosition) {
            CameraElements.locationInput.value = 'Unknown';
            console.log('Location input reset to default: Unknown');
        } else {
            console.log('Keeping GPS location after reset');
        }
    }

    // Reset UI elements using cached elements
    if (CameraElements.fileName) CameraElements.fileName.textContent = 'No file selected';
    if (CameraElements.fileInfo) CameraElements.fileInfo.style.display = 'none';
    if (CameraElements.predictButton) CameraElements.predictButton.disabled = true;
    
    // Remove success state from camera container
    if (CameraElements.container) {
        CameraElements.container.classList.remove('success');
    }
    
    // Clean camera state completely
    cleanCameraState();
    
    // Restart camera stream with optimized function
    setTimeout(async () => {
        try {
            if (PlanktoScanApp.currentStream) {
                await manageCamera('stop');
                await new Promise(resolve => setTimeout(resolve, 300));
                await manageCamera('start');
            } else {
                await manageCamera('start');
            }
        } catch (error) {
            console.error('Failed to restart camera:', error);
            showError('Failed to restart camera');
        }
    }, 100);
    
    console.log('Camera capture state reset completely');
}

/**
 * Setup camera event handlers
 */
function setupCameraHandlers() {
    // Initialize camera elements
    CameraElements.init();

    // Camera mode button
    if (CameraElements.cameraModeBtn) {
        CameraElements.cameraModeBtn.addEventListener('click', switchToCameraMode);
    }
    
    // File mode button
    if (CameraElements.fileModeBtn) {
        CameraElements.fileModeBtn.addEventListener('click', switchToFileMode);
    }
    
    // Camera control buttons
    const captureBtn = document.getElementById('capture-btn');
    const switchBtn = document.getElementById('switch-camera-btn');
    const uploadBtn = document.getElementById('upload-captured-btn');

    if (captureBtn) {
        captureBtn.addEventListener('click', capturePhoto);
    }
    
    if (switchBtn) {
        switchBtn.addEventListener('click', switchCamera);
    }
    
    if (uploadBtn) {
        uploadBtn.addEventListener('click', function() {
            if (window.capturedImageFile) {
                uploadCapturedImage(window.capturedImageFile.dataURL);
            }
        });
    }
    
    console.log('Camera event handlers setup complete with cached elements');
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
    window.resetCameraCapture = resetCameraCapture;
    window.setupCameraHandlers = setupCameraHandlers;
}