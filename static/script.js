// GLOBAL VARIABLES

let uploadedImagePath = '';
let currentStream = null;
let facingMode = 'environment'; 
let isInitialized = false;

/**
 * GPS location state management
 */
let gpsState = {
    isGettingLocation: false,
    lastKnownPosition: null,
    watchId: null,
    accuracy: null,
    lastUpdate: null,
    cacheTimeout: 300000
};

// UTILITY FUNCTIONS

/**
 * Get cookie value by name
 * @param {string} name - Cookie name
 * @returns {string|null} Cookie value or null if not found
 */
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
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

// DROPDOWN MANAGEMENT

/**
 * Initialize dropdown values with default selections
 */
function initializeDropdowns() {
    const $modelSelect = $('#classification-model');
    
    // Set default values if not already set
    if (!$modelSelect.val() || $modelSelect.val() === '') {
        $modelSelect.val('efficientnetv2b0');
    }
    
    console.log('Dropdowns initialized:', {
        classification: $modelSelect.val()
    });
}

/**
 * Setup dropdown event handlers
 */
function setupDropdownHandlers() {
    const $modelSelect = $('#classification-model');
    
    // Remove any existing dropdown handlers first to prevent duplicates
    $(document).off('click.dropdown', '.dropdown-item');
    
    // Bootstrap Dropdown Event Handlers with namespace
    $(document).on('click.dropdown', '.dropdown-item', function(e) {
        e.preventDefault();
        
        const $item = $(this);
        const value = $item.attr('data-value');
        const text = $item.text();
        const $dropdown = $item.closest('.dropdown');
        const $button = $dropdown.find('.dropdown-toggle');
        
        // Find the correct hidden input
        let $hiddenInput;
        const dropdownId = $button.attr('id');
        if (dropdownId === 'classificationDropdown') {
            $hiddenInput = $('#classification-model');
        }
        
        // Update button text
        $button.text(text);
        
        // Update hidden input value
        if ($hiddenInput && $hiddenInput.length) {
            $hiddenInput.val(value);
            $hiddenInput.trigger('change');
        }
        
        // Update active state
        $dropdown.find('.dropdown-item').removeClass('active');
        $item.addClass('active');
        
        console.log('Dropdown updated:', {
            button: dropdownId,
            value: value,
            text: text,
            hiddenInputExists: $hiddenInput && $hiddenInput.length > 0
        });
    });

    // Remove any existing model select handlers to prevent duplicates
    $modelSelect.off('change');
    
    // Monitor dropdown changes for debugging
    $modelSelect.on('change', function() {
        console.log('Classification model changed to:', $(this).val());
    });
}

// FILE UPLOAD MANAGEMENT

/**
 * Handle file upload process
 * @param {File} file - The file to upload
 */
function handleFileUpload(file) {
    const $fileName = $('#file-name');
    const $fileInfo = $('#file-info');
    const $uploadZone = $('.upload-zone');
    const $predictButton = $('.btn-predict-image');
    const $imageUploadInput = $('#image-upload');
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        swal({
            title: "Invalid File",
            text: "Please select a valid image file.",
            icon: "error",
        });
        return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
        swal({
            title: "File Too Large",
            text: "Please select an image smaller than 10MB.",
            icon: "error",
        });
        return;
    }

    // Show image preview immediately
    showImagePreview(file);

    const formData = new FormData();
    formData.append('file', file);

    // Show uploading state
    $fileName.text('Uploading...');
    $fileInfo.show();
    $uploadZone.addClass('uploading');
    $predictButton.prop('disabled', true);
    
    $.ajax({
        url: '/upload',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: (data) => {
            uploadedImagePath = data.img_path;
            $imageUploadInput.val(uploadedImagePath);
            $fileName.text(file.name);
            $predictButton.prop('disabled', false);
            $uploadZone.removeClass('uploading');
            $uploadZone.addClass('success');
            
        },
        error: () => {
            resetFileUpload();
            $uploadZone.removeClass('uploading');
            swal({
                title: "Upload Error",
                text: "Failed to upload image. Please try again.",
                icon: "error",
            });
        }
    });
}

/**
 * Show image preview in upload zone
 * @param {File} file - The image file to preview
 */
function showImagePreview(file) {
    const $uploadZone = $('.upload-zone');
    const reader = new FileReader();
    
    reader.onload = function(e) {
        // Create a temporary image to get dimensions
        const tempImg = new Image();
        tempImg.onload = function() {
            const originalWidth = this.width;
            const originalHeight = this.height;
            
            // Calculate aspect ratio
            const aspectRatio = originalWidth / originalHeight;
            
            // Get container max width (upload zone width)
            const containerMaxWidth = $uploadZone.width();
            
            // Calculate display dimensions to fill the container width
            let displayWidth = containerMaxWidth;
            let displayHeight = displayWidth / aspectRatio;
            
            $uploadZone.html(`
                <div class="image-preview-container" style="
                    position: relative;
                    width: ${displayWidth}px;
                    height: ${displayHeight}px;
                    margin: 0 auto;
                    overflow: hidden;
                    border-radius: 15px;
                ">
                    <img src="${e.target.result}" alt="Preview" class="image-preview" style="
                        width: 100%;
                        height: 100%;
                        border-radius: 15px;
                        object-fit: contain;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                        display: block;
                    ">
                    <div class="upload-overlay" style="
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
                        cursor: pointer;
                        z-index: 50;
                        pointer-events: auto;
                    ">
                        <i class="fas fa-check-circle" style="font-size: 3rem; margin-bottom: 15px; color: #27AE60;"></i>
                        <div style="font-size: 1.2rem; color: #27AE60; margin-bottom: 5px;">File Uploaded!</div>
                        <div style="font-size: 1rem; color: #fff; text-align: center;">Click to change image</div>
                    </div>
                </div>
            `);
            
            // Add class to indicate image is loaded and remove padding
            $uploadZone.addClass('with-image');
            
            // Add hover effect yang lebih tepat
            $uploadZone.off('mouseenter mouseleave').on('mouseenter', '.image-preview-container', function() {
                $(this).find('.upload-overlay').css('opacity', '1');
            }).on('mouseleave', '.image-preview-container', function() {
                $(this).find('.upload-overlay').css('opacity', '0');
            });
            
            // Add click handler untuk overlay change image
            $uploadZone.off('click.overlay').on('click.overlay', '.upload-overlay', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Overlay clicked, triggering file input for image change');
                $('#file-image-upload').trigger('click');
            });
            
            // Ensure the upload zone remains clickable
            $uploadZone.css('position', 'relative');
        };
        
        tempImg.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

/**
 * Reset file upload state to initial state
 */
function resetFileUpload() {
    const $fileInput = $('#file-image-upload');
    const $imageUploadInput = $('#image-upload');
    const $fileName = $('#file-name');
    const $fileInfo = $('#file-info');
    const $uploadZone = $('.upload-zone');
    const $predictButton = $('.btn-predict-image');
    const $locationInput = $('#sampling-location');
    
    // Clear file inputs and state
    $fileInput.val('');
    $imageUploadInput.val('');
    uploadedImagePath = '';
    window.capturedImageFile = null;

    // Reset location input ke default
    if ($locationInput.length) {
        if (!gpsState.lastKnownPosition) {
            $locationInput.val('Unknown');
            console.log('Location input reset to default: Unknown');
        } else {
            console.log('Keeping GPS location after reset');
        }
    }

    // Update UI elements
    $fileInfo.hide();
    $fileName.text('No file selected');
    $uploadZone.removeClass('success with-image');
    $predictButton.prop('disabled', true);
    
    // Reset upload zone content and styling - FORCE COMPLETE RESET
    $uploadZone.removeAttr('style');
    $uploadZone.removeClass('success with-image uploading dragover');
    $uploadZone.html(`
        <div class="upload-content" style="padding: 3.5rem 2rem; min-height: 300px;">
            <div class="upload-icon">
                <i class="fas fa-cloud-upload-alt"></i>
            </div>
            <div class="upload-text">Click to upload or drag and drop</div>
            <div class="upload-subtext">PNG, JPG or JPEG (max. 10MB)</div>
        </div>
    `);
    
    // Ensure upload zone is visible and properly styled
    $uploadZone.css({
        'display': 'block',
        'visibility': 'visible',
        'opacity': '1',
        'position': 'relative',
        'pointer-events': 'auto'
    });

    // Remove any existing event handlers and re-attach
    $uploadZone.off('click.upload');
    $uploadZone.on('click.upload', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('Upload zone clicked after reset, triggering file input');
        $fileInput.trigger('click');
    });

    console.log('File upload state reset completely');
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
    uploadedImagePath = '';
    
    // Reset location input ke default
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
        if (currentStream) {
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
 * Universal cancel upload function that handles both file and camera uploads
 */
function cancelUpload() {
    const currentMode = getCurrentMode();
    
    console.log('Cancel upload called:', {
        currentMode,
        hasCapturedFile: !!window.capturedImageFile,
        hasUploadedPath: !!uploadedImagePath
    });

    if (currentMode === 'camera' || window.capturedImageFile) {
        // Reset camera capture state
        resetCameraCapture();
        
        swal({
            title: "Camera Capture Canceled",
            text: "Camera capture has been canceled and camera restarted",
            icon: "info",
            timer: 2000,
            buttons: false
        });
    } else if (currentMode === 'file' || uploadedImagePath) {
        // Reset file upload state
        resetFileUpload();
        
        swal({
            title: "Upload Canceled",
            text: "File upload has been canceled",
            icon: "info",
            timer: 2000,
            buttons: false
        });
    } else {
        // Fallback: reset both states
        resetFileUpload();
        resetCameraCapture();
        
        swal({
            title: "Upload Canceled",
            text: "Upload has been canceled",
            icon: "info",
            timer: 2000,
            buttons: false
        });
    }
}

/**
 * Update upload zone with success indicators
 */
function updateUploadZoneSuccess() {
    const $uploadZone = $('.upload-zone');
    
    // Update upload icon to show success
    $uploadZone.find('.upload-icon').html('<i class="fas fa-check-circle"></i>');
    
    // Update upload text to show success
    $uploadZone.find('.upload-text').text('Upload Successful!');
    $uploadZone.find('.upload-subtext').text('Click to change image');
}

/**
 * Updated predict button handler that supports both file and camera uploads
 */
function handlePredictButtonClick() {
    // Check if we have either uploaded image or captured image
    if (!uploadedImagePath && !window.capturedImageFile) {
        return swal({ 
            title: "No Image Selected",
            text: "Please upload an image or capture a photo first.", 
            icon: "error" 
        });
    }

    // Re-initialize dropdowns to ensure values are set
    initializeDropdowns();

    // Get values from dropdowns
    const $modelSelect = $('#classification-model');
    const $locationInput = $('#sampling-location');
    const modelOption = $modelSelect.val() || 'efficientnetv2b0';
    const locationValue = $locationInput.val() || 'unknown';

    console.log('=== Prediction Values ===');
    console.log('modelOption:', modelOption);
    console.log('locationValue:', locationValue);

    // Final validation
    if (!modelOption || modelOption === 'null' || modelOption === 'undefined') {
        return swal({
            title: "Model Error",
            text: "Classification model not properly selected. Please refresh and try again.",
            icon: "error"
        });
    }

    // Validate location input
    if (!locationValue || locationValue.trim() === '') {
        return swal({
            title: "Location Required",
            text: "Please enter a sampling location.",
            icon: "warning"
        });
    }

    const formData = new FormData();

    // Add location to form data
    formData.append('location', locationValue.trim());
    
    // Handle camera capture vs file upload
    if (window.capturedImageFile) {
        // Use captured image file
        formData.append('file', window.capturedImageFile);
        console.log('Using captured image file for prediction');
    } else {
        // Use uploaded image path
        formData.append('img_path', uploadedImagePath);
        console.log('Using uploaded image path for prediction');
    }
    
    // Ensure no undefined values are sent
    formData.append('model_option', String(modelOption));

    console.log('Sending prediction request with data:', {
        has_captured_file: !!window.capturedImageFile,
        img_path: uploadedImagePath,
        model_option: String(modelOption),
        location: locationValue.trim()
    });

    const $loading = $('#load');
    const $transparant = $('#transparant-bg');
    
    $loading.show();
    $transparant.show();

    $.ajax({
        url: '/predict',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        timeout: 60000,
        success: (data) => {
            console.log('Prediction successful:', data);
            if (data.stored_filename) {
                console.log('Stored as:', data.stored_filename);
            } if (data.result_id) {
                window.location.href = `/result/${data.result_id}`;
            } else {
                throw new Error('Invalid response: missing result_id');
            }
        },
        error: (xhr, status, error) => {
            $loading.hide();
            $transparant.hide();
            
            console.error('Prediction error:', xhr.responseJSON);

            let errorMessage = "Failed to analyze image. Please try again.";
            
            if (xhr.status === 413) {
                errorMessage = "File too large. Please upload a smaller image.";
            } else if (xhr.status === 0) {
                errorMessage = "Network error. Please check your connection.";
            } else if (status === 'timeout') {
                errorMessage = "Request timed out. Please try again.";
            } else if (xhr.responseJSON && xhr.responseJSON.error) {
                errorMessage = xhr.responseJSON.error;
            }

            swal({ 
                title: "Prediction Error", 
                text: errorMessage, 
                icon: "error" 
            });
        }
    });
}

// CAMERA MANAGEMENT

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
    uploadedImagePath = '';
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
 * Start camera stream
 */
async function startCamera() {
    try {
        const constraints = {
            video: {
                facingMode: facingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };
        
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        const video = document.getElementById('camera-preview');
        if (video) {
            video.srcObject = currentStream;
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
        
    } catch (error) {
        console.error('Error accessing camera:', error);
        alert('Error accessing camera. Please make sure you have granted camera permissions.');
        switchToFileMode();
    }
}

/**
 * Stop camera stream
 */
function stopCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
}

/**
 * Switch between front and back camera
 */
function switchCamera() {
    facingMode = facingMode === 'user' ? 'environment' : 'user';
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
        window.capturedImageFile = file;
        uploadedImagePath = dataURL;

        // Upload the captured image using the same process as file upload
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
        
        // Show camera preview dengan responsive sizing
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
                // Set the uploaded image path globally
                uploadedImagePath = data.img_path;
                $imageUploadInput.val(data.img_path);
                $fileName.text('Camera capture: ' + file.name);
                $fileInfo.show();
                $predictButton.prop('disabled', false);
                $uploadZone.removeClass('uploading');
                $uploadZone.addClass('success');
                
                // Update camera preview with success indicator
                updateCameraPreviewSuccess();
                
                console.log('Camera image uploaded successfully:', data.img_path);

                // Stop camera after successful upload
                stopCamera();
                console.log('Camera stopped after successful upload');
            },
            error: () => {
                $uploadZone.removeClass('uploading');
                $fileName.text('Upload failed');
                swal({
                    title: "Upload Error",
                    text: "Failed to upload camera image. Please try again.",
                    icon: "error",
                });
            }
        });
        
    }, 'image/jpeg', 0.9);
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
        
        console.log('Original image dimensions:', { originalWidth, originalHeight });
        
        // Create or update camera preview overlay
        let previewOverlay = document.getElementById('camera-preview-overlay');
        if (!previewOverlay) {
            previewOverlay = document.createElement('div');
            previewOverlay.id = 'camera-preview-overlay';
            cameraContainer.appendChild(previewOverlay);
        }
        
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
        
        // Remove any existing click listeners first
        previewOverlay.onclick = null;
        $(previewOverlay).off('click');
        
        // Add click functionality to retake photo with proper event delegation
        previewOverlay.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('Retake photo clicked');
            
            // Remove success state from camera container
            cameraContainer.classList.remove('success');

            // Reset upload state
            uploadedImagePath = '';
            const $imageUploadInput = $('#image-upload');
            const $fileName = $('#file-name');
            const $fileInfo = $('#file-info');
            const $uploadZone = $('.upload-zone');
            const $predictButton = $('.btn-predict-image');
            
            $imageUploadInput.val('');
            $fileName.text('No file selected');
            $fileInfo.hide();
            $uploadZone.removeClass('success uploading');
            $predictButton.prop('disabled', true);
            
            // Clean camera state completely
            cleanCameraState();
            
            // Restart camera stream to ensure it's active
            if (currentStream) {
                stopCamera();
                setTimeout(() => {
                    startCamera();
                }, 200);
            } else {
                startCamera();
            }
            
            console.log('Camera reset for retake photo completed');
        };
        
        // Add hover effect with proper event handling
        const overlay = previewOverlay.querySelector('.camera-overlay');
        if (overlay) {
            previewOverlay.onmouseenter = function() {
                overlay.style.opacity = '1';
            };
            previewOverlay.onmouseleave = function() {
                overlay.style.opacity = '0';
            };
        }
        
        // Ensure the overlay is visible and clickable
        previewOverlay.style.display = 'flex';
        previewOverlay.style.pointerEvents = 'auto';
        
        console.log('Camera preview overlay created with original dimensions:', {
            originalWidth,
            originalHeight
        });
    };
    
    tempImg.onerror = function() {
        console.error('Failed to load captured image for preview');
    };
    
    tempImg.src = dataURL;

    console.log('Camera preview overlay created and event listeners attached');
}

/**
 * Update camera preview with success indicator
 */
function updateCameraPreviewSuccess() {
    const previewOverlay = document.getElementById('camera-preview-overlay');
    if (!previewOverlay) return;
    
    // Update the success indicator to show checkmark
    const successIndicator = previewOverlay.querySelector('.camera-success-indicator');
    if (successIndicator) {
        successIndicator.innerHTML = '<i class="fas fa-check"></i>';
        successIndicator.style.background = '#27AE60';
    }
    
    // Update overlay text to show upload success but keep retake functionality
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

// WELCOME POPUP MANAGEMENT

/**
 * Show welcome popup
 */
function showWelcomePopup() {
    const welcomePopup = document.getElementById('welcomePopup');
    if (welcomePopup) {
        welcomePopup.style.display = 'flex';
    }
}

/**
 * Close welcome popup and set cookie
 */
function closeWelcomePopup() {
    const welcomePopup = document.getElementById('welcomePopup');
    if (welcomePopup) {
        welcomePopup.style.display = 'none';
        
        console.log('Closing welcome popup and setting cookie...');
        
        // Set cookie to prevent popup from showing again
        $.ajax({
            url: '/set-welcome-seen',
            type: 'POST',
            success: function(response) {
                console.log('Welcome popup marked as seen:', response);
            },
            error: function(xhr, status, error) {
                console.error('Error setting welcome seen cookie:', error);
                console.error('Response:', xhr.responseText);
                console.error('Status:', status);
            }
        });
        
        // Also set cookie manually as backup
        document.cookie = "welcome_seen=true; max-age=86400; path=/";
        console.log('Cookie set manually as backup');
    }
}

// GPS LOCATION MANAGEMENT

/**
 * Check if geolocation is supported
 */
function isGeolocationSupported() {
    return "geolocation" in navigator;
}

/**
 * Check if cached GPS location is still valid
 */
function isCachedLocationValid() {
    if (!gpsState.lastKnownPosition || !gpsState.lastUpdate) {
        return false;
    }
    
    const now = Date.now();
    const timeDiff = now - gpsState.lastUpdate;
    
    return timeDiff < gpsState.cacheTimeout;
}

/**
 * Get current GPS location
 */
function getCurrentGPSLocation() {
    const $gpsButton = $('#get-gps-location');
    const $gpsStatus = $('#gps-status');
    const $locationInput = $('#sampling-location');
    const $accuracyInfo = $('#location-accuracy');

    // Check if geolocation is supported
    if (!isGeolocationSupported()) {
        swal({
            title: "GPS Not Supported",
            text: "Your device doesn't support GPS location. Please enter location manually.",
            icon: "warning"
        });
        return;
    }

    // Check for cached location first
    if (isCachedLocationValid()) {
        console.log('Using cached GPS location');
        handleGPSSuccess(gpsState.lastKnownPosition);
        return;
    }

    // Prevent multiple requests
    if (gpsState.isGettingLocation) {
        console.log('GPS location request already in progress');
        return;
    }

    // Update UI to loading state
    gpsState.isGettingLocation = true;
    $gpsButton.addClass('loading');
    $gpsButton.find('.gps-icon').removeClass('fa-location-arrow').addClass('fa-spinner fa-spin');
    $gpsButton.find('.gps-text').text('...');
    $gpsStatus.show().removeClass('success error');
    $gpsStatus.find('span').text('Getting your location...');
    $accuracyInfo.hide();

    // GPS options
    const options = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000
    };

    // Get current position
    navigator.geolocation.getCurrentPosition(
        (position) => {
            // Update cache timestamp
            gpsState.lastUpdate = Date.now();
            handleGPSSuccess(position);
        },
        (error) => {
            handleGPSError(error);
        },
        options
    );
}

/**
 * Handle successful GPS location
 */
function handleGPSSuccess(position) {
    const $gpsButton = $('#get-gps-location');
    const $gpsStatus = $('#gps-status');
    const $locationInput = $('#sampling-location');
    const $accuracyInfo = $('#location-accuracy');

    const { latitude, longitude, accuracy } = position.coords;
    
    // Store position
    gpsState.lastKnownPosition = position;
    gpsState.accuracy = accuracy;

    console.log('GPS Location obtained:', {
        latitude: latitude,
        longitude: longitude,
        accuracy: accuracy + 'm'
    });

    // Update UI to success state
    $gpsButton.removeClass('loading').addClass('success');
    $gpsButton.find('.gps-icon').removeClass('fa-spinner fa-spin').addClass('fa-check');
    $gpsButton.find('.gps-text').text('GPS');
    
    $gpsStatus.addClass('success');
    $gpsStatus.find('span').text('Location obtained successfully!');

    // Show accuracy information
    $accuracyInfo.show();
    $('#accuracy-text').text(`Accuracy: ± ${Math.round(accuracy)}m`);
    $('#coords-text').text(`(${latitude.toFixed(6)}, ${longitude.toFixed(6)})`);

    // Get human-readable address using reverse geocoding
    reverseGeocode(latitude, longitude);

    // Auto-hide status after 3 seconds
    setTimeout(() => {
        $gpsStatus.fadeOut();
        resetGPSButton();
    }, 3000);

    gpsState.isGettingLocation = false;
}

/**
 * Handle GPS location error
 */
function handleGPSError(error) {
    const $gpsButton = $('#get-gps-location');
    const $gpsStatus = $('#gps-status');

    let errorMessage = "Failed to get location. ";
    let userAction = "";

    switch(error.code) {
        case error.PERMISSION_DENIED:
            errorMessage += "Location access denied by user.";
            userAction = "Please enable location permissions and try again.";
            break;
        case error.POSITION_UNAVAILABLE:
            errorMessage += "Location information unavailable.";
            userAction = "Please check if GPS is enabled on your device.";
            break;
        case error.TIMEOUT:
            errorMessage += "Location request timed out.";
            userAction = "Please try again or enter location manually.";
            break;
        default:
            errorMessage += "Unknown error occurred.";
            userAction = "Please try again or enter location manually.";
            break;
    }

    console.error('GPS Error:', error.code, error.message);

    // Update UI to error state
    $gpsButton.removeClass('loading').addClass('error');
    $gpsButton.find('.gps-icon').removeClass('fa-spinner fa-spin').addClass('fa-exclamation');
    $gpsButton.find('.gps-text').text('Error');
    
    $gpsStatus.addClass('error');
    $gpsStatus.find('span').text(errorMessage);

    // Show error alert
    swal({
        title: "GPS Error",
        text: errorMessage + " " + userAction,
        icon: "error",
        buttons: {
            cancel: "Enter Manually",
            retry: {
                text: "Try Again",
                value: "retry",
                className: "btn-primary"
            }
        }
    }).then((value) => {
        if (value === "retry") {
            setTimeout(() => {
                getCurrentGPSLocation();
            }, 1000);
        }
    });

    // Reset button after 5 seconds
    setTimeout(() => {
        $gpsStatus.fadeOut();
        resetGPSButton();
    }, 5000);

    gpsState.isGettingLocation = false;
}

/**
 * Reset GPS button to initial state
 */
function resetGPSButton() {
    const $gpsButton = $('#get-gps-location');
    
    $gpsButton.removeClass('loading success error');
    $gpsButton.find('.gps-icon').removeClass('fa-spinner fa-spin fa-check fa-exclamation').addClass('fa-location-arrow');
    $gpsButton.find('.gps-text').text('GPS');
}

/**
 * Reverse geocode coordinates to human-readable address
 */
function reverseGeocode(latitude, longitude) {
    const $locationInput = $('#sampling-location');
    
    // Try multiple geocoding services for better coverage
    const geocodingServices = [
        {
            name: 'OpenStreetMap Nominatim',
            url: `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`,
            parser: (data) => {
                if (data && data.display_name) {
                    // Extract meaningful location parts
                    const address = data.address || {};
                    const parts = [];
                    
                    if (address.road) parts.push(address.road);
                    if (address.suburb || address.neighbourhood) parts.push(address.suburb || address.neighbourhood);
                    if (address.city || address.town || address.village) parts.push(address.city || address.town || address.village);
                    if (address.state) parts.push(address.state);
                    
                    return parts.length > 0 ? parts.join(', ') : data.display_name;
                }
                return null;
            }
        }
    ];

    // Try each service until one succeeds
    function tryService(serviceIndex = 0) {
        if (serviceIndex >= geocodingServices.length) {
            // All services failed, use coordinates
            const coordsLocation = `GPS: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            $locationInput.val(coordsLocation);
            console.log('Reverse geocoding failed, using coordinates:', coordsLocation);
            return;
        }

        const service = geocodingServices[serviceIndex];
        
        $.ajax({
            url: service.url,
            method: 'GET',
            timeout: 10000,
            success: (data) => {
                try {
                    const location = service.parser(data);
                    if (location) {
                        $locationInput.val(location);
                        console.log('Reverse geocoding successful:', location);
                        
                        // Trigger input event to notify other parts of the system
                        $locationInput.trigger('input');
                    } else {
                        tryService(serviceIndex + 1);
                    }
                } catch (error) {
                    console.error(`${service.name} parsing error:`, error);
                    tryService(serviceIndex + 1);
                }
            },
            error: (xhr, status, error) => {
                console.error(`${service.name} request failed:`, error);
                tryService(serviceIndex + 1);
            }
        });
    }

    // Start trying services
    tryService(0);
}

/**
 * Clear location input
 */
function clearLocationInput() {
    const $locationInput = $('#sampling-location');
    const $accuracyInfo = $('#location-accuracy');
    const $gpsStatus = $('#gps-status');

    // Clear input and hide info
    $locationInput.val('Unknown'); // Reset to default
    $accuracyInfo.hide();
    $gpsStatus.hide();
    
    // Reset GPS state
    gpsState.lastKnownPosition = null;
    gpsState.accuracy = null;
    resetGPSButton();

    // Trigger input event
    $locationInput.trigger('input');
    
    console.log('Location input cleared');
}

/**
 * Watch GPS position for continuous updates (optional feature)
 */
function startWatchingGPS() {
    if (!isGeolocationSupported() || gpsState.watchId) {
        return;
    }

    const options = {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 60000
    };

    gpsState.watchId = navigator.geolocation.watchPosition(
        (position) => {
            // Update position silently
            gpsState.lastKnownPosition = position;
            gpsState.accuracy = position.coords.accuracy;
            
            console.log('GPS position updated:', {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy + 'm'
            });
        },
        (error) => {
            console.warn('GPS watch error:', error.message);
        },
        options
    );
}

/**
 * Stop watching GPS position
 */
function stopWatchingGPS() {
    if (gpsState.watchId) {
        navigator.geolocation.clearWatch(gpsState.watchId);
        gpsState.watchId = null;
        console.log('GPS watching stopped');
    }
}

// HELPER FUNCTIONS

/**
 * Get current active mode (file or camera)
 */
function getCurrentMode() {
    const cameraContainer = document.getElementById('camera-container');
    const uploadZone = document.getElementById('upload-zone');
    const cameraModeBtn = document.getElementById('camera-mode-btn');
    const fileModeBtn = document.getElementById('file-mode-btn');
    
    // Check active button states first
    const isCameraModeActive = cameraModeBtn && cameraModeBtn.classList.contains('active');
    const isFileModeActive = fileModeBtn && fileModeBtn.classList.contains('active');
    
    console.log('Mode detection - Button states:', {
        isCameraModeActive,
        isFileModeActive
    });

    if (isCameraModeActive) {
        return 'camera';
    } else if (isFileModeActive) {
        return 'file';
    }

    // Check for captured image file
    if (window.capturedImageFile) {
        return 'camera';
    }

    // Check computed display styles
    const cameraDisplay = cameraContainer ? window.getComputedStyle(cameraContainer).display : 'none';
    const uploadDisplay = uploadZone ? window.getComputedStyle(uploadZone).display : 'none';
    
    console.log('Mode detection - Display styles:', {
        cameraDisplay,
        uploadDisplay
    });
    
    if (cameraDisplay !== 'none' && uploadDisplay === 'none') {
        return 'camera';
    } else if (uploadDisplay !== 'none' && cameraDisplay === 'none') {
        return 'file';
    }
    
    // Check inline styles
    const cameraInlineDisplay = cameraContainer ? cameraContainer.style.display : '';
    const uploadInlineDisplay = uploadZone ? uploadZone.style.display : '';
    
    console.log('Mode detection - Inline styles:', {
        cameraInlineDisplay,
        uploadInlineDisplay
    });
    
    if (cameraInlineDisplay === 'block' || cameraInlineDisplay === 'flex') {
        return 'camera';
    } else if (uploadInlineDisplay === 'block' || uploadInlineDisplay === '') {
        return 'file';
    }
    
    // Default fallback: file mode
    console.log('Mode detection - Using fallback: file');
    return 'file';
}

/**
 * Validate and clean location input for filename safety
 */
function validateLocationInput(location) {
    if (!location || location.trim() === '') {
        return 'unknown';
    }
    
    // Clean location untuk filename safety
    let cleaned = location.trim();
    cleaned = cleaned.replace(/[^a-zA-Z0-9\s\-_]/g, ''); // Remove special characters
    cleaned = cleaned.replace(/\s+/g, '_'); // Replace spaces with underscores
    cleaned = cleaned.substring(0, 50); // Limit length
    
    return cleaned || 'unknown';
}

/**
 * Get current location value with validation
 */
function getCurrentLocation() {
    const $locationInput = $('#sampling-location');
    const rawLocation = $locationInput.length ? $locationInput.val() : '';
    return validateLocationInput(rawLocation);
}

// MAIN INITIALIZATION

$(document).ready(function() {
    // Prevent multiple initializations
    if (isInitialized) {
        console.log('Already initialized, skipping...');
        return;
    }
    
    console.log('=== Starting PlanktoScan Initialization ===');
    isInitialized = true;
    
    // Cache jQuery selectors
    const $fileInput = $('#file-image-upload');
    const $imageUploadInput = $('#image-upload');
    const $fileName = $('#file-name');
    const $fileInfo = $('#file-info');
    const $uploadZone = $('.upload-zone');
    const $predictButton = $('.btn-predict-image');
    const $cancelUpload = $('#cancel-upload');
    const $loading = $('#load');
    const $transparant = $('#transparant-bg');
    const $modelSelect = $('#classification-model');
    const $segmentationSelect = $('#segmentation-model');
    const $locationInput = $('#sampling-location');
    
    // Initialize dropdowns
    initializeDropdowns();
    setupDropdownHandlers();

    // Initialize location input dengan default value
    if ($locationInput.length && !$locationInput.val()) {
        $locationInput.val('Unknown');
        console.log('Location input initialized with default value: Unknown');
    }

    // Ensure file mode is active on page load
    setTimeout(() => {
        const fileModeBtn = document.getElementById('file-mode-btn');
        const cameraModeBtn = document.getElementById('camera-mode-btn');
        const uploadZone = document.getElementById('upload-zone');
        const cameraContainer = document.getElementById('camera-container');
        
        // Force file mode to be active
        if (fileModeBtn) fileModeBtn.classList.add('active');
        if (cameraModeBtn) cameraModeBtn.classList.remove('active');
        if (uploadZone) uploadZone.style.display = 'block';
        if (cameraContainer) cameraContainer.style.display = 'none';
        
        console.log('Forced file mode initialization on page load');
    }, 50);
    
    // Remove any existing file upload handlers to prevent duplicates
    $fileInput.off('change');
    $uploadZone.off('click.upload dragover dragleave drop');
    
    // File upload handlers
    $fileInput.on('change', function(e) {
        console.log('File input changed, processing file');
        const file = e.target.files[0];
        if (file) {
            handleFileUpload(file);
        }
    });

    // Drag and drop functionality
    $uploadZone.on('dragover', function(e) {
        e.preventDefault();
        $(this).addClass('dragover');
    });

    $uploadZone.on('dragleave', function(e) {
        e.preventDefault();
        $(this).removeClass('dragover');
    });

    $uploadZone.on('drop', function(e) {
        e.preventDefault();
        $(this).removeClass('dragover');
        
        const files = e.originalEvent.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    });

    // Upload zone click handler
    $uploadZone.on('click.upload', function(e) {
        // Prevent event bubbling and multiple triggers
        e.preventDefault();
        e.stopPropagation();
        
        // Jika sudah ada image preview, jangan trigger file input lagi
        if ($(this).hasClass('success') || $(this).find('.image-preview-container').length > 0) {
            console.log('Upload zone already has image, click ignored');
            return;
        }
        
        console.log('Upload zone clicked, triggering file input');
        
        // Only trigger file input click if no image is present
        $fileInput.trigger('click');
    });

    // Remove any existing predict button handlers to prevent duplicates
    $predictButton.off('click');
    $cancelUpload.off('click');
    
    // Predict button handler that supports both file and camera uploads
    $predictButton.on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        handlePredictButtonClick();
    });

    // cancel upload button handler that supports both file and camera uploads
    $cancelUpload.on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        cancelUpload();
    });

    // GPS button click handler
    $('#get-gps-location').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        getCurrentGPSLocation();
    });

    // Clear location button click handler
    $('#clear-location').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        clearLocationInput();
    });

    $('#sampling-location').on('input', function() {
    const value = $(this).val();
    
    // Hide GPS accuracy info when manually editing
    if (gpsState.lastKnownPosition && $('#location-accuracy').is(':visible')) {
        $('#location-accuracy').fadeOut();
        resetGPSButton();
    }
    
    // Simple length validation only
    if (value.length > 255) {
        $(this).val(value.substring(0, 255));
        swal({
            title: "Input Too Long",
            text: "Location input has been truncated to 255 characters.",
            icon: "warning",
            timer: 2000,
            buttons: false
        });
    }
    
    console.log('Location input updated:', value.substring(0, 50) + (value.length > 50 ? '...' : ''));
    });

    // Auto-clear GPS status when clicking elsewhere
    $(document).on('click', function(e) {
        if (!$(e.target).closest('.location-input-container').length) {
            $('#gps-status').fadeOut();
        }
    });

    // Initialize GPS button state
    if (!isGeolocationSupported()) {
        $('#get-gps-location').prop('disabled', true).attr('title', 'GPS not supported on this device');
    }

    console.log('GPS location management initialized');

    // Final initialization check after DOM is fully loaded
    setTimeout(() => {
        console.log('=== Final Initialization Check ===');
        console.log('Classification model:', $modelSelect.val());
        console.log('Segmentation model:', $segmentationSelect.val());
        console.log('Location input:', $locationInput.val());
        
        // Force re-initialization if any value is still empty
        initializeDropdowns();
        
        // Ensure dropdown buttons show correct text
        const classificationValue = $modelSelect.val();
        const segmentationValue = $segmentationSelect.val();
        
        console.log('Setting initial dropdown texts:', {
            classificationValue,
            segmentationValue
        });
        
        if (classificationValue) {
            const $activeClassItem = $(`.dropdown-item[data-value="${classificationValue}"]`).first();
            if ($activeClassItem.length) {
                $('#classificationDropdown').text($activeClassItem.text());
                $activeClassItem.addClass('active');
                console.log('Set classification dropdown to:', $activeClassItem.text());
            }
        }
        
        if (segmentationValue) {
            const $activeSegItem = $(`.dropdown-item[data-value="${segmentationValue}"]`).first();
            if ($activeSegItem.length) {
                $('#segmentationDropdown').text($activeSegItem.text());
                $activeSegItem.addClass('active');
                console.log('Set segmentation dropdown to:', $activeSegItem.text());
            }
        }
    }, 100);
    
    // Debug: Check current cookies
    console.log('=== Cookie Debug ===');
    console.log('Document cookies:', document.cookie);
    console.log('Welcome seen cookie:', getCookie('welcome_seen'));
    
    // Clean up camera when page unloads
    $(window).on('beforeunload', function() {
        stopCamera();
    });
    
    // Handle welcome popup click outside to close
    const welcomePopup = document.getElementById('welcomePopup');
    if (welcomePopup) {
        welcomePopup.addEventListener('click', function(e) {
            if (e.target === this) {
                closeWelcomePopup();
            }
        });
    }
});

// GLOBAL WINDOW FUNCTIONS

// Make functions globally available for onclick handlers
window.showWelcomePopup = showWelcomePopup;
window.closeWelcomePopup = closeWelcomePopup;
window.switchToFileMode = switchToFileMode;
window.switchToCameraMode = switchToCameraMode;
window.switchCamera = switchCamera;
window.capturePhoto = capturePhoto;
window.stopCamera = stopCamera;
window.updateUploadZoneSuccess = updateUploadZoneSuccess;
window.updateCameraPreviewSuccess = updateCameraPreviewSuccess;
window.cancelUpload = cancelUpload;
window.resetFileUpload = resetFileUpload;
window.resetCameraCapture = resetCameraCapture;
window.getCurrentMode = getCurrentMode;
window.handlePredictButtonClick = handlePredictButtonClick;
window.validateLocationInput = validateLocationInput;
window.getCurrentLocation = getCurrentLocation;
window.getCurrentGPSLocation = getCurrentGPSLocation;
window.clearLocationInput = clearLocationInput;
window.startWatchingGPS = startWatchingGPS;
window.stopWatchingGPS = stopWatchingGPS;