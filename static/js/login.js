/**
 * Login page functionality for PlanktoScan
 */

$(document).ready(function() {
    setupLoginHandlers();

    // Global error handler untuk modal cleanup
    $(document).on('hidden.bs.modal', '#loadingModal', function () {
        console.log('Loading modal hidden');
        // Cleanup any remaining backdrop
        $('.modal-backdrop').remove();
        $('body').removeClass('modal-open').css('padding-right', '');
    });
    
    // Fallback cleanup saat swal muncul
    $(document).on('click', '.swal-button', function() {
        setTimeout(() => {
            hideLoadingModal();
        }, 100);
    });
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

function getFirebaseErrorMessage(errorCode) {
    const errorMessages = {
        'auth/user-not-found': {
            title: 'Account Not Found',
            message: 'No account is registered with this email address.',
            showRegister: true
        },
        'auth/wrong-password': {
            title: 'Incorrect Password',
            message: 'The password you entered is incorrect. Please check your password and try again.',
            showRegister: false
        },
        'auth/invalid-email': {
            title: 'Invalid Email Format',
            message: 'Please enter a valid email address.',
            showRegister: false
        },
        'auth/user-disabled': {
            title: 'Account Disabled',
            message: 'This account has been disabled. Please contact support for assistance.',
            showRegister: false
        },
        'auth/too-many-requests': {
            title: 'Too Many Login Attempts',
            message: 'Too many failed attempts. Please wait a moment before trying again.',
            showRegister: false
        },
        'auth/invalid-login-credentials': {
            title: 'Invalid Login Credentials',
            message: 'The email or password is incorrect. Please verify your information.',
            showRegister: false
        },
        'auth/invalid-credential': {
            title: 'Invalid Credentials',
            message: 'The email or password you entered is incorrect. Please verify your credentials.',
            showRegister: false
        }
    };

    return errorMessages[errorCode] || {
        title: 'Login Failed',
        message: 'An unexpected error occurred. Please try again.',
        showRegister: false
    };
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
        
        let errorTitle = 'Login Error';
        let errorMessage = 'Login failed. Please try again.';
        let showRegisterOption = false;
        
        if (error.code) {
            switch (error.code) {
                case 'auth/user-not-found':
                    errorTitle = 'Account Not Found';
                    errorMessage = `No account is registered with "${email}". Would you like to create a new account?`;
                    showRegisterOption = true;
                    break;
                case 'auth/wrong-password':
                    errorTitle = 'Incorrect Password';
                    errorMessage = 'The password you entered is incorrect. Please check your password and try again.';
                    break;
                case 'auth/invalid-email':
                    errorTitle = 'Invalid Email';
                    errorMessage = 'Please enter a valid email address format.';
                    break;
                case 'auth/user-disabled':
                    errorTitle = 'Account Disabled';
                    errorMessage = 'This account has been disabled. Please contact support for assistance.';
                    break;
                case 'auth/too-many-requests':
                    errorTitle = 'Too Many Attempts';
                    errorMessage = 'Too many failed login attempts. Please try again later or reset your password.';
                    break;
                case 'auth/invalid-login-credentials':
                case 'auth/invalid-credential':
                    errorTitle = 'Invalid Credentials';
                    errorMessage = 'The email or password you entered is incorrect. Please verify your credentials and try again.';
                    break;
                default:
                    errorMessage = error.message || errorMessage;
            }
        } else if (error.message) {
            if (error.message.includes('not found') || error.message.includes('not registered')) {
                errorTitle = 'Account Not Found';
                errorMessage = `No account is registered with "${email}". Would you like to create a new account?`;
                showRegisterOption = true;
            } else {
                errorMessage = error.message;
            }
        }
        
        // Show appropriate error dialog
        if (showRegisterOption) {
            showAccountNotFoundError(email);
        } else {
            showLoginError(errorTitle, errorMessage);
        }
    }
}

/**
 * Show account not found error with registration option
 */
function showAccountNotFoundError(email) {
    swal({
        title: "Account Not Found",
        text: `No account is registered with "${email}". Would you like to create a new account?`,
        icon: "warning",
        buttons: {
            cancel: {
                text: "Try Again",
                value: null,
                visible: true,
                className: "btn-secondary",
                closeModal: true,
            },
            confirm: {
                text: "Create Account",
                value: true,
                visible: true,
                className: "btn-primary",
                closeModal: true
            }
        },
        dangerMode: false,
    }).then((willRegister) => {
        if (willRegister) {
            // Redirect to registration page with email pre-filled
            window.location.href = `/register?email=${encodeURIComponent(email)}`;
        } else {
            // Clear the email field and focus on it
            $('#email').val('').focus();
        }
    });
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
    try {
        const modal = $('#loadingModal');
        if (modal.length) {
            // Pastikan modal bersih sebelum show
            modal.modal('hide');
            $('.modal-backdrop').remove();
            
            // Show modal
            setTimeout(() => {
                modal.modal('show');
            }, 100);
        } else {
            console.warn('Loading modal element not found');
        }
    } catch (error) {
        console.error('Error showing loading modal:', error);
    }
}

/**
 * Hide loading modal
 */
function hideLoadingModal() {
    try {
        const modal = $('#loadingModal');
        if (modal.length) {
            modal.modal('hide');
            
            // Force remove modal backdrop jika masih ada
            setTimeout(() => {
                $('.modal-backdrop').remove();
                $('body').removeClass('modal-open');
                $('body').css('padding-right', '');
            }, 100);
        }
    } catch (error) {
        console.error('Error hiding loading modal:', error);
        
        // Fallback: Force remove modal elements
        $('.modal-backdrop').remove();
        $('body').removeClass('modal-open');
        $('body').css('padding-right', '');
        $('#loadingModal').hide();
    }
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
    if ($button && $button.length) {
        $button.addClass('loading').prop('disabled', true);
        $button.data('original-text', $button.html());
        $button.html('<i class="fas fa-spinner fa-spin"></i> Please wait...');
    }
}
/**
 * Hide button loading state
 */
function hideButtonLoading($button) {
    if ($button && $button.length) {
        $button.removeClass('loading').prop('disabled', false);
        if ($button.data('original-text')) {
            $button.html($button.data('original-text'));
        }
    }
}

function forceCleanupModal() {
    try {
        // Hide all modals
        $('.modal').modal('hide');
        
        // Remove all backdrops
        $('.modal-backdrop').remove();
        
        // Reset body
        $('body').removeClass('modal-open');
        $('body').css('padding-right', '');
        
        // Hide specific loading modal
        $('#loadingModal').hide().removeClass('show');
        
        console.log('Modal cleanup completed');
    } catch (error) {
        console.error('Modal cleanup error:', error);
    }
}

function showAccountNotFoundError(email) {
    // Force cleanup sebelum show swal
    forceCleanupModal();
    
    setTimeout(() => {
        swal({
            title: "Account Not Found",
            text: `No account is registered with "${email}". Would you like to create a new account?`,
            icon: "warning",
            buttons: {
                cancel: {
                    text: "Try Again",
                    value: null,
                    visible: true,
                    className: "btn-secondary",
                    closeModal: true,
                },
                confirm: {
                    text: "Create Account",
                    value: true,
                    visible: true,
                    className: "btn-primary",
                    closeModal: true
                }
            },
            dangerMode: false,
        }).then((willRegister) => {
            if (willRegister) {
                // Redirect to registration page with email pre-filled
                window.location.href = `/register?email=${encodeURIComponent(email)}`;
            } else {
                // Clear the email field and focus on it
                $('#email').val('').focus();
            }
        });
    }, 100);
}

/**
 * Show login error message
 */
function showLoginError(title = "Login Error", message) {
    // Force cleanup sebelum show swal
    forceCleanupModal();
    
    setTimeout(() => {
        swal({
            title: title,
            text: message,
            icon: "error",
            button: "OK",
            dangerMode: true
        });
    }, 100);
}

/**
 * Show validation error message
 */
function showValidationError(message) {
    forceCleanupModal();
    
    setTimeout(() => {
        swal({
            title: "Please Check Your Input",
            text: message,
            icon: "warning",
            button: "OK"
        });
    }, 100);
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
    // Gunakan swal biasa karena Swal mungkin tidak tersedia
    if (typeof swal !== 'undefined') {
        swal({
            title: 'Email Not Verified',
            text: 'Your email address is not verified yet. Please check your inbox and verify your email for full account security.',
            icon: 'warning',
            timer: 5000,
            button: false
        });
    } else {
        console.warn('Email verification warning: Please verify your email address for full account security');
    }
}


