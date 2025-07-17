// GLOBAL VARIABLES

let uploadedImagePath = '';
let currentStream = null;
let facingMode = 'environment'; 
let isInitialized = false;

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
    const $segmentationSelect = $('#segmentation-model');
    
    // Set default values if not already set
    if (!$modelSelect.val() || $modelSelect.val() === '') {
        $modelSelect.val('efficientnetv2b0');
    }
    if (!$segmentationSelect.val() || $segmentationSelect.val() === '') {
        $segmentationSelect.val('deeplab');
    }
    
    console.log('Dropdowns initialized:', {
        classification: $modelSelect.val(),
        segmentation: $segmentationSelect.val()
    });
}

/**
 * Setup dropdown event handlers
 */
function setupDropdownHandlers() {
    const $modelSelect = $('#classification-model');
    const $segmentationSelect = $('#segmentation-model');
    
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
        } else if (dropdownId === 'segmentationDropdown') {
            $hiddenInput = $('#segmentation-model');
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
    $segmentationSelect.off('change');
    
    // Monitor dropdown changes for debugging
    $modelSelect.on('change', function() {
        console.log('Classification model changed to:', $(this).val());
    });
    
    $segmentationSelect.on('change', function() {
        console.log('Segmentation model changed to:', $(this).val());
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
    
    $fileInput.val(''); // Clear the file input
    $imageUploadInput.val(''); // Clear the hidden input
    uploadedImagePath = '';
    $fileInfo.hide();
    $fileName.text('No file selected');
    $uploadZone.removeClass('success with-image');
    $predictButton.prop('disabled', true);
    
    // Reset padding and content
    $uploadZone.removeAttr('style');
    $uploadZone.html(`
        <div class="upload-content" style="padding: 3.5rem 2rem;">
            <div class="upload-icon">
                <i class="fas fa-cloud-upload-alt"></i>
            </div>
            <div class="upload-text">Click to upload or drag and drop</div>
            <div class="upload-subtext">PNG, JPG or JPEG (max. 10MB)</div>
        </div>
    `);
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
    
    // Initialize dropdowns
    initializeDropdowns();
    setupDropdownHandlers();
    
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
    
    // Predict button handler
    $predictButton.click(() => {
        if (!uploadedImagePath) {
            return swal({ 
                title: "No Image Selected",
                text: "Please upload an image first.", 
                icon: "error" 
            });
        }

        // Re-initialize dropdowns to ensure values are set
        initializeDropdowns();

        // Get values from dropdowns
        const modelOption = $modelSelect.val() || 'efficientnetv2b0';
        const segmentationOption = $segmentationSelect.val() || 'deeplab';

        console.log('=== Prediction Values ===');
        console.log('modelOption:', modelOption);
        console.log('segmentationOption:', segmentationOption);

        // Final validation
        if (!modelOption || modelOption === 'null' || modelOption === 'undefined') {
            return swal({
                title: "Model Error",
                text: "Classification model not properly selected. Please refresh and try again.",
                icon: "error"
            });
        }

        if (!segmentationOption || segmentationOption === 'null' || segmentationOption === 'undefined') {
            return swal({
                title: "Segmentation Error",
                text: "Segmentation model not properly selected. Please refresh and try again.",
                icon: "error"
            });
        }

        const formData = new FormData();
        formData.append('img_path', uploadedImagePath);
        
        // Ensure no undefined values are sent
        formData.append('model_option', String(modelOption));
        formData.append('segmentation_model', String(segmentationOption));

        console.log('Sending prediction request with data:', {
            img_path: uploadedImagePath,
            model_option: String(modelOption),
            segmentation_model: String(segmentationOption)
        });

        $loading.show();
        $transparant.show();

        $.ajax({
            url: '/predict',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: (data) => {
                window.location.href = `/result/${data.result_id}`;
            },
            error: (xhr, status, error) => {
                $loading.hide();
                $transparant.hide();
                console.error('Prediction error:', xhr.responseJSON);
                swal({ 
                    title: "Prediction Error", 
                    text: xhr.responseJSON?.error || "Failed to analyze image. Please try again.", 
                    icon: "error" 
                });
            }
        });
    });

    // Cancel upload button handler
    $cancelUpload.on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        resetFileUpload();
        
        // Show a brief feedback message
        swal({
            title: "Upload Canceled",
            text: "File upload has been canceled",
            icon: "info",
            timer: 2000,
            buttons: false
        });
    });

    // Final initialization check after DOM is fully loaded
    setTimeout(() => {
        console.log('=== Final Initialization Check ===');
        console.log('Classification model:', $modelSelect.val());
        console.log('Segmentation model:', $segmentationSelect.val());
        
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
        showCameraPreview(dataURL);
        
        
        // Upload the captured image using the same process as file upload
        const formData = new FormData();
        formData.append('file', file);

        // Show uploading state
        const $fileName = $('#file-name');
        const $fileInfo = $('#file-info');
        const $uploadZone = $('.upload-zone');
        const $predictButton = $('.btn-predict-image');
        const $imageUploadInput = $('#image-upload');
        
        $fileName.text('Uploading camera capture...');
        $fileInfo.show();
        $uploadZone.addClass('uploading');
        $predictButton.prop('disabled', true);
        
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
    const video = document.getElementById('camera-preview');
    
    if (!cameraContainer) return;
    
    // Hide the video element
    if (video) {
        video.style.display = 'none';
    }
    
    // Hide camera controls
    const cameraControls = document.querySelector('.camera-controls');
    if (cameraControls) {
        cameraControls.style.display = 'none';
    }
    
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
    
    previewOverlay.innerHTML = `
        <div class="camera-image-preview" style="
            position: relative;
            width: 100%;
            height: 100%;
            background: #000;
            border-radius: 15px;
            overflow: hidden;
            cursor: pointer;
            pointer-events: auto;
        ">
            <img src="${dataURL}" alt="Camera Capture" style="
                width: 100%;
                height: 100%;
                object-fit: cover;
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
                <i class="fas fa-camera"></i>
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
                <i class="fas fa-camera" style="font-size: 3rem; margin-bottom: 15px; color: #27AE60;"></i>
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
    previewOverlay.style.display = 'block';
    previewOverlay.style.pointerEvents = 'auto';
    
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
