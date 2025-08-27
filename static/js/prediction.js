// ============================================================================
// MAIN SETUP FUNCTION
// ============================================================================

function handlePredictButtonClick() {
    console.log('=== Prediction Button Clicked ===');
    
    // Enhanced file detection
    const hasUploadedFile = PlanktoScanApp.uploadedFile || 
                           (document.getElementById('file-image-upload')?.files?.[0]);
    const hasCapturedFile = window.capturedImageFile || PlanktoScanApp.capturedImageFile;
    
    console.log('File detection results:');
    console.log('- hasUploadedFile:', !!hasUploadedFile);
    console.log('- hasCapturedFile:', !!hasCapturedFile);
    console.log('- window.capturedImageFile:', !!window.capturedImageFile);
    console.log('- PlanktoScanApp.capturedImageFile:', !!PlanktoScanApp.capturedImageFile);
    console.log('- PlanktoScanApp.uploadedFile:', !!PlanktoScanApp.uploadedFile);
    
    // Check if we have any valid file
    if (!hasUploadedFile && !hasCapturedFile) {
        console.error('No valid image file found');
        
        // Show more specific error message
        if (typeof swal !== 'undefined') {
            return swal({ 
                title: "No Image Selected",
                text: "Please upload an image or capture a photo first.", 
                icon: "error" 
            });
        } else if (typeof showError === 'function') {
            return showError("Please upload an image or capture a photo first.");
        } else {
            return alert("Please upload an image or capture a photo first.");
        }
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
        const errorMsg = "Classification model not properly selected. Please refresh and try again.";
        if (typeof swal !== 'undefined') {
            return swal({
                title: "Model Error",
                text: errorMsg,
                icon: "error"
            });
        } else if (typeof showError === 'function') {
            return showError(errorMsg);
        } else {
            return alert(errorMsg);
        }
    }

    // Create FormData
    const formData = new FormData();
    formData.append('location', locationValue.trim());
    formData.append('model_option', String(modelOption));

    // Handle file source with better priority
    let fileToUse = null;
    let fileSource = '';
    
    if (window.capturedImageFile) {
        fileToUse = window.capturedImageFile;
        fileSource = 'window.capturedImageFile';
    } else if (PlanktoScanApp.capturedImageFile) {
        fileToUse = PlanktoScanApp.capturedImageFile;
        fileSource = 'PlanktoScanApp.capturedImageFile';
    } else if (PlanktoScanApp.uploadedFile) {
        fileToUse = PlanktoScanApp.uploadedFile;
        fileSource = 'PlanktoScanApp.uploadedFile';
    } else {
        const fileInput = document.getElementById('file-image-upload');
        if (fileInput?.files?.[0]) {
            fileToUse = fileInput.files[0];
            fileSource = 'file input';
        }
    }
    
    if (!fileToUse) {
        console.error('No file could be determined for prediction');
        const errorMsg = "Unable to access image file. Please try again.";
        if (typeof swal !== 'undefined') {
            return swal({
                title: "File Error",
                text: errorMsg,
                icon: "error"
            });
        } else if (typeof showError === 'function') {
            return showError(errorMsg);
        } else {
            return alert(errorMsg);
        }
    }
    
    console.log(`Using file from: ${fileSource}`);
    console.log(`File name: ${fileToUse.name}`);
    console.log(`File size: ${fileToUse.size} bytes`);
    console.log(`File type: ${fileToUse.type}`);
    
    // Append file to FormData
    formData.append('img_path', fileToUse);

    console.log('=== Sending Prediction Request ===');
    console.log('FormData contents:');
    for (let [key, value] of formData.entries()) {
        if (value instanceof File) {
            console.log(`${key}: File(${value.name}, ${value.size} bytes, ${value.type})`);
        } else {
            console.log(`${key}: ${value}`);
        }
    }

    // Show loading state
    if (typeof showLoading === 'function') {
        showLoading();
    }

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