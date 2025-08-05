// WELCOME POPUP MANAGEMENT

// Show welcome popup
function showWelcomePopup() {
    const welcomePopup = document.getElementById('welcomePopup');
    if (welcomePopup) {
        welcomePopup.style.display = 'flex';
        console.log('Welcome popup shown');
    }
}

// Close welcome popup and set cookie
function closeWelcomePopup() {
    const welcomePopup = document.getElementById('welcomePopup');
    if (welcomePopup) {
        welcomePopup.style.display = 'none';
        
        console.log('Closing welcome popup ...');
        
        // Set cookie to prevent popup from showing again for this session
        document.cookie = "welcome_seen=true; max-age=3600; path=/"; // 1 hour
        
        // Redirect to login page
        window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname);
    }
}

// Redirect to login without popup
function redirectToLogin() {
    console.log('Redirecting to login page...');
    window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname);
}

// Check authentication status and show appropriate popup
function checkAuthenticationStatus() {
    // Check if user is logged in from server-side data
    const isLoggedIn = window.USER_AUTHENTICATED || false;
    const userRole = window.USER_ROLE || null;
    
    console.log('=== Authentication Check ===');
    console.log('Is logged in:', isLoggedIn);
    console.log('User role:', userRole);
    
    if (!isLoggedIn) {
        // Show welcome popup for non-authenticated users
        const welcomeSeen = getCookie('welcome_seen');
        if (!welcomeSeen) {
            setTimeout(() => {
                showWelcomePopup();
            }, 1000);
        } else {
            // If welcome was seen but user still not logged in, redirect
            setTimeout(() => {
                redirectToLogin();
            }, 2000);
        }
    }
}

// Setup welcome popup event handlers
function setupWelcomePopupHandlers() {
    // Handle welcome popup close button
    const closeBtn = document.querySelector('#welcomePopup .close-btn, #welcomePopup .btn-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            closeWelcomePopup();
        });
    }
    
    // Handle welcome popup click outside to close
    const welcomePopup = document.getElementById('welcomePopup');
    if (welcomePopup) {
        welcomePopup.addEventListener('click', function(e) {
            if (e.target === this) {
                closeWelcomePopup();
            }
        });
    }
    
    // Handle login button in welcome popup
    const loginBtn = document.querySelector('#welcomePopup .btn-login, #welcomePopup .login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', function(e) {
            e.preventDefault();
            closeWelcomePopup();
        });
    }
    
    console.log('Welcome popup event handlers setup complete');
}

// Initialize welcome popup based on authentication
function initializeWelcomePopup() {
    setupWelcomePopupHandlers();
    checkAuthenticationStatus();
}

// Export to global scope
if (typeof window !== 'undefined') {
    window.showWelcomePopup = showWelcomePopup;
    window.closeWelcomePopup = closeWelcomePopup;
    window.redirectToLogin = redirectToLogin;
    window.checkAuthenticationStatus = checkAuthenticationStatus;
    window.setupWelcomePopupHandlers = setupWelcomePopupHandlers;
    window.initializeWelcomePopup = initializeWelcomePopup;
}