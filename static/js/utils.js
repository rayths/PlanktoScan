// ============================================================================
// ALERT MASSAGES
// ============================================================================

function showError(message) {
    if (typeof swal !== 'undefined') {
        swal({
            title: "Error",
            text: message,
            icon: "error",
            timer: 5000
        });
    } else {
        alert(message);
    }
}

function showSuccess(message) {
    if (typeof swal !== 'undefined') {
        swal({
            title: "Success",
            text: message,
            icon: "success",
            timer: 3000
        });
    } else {
        alert(message);
    }
}

// ============================================================================
// LOADING STATE MANAGEMENT
// ============================================================================

function showLoading() {
    const $loading = $('#load');
    const $transparent = $('#transparant-bg');
    
    if ($loading.length) $loading.show();
    if ($transparent.length) $transparent.show();
}

function hideLoading() {
    const $loading = $('#load');
    const $transparent = $('#transparant-bg');
    
    if ($loading.length) $loading.hide();
    if ($transparent.length) $transparent.hide();
}

// ============================================================================
// COOKIE MANAGEMENT
// ============================================================================

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

// ============================================================================
// USER AUTHENTICATION
// ============================================================================

function logout() {
    // Show confirmation dialog
    if (confirm('Are you sure you want to logout?')) {
        // Show loading state
        const logoutBtn = document.querySelector('.logout-item');
        if (logoutBtn) {
            logoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging out...';
        }

        // Send logout request
        fetch('/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin'
        })
        .then(response => {
            if (response.ok) {
                // Redirect to dashboard after successful logout
                window.location.href = '/';
            } else {
                throw new Error('Logout failed');
            }
        })
        .catch(error => {
            console.error('Logout error:', error);
            alert('Logout failed. Please try again.');
            // Reset button text
            if (logoutBtn) {
                logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
            }
        });
    }
}

// ============================================================================
// FILE VALIDATION AND UTILITIES
// ============================================================================

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function isValidImageFile(file) {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    return validTypes.includes(file.type.toLowerCase());
}

function isValidFileSize(file, maxSizeMB = 10) {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return file.size <= maxSizeBytes;
}

// ============================================================================
// DEVICE AND BROWSER CAPABILITIES
// ============================================================================

function isGeolocationSupported() {
    return "geolocation" in navigator;
}

// ============================================================================
// APPLICATION STATE MANAGEMENT
// ============================================================================

function getCurrentMode() {
    const fileModeBtn = document.getElementById('file-mode-btn');
    const cameraModeBtn = document.getElementById('camera-mode-btn');
    
    if (fileModeBtn && fileModeBtn.classList.contains('active')) {
        return 'file';
    } else if (cameraModeBtn && cameraModeBtn.classList.contains('active')) {
        return 'camera';
    }
    
    return 'file'; // Default to file mode
}

function updateFileInfo(fileName, show = true) {
    const $fileInfo = $('#file-info');
    const $fileName = $('#file-name');
    
    if (show && fileName) {
        $fileName.text(fileName);
        $fileInfo.show();
    } else {
        $fileInfo.hide();
        $fileName.text('No file selected');
    }
}

function updatePredictButtonState() {
    const $predictButton = $('.btn-predict-image');
    if (!$predictButton.length) return;
    
    const hasImage = window.capturedImageFile || 
                     PlanktoScanApp.uploadedFile || 
                     PlanktoScanApp.uploadedImagePath ||
                     (document.getElementById('file-image-upload')?.files?.[0]);
                     
    const hasLocation = $('#sampling-location').val().trim() !== '';
    const hasModel = $('#classification-model').val() !== '';
    
    const shouldEnable = hasImage && hasLocation && hasModel;
    
    $predictButton.prop('disabled', !shouldEnable);
    
    if (shouldEnable) {
        $predictButton.removeClass('btn-disabled').addClass('btn-enabled');
    } else {
        $predictButton.removeClass('btn-enabled').addClass('btn-disabled');
    }
}

// ============================================================================
// GLOBAL EXPORTS
// ============================================================================

if (typeof window !== 'undefined') {
    window.showError = showError;
    window.showSuccess = showSuccess;
    window.showLoading = showLoading;
    window.hideLoading = hideLoading;
    window.getCookie = getCookie;
    window.setCookie = setCookie;
    window.formatFileSize = formatFileSize;
    window.isValidImageFile = isValidImageFile;
    window.isValidFileSize = isValidFileSize;
    window.isGeolocationSupported = isGeolocationSupported;
    window.getCurrentMode = getCurrentMode;
    window.updateFileInfo = updateFileInfo;
    window.updatePredictButtonState = updatePredictButtonState;
    window.logout = logout;
}