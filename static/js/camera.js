// CAMERA MANAGEMENT MODULE
const CameraElements = {
    container: null, video: null, canvas: null, controls: null, preview: null,
    fileName: null, fileInfo: null, predictButton: null, locationInput: null,
    cameraModeBtn: null, fileModeBtn: null, uploadZone: null,
    
    init() {
        const elements = {
            container: 'camera-container', video: 'camera-preview', canvas: 'camera-canvas',
            fileName: 'file-name', fileInfo: 'file-info', locationInput: 'sampling-location',
            cameraModeBtn: 'camera-mode-btn', fileModeBtn: 'file-mode-btn', uploadZone: 'upload-zone'
        };
        
        Object.keys(elements).forEach(key => {
            this[key] = document.getElementById(elements[key]);
        });
        
        this.controls = document.querySelector('.camera-controls');
        this.preview = document.getElementById('camera-preview-overlay');
        this.predictButton = document.querySelector('.btn-predict-image');
    },
    
    refresh() { this.init(); }
};

window.isCameraActive = false;

// Stream management
function stopAllStreams() {
    [PlanktoScanApp?.currentStream, CameraElements.video?.srcObject, window.CameraState?.stream]
        .forEach(stream => stream?.getTracks?.()?.forEach(track => track.stop()));
    
    if (PlanktoScanApp) PlanktoScanApp.currentStream = null;
    if (window.CameraState) Object.assign(CameraState, { stream: null, isActive: false });
    if (CameraElements.video) CameraElements.video.srcObject = null;
}

// Camera management
async function manageCamera(action, facingMode = null) {
    try {
        switch(action) {
            case 'start':
                if (window.isCameraActive) return;
                await stopAllStreams();
                window.isCameraActive = true;
                
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { 
                        facingMode: PlanktoScanApp.facingMode || 'environment', 
                        width: { ideal: 1280 }, height: { ideal: 720 } 
                    }
                });
                
                PlanktoScanApp.currentStream = stream;
                if (CameraElements.video) {
                    CameraElements.video.srcObject = stream;
                    await CameraElements.video.play();
                }
                break;
                
            case 'stop':
                window.isCameraActive = false;
                stopAllStreams();
                break;
                
            case 'switch':
                PlanktoScanApp.facingMode = facingMode || 
                    (PlanktoScanApp.facingMode === 'user' ? 'environment' : 'user');
                await manageCamera('stop');
                await new Promise(resolve => setTimeout(resolve, 300));
                await manageCamera('start');
                break;
        }
    } catch (error) {
        console.error(`Camera ${action} error:`, error);
        window.isCameraActive = false;
        throw error;
    }
}

// Camera control wrappers
function startCamera() { return manageCamera('start'); }
function stopCamera() { return manageCamera('stop'); }
function switchCamera() { return manageCamera('switch'); }

// UI state management helper
function updateUIState(state, fileName = '') {
    const states = {
        reset: { fileName: 'No file selected', fileInfo: 'none', predictButton: true },
        captured: { fileName: fileName || 'camera-capture.jpg', fileInfo: 'block', predictButton: false },
        uploading: { fileName: 'Uploading camera capture...', fileInfo: 'block', predictButton: true },
        failed: { fileName: 'Upload failed', fileInfo: 'block', predictButton: true }
    };
    
    const config = states[state];
    if (!config) return;
    
    if (CameraElements.fileName) CameraElements.fileName.textContent = config.fileName;
    if (CameraElements.fileInfo) CameraElements.fileInfo.style.display = config.fileInfo;
    if (CameraElements.predictButton) CameraElements.predictButton.disabled = config.predictButton;
}

// Capture photo
function capturePhoto() {
    if (!CameraElements.video || !CameraElements.canvas || !CameraElements.container) return;
    
    const ctx = CameraElements.canvas.getContext('2d');
    Object.assign(CameraElements.canvas, { 
        width: CameraElements.video.videoWidth, 
        height: CameraElements.video.videoHeight 
    });
    
    ctx.drawImage(CameraElements.video, 0, 0);
    
    CameraElements.canvas.toBlob(blob => {
        const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
        const dataURL = CameraElements.canvas.toDataURL('image/jpeg', 1);
        
        Object.assign(PlanktoScanApp, { capturedImageFile: file, uploadedImagePath: dataURL });
        uploadCapturedImage(file, dataURL, CameraElements.container);
    }, 'image/jpeg', 0.9);
}

// Clean camera state
function cleanCameraState() {
    document.querySelectorAll('#camera-preview-overlay').forEach(overlay => overlay.remove());
    
    if (CameraElements.container) CameraElements.container.classList.remove('success');
    if (CameraElements.video) {
        Object.assign(CameraElements.video.style, { 
            display: 'block', visibility: 'visible', opacity: '1', zIndex: '1' 
        });
    }
    if (CameraElements.controls) {
        Object.assign(CameraElements.controls.style, { 
            display: 'flex', visibility: 'visible' 
        });
    }
    
    CameraElements.preview = null;
}

// Mode switching
function switchMode(mode) {
    console.log('switchMode called with mode:', mode);
    
    window.capturedImageFile = null;
    PlanktoScanApp.uploadedImagePath = '';
    updateUIState('reset');
    
    if (CameraElements.locationInput && (!gpsState?.lastKnownPosition)) {
        CameraElements.locationInput.value = 'Unknown';
    }
    
    const isCamera = mode === 'camera';
    CameraElements.cameraModeBtn?.classList.toggle('active', isCamera);
    CameraElements.fileModeBtn?.classList.toggle('active', !isCamera);
    
    if (CameraElements.uploadZone) CameraElements.uploadZone.style.display = isCamera ? 'none' : 'block';
    if (CameraElements.container) CameraElements.container.style.display = isCamera ? 'block' : 'none';
    
    cleanCameraState();
    
    if (isCamera) {
        // Check permissions for camera mode
        const isAuthenticated = window.USER_AUTHENTICATED || false;
        const userRole = window.USER_ROLE || null;
        
        if (!isAuthenticated) {
            console.log('Camera mode requires authentication');
            if (typeof showLoginRequiredPopup === 'function') {
                showLoginRequiredPopup('not_logged_in');
            } else {
                window.location.href = '/login';
            }
            // Switch back to file mode
            switchToFileMode();
            return;
        }
        
        if (userRole === 'guest') {
            console.log('Guest users cannot use camera mode');
            if (typeof showLoginRequiredPopup === 'function') {
                showLoginRequiredPopup('guest_role');
            } else {
                alert('Guests can only view the application. Please login with a BASIC account or higher to use camera.');
            }
            // Switch back to file mode
            switchToFileMode();
            return;
        }
        
        startCamera().catch(error => {
            console.error('Failed to start camera:', error);
            showError('Failed to start camera. Please check permissions.');
        });
    } else {
        stopCamera();
        if (typeof resetFileUpload === 'function') resetFileUpload();
    }
}

function switchToCameraMode() { 
    console.log('switchToCameraMode called');
    return switchMode('camera'); 
}

function switchToFileMode() { 
    console.log('switchToFileMode called');
    return switchMode('file'); 
}

// Upload captured image
function uploadCapturedImage(file, dataURL, cameraContainer) {
    const formData = new FormData();
    formData.append('file', file);
    
    updateUIState('uploading');
    stopCamera();
    
    if (cameraContainer) cameraContainer.classList.add('success');
    createCameraPreview(dataURL, 'captured');
    
    $.ajax({
        url: '/upload', type: 'POST', data: formData, processData: false, contentType: false,
        success: (data) => {
            PlanktoScanApp.uploadedImagePath = data.img_path;
            updateUIState('captured', `Camera capture: ${file.name}`);
            
            $('.upload-zone').removeClass('uploading').addClass('success');
            $('#image-upload').val(data.img_path);
            createCameraPreview(dataURL, 'uploaded');
        },
        error: () => {
            $('.upload-zone').removeClass('uploading');
            updateUIState('failed');
            showError("Failed to upload camera image. Please try again.");
        }
    });
}

// Create camera preview
function createCameraPreview(dataURL, status = 'captured') {
    if (!CameraElements.container) return;
    
    const tempImg = new Image();
    tempImg.onload = function() {
        setupPreviewOverlay(dataURL, this.width, this.height, status);
        
        if (status === 'captured') {
            CameraElements.container.classList.add('success');
            if (CameraElements.controls) CameraElements.controls.style.display = 'none';
            updateUIState('captured');
        }
    };
    tempImg.onerror = () => showError('Failed to process camera image');
    tempImg.src = dataURL;
}

// Setup preview overlay
function setupPreviewOverlay(dataURL, width, height, status) {
    let overlay = CameraElements.preview;
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'camera-preview-overlay';
        CameraElements.container.appendChild(overlay);
        CameraElements.preview = overlay;
    }
    
    const message = status === 'captured' ? 'Photo Captured!' : 'Upload Successful!';
    overlay.innerHTML = `
        <div class="camera-image-preview" style="width: ${width}px; height: ${height}px;">
            <img src="${dataURL}" alt="Camera Capture">
            <div class="camera-overlay">
                <i class="fas fa-check-circle"></i>
                <div class="success-text">${message}</div>
                <div class="change-text">Click to take another photo</div>
            </div>
        </div>`;
    
    if (status === 'captured') {
        overlay.onclick = e => { 
            e.preventDefault(); 
            e.stopPropagation(); 
            resetCameraCapture(); 
        };
    }
}

// Update preview success
function updateCameraPreviewSuccess() {
    if (window.capturedImageFile?.dataURL) {
        createCameraPreview(window.capturedImageFile.dataURL, 'uploaded');
    }
}

// Reset camera capture
function resetCameraCapture() {
    window.capturedImageFile = null;
    PlanktoScanApp.uploadedImagePath = '';
    
    if (CameraElements.locationInput && (!gpsState?.lastKnownPosition)) {
        CameraElements.locationInput.value = 'Unknown';
    }
    
    updateUIState('reset');
    if (CameraElements.container) CameraElements.container.classList.remove('success');
    cleanCameraState();
    
    setTimeout(async () => {
        try {
            if (PlanktoScanApp.currentStream) {
                await manageCamera('stop');
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            await manageCamera('start');
        } catch (error) {
            console.error('Failed to restart camera:', error);
            showError('Failed to restart camera');
        }
    }, 100);
}

// Setup event handlers
function setupCameraHandlers() {
    CameraElements.init();
    
    // Mode buttons
    CameraElements.cameraModeBtn?.addEventListener('click', switchToCameraMode);
    CameraElements.fileModeBtn?.addEventListener('click', switchToFileMode);
    
    // Camera control buttons
    const btnConfigs = [
        { id: 'capture-btn', handler: capturePhoto },
        { id: 'switch-camera-btn', handler: switchCamera },
        { 
            id: 'upload-captured-btn', 
            handler: () => window.capturedImageFile && uploadCapturedImage(window.capturedImageFile.dataURL) 
        }
    ];
    
    btnConfigs.forEach(({ id, handler }) => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', handler);
    });
}

// Cleanup and exports
window.addEventListener('beforeunload', stopCamera);

if (typeof window !== 'undefined') {
    Object.assign(window, {
        cleanCameraState, switchToCameraMode, switchToFileMode, startCamera, 
        stopCamera, switchCamera, capturePhoto, resetCameraCapture, setupCameraHandlers,
        updateCameraPreviewSuccess
    });
}