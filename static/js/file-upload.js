// ============================================================================
// MAIN SETUP FUNCTION
// ============================================================================

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

        console.log('Upload zone clicked, checking permissions...');

        // Check if user can upload
        if (!canUserUpload()) {
            console.log('User cannot upload, upload blocked');
            return;
        }
        
        // If already has an image preview, don't trigger file input again
        if ($(this).hasClass('success') || $(this).find('.image-preview-container').length > 0) {
            console.log('Upload zone already has image, click ignored');
            return;
        }
        
        $fileInput.click();
    });

    // File input change handler
    $fileInput.on('change.fileupload', function(e) {
        const file = e.target.files[0];
        if (file) {
            console.log('File selected:', file.name, formatFileSize(file.size));
            
            // Validate file
            if (!isValidImageFile(file)) {
                showError('Please select a valid image file (JPG, PNG, GIF, WebP)');
                return;
            }
            
            if (!isValidFileSize(file)) {
                showError('File size must be less than 10MB');
                return;
            }

            // Store file directly for prediction
            PlanktoScanApp.uploadedFile = file;
            PlanktoScanApp.uploadedImagePath = URL.createObjectURL(file);

            // Show image preview and info
            showImagePreview(file);
            updateFileInfo(file.name, true);
            
            // Update predict button state
            if (typeof updatePredictButtonState === 'function') {
                updatePredictButtonState();
            }

            console.log('File processed successfully for prediction');
        }
    });

    // Cancel upload handler
    $cancelButton.on('click.fileupload', function(e) {
        e.preventDefault();
        e.stopPropagation();
        cancelUpload();
    });

    // Drag and drop handlers
    $uploadZone.on('dragover.fileupload', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).addClass('drag-over');
    });

    $uploadZone.on('dragleave.fileupload', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).removeClass('drag-over');
    });

    $uploadZone.on('drop.fileupload', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).removeClass('drag-over');

        if (!canUserUpload()) {
            return;
        }

        const files = e.originalEvent.dataTransfer.files;
        if (files.length > 0) {
            $fileInput[0].files = files;
            $fileInput.trigger('change');
        }
    });

    console.log('File upload event handlers setup complete');
}

// ============================================================================
// PERMISSION AND VALIDATION
// ============================================================================

function canUserUpload() {
    const isAuthenticated = window.USER_AUTHENTICATED || false;
    const userRole = window.USER_ROLE || null;
    
    console.log('canUserUpload check:', { isAuthenticated, userRole });
    
    if (!isAuthenticated) {
        console.log('User not authenticated, showing login popup');
        if (typeof showLoginRequiredPopup === 'function') {
            showLoginRequiredPopup('not_logged_in');
        } else {
            // Fallback: redirect to login
            window.location.href = '/login';
        }
        return false;
    }
    
    if (userRole === 'guest') {
        console.log('Guest user cannot upload, showing role popup');
        if (typeof showLoginRequiredPopup === 'function') {
            showLoginRequiredPopup('guest_role');
        } else {
            // Fallback: show alert
            alert('Guests can only view the application. Please login with a BASIC account or higher to upload images.');
        }
        return false;
    }
    
    // Allow Basic, Expert, and Admin users to upload
    console.log('User can upload:', { userRole, isAuthenticated });
    return true;
}

// ============================================================================
// IMAGE PREVIEW AND UI UPDATES
// ============================================================================

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
                        <i class="fas fa-check-circle" success-icon></i>
                        <div class="success-text">Upload Successful!</div>
                        <div class="change-text">Click to change image</div>
                    </div>
                </div>
            `);
            
            // Add class to indicate image is loaded and remove padding
            $uploadZone.addClass('with-image success');
            
            // Add hover effect
            $uploadZone.off('mouseenter.preview mouseleave.preview').on('mouseenter.preview', '.image-preview-container', function() {
                $(this).find('.upload-overlay').css('opacity', '1');
            }).on('mouseleave.preview', '.image-preview-container', function() {
                $(this).find('.upload-overlay').css('opacity', '0');
            });
            
            // Add click handler for overlay to change image
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

// ============================================================================
// UPLOAD MANAGEMENT
// ============================================================================

function cancelUpload() {
    const currentMode = getCurrentMode();
    
    console.log('Cancel upload called:', {
        currentMode,
        hasCapturedFile: !!window.capturedImageFile,
        hasUploadedPath: !!PlanktoScanApp.uploadedFile
    });

    if (currentMode === 'camera' || window.capturedImageFile) {
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
    PlanktoScanApp.uploadedFile = null;
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
    $uploadZone.removeClass('success with-image uploading drag-over');
    $predictButton.prop('disabled', true);
    
    // Reset upload zone content and styling
    $uploadZone.removeAttr('style');
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

    console.log('File upload state reset completely');
}

// ============================================================================
// MODE SWITCHING
// ============================================================================

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

// ============================================================================
// ENHANCED DRAG & DROP HANDLERS
// ============================================================================

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (getCurrentMode() === 'file' && canUserUpload()) {
        $(e.currentTarget).addClass('drag-over');
    }
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    $(e.currentTarget).removeClass('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const $target = $(e.currentTarget);
    $target.removeClass('drag-over');
    
    if (getCurrentMode() !== 'file' || !canUserUpload()) {
        return;
    }
    
    const files = e.originalEvent.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];

        // Validate file type
        if (!isValidImageFile(file)) {
            showError('Please drop a valid image file (JPG, PNG, GIF, WebP)');
            return;
        }
        
        // Validate file size
        if (!isValidFileSize(file)) {
            showError('File size must be less than 10MB');
            return;
        }
        
        // Set file to input and trigger change
        const fileInput = document.getElementById('file-image-upload');
        if (fileInput) {
            fileInput.files = files;
            $(fileInput).trigger('change');
        }
    }
}

// ============================================================================
// GLOBAL EXPORTS
// ============================================================================

if (typeof window !== 'undefined') {
    window.setupFileUploadHandlers = setupFileUploadHandlers;
    window.canUserUpload = canUserUpload;
    window.showImagePreview = showImagePreview;
    window.cancelUpload = cancelUpload;
    window.resetFileUpload = resetFileUpload;
    window.switchToFileMode = switchToFileMode;
    window.handleDragOver = handleDragOver;
    window.handleDragLeave = handleDragLeave;
    window.handleDrop = handleDrop;
}