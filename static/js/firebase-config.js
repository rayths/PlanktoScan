/**
 * Firebase Configuration Loader
 * Loads Firebase configuration from API endpoint securely
 */

class FirebaseConfigLoader {
    constructor() {
        this.config = null;
        this.isInitialized = false;
        this.initPromise = null;
    }

    /**
     * Load Firebase configuration from API endpoint
     */
    async loadConfig() {
        try {
            const response = await fetch('/api/firebase-config');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const config = await response.json();
            
            // Validate required fields
            const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
            const missingFields = requiredFields.filter(field => !config[field]);
            
            if (missingFields.length > 0) {
                throw new Error(`Missing required Firebase config fields: ${missingFields.join(', ')}`);
            }
            
            this.config = config;
            return config;
            
        } catch (error) {
            console.error('Failed to load Firebase configuration:', error);
            throw new Error('Unable to load authentication system configuration');
        }
    }

    /**
     * Initialize Firebase with loaded configuration
     */
    async initializeFirebase() {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this._doInitialize();
        return this.initPromise;
    }

    async _doInitialize() {
        try {
            if (this.isInitialized) {
                return this.config;
            }

            // Check if Firebase is available
            if (typeof firebase === 'undefined') {
                throw new Error('Firebase SDK not loaded');
            }

            // Load configuration
            await this.loadConfig();
            
            console.log('Firebase config loaded:', this.config);
            
            // Check if Firebase is already initialized
            if (firebase.apps.length > 0) {
                console.log('Firebase already initialized, using existing app');
                this.isInitialized = true;
                return this.config;
            }
            
            // Initialize Firebase
            firebase.initializeApp(this.config);
            this.isInitialized = true;
            
            console.log('Firebase initialized successfully with project:', this.config.projectId);
            return this.config;
            
        } catch (error) {
            console.error('Firebase initialization error:', error);
            this.isInitialized = false;
            this.initPromise = null;
            throw error;
        }
    }

    /**
     * Show loading indicator
     */
    showLoadingIndicator(containerId, targetElementId) {
        const container = document.getElementById(containerId);
        const targetElement = document.getElementById(targetElementId);
        
        if (!container || !targetElement) {
            console.warn('Loading indicator containers not found');
            return null;
        }

        // Hide target element
        targetElement.style.display = 'none';
        
        // Create loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'firebase-loading';
        loadingDiv.className = 'text-center py-3';
        loadingDiv.innerHTML = `
            <div class="spinner-border spinner-border-sm text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <small class="text-muted ms-2">Loading authentication system...</small>
        `;
        
        container.insertBefore(loadingDiv, targetElement);
        return loadingDiv;
    }

    /**
     * Hide loading indicator and show target element
     */
    hideLoadingIndicator(targetElementId) {
        const loadingElement = document.getElementById('firebase-loading');
        const targetElement = document.getElementById(targetElementId);
        
        if (loadingElement) {
            loadingElement.remove();
        }
        
        if (targetElement) {
            targetElement.style.display = 'block';
        }
    }

    /**
     * Show error message to user
     */
    showErrorMessage(error) {
        console.error('Firebase configuration error:', error);
        
        const message = error.message || 'Authentication system failed to load. Please refresh the page.';
        
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Configuration Error',
                text: message,
                icon: 'error',
                confirmButtonText: 'Refresh Page'
            }).then(() => {
                window.location.reload();
            });
        } else {
            alert(message);
            window.location.reload();
        }
    }

    /**
     * Initialize Firebase for a specific form
     */
    async initializeForForm(containerId, formId) {
        try {
            // Show loading indicator
            const loadingElement = this.showLoadingIndicator(containerId, formId);
            
            // Initialize Firebase
            await this.initializeFirebase();
            
            // Hide loading and show form
            this.hideLoadingIndicator(formId);
            
            return this.config;
            
        } catch (error) {
            // Hide loading indicator
            this.hideLoadingIndicator(formId);
            
            // Show error message
            this.showErrorMessage(error);
            
            throw error;
        }
    }

    /**
     * Get the current configuration (if loaded)
     */
    getConfig() {
        return this.config;
    }

    /**
     * Check if Firebase is initialized
     */
    isFirebaseInitialized() {
        return this.isInitialized;
    }
}

// Create global instance
window.firebaseConfigLoader = new FirebaseConfigLoader();

/**
 * Convenience function for initializing Firebase in forms
 */
window.initializeFirebaseForForm = async function(containerId, formId) {
    return window.firebaseConfigLoader.initializeForForm(containerId, formId);
};

/**
 * Convenience function for getting Firebase config
 */
window.getFirebaseConfig = function() {
    return window.firebaseConfigLoader.getConfig();
};
