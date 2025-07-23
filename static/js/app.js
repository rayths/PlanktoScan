// GLOBAL APPLICATION STATE
const PlanktoScanApp = {
    isInitialized: false,
    currentStream: null,
    facingMode: 'environment',
    uploadedImagePath: '',
    capturedImageFile: null
};

/**
 * Initialize the entire PlanktoScan application
 */
function initializePlanktoScan() {
    if (PlanktoScanApp.isInitialized) {
        console.log('PlanktoScan already initialized, skipping...');
        return;
    }
    
    console.log('=== Starting PlanktoScan Initialization ===');
    PlanktoScanApp.isInitialized = true;
    
    try {
        // Initialize all modules in correct order
        initializeDropdowns();
        setupAllEventHandlers();
        initializeLocationInput();
        initializeModeButtons();
        setupWelcomePopupHandlers();
        
        // Set default file mode
        setTimeout(() => {
            switchToFileMode();
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

/**
 * Setup all event handlers from different modules
 */
function setupAllEventHandlers() {
    console.log('Setting up all event handlers...');
    
    // File upload handlers
    if (typeof setupFileUploadHandlers === 'function') {
        setupFileUploadHandlers();
    }
    
    // Camera handlers
    if (typeof setupCameraHandlers === 'function') {
        setupCameraHandlers();
    }
    
    // GPS location handlers
    if (typeof setupGPSHandlers === 'function') {
        setupGPSHandlers();
    }
    
    // Prediction handlers
    if (typeof setupPredictionHandlers === 'function') {
        setupPredictionHandlers();
    }
    
    // Dropdown handlers
    if (typeof setupDropdownHandlers === 'function') {
        setupDropdownHandlers();
    }
    
    // General UI handlers
    setupGeneralUIHandlers();
    
    console.log('All event handlers setup complete');
}

/**
 * Setup general UI event handlers
 */
function setupGeneralUIHandlers() {
    const $locationInput = $('#sampling-location');
    
    // Location input handler
    $locationInput.off('input').on('input', function() {
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
        updatePredictButtonState();
        
        console.log('Location input updated:', value.substring(0, 50) + (value.length > 50 ? '...' : ''));
    });

    // Auto-clear GPS status when clicking elsewhere
    $(document).off('click.gps').on('click.gps', function(e) {
        if (!$(e.target).closest('.location-input-container').length) {
            $('#gps-status').fadeOut();
        }
    });

    // Initialize GPS button state
    if (!isGeolocationSupported()) {
        $('#get-gps-location').prop('disabled', true).attr('title', 'GPS not supported on this device');
    }
    
    console.log('General UI handlers setup complete');
}

/**
 * Setup GPS event handlers
 */
function setupGPSHandlers() {
    // GPS button click handler
    $('#get-gps-location').off('click').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof getCurrentGPSLocation === 'function') {
            getCurrentGPSLocation();
        }
    });

    // Clear location button click handler
    $('#clear-location').off('click').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof clearLocationInput === 'function') {
            clearLocationInput();
        }
    });
    
    console.log('GPS event handlers setup complete');
}

/**
 * Initialize location input with default value
 */
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

/**
 * Initialize mode buttons (File/Camera)
 */
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

/**
 * Perform final initialization check and adjustments
 */
function performFinalInitializationCheck() {
    console.log('=== Final Initialization Check ===');
    
    const $modelSelect = $('#classification-model');
    const $locationInput = $('#sampling-location');
    
    console.log('Classification model:', $modelSelect.val());
    console.log('Location input:', $locationInput.val());
    
    // Force re-initialization if any value is still empty
    if (typeof initializeDropdowns === 'function') {
        initializeDropdowns();
    }
    
    // Ensure dropdown buttons show correct text
    const classificationValue = $modelSelect.val();
    
    if (classificationValue && typeof updateDropdownButtonText === 'function') {
        updateDropdownButtonText('classification-model');
    }
    
    // Update predict button state
    updatePredictButtonState();
    
    console.log('Final initialization check complete');
}

/**
 * Clean up application state when page unloads
 */
function cleanupPlanktoScan() {
    // Stop camera if running
    if (PlanktoScanApp.currentStream && typeof stopCamera === 'function') {
        stopCamera();
    }
    
    // Stop GPS watching
    if (typeof stopWatchingGPS === 'function') {
        stopWatchingGPS();
    }
    
    // Reset state
    PlanktoScanApp.uploadedImagePath = '';
    PlanktoScanApp.capturedImageFile = null;
    
    console.log('PlanktoScan cleanup completed');
}

// Initialize when DOM is ready
$(document).ready(function() {
    initializePlanktoScan();
});

// Cleanup when page unloads
$(window).on('beforeunload', function() {
    cleanupPlanktoScan();
});

// Export to global scope
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