// WELCOME POPUP MANAGEMENT
// Close welcome popup and set cookie
function closeWelcomePopup() {
    const welcomePopup = document.getElementById('welcomePopup');
    if (welcomePopup) {
        welcomePopup.style.display = 'none';
        
        console.log('Closing welcome popup ...');
        
        // Set cookie to prevent popup from showing again for this session
        document.cookie = "welcome_seen=true; max-age=86400; path=/"; // 1 day
        
        // Check if user is authenticated to determine where to redirect
        const isLoggedIn = window.USER_AUTHENTICATED || false;
        
        if (isLoggedIn) {
            // User is logged in, stay on current page (dashboard)
            console.log('User is logged in, staying on current page');
        } else {
            // User not logged in, redirect to login page
            console.log('User not logged in, redirecting to login page');
            redirectToLogin();
        }
    }
}

// Utility function to get cookie value
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

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
        
        // Don't redirect automatically - let user stay on current page
        // Only redirect if they click a login button
    }
}

// Redirect to login without popup
function redirectToLogin() {
    console.log('Redirecting to login page...');
    window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname);
}

// Handle start analysis button click
function startAnalysis() {
    console.log('Start analysis clicked');
    
    // Check if user is authenticated
    const isLoggedIn = window.USER_AUTHENTICATED || false;
    
    if (isLoggedIn) {
        // User is logged in, just close popup and stay on dashboard
        closeWelcomePopup();
    } else {
        // User not logged in, set cookie and redirect to login
        document.cookie = "welcome_seen=true; max-age=86400; path=/"; // 1 day
        redirectToLogin();
    }
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
    const closeBtn = document.querySelector('#welcomePopup .popup-close');
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
    
    // Handle start analysis button in welcome popup
    const startBtn = document.querySelector('#welcomePopup .btn-start-popup');
    if (startBtn) {
        startBtn.addEventListener('click', function(e) {
            e.preventDefault();
            startAnalysis();
        });
    }
    
    console.log('Welcome popup event handlers setup complete');
}

// Initialize welcome popup based on authentication
function initializeWelcomePopup() {
    setupWelcomePopupHandlers();
    checkAuthenticationStatus();
}

// Handle welcome popup from server configuration
function handleWelcomePopupFromServer(showWelcome) {
    console.log('=== handleWelcomePopupFromServer ===');
    console.log('Show welcome from server:', showWelcome);
    
    // Check if user is authenticated
    const isLoggedIn = window.USER_AUTHENTICATED || false;
    const userRole = window.USER_ROLE || null;
    const welcomeSeen = getCookie('welcome_seen');
    
    console.log('Is logged in:', isLoggedIn);
    console.log('User role:', userRole);
    console.log('Welcome seen cookie:', welcomeSeen);
    console.log('Show welcome parameter:', showWelcome);
    
    // Logic untuk welcome popup:
    // 1. Jika user sudah login: TIDAK tampilkan welcome popup
    // 2. Jika user belum login DAN belum pernah lihat welcome popup: TAMPILKAN welcome popup
    // 3. Jika user belum login DAN sudah pernah lihat welcome popup: TIDAK tampilkan welcome popup
    
    if (isLoggedIn) {
        console.log('User is logged in - welcome popup not shown');
        return; // User sudah login, tidak perlu welcome popup
    }
    
    if (showWelcome && !welcomeSeen) {
        console.log('User not logged in and first visit - showing welcome popup');
        setTimeout(() => {
            showWelcomePopup();
        }, 500);
    } else {
        console.log('User not logged in but welcome already seen - no popup');
        // User belum login tapi sudah pernah lihat welcome popup
        // Biarkan mereka di halaman ini, tidak redirect otomatis
    }
}

// Export to global scope
if (typeof window !== 'undefined') {
    window.showWelcomePopup = showWelcomePopup;
    window.closeWelcomePopup = closeWelcomePopup;
    window.redirectToLogin = redirectToLogin;
    window.startAnalysis = startAnalysis;
    window.checkAuthenticationStatus = checkAuthenticationStatus;
    window.setupWelcomePopupHandlers = setupWelcomePopupHandlers;
    window.initializeWelcomePopup = initializeWelcomePopup;
    window.handleWelcomePopupFromServer = handleWelcomePopupFromServer;
}