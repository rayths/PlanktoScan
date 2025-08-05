/**
 * Register page functionality for PlanktoScan
 */

$(document).ready(function() {
    setupRegisterHandlers();
});

/**
 * Setup all register form handlers
 */
function setupRegisterHandlers() {
    // Role selection cards
    $('.role-card').on('click', handleRoleSelection);
    
    // Register form submission
    $('#registerForm').on('submit', handleRegisterSubmission);
    
    // Email validation for expert role
    $('#email').on('blur', validateEmailForRole);
    
    // Password confirmation
    $('#confirmPassword').on('blur', validatePasswordConfirmation);
    
    console.log('Register handlers setup complete');
}

/**
 * Handle role selection
 */
function handleRoleSelection() {
    // Remove selected class from all cards
    $('.role-card').removeClass('selected');
    
    // Add selected class to clicked card
    $(this).addClass('selected');
    
    // Set radio button
    const role = $(this).data('role');
    $(`#role${role.charAt(0).toUpperCase() + role.slice(1)}`).prop('checked', true);
    
    // Show/hide conditional fields
    if (role === 'basic') {
        $('#conditionalFields').show();
        $('#organization').prop('required', true);
    } else {
        $('#conditionalFields').hide();
        $('#organization').prop('required', false);
    }
    
    // Update email validation
    validateEmailForRole();
}

/**
 * Validate email based on selected role
 */
function validateEmailForRole() {
    const email = $('#email').val().trim();
    const selectedRole = $('input[name="role"]:checked').val();
    const $emailField = $('#email');
    const $emailFeedback = $('#emailFeedback');
    
    if (!email) {
        $emailField.removeClass('is-invalid is-valid');
        $emailFeedback.text('').hide();
        return;
    }
    
    if (!isValidEmail(email)) {
        $emailField.addClass('is-invalid').removeClass('is-valid');
        $emailFeedback.text('Please enter a valid email address').show();
        return false;
    }
    
    if (selectedRole === 'expert' && !email.endsWith('@brin.go.id')) {
        $emailField.addClass('is-invalid').removeClass('is-valid');
        $emailFeedback.text('Expert role requires @brin.go.id email address').show();
        return false;
    }
    
    $emailField.addClass('is-valid').removeClass('is-invalid');
    $emailFeedback.hide();
    return true;
}

/**
 * Validate password confirmation
 */
function validatePasswordConfirmation() {
    const password = $('#password').val();
    const confirmPassword = $('#confirmPassword').val();
    const $confirmField = $('#confirmPassword');
    
    if (!confirmPassword) {
        $confirmField.removeClass('is-invalid is-valid');
        return;
    }
    
    if (password !== confirmPassword) {
        $confirmField.addClass('is-invalid').removeClass('is-valid');
        return false;
    }
    
    $confirmField.addClass('is-valid').removeClass('is-invalid');
    return true;
}

/**
 * Handle register form submission
 */
function handleRegisterSubmission(e) {
    e.preventDefault();
    
    const formData = getFormData();
    
    // Validate form
    if (!validateRegisterForm(formData)) {
        return;
    }
    
    // Show loading
    const $submitBtn = $('#registerForm button[type="submit"]');
    showButtonLoading($submitBtn);
    showLoadingModal();
    
    // Determine endpoint based on role
    const endpoint = getRegisterEndpoint(formData.role);
    
    // Prepare API data
    const apiData = prepareApiData(formData);
    
    // Submit registration
    fetch(endpoint, {
        method: 'POST',
        body: apiData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        hideLoadingModal();
        hideButtonLoading($submitBtn);
        
        if (data.success) {
            showRegisterSuccess();
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
        } else {
            showRegisterError(data.message || 'Registration failed');
        }
    })
    .catch(error => {
        hideLoadingModal();
        hideButtonLoading($submitBtn);
        console.error('Registration error:', error);
        showRegisterError('An error occurred during registration. Please try again.');
    });
}

/**
 * Get form data
 */
function getFormData() {
    return {
        role: $('input[name="role"]:checked').val(),
        name: $('#fullName').val().trim(),
        email: $('#email').val().trim(),
        password: $('#password').val(),
        confirmPassword: $('#confirmPassword').val(),
        organization: $('#organization').val().trim()
    };
}

/**
 * Validate register form
 */
function validateRegisterForm(data) {
    // Check if role is selected
    if (!data.role) {
        showValidationError('Please select a role');
        return false;
    }
    
    // Check required fields
    if (!data.name || !data.email || !data.password || !data.confirmPassword) {
        showValidationError('Please fill in all required fields');
        return false;
    }
    
    // Validate email
    if (!isValidEmail(data.email)) {
        showValidationError('Please enter a valid email address');
        return false;
    }
    
    // Validate expert email
    if (data.role === 'expert' && !data.email.endsWith('@brin.go.id')) {
        showValidationError('Expert role requires @brin.go.id email address');
        return false;
    }
    
    // Validate organization for basic users
    if (data.role === 'basic' && !data.organization) {
        showValidationError('Organization is required for basic users');
        return false;
    }
    
    // Validate password confirmation
    if (data.password !== data.confirmPassword) {
        showValidationError('Passwords do not match');
        return false;
    }
    
    // Validate password length
    if (data.password.length < 6) {
        showValidationError('Password must be at least 6 characters long');
        return false;
    }
    
    return true;
}

/**
 * Get register endpoint based on role
 */
function getRegisterEndpoint(role) {
    if (role === 'expert') {
        return '/auth/expert/register';
    }
    return '/auth/basic/register';
}

/**
 * Prepare API data based on role
 */
function prepareApiData(formData) {
    const apiData = new FormData();
    
    if (formData.role === 'expert') {
        apiData.append('email', formData.email);
        apiData.append('password', formData.password);
        apiData.append('name', formData.name);
    } else {
        apiData.append('name', formData.name);
        apiData.append('email', formData.email);
        apiData.append('password', formData.password);
        apiData.append('organization', formData.organization);
    }
    
    return apiData;
}

/**
 * Show loading modal
 */
function showLoadingModal() {
    $('#loadingModal').modal('show');
}

/**
 * Hide loading modal
 */
function hideLoadingModal() {
    $('#loadingModal').modal('hide');
}

/**
 * Show register success message
 */
function showRegisterSuccess() {
    swal({
        title: "Registration Successful!",
        text: "Your account has been created. You will be redirected to login page.",
        icon: "success",
        timer: 2000
    });
}

/**
 * Show button loading state
 */
function showButtonLoading($button) {
    $button.addClass('loading').prop('disabled', true);
    $button.data('original-text', $button.html());
    $button.html('<i class="fas fa-spinner fa-spin"></i> Creating account...');
}

/**
 * Hide button loading state
 */
function hideButtonLoading($button) {
    $button.removeClass('loading').prop('disabled', false);
    if ($button.data('original-text')) {
        $button.html($button.data('original-text'));
    }
}

/**
 * Show register error message
 */
function showRegisterError(message) {
    swal({
        title: "Registration Error",
        text: message,
        icon: "error",
    });
}

/**
 * Show validation error message
 */
function showValidationError(message) {
    swal({
        title: "Validation Error",
        text: message,
        icon: "warning",
    });
}

/**
 * Validate email format
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
