// ============================================================================
// MAIN SETUP FUNCTION
// ============================================================================

function handlePredictButtonClick() {
    // Check if we have either uploaded file or captured image
    const hasUploadedFile = PlanktoScanApp.uploadedFile || 
                           (document.getElementById('file-image-upload')?.files?.[0]);
    const hasCapturedFile = window.capturedImageFile;
    
    if (!hasUploadedFile && !hasCapturedFile) {
        return swal({ 
            title: "No Image Selected",
            text: "Please upload an image or capture a photo first.", 
            icon: "error" 
        });
    }

    // Re-initialize dropdowns to ensure values are set
    if (typeof initializeDropdowns === 'function') {
        initializeDropdowns();
    }

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

    // Create FormData
    const formData = new FormData();

    formData.append('location', locationValue.trim());
    formData.append('model_option', String(modelOption));

    // Handle file source
    if (window.capturedImageFile) {
        // Use captured image file
        formData.append('img_path', window.capturedImageFile);
        console.log('Using captured image file for prediction');
    } else if (PlanktoScanApp.uploadedFile) {
        // Use stored uploaded file
        formData.append('img_path', PlanktoScanApp.uploadedFile);
        console.log('Using stored uploaded file for prediction');
    } else {
        // Fallback: get from file input
        const fileInput = document.getElementById('file-image-upload');
        if (fileInput?.files?.[0]) {
            formData.append('img_path', fileInput.files[0]);
            console.log('Using file input for prediction');
        } else {
            return swal({
                title: "File Error",
                text: "Unable to access image file. Please try again.",
                icon: "error"
            });
        }
    }

    console.log('Sending prediction request with correct parameters');

    // Show loading state
    showLoading();

    // Submit prediction request
    submitPrediction(formData);
}

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
        
        // Check for success response
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

function handlePredictionSuccess(data) {
    console.log('Prediction successful:', data);
    
    if (data.success && data.result_id) {
        // Use result_id for redirect
        const redirectUrl = `/result/${data.result_id}`;
        console.log('Redirecting to:', redirectUrl);
        
        // Redirect to result page
        window.location.href = redirectUrl;
    } else {
        console.error('Invalid response data:', data);
        showError('Invalid response from server');
    }
}

function getPredictionErrorMessage(error) {
    let errorMessage = "Failed to analyze image. Please try again.";
    
    if (error.name === 'AbortError') {
        errorMessage = "Request timed out. Please try again.";
    } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = "Network error. Please check your connection.";
    } else if (error.message.includes('HTTP 401')) {
        errorMessage = "Please log in to analyze images.";
    } else if (error.message.includes('HTTP 413')) {
        errorMessage = "File too large. Please upload a smaller image.";
    } else if (error.message.includes('HTTP 415')) {
        errorMessage = "Unsupported file type. Please upload a valid image.";
    } else if (error.message.includes('HTTP 422')) {
        errorMessage = "Invalid request format. Please try uploading the file again.";
    } else if (error.message.includes('HTTP 500')) {
        errorMessage = "Server error. Please try again later.";
    } else if (error.message.includes('HTTP')) {
        errorMessage = `Server error: ${error.message}`;
    } else if (error.message) {
        errorMessage = error.message;
    }
    
    return errorMessage;
}

function setupPredictionHandlers() {
    const $predictButton = $('.btn-predict-image');
    
    // Remove existing handlers to prevent duplicates
    $predictButton.off('click.prediction');
    
    // Predict button handler
    $predictButton.on('click.prediction', function(e) {
        e.preventDefault();
        e.stopPropagation();
        handlePredictButtonClick();
    });
    
    console.log('Prediction event handlers setup complete');
}

// ============================================================================
// GLOBAL EXPORTS
// ============================================================================

if (typeof window !== 'undefined') {
    window.handlePredictButtonClick = handlePredictButtonClick;
    window.submitPrediction = submitPrediction;
    window.handlePredictionSuccess = handlePredictionSuccess;
    window.getPredictionErrorMessage = getPredictionErrorMessage;
    window.setupPredictionHandlers = setupPredictionHandlers;
}