/**
 * Login page functionality for PlanktoScan
 */

$(document).ready(function() {
    setupLoginHandlers();
});

/**
 * Setup all login form handlers
 */
function setupLoginHandlers() {
    // Main login form
    $('#loginForm').on('submit', handleLogin);
    
    // Guest access button
    $('#guestAccessBtn').on('click', handleGuestAccess);
    
    // Register link
    $('#registerLink').on('click', function(e) {
        e.preventDefault();
        window.location.href = '/register';
    });
    
    console.log('Login handlers setup complete');
}

/**
 * Handle main login form submission
 */
function handleLogin(e) {
    e.preventDefault();
    
    const email = $('#email').val().trim();
    const password = $('#password').val();
    
    // Basic validation
    if (!email || !password) {
        showValidationError('Please enter both email and password');
        return;
    }
    
    if (!isValidEmail(email)) {
        showValidationError('Please enter a valid email address');
        return;
    }
    
    // Show loading
    const $form = $(this);
    const $submitBtn = $form.find('button[type="submit"]');
    showButtonLoading($submitBtn);
    showLoadingModal();
    
    // Use Firebase authentication instead of direct API calls
    loginWithFirebase(email, password, $submitBtn);
}

/**
 * Login with Firebase Authentication
 */
async function loginWithFirebase(email, password, $submitBtn) {
    try {
        console.log('Attempting Firebase login...');
        
        // Sign in with Firebase
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        console.log('Firebase login successful:', user.uid);
        
        // Show warning if email is not verified, but allow login to continue
        if (!user.emailVerified) {
            console.warn('Email not verified, but login allowed to continue');
            // Optional: Show a non-blocking notification
            showEmailVerificationWarning();
        }
        
        // Get ID token for backend authentication
        const idToken = await user.getIdToken();
        console.log('ID token retrieved for backend authentication');
        
        // Determine role based on email
        const role = determineLoginRole(email);
        
        // Send to backend for session creation
        const response = await fetch('/auth/firebase', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                id_token: idToken,
                next_url: getNextUrl(),
                role: role
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        hideLoadingModal();
        hideButtonLoading($submitBtn);
        
        if (data.success) {
            console.log('Login successful, setting cookie and redirecting...');
            
            // Set welcome_seen cookie manually with longer expiry
            setCookie('welcome_seen', 'true', 7); // 7 days
            
            // Also call API to set cookie as fallback
            fetch('/api/set-welcome-seen', { method: 'POST' })
                .then(response => response.json())
                .then(cookieResult => console.log('Cookie API result:', cookieResult))
                .catch(err => console.log('Cookie API call failed:', err));
            
            showLoginSuccess(data.user.role);
            
            // Redirect after short delay
            setTimeout(() => {
                const nextUrl = data.redirect_url || getNextUrl();
                console.log('Redirecting to:', nextUrl);
                window.location.href = nextUrl;
            }, 1500); // Increased delay to ensure cookie is set
        } else {
            throw new Error(data.message || 'Authentication failed');
        }
        
    } catch (error) {
        hideLoadingModal();
        hideButtonLoading($submitBtn);
        
        console.error('Login error:', error);
        
        let errorMessage = 'Login failed. Please try again.';
        
        if (error.code) {
            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'No account found with this email address.';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Incorrect password.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Invalid email address.';
                    break;
                case 'auth/user-disabled':
                    errorMessage = 'This account has been disabled.';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Too many failed login attempts. Please try again later.';
                    break;
                default:
                    errorMessage = error.message || errorMessage;
            }
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        showLoginError(errorMessage);
    }
}

/**
 * Handle guest access
 */
function handleGuestAccess() {
    showLoadingModal();
    
    fetch('/login/guest', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        hideLoadingModal();
        
        if (data.success) {
            console.log('Guest access successful, setting cookie and redirecting...');
            
            // Set welcome_seen cookie manually with longer expiry
            setCookie('welcome_seen', 'true', 1); // 1 day

            // Also call API to set cookie as fallback
            fetch('/api/set-welcome-seen', { method: 'POST' })
                .then(response => response.json())
                .then(cookieResult => console.log('Cookie API result:', cookieResult))
                .catch(err => console.log('Cookie API call failed:', err));
            
            showLoginSuccess('guest');
            
            // Redirect after short delay
            setTimeout(() => {
                const nextUrl = getNextUrl();
                console.log('Redirecting to:', nextUrl);
                window.location.href = nextUrl;
            }, 1500); // Increased delay to ensure cookie is set
        } else {
            showLoginError(data.message || 'Guest access failed');
        }
    })
    .catch(error => {
        hideLoadingModal();
        console.error('Guest access error:', error);
        showLoginError('An error occurred. Please try again.');
    });
}

/**
 * Determine login role based on email
 */
function determineLoginRole(email) {
    if (email.endsWith('@brin.go.id')) {
        return 'expert';
    }
    return 'basic';
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
 * Show login success message
 */
function showLoginSuccess(role) {
    swal({
        title: "Login Successful!",
        text: `Welcome! You are logged in as ${role}`,
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
    $button.html('<i class="fas fa-spinner fa-spin"></i> Please wait...');
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
 * Show login error message
 */
function showLoginError(message) {
    swal({
        title: "Login Error",
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

/**
 * Get next URL from query params
 */
function getNextUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('next') || '/';
}

/**
 * Set cookie helper function
 */
function setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    const cookieString = `${name}=${value}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
    document.cookie = cookieString;
    console.log('Cookie set:', cookieString);
    
    // Verify cookie was set
    setTimeout(() => {
        const cookieValue = getCookie(name);
        console.log(`Cookie verification - ${name}:`, cookieValue);
    }, 100);
}

/**
 * Get cookie helper function
 */
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

/**
 * Show email verification warning (non-blocking)
 */
function showEmailVerificationWarning() {
    // Show a toast-style notification that doesn't block login
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Email Not Verified',
            text: 'Your email address is not verified yet. Please check your inbox and verify your email for full account security.',
            icon: 'warning',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 5000,
            timerProgressBar: true
        });
    } else {
        // Fallback for systems without SweetAlert
        console.warn('Email verification warning: Please verify your email address for full account security');
    }
}
