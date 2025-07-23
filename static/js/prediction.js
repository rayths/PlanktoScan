/**
 * Prediction handling module for PlanktoScan
 */

/**
 * Handle prediction button click with comprehensive validation
 */
function handlePredictButtonClick() {
    // Check if we have either uploaded image or captured image
    if (!PlanktoScanApp.uploadedImagePath && !window.capturedImageFile) {
        return swal({ 
            title: "No Image Selected",
            text: "Please upload an image or capture a photo first.", 
            icon: "error" 
        });
    }

    // Re-initialize dropdowns to ensure values are set
    initializeDropdowns();

    // Get values from dropdowns and location input
    const $modelSelect = $('#classification-model');
    const $locationInput = $('#sampling-location');
    const modelOption = $modelSelect.val() || 'efficientnetv2b0';

    // Handle empty location input
    let locationValue = $locationInput.val();
    if (!locationValue || locationValue.trim() === '') {
        locationValue = 'Unknown';
    }

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
        formData.append('img_path', PlanktoScanApp.uploadedImagePath);
        console.log('Using uploaded image path for prediction');
    }
    
    // Ensure no undefined values are sent
    formData.append('model_option', String(modelOption));

    console.log('Sending prediction request with data:', {
        has_captured_file: !!window.capturedImageFile,
        img_path: PlanktoScanApp.uploadedImagePath,
        model_option: String(modelOption),
        location: locationValue.trim()
    });

    // Show loading state
    showLoading();

    // Submit prediction request
    submitPrediction(formData);
}

/**
 * Submit prediction using fetch API with comprehensive error handling
 * @param {FormData} formData - Form data to submit
 */
function submitPrediction(formData) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    fetch('/predict', {
        method: 'POST',
        body: formData,
        signal: controller.signal
    })
    .then(response => {
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Raw prediction response:', data);
        
        // Hide loading
        hideLoading();
        
        if (data.success && data.result_id) {
            handlePredictionSuccess(data);
        } else {
            throw new Error(data.error || 'Prediction failed: Invalid response');
        }
    })
    .catch(error => {
        clearTimeout(timeoutId);
        console.error('Prediction error:', error);
        
        // Hide loading
        hideLoading();
        
        // Handle different error types
        const errorMessage = getPredictionErrorMessage(error);
        showError(errorMessage);
    });
}

/**
 * Handle successful prediction response
 * @param {Object} data - Success response data
 */
function handlePredictionSuccess(data) {
    console.log('Prediction successful:', data);
    
    if (data.success && data.result_id) {
        // Use result_id (integer) for redirect
        const redirectUrl = `/result/${data.result_id}`;
        console.log('Redirecting to:', redirectUrl);
        
        // Redirect to result page
        window.location.href = redirectUrl;
    } else {
        console.error('Invalid response data:', data);
        showError('Invalid response from server');
    }
}

/**
 * Get appropriate error message based on error type
 * @param {Error} error - The error object
 * @returns {string} User-friendly error message
 */
function getPredictionErrorMessage(error) {
    let errorMessage = "Failed to analyze image. Please try again.";
    
    if (error.name === 'AbortError') {
        errorMessage = "Request timed out. Please try again.";
    } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = "Network error. Please check your connection.";
    } else if (error.message.includes('HTTP 413')) {
        errorMessage = "File too large. Please upload a smaller image.";
    } else if (error.message.includes('HTTP 415')) {
        errorMessage = "Unsupported file type. Please upload a valid image.";
    } else if (error.message.includes('HTTP 500')) {
        errorMessage = "Server error. Please try again later.";
    } else if (error.message.includes('HTTP')) {
        errorMessage = `Server error: ${error.message}`;
    } else if (error.message) {
        errorMessage = error.message;
    }
    
    return errorMessage;
}

/**
 * Setup prediction event handlers
 */
function setupPredictionHandlers() {
    const $predictButton = $('.btn-predict-image');
    
    // Remove existing handlers to prevent duplicates
    $predictButton.off('click');
    
    // Predict button handler
    $predictButton.on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        handlePredictButtonClick();
    });
    
    console.log('Prediction event handlers setup complete');
}

// Export to global scope
if (typeof window !== 'undefined') {
    window.handlePredictButtonClick = handlePredictButtonClick;
    window.submitPrediction = submitPrediction;
    window.handlePredictionSuccess = handlePredictionSuccess;
    window.getPredictionErrorMessage = getPredictionErrorMessage;
    window.setupPredictionHandlers = setupPredictionHandlers;
}