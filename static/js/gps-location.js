// GPS state management
const gpsState = {
    isGettingLocation: false,
    lastKnownPosition: null,
    lastUpdate: null,
    accuracy: null,
    watchId: null,
    cacheTimeout: 300000 // 5 minutes
};

/**
 * Check if geolocation is supported
 */
function isGeolocationSupported() {
    return "geolocation" in navigator;
}

/**
 * Check if cached GPS location is still valid
 */
function isCachedLocationValid() {
    if (!gpsState.lastKnownPosition || !gpsState.lastUpdate) {
        return false;
    }
    
    const now = Date.now();
    const timeDiff = now - gpsState.lastUpdate;
    
    return timeDiff < gpsState.cacheTimeout;
}

/**
 * Update location input placeholder based on mode
 */
function updateLocationPlaceholder(mode = 'default') {
    const $locationInput = $('#sampling-location');
    
    const placeholders = {
        'default': 'Enter location or use GPS...',
        'gps_loading': 'Getting GPS location...',
        'manual': 'Type your location here...'
    };
    
    $locationInput.attr('placeholder', placeholders[mode] || placeholders['default']);
}

/**
 * Get current GPS location
 */
function getCurrentGPSLocation() {
    const $gpsButton = $('#get-gps-location');
    const $gpsStatus = $('#gps-status');
    const $locationInput = $('#sampling-location');
    const $accuracyInfo = $('#location-accuracy');

    // Check if geolocation is supported
    if (!isGeolocationSupported()) {
        swal({
            title: "GPS Not Supported",
            text: "Your device doesn't support GPS location. Please enter location manually.",
            icon: "warning"
        });
        return;
    }

    // Check for cached location first
    if (isCachedLocationValid()) {
        console.log('Using cached GPS location');
        handleGPSSuccess(gpsState.lastKnownPosition);
        return;
    }

    // Prevent multiple requests
    if (gpsState.isGettingLocation) {
        console.log('GPS location request already in progress');
        return;
    }

    // Update UI to loading state
    gpsState.isGettingLocation = true;
    $gpsButton.addClass('loading');
    $gpsButton.find('.gps-icon').removeClass('fa-location-arrow').addClass('fa-spinner fa-spin');
    $gpsButton.find('.gps-text').text('...');
    $gpsStatus.show().removeClass('success error');
    $gpsStatus.find('span').text('Getting your location...');
    $accuracyInfo.hide();

    // Update placeholder during GPS loading
    updateLocationPlaceholder('gps_loading');

    // GPS options
    const options = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000
    };

    // Get current position
    navigator.geolocation.getCurrentPosition(
        (position) => {
            gpsState.lastUpdate = Date.now();
            handleGPSSuccess(position);
        },
        (error) => {
            handleGPSError(error);
        },
        options
    );
}

/**
 * Handle successful GPS location
 */
function handleGPSSuccess(position) {
    const $gpsButton = $('#get-gps-location');
    const $gpsStatus = $('#gps-status');
    const $locationInput = $('#sampling-location');
    const $accuracyInfo = $('#location-accuracy');

    const { latitude, longitude, accuracy } = position.coords;
    
    // Store position
    gpsState.lastKnownPosition = position;
    gpsState.accuracy = accuracy;

    console.log('GPS Location obtained:', {
        latitude: latitude,
        longitude: longitude,
        accuracy: accuracy + 'm'
    });

    // Update UI to success state
    $gpsButton.removeClass('loading').addClass('success');
    $gpsButton.find('.gps-icon').removeClass('fa-spinner fa-spin').addClass('fa-check');
    $gpsButton.find('.gps-text').text('GPS');
    
    $gpsStatus.addClass('success');
    $gpsStatus.find('span').text('Location obtained successfully!');

    // Show accuracy information
    $accuracyInfo.show();
    $('#accuracy-text').text(`Accuracy: ± ${Math.round(accuracy)}m`);
    $('#coords-text').text(`(${latitude.toFixed(6)}, ${longitude.toFixed(6)})`);

    // Get human-readable address using reverse geocoding
    reverseGeocode(latitude, longitude);

    // Auto-hide status after 3 seconds
    setTimeout(() => {
        $gpsStatus.fadeOut();
        resetGPSButton();
    }, 3000);

    gpsState.isGettingLocation = false;
}

/**
 * Handle GPS location error
 */
function handleGPSError(error) {
    const $gpsButton = $('#get-gps-location');
    const $gpsStatus = $('#gps-status');

    let errorMessage = "Failed to get location. ";
    let userAction = "";

    switch(error.code) {
        case error.PERMISSION_DENIED:
            errorMessage += "Location access denied by user.";
            userAction = "Please enable location permissions and try again.";
            break;
        case error.POSITION_UNAVAILABLE:
            errorMessage += "Location information unavailable.";
            userAction = "Please check if GPS is enabled on your device.";
            break;
        case error.TIMEOUT:
            errorMessage += "Location request timed out.";
            userAction = "Please try again or enter location manually.";
            break;
        default:
            errorMessage += "Unknown error occurred.";
            userAction = "Please try again or enter location manually.";
            break;
    }

    console.error('GPS Error:', error.code, error.message);

    // Update UI to error state
    $gpsButton.removeClass('loading').addClass('error');
    $gpsButton.find('.gps-icon').removeClass('fa-spinner fa-spin').addClass('fa-exclamation');
    $gpsButton.find('.gps-text').text('Error');
    
    $gpsStatus.addClass('error');
    $gpsStatus.find('span').text(errorMessage);

    // Show error alert
    swal({
        title: "GPS Error",
        text: errorMessage + " " + userAction,
        icon: "error",
        buttons: {
            cancel: "Enter Manually",
            retry: {
                text: "Try Again",
                value: "retry",
                className: "btn-primary"
            }
        }
    }).then((value) => {
        if (value === "retry") {
            setTimeout(() => {
                getCurrentGPSLocation();
            }, 1000);
        }
    });

    // Reset button after 5 seconds
    setTimeout(() => {
        $gpsStatus.fadeOut();
        resetGPSButton();
    }, 5000);

    gpsState.isGettingLocation = false;
}

/**
 * Reset GPS button to initial state
 */
function resetGPSButton() {
    const $gpsButton = $('#get-gps-location');
    
    $gpsButton.removeClass('loading success error');
    $gpsButton.find('.gps-icon').removeClass('fa-spinner fa-spin fa-check fa-exclamation').addClass('fa-location-arrow');
    $gpsButton.find('.gps-text').text('GPS');
}

/**
 * Reverse geocode coordinates to human-readable address
 */
function reverseGeocode(latitude, longitude) {
    const $locationInput = $('#sampling-location');
    
    // Try multiple geocoding services for better coverage
    const geocodingServices = [
        {
            name: 'OpenStreetMap Nominatim',
            url: `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`,
            parser: (data) => {
                if (data && data.display_name) {
                    // Extract meaningful location parts
                    const address = data.address || {};
                    const parts = [];
                    
                    if (address.road) parts.push(address.road);
                    if (address.suburb || address.neighbourhood) parts.push(address.suburb || address.neighbourhood);
                    if (address.city || address.town || address.village) parts.push(address.city || address.town || address.village);
                    if (address.state) parts.push(address.state);
                    
                    return parts.length > 0 ? parts.join(', ') : data.display_name;
                }
                return null;
            }
        }
    ];

    // Try each service until one succeeds
    function tryService(serviceIndex = 0) {
        if (serviceIndex >= geocodingServices.length) {
            // All services failed, use coordinates
            const coordsLocation = `GPS: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            $locationInput.val(coordsLocation);
            console.log('Reverse geocoding failed, using coordinates:', coordsLocation);
            return;
        }

        const service = geocodingServices[serviceIndex];
        
        $.ajax({
            url: service.url,
            method: 'GET',
            timeout: 10000,
            success: (data) => {
                try {
                    const location = service.parser(data);
                    if (location) {
                        $locationInput.val(location);
                        console.log('Reverse geocoding successful:', location);
                        
                        // Trigger input event to notify other parts of the system
                        $locationInput.trigger('input');
                    } else {
                        tryService(serviceIndex + 1);
                    }
                } catch (error) {
                    console.error(`${service.name} parsing error:`, error);
                    tryService(serviceIndex + 1);
                }
            },
            error: (xhr, status, error) => {
                console.error(`${service.name} request failed:`, error);
                tryService(serviceIndex + 1);
            }
        });
    }

    // Start trying services
    tryService(0);
}

/**
 * Clear location input
 */
function clearLocationInput() {
    const $locationInput = $('#sampling-location');
    const $accuracyInfo = $('#location-accuracy');
    const $gpsStatus = $('#gps-status');

    // Clear input and hide info
    $locationInput.val('');
    $accuracyInfo.hide();
    $gpsStatus.hide();
    
    // Reset GPS state
    gpsState.lastKnownPosition = null;
    gpsState.accuracy = null;
    resetGPSButton();

    // Trigger input event
    $locationInput.trigger('input');
    
    console.log('Location input cleared');
}

/**
 * Watch GPS position for continuous updates (optional feature)
 */
function startWatchingGPS() {
    if (!isGeolocationSupported() || gpsState.watchId) {
        return;
    }

    const options = {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 60000
    };

    gpsState.watchId = navigator.geolocation.watchPosition(
        (position) => {
            // Update position silently
            gpsState.lastKnownPosition = position;
            gpsState.accuracy = position.coords.accuracy;
            
            console.log('GPS position updated:', {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy + 'm'
            });
        },
        (error) => {
            console.warn('GPS watch error:', error.message);
        },
        options
    );
}

/**
 * Stop watching GPS position
 */
function stopWatchingGPS() {
    if (gpsState.watchId) {
        navigator.geolocation.clearWatch(gpsState.watchId);
        gpsState.watchId = null;
        console.log('GPS watching stopped');
    }
}

// Export functions to global scope for use in other modules
if (typeof window !== 'undefined') {
    window.gpsState = gpsState;
    window.isGeolocationSupported = isGeolocationSupported;
    window.isCachedLocationValid = isCachedLocationValid;
    window.updateLocationPlaceholder = updateLocationPlaceholder;
    window.getCurrentGPSLocation = getCurrentGPSLocation;
    window.handleGPSSuccess = handleGPSSuccess;
    window.handleGPSError = handleGPSError;
    window.resetGPSButton = resetGPSButton;
    window.reverseGeocode = reverseGeocode;
    window.clearLocationInput = clearLocationInput;
    window.startWatchingGPS = startWatchingGPS;
    window.stopWatchingGPS = stopWatchingGPS;
}