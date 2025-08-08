// ============================================================================
// GLOBAL APPLICATION STATE
// ============================================================================

const PlanktoScanApp = {
    isInitialized: false,
    currentStream: null,
    facingMode: 'environment',
    uploadedImagePath: '',
    uploadedFile: null,
    capturedImageFile: null
};

// ============================================================================
// MAIN INITIALIZATION
// ============================================================================

function initializePlanktoScan() {
    if (PlanktoScanApp.isInitialized) {
        console.log('PlanktoScan already initialized, skipping...');
        return;
    }
    
    console.log('=== Starting PlanktoScan Initialization ===');
    PlanktoScanApp.isInitialized = true;
    
    try {
        // Initialize all modules
        if (typeof initializeAllDropdowns === 'function') {
            initializeAllDropdowns();
        }
        
        setupAllEventHandlers();
        initializeLocationInput();
        initializeModeButtons();

        // Setup welcome popup handlers
        if (typeof setupWelcomePopupHandlers === 'function') {
            setupWelcomePopupHandlers();
        }

        // Initialize welcome popup with server data
        if (typeof initializeWelcomePopupWithServerData === 'function') {
            initializeWelcomePopupWithServerData();
        }
        
        // Set default file mode
        setTimeout(() => {
            if (typeof switchToFileMode === 'function') {
                switchToFileMode();
            }
        }, 50);
                
        // Final initialization check
        setTimeout(() => {
            performFinalInitializationCheck();
        }, 100);
        
        console.log('=== PlanktoScan Initialization Complete ===');
        
    } catch (error) {
        console.error('Error during PlanktoScan initialization:', error);
    }
}

// ============================================================================
// EVENT HANDLER SETUP
// ============================================================================

function setupAllEventHandlers() {
    console.log('Setting up all event handlers...');
    
    // File upload handlers
    if (typeof setupFileUploadHandlers === 'function') {
        setupFileUploadHandlers();
    } else {
        console.warn('setupFileUploadHandlers function not found');
    }
    
    // Camera handlers
    if (typeof setupCameraHandlers === 'function') {
        setupCameraHandlers();
    } else {
        console.warn('setupCameraHandlers function not found');
    }
    
    // GPS location handlers
    setupGPSHandlers();
    
    // Prediction handlers
    if (typeof setupPredictionHandlers === 'function') {
        setupPredictionHandlers();
    } else {
        console.warn('setupPredictionHandlers function not found');
    }
    
    // Dropdown handlers
    if (typeof setupDropdownHandlers === 'function') {
        setupDropdownHandlers();
    } else {
        console.warn('setupDropdownHandlers function not found');
    }
    
    // General UI handlers
    setupGeneralUIHandlers();
    
    console.log('All event handlers setup complete');
}

function setupGeneralUIHandlers() {
    const $locationInput = $('#sampling-location');
    
    // Location input handler
    $locationInput.off('input.app').on('input.app', function() {
        const value = $(this).val();
        
        // Hide GPS accuracy info when manually editing
        if (typeof gpsState !== 'undefined' && gpsState.lastKnownPosition && $('#location-accuracy').is(':visible')) {
            $('#location-accuracy').fadeOut();
            if (typeof resetGPSButton === 'function') {
                resetGPSButton();
            }
        }
        
        // Simple length validation
        if (value.length > 255) {
            $(this).val(value.substring(0, 255));
            showError('Location input has been truncated to 255 characters.');
        }
        
        // Update predict button state
        if (typeof updatePredictButtonState === 'function') {
            updatePredictButtonState();
        }
        
        console.log('Location input updated:', value.substring(0, 50) + (value.length > 50 ? '...' : ''));
    });

    // Auto-clear GPS status when clicking elsewhere
    $(document).off('click.gps').on('click.gps', function(e) {
        if (!$(e.target).closest('.location-input-container').length) {
            $('#gps-status').fadeOut();
        }
    });

    // Initialize GPS button state
    if (typeof isGeolocationSupported === 'function' && !isGeolocationSupported()) {
        $('#get-gps-location').prop('disabled', true).attr('title', 'GPS not supported on this device');
    }
    
    console.log('General UI handlers setup complete');
}

function setupGPSHandlers() {
    // GPS button click handler
    $('#get-gps-location').off('click.gps').on('click.gps', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof getCurrentGPSLocation === 'function') {
            getCurrentGPSLocation();
        } else {
            console.warn('getCurrentGPSLocation function not found');
        }
    });

    // Clear location button click handler
    $('#clear-location').off('click.gps').on('click.gps', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof clearLocationInput === 'function') {
            clearLocationInput();
        } else {
            console.warn('clearLocationInput function not found');
        }
    });
    
    console.log('GPS event handlers setup complete');
}

// ============================================================================
// INITIALIZATION HELPERS
// ============================================================================

function initializeLocationInput() {
    const $locationInput = $('#sampling-location');
    if ($locationInput.length) {
        const currentValue = $locationInput.val();
        if (!currentValue || currentValue === '' || currentValue === 'Unknown') {
            $locationInput.val('');
            console.log('Location input initialized with empty value');
        }
    }
}

function initializeModeButtons() {
    const fileModeBtn = document.getElementById('file-mode-btn');
    const cameraModeBtn = document.getElementById('camera-mode-btn');
    const uploadZone = document.getElementById('upload-zone');
    const cameraContainer = document.getElementById('camera-container');
    
    // Force file mode to be active on load
    if (fileModeBtn) fileModeBtn.classList.add('active');
    if (cameraModeBtn) cameraModeBtn.classList.remove('active');
    if (uploadZone) uploadZone.style.display = 'block';
    if (cameraContainer) cameraContainer.style.display = 'none';
    
    console.log('Mode buttons initialized - File mode active');
}

function performFinalInitializationCheck() {
    console.log('=== Final Initialization Check ===');
    
    const $modelSelect = $('#classification-model');
    const $locationInput = $('#sampling-location');
    
    console.log('Classification model:', $modelSelect.val());
    console.log('Location input:', $locationInput.val());
    
    // Force re-initialization if any value is still empty
    if (typeof initializeAllDropdowns === 'function') {
        initializeAllDropdowns();
    }
    
    // Ensure dropdown buttons show correct text
    const classificationValue = $modelSelect.val();
    
    if (classificationValue && typeof updateDropdownButtonText === 'function') {
        updateDropdownButtonText('classification-model');
    }
    
    // Update predict button state
    if (typeof updatePredictButtonState === 'function') {
        updatePredictButtonState();
    }

    console.log('Final initialization check complete');
}

// ============================================================================
// CLEANUP
// ============================================================================

function cleanupPlanktoScan() {
    try {
        // Stop camera if running
        if (PlanktoScanApp.currentStream && typeof stopCamera === 'function') {
            stopCamera();
        }

        // Stop GPS watching
        if (typeof stopWatchingGPS === 'function') {
            stopWatchingGPS();
        }

        // Clear file objects to prevent memory leaks
        if (PlanktoScanApp.uploadedImagePath && PlanktoScanApp.uploadedImagePath.startsWith('blob:')) {
            URL.revokeObjectURL(PlanktoScanApp.uploadedImagePath);
        }

        // Reset state
        PlanktoScanApp.uploadedImagePath = '';
        PlanktoScanApp.uploadedFile = null;
        PlanktoScanApp.capturedImageFile = null;
        
        console.log('PlanktoScan cleanup completed');
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
}

// ============================================================================
// DOCUMENT READY AND EVENT BINDING
// ============================================================================

// Initialize when DOM is ready
$(document).ready(function() {
    try {
        initializePlanktoScan();
    } catch (error) {
        console.error('Failed to initialize PlanktoScan:', error);
    }
});

// Cleanup when page unloads
$(window).on('beforeunload', function() {
    cleanupPlanktoScan();
});

// Handle page visibility changes
if (typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            // Page is hidden, pause expensive operations
            if (typeof pauseCamera === 'function') {
                pauseCamera();
            }
        } else {
            // Page is visible, resume operations
            if (typeof resumeCamera === 'function') {
                resumeCamera();
            }
        }
    });
}

// ============================================================================
// GLOBAL EXPORTS
// ============================================================================

if (typeof window !== 'undefined') {
    window.PlanktoScanApp = PlanktoScanApp;
    window.initializePlanktoScan = initializePlanktoScan;
    window.setupAllEventHandlers = setupAllEventHandlers;
    window.setupGeneralUIHandlers = setupGeneralUIHandlers;
    window.setupGPSHandlers = setupGPSHandlers;
    window.initializeLocationInput = initializeLocationInput;
    window.initializeModeButtons = initializeModeButtons;
    window.performFinalInitializationCheck = performFinalInitializationCheck;
    window.cleanupPlanktoScan = cleanupPlanktoScan;
}