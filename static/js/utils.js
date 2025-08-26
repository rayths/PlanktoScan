// ============================================================================
// ALERT MASSAGES
// ============================================================================

function showError(message) {
    if (typeof swal !== 'undefined') {
        swal({
            title: "Error",
            text: message,
            icon: "error",
            timer: 5000,
            button: "OK"
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
            timer: 3000,
            button: "OK"
        });
    } else {
        alert(message);
    }
}

function showWarning(message) {
    if (typeof swal !== 'undefined') {
        swal({
            title: "Warning",
            text: message,
            icon: "warning",
            button: "OK"
        });
    } else {
        alert('Warning: ' + message);
    }
}

function showInfo(message) {
    if (typeof swal !== 'undefined') {
        swal({
            title: "Information",
            text: message,
            icon: "info",
            button: "OK"
        });
    } else {
        alert('Info: ' + message);
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
    // Show SweetAlert confirmation dialog
    if (typeof swal !== 'undefined') {
        swal({
            title: 'Logout Confirmation',
            text: 'Are you sure you want to logout?',
            icon: 'warning',
            buttons: {
                cancel: {
                    text: "Cancel",
                    value: null,
                    visible: true,
                    className: "btn-cancel",
                    closeModal: true,
                },
                confirm: {
                    text: "Yes, Logout",
                    value: true,
                    visible: true,
                    className: "btn-danger",
                    closeModal: true
                }
            },
            dangerMode: true,
        }).then((willLogout) => {
            if (willLogout) {
                performLogout();
            }
        });
    } else {
        // Fallback to regular confirm if SweetAlert not available
        if (confirm('Are you sure you want to logout?')) {
            performLogout();
        }
    }
}

function performLogout() {
    // Show loading state with SweetAlert
    if (typeof swal !== 'undefined') {
        swal({
            title: 'Logging out...',
            text: 'Please wait while we sign you out',
            icon: 'info',
            buttons: false,
            closeOnClickOutside: false,
            closeOnEsc: false
        });
    } else {
        // Show loading state on button
        const logoutBtn = document.querySelector('.logout-item');
        if (logoutBtn) {
            logoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging out...';
        }
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
            // Success notification
            if (typeof swal !== 'undefined') {
                swal({
                    title: 'Logged Out Successfully!',
                    text: 'You have been signed out. Redirecting to homepage...',
                    icon: 'success',
                    timer: 2000,
                    buttons: false,
                    closeOnClickOutside: false
                }).then(() => {
                    window.location.href = '/';
                });
            } else {
                window.location.href = '/';
            }
        } else {
            throw new Error('Logout failed');
        }
    })
    .catch(error => {
        console.error('Logout error:', error);

        if (typeof swal !== 'undefined') {
            swal({
                title: 'Logout Failed',
                text: 'Unable to logout at this time. Please try again.',
                icon: 'error',
                button: "OK",
                dangerMode: true
            });
        } else {
            alert('Logout failed. Please try again.');
            // Reset button text
            const logoutBtn = document.querySelector('.logout-item');
            if (logoutBtn) {
                logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
            }
        }
    });
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
// ENHANCED ALERT FUNCTIONS
// ============================================================================

function showConfirmDialog(title, text, onConfirm, onCancel = null) {
    if (typeof swal !== 'undefined') {
        swal({
            title: title,
            text: text,
            icon: 'warning',
            buttons: {
                cancel: {
                    text: "Cancel",
                    value: null,
                    visible: true,
                    className: "btn-secondary",
                    closeModal: true,
                },
                confirm: {
                    text: "Confirm",
                    value: true,
                    visible: true,
                    className: "btn-primary",
                    closeModal: true
                }
            },
            dangerMode: false,
        }).then((willProceed) => {
            if (willProceed && onConfirm) {
                onConfirm();
            } else if (!willProceed && onCancel) {
                onCancel();
            }
        });
    } else {
        if (confirm(title + '\n' + text)) {
            if (onConfirm) onConfirm();
        } else {
            if (onCancel) onCancel();
        }
    }
}

function showDeleteConfirmDialog(itemName, onConfirm, onCancel = null) {
    if (typeof swal !== 'undefined') {
        swal({
            title: 'Delete Confirmation',
            text: `Are you sure you want to delete "${itemName}"? This action cannot be undone.`,
            icon: 'warning',
            buttons: {
                cancel: {
                    text: "Cancel",
                    value: null,
                    visible: true,
                    className: "btn-secondary",
                    closeModal: true,
                },
                confirm: {
                    text: "Delete",
                    value: true,
                    visible: true,
                    className: "btn-danger",
                    closeModal: true
                }
            },
            dangerMode: true,
        }).then((willDelete) => {
            if (willDelete && onConfirm) {
                onConfirm();
            } else if (!willDelete && onCancel) {
                onCancel();
            }
        });
    } else {
        if (confirm(`Are you sure you want to delete "${itemName}"? This action cannot be undone.`)) {
            if (onConfirm) onConfirm();
        } else {
            if (onCancel) onCancel();
        }
    }
}

function showLoadingDialog(title = 'Loading...', text = 'Please wait...') {
    if (typeof swal !== 'undefined') {
        return swal({
            title: title,
            text: text,
            icon: 'info',
            buttons: false,
            closeOnClickOutside: false,
            closeOnEsc: false
        });
    }
    return null;
}

function closeLoadingDialog() {
    if (typeof swal !== 'undefined') {
        swal.close();
    }
}

// ============================================================================
// GLOBAL EXPORTS
// ============================================================================

if (typeof window !== 'undefined') {
    window.showError = showError;
    window.showSuccess = showSuccess;
    window.showWarning = showWarning;
    window.showInfo = showInfo;
    window.showConfirmDialog = showConfirmDialog;
    window.showDeleteConfirmDialog = showDeleteConfirmDialog;
    window.showLoadingDialog = showLoadingDialog;
    window.closeLoadingDialog = closeLoadingDialog;
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
    window.performLogout = performLogout;
}