/**
 * Welcome popup management module for PlanktoScan
 */

/**
 * Show welcome popup
 */
function showWelcomePopup() {
    const welcomePopup = document.getElementById('welcomePopup');
    if (welcomePopup) {
        welcomePopup.style.display = 'flex';
        console.log('Welcome popup shown');
    }
}

/**
 * Close welcome popup and set cookie
 */
function closeWelcomePopup() {
    const welcomePopup = document.getElementById('welcomePopup');
    if (welcomePopup) {
        welcomePopup.style.display = 'none';
        
        console.log('Closing welcome popup and setting cookie...');
        
        // Set cookie to prevent popup from showing again
        $.ajax({
            url: '/set-welcome-seen',
            type: 'POST',
            success: function(response) {
                console.log('Welcome popup marked as seen:', response);
            },
            error: function(xhr, status, error) {
                console.error('Error setting welcome seen cookie:', error);
                console.error('Response:', xhr.responseText);
                console.error('Status:', status);
            }
        });
        
        // Also set cookie manually as backup
        document.cookie = "welcome_seen=true; max-age=86400; path=/";
        console.log('Cookie set manually as backup');
    }
}

/**
 * Setup welcome popup event handlers
 */
function setupWelcomePopupHandlers() {
    // Handle welcome popup click outside to close
    const welcomePopup = document.getElementById('welcomePopup');
    if (welcomePopup) {
        welcomePopup.addEventListener('click', function(e) {
            if (e.target === this) {
                closeWelcomePopup();
            }
        });
        console.log('Welcome popup event handlers setup complete');
    }
}

/**
 * Check if welcome popup should be shown
 */
function checkWelcomePopupStatus() {
    const welcomeSeen = getCookie('welcome_seen');
    
    console.log('=== Welcome Popup Status ===');
    console.log('Document cookies:', document.cookie);
    console.log('Welcome seen cookie:', welcomeSeen);
    
    if (!welcomeSeen || welcomeSeen !== 'true') {
        // Show welcome popup after a short delay
        setTimeout(() => {
            showWelcomePopup();
        }, 1000);
    }
}

// Export to global scope
if (typeof window !== 'undefined') {
    window.showWelcomePopup = showWelcomePopup;
    window.closeWelcomePopup = closeWelcomePopup;
    window.setupWelcomePopupHandlers = setupWelcomePopupHandlers;
    window.checkWelcomePopupStatus = checkWelcomePopupStatus;
}