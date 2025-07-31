/**
 * File upload handling module for PlanktoScan
 */

/**
 * Setup file upload event handlers
 */
function setupFileUploadHandlers() {
    const $uploadZone = $('#upload-zone');
    const $fileInput = $('#file-image-upload');
    const $cancelButton = $('#cancel-upload');

    // Remove existing handlers to prevent duplicates
    $uploadZone.off('click.fileupload dragover.fileupload dragleave.fileupload drop.fileupload');
    $fileInput.off('change.fileupload');
    $cancelButton.off('click.fileupload');

    // Upload zone click handler
    $uploadZone.on('click.fileupload', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Jika sudah ada image preview, jangan trigger file input lagi
        if ($(this).hasClass('success') || $(this).find('.image-preview-container').length > 0) {
            console.log('Upload zone already has image, click ignored');
            return;
        }
        
        console.log('Upload zone clicked, triggering file input');
        
        if (getCurrentMode() === 'file') {
            $fileInput.trigger('click');
        }
    });

    // File input change handler
    $fileInput.on('change.fileupload', function(e) {
        console.log('File input changed, processing file');
        const file = e.target.files[0];
        if (file) {
            handleFileSelection(file);
        }
    });

    // Cancel upload handler
    $cancelButton.on('click.fileupload', function(e) {
        e.preventDefault();
        e.stopPropagation();
        cancelUpload();
    });

    // Drag and drop handlers
    $uploadZone.on('dragover.fileupload', handleDragOver);
    $uploadZone.on('dragleave.fileupload', handleDragLeave);
    $uploadZone.on('drop.fileupload', handleDrop);

    console.log('File upload event handlers setup complete');
}

/**
 * Handle file selection - Updated to match script.js functionality
 */
function handleFileSelection(file) {
    console.log('File selected:', file.name, formatFileSize(file.size));

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
    const $fileName = $('#file-name');
    const $fileInfo = $('#file-info');
    const $uploadZone = $('.upload-zone');
    const $predictButton = $('.btn-predict-image');
    const $imageUploadInput = $('#image-upload');
    
    $fileName.text('Uploading...');
    $fileInfo.show();
    $uploadZone.addClass('uploading');
    $predictButton.prop('disabled', true);
    
    // Upload file
    $.ajax({
        url: '/upload',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        timeout: 30000,
        success: (data) => {
            PlanktoScanApp.uploadedImagePath = data.img_path;
            $imageUploadInput.val(PlanktoScanApp.uploadedImagePath);
            $fileName.text(file.name);
            $predictButton.prop('disabled', false);
            $uploadZone.removeClass('uploading');
            $uploadZone.addClass('success');
            
            console.log('File upload completed successfully');
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
 * Show image preview in upload zone - Dari script.js
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
                    width: ${displayWidth}px;
                    height: ${displayHeight}px;
                ">
                    <img src="${e.target.result}" alt="Preview" class="image-preview">
                    <div class="upload-overlay">
                        <i class="fas fa-check-circle"></i>
                        <div class="success-text">File Uploaded!</div>
                        <div class="change-text">Click to change image</div>
                    </div>
                </div>
            `);
            
            // Add class to indicate image is loaded and remove padding
            $uploadZone.addClass('with-image');
            
            // Add hover effect
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
 * Handle successful upload - Simplified version
 * @param {Object} response - Server response
 * @param {string} fileName - Original file name
 */
function handleUploadSuccess(response, fileName) {
    console.log('Upload successful:', response);

    // Store the uploaded image path
    PlanktoScanApp.uploadedImagePath = response.img_path;

    // Update UI to show success
    updateUploadZoneSuccess();
    updateFileInfo(fileName, true);

    // Update predict button state
    if (typeof updatePredictButtonState === 'function') {
        updatePredictButtonState();
    }

    console.log('File upload completed successfully');
}

/**
 * Update upload zone with success indicators - Dari script.js
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
 * Cancel current upload - Updated dari script.js
 */
function cancelUpload() {
    const currentMode = getCurrentMode();
    
    console.log('Cancel upload called:', {
        currentMode,
        hasCapturedFile: !!PlanktoScanApp.capturedImageFile,
        hasUploadedPath: !!PlanktoScanApp.uploadedImagePath
    });

    if (currentMode === 'camera' || PlanktoScanApp.capturedImageFile) {
        // Reset camera capture state
        if (typeof resetCameraCapture === 'function') {
            resetCameraCapture();
        }
        
        swal({
            title: "Camera Capture Canceled",
            text: "Camera capture has been canceled and camera restarted",
            icon: "info",
            timer: 2000,
            buttons: false
        });
    } else if (currentMode === 'file' || PlanktoScanApp.uploadedImagePath) {
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
        if (typeof resetCameraCapture === 'function') {
            resetCameraCapture();
        }
        
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
 * Reset file upload UI to initial state - Updated dari script.js
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
    PlanktoScanApp.uploadedImagePath = '';
    PlanktoScanApp.capturedImageFile = null;

    // Reset location input if no GPS position
    if ($locationInput.length) {
        if (!window.gpsState || !window.gpsState.lastKnownPosition) {
            $locationInput.val('');
            console.log('Location input reset to empty');
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
        <div class="upload-content">
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
 * Handle drag over event
 * @param {Event} e - Drag event
 */
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (getCurrentMode() === 'file') {
        $(e.currentTarget).addClass('dragover');
    }
}

/**
 * Handle drag leave event
 * @param {Event} e - Drag event
 */
function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    
    $(e.currentTarget).removeClass('dragover');
}

/**
 * Handle drop event
 * @param {Event} e - Drop event
 */
function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const $target = $(e.currentTarget);
    $target.removeClass('dragover');
    
    if (getCurrentMode() !== 'file') {
        return;
    }
    
    const files = e.originalEvent.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        handleFileSelection(file);
    }
}

/**
 * Switch to file mode
 */
function switchToFileMode() {
    console.log('Switching to file mode...');

    const fileModeBtn = document.getElementById('file-mode-btn');
    const cameraModeBtn = document.getElementById('camera-mode-btn');
    const uploadZone = document.getElementById('upload-zone');
    const cameraContainer = document.getElementById('camera-container');
    
    if (fileModeBtn) fileModeBtn.classList.add('active');
    if (cameraModeBtn) cameraModeBtn.classList.remove('active');
    if (uploadZone) uploadZone.style.display = 'block';
    if (cameraContainer) cameraContainer.style.display = 'none';
    
    // Clean camera state
    if (typeof cleanCameraState === 'function') {
        cleanCameraState();
    }
    
    // Reset state variables
    PlanktoScanApp.capturedImageFile = null;
    
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
    
    // Stop camera if it's running
    if (typeof stopCamera === 'function') {
        stopCamera();
    }

    // Update predict button state
    if (typeof updatePredictButtonState === 'function') {
        updatePredictButtonState();
    }

    console.log('Switched to file mode');
}

// Export to global scope
if (typeof window !== 'undefined') {
    window.setupFileUploadHandlers = setupFileUploadHandlers;
    window.handleFileSelection = handleFileSelection;
    window.showImagePreview = showImagePreview;
    window.handleUploadSuccess = handleUploadSuccess;
    window.updateUploadZoneSuccess = updateUploadZoneSuccess;
    window.cancelUpload = cancelUpload;
    window.resetFileUpload = resetFileUpload;
    window.switchToFileMode = switchToFileMode;
    window.handleDragOver = handleDragOver;
    window.handleDragLeave = handleDragLeave;
    window.handleDrop = handleDrop;
}