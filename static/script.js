$(document).ready(function () {
    const $btn = $('.btn');
    const $start = $('.btn-start');
    const $home = $('.btn-back');
    const $fileInput = $('#file-image-upload');
    const $imageUploadInput = $('#image-upload');
    const $predictButton = $('.btn-predict-image');
    const $modelSelect = $('#classification-model');
    const $segmentationSelect = $('#segmentation-model');
    const $loading = $('#load');
    const $transparant = $('#transparant-bg');
    const $uploadZone = $('.upload-zone');
    const $fileInfo = $('#file-info');
    const $fileName = $('#file-name');
    const $cancelUpload = $('#cancel-upload');

    let uploadedImagePath = '';

    // Initialize dropdown values immediately
    function initializeDropdowns() {
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
    
    // Initialize dropdowns immediately
    initializeDropdowns();

    // Hover effect
    $btn.hover(
        function () {
            const svg = $(this).find('svg path');
            $(this).data('timeout', setTimeout(() => {
                svg.css('fill', '#ffffff');
            }, 100));
        },
        function () {
            clearTimeout($(this).data('timeout'));
            $(this).find('svg path').css('fill', '#59a9d4');
        }
    );

    // Routing navigation
    $start.click(() => window.location.href = '/dashboard');
    $home.click(() => window.location.href = '/');

    // Drag and drop functionality
    $uploadZone.on('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).addClass('dragover');
    });

    $uploadZone.on('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).removeClass('dragover');
    });

    $uploadZone.on('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).removeClass('dragover');
        
        const files = e.originalEvent.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    });

    // File input change handler
    $fileInput.on('change', function (e) {
        const file = e.target.files[0];
        if (file) {
            handleFileUpload(file);
        }
    });

    // Handle file upload
    function handleFileUpload(file) {
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
                $fileInfo.show();
                $predictButton.prop('disabled', false);
                $uploadZone.removeClass('uploading');
                $uploadZone.addClass('success');
                
                // Update upload zone appearance
                $uploadZone.html(`
                    <div class="upload-icon">
                        <i class="fas fa-check-circle" style="color: #27AE60;"></i>
                    </div>
                    <div class="upload-text" style="color: #27AE60;">File uploaded successfully!</div>
                    <div class="upload-subtext">Click to upload a different image</div>
                `);
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

    // Predict
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

    // Function to reset file upload state
    function resetFileUpload() {
        $fileInput.val(''); // Clear the file input
        $imageUploadInput.val(''); // Clear the hidden input
        uploadedImagePath = '';
        $fileInfo.hide();
        $fileName.text('No file selected');
        $uploadZone.removeClass('success');
        $predictButton.attr('disabled', true);
    }

    // Monitor dropdown changes for debugging
    $modelSelect.on('change', function() {
        console.log('Classification model changed to:', $(this).val());
    });
    
    $segmentationSelect.on('change', function() {
        console.log('Segmentation model changed to:', $(this).val());
    });

    // Final initialization check after DOM is fully loaded
    setTimeout(() => {
        console.log('=== Final Initialization Check ===');
        console.log('Classification model:', $modelSelect.val());
        console.log('Segmentation model:', $segmentationSelect.val());
        
        // Force re-initialization if any value is still empty
        initializeDropdowns();
    }, 100);
});
