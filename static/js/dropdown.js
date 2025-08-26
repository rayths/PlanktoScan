// DROPDOWN MANAGEMENT MODULE

/**
 * Log dropdown actions for debugging
 */
function logDropdownAction(action, details = '') {
    console.log(`[Dropdown] ${action}`, details);
}

function getDefaultValue(dropdownId) {
    const defaults = { 'classification-model': 'efficientnetv2b0' };
    return defaults[dropdownId] || '';
}

function updateActiveState($dropdown, $activeItem) {
    $dropdown.find('.dropdown-item').removeClass('active');
    $activeItem.addClass('active');
}

function setupOutsideClickHandler() {
    // Let Bootstrap handle outside clicks for dropdowns
    // Only handle specific cases if needed
    document.addEventListener('click', function(e) {
        // Only handle model dropdowns, not user dropdown
        if (!e.target.closest('.dropdown')) {
            document.querySelectorAll('.dropdown-menu.show:not([aria-labelledby="userDropdown"])').forEach(menu => {
                menu.classList.remove('show');
            });
        }
    });
}

/**
 * Setup menu click handlers for dropdown items
 */
function setupMenuClickHandlers(menu, toggle) {
    // Only setup click prevention for non-navigation items
    menu.addEventListener('click', function(e) {
        if (!e.target.classList.contains('dropdown-item')) {
            e.stopPropagation();
        }
    });
    
    menu.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', function(e) {
            logDropdownAction('item clicked', this.textContent.trim());
            
            // For navigation items (like history, logout), let them navigate
            const href = this.getAttribute('href');
            if (href && href !== '#') {
                // Close dropdown first
                menu.classList.remove('show');
                toggle.setAttribute('aria-expanded', 'false');
                
                // Handle special navigation items
                if (href === '/history') {
                    e.preventDefault();
                    navigateToHistory(this);
                    return false;
                }
                
                // For other navigation items, allow default behavior
                return true;
            }
            
            // For non-navigation items, close dropdown
            menu.classList.remove('show');
            toggle.setAttribute('aria-expanded', 'false');
            return true;
        });
    });
}

/**
 * Initialize fallback dropdown for browsers without Bootstrap
 */
function initializeFallbackDropdown() {
    const userDropdownEl = document.getElementById('userDropdown');
    const userMenuEl = document.querySelector('#userDropdown + .dropdown-menu, .user-dropdown-btn + .dropdown-menu');
    
    if (userDropdownEl && userMenuEl) {
        logDropdownAction('Setting up fallback dropdown');
        
        userDropdownEl.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const isShown = userMenuEl.classList.contains('show');
            
            // Close all dropdowns first
            document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                menu.classList.remove('show');
            });
            
            if (!isShown) {
                userMenuEl.classList.add('show');
                userDropdownEl.setAttribute('aria-expanded', 'true');
                logDropdownAction('Dropdown opened');
            } else {
                userDropdownEl.setAttribute('aria-expanded', 'false');
                logDropdownAction('Dropdown closed');
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!userDropdownEl.contains(e.target) && !userMenuEl.contains(e.target)) {
                userMenuEl.classList.remove('show');
                userDropdownEl.setAttribute('aria-expanded', 'false');
                logDropdownAction('Dropdown closed by outside click');
            }
        });
        
        // Setup menu click handlers
        setupMenuClickHandlers(userMenuEl, userDropdownEl);
    } else {
        logDropdownAction('Fallback dropdown elements not found');
    }
}

/**
 * Initialize dropdown menu item handlers
 */
function initializeDropdownMenuHandlers() {
    logDropdownAction('Initializing dropdown menu handlers');
    
    // History menu item handler
    const historyItems = document.querySelectorAll('a[href="/history"], a[data-link="history"]');
    historyItems.forEach(historyItem => {
        if (historyItem) {
            historyItem.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                logDropdownAction('History link clicked');
                navigateToHistory(this);
            });
        }
    });
    
    // Logout menu item handler
    const logoutItems = document.querySelectorAll('.logout-item, a[data-action="logout"]');
    logoutItems.forEach(logoutItem => {
        if (logoutItem) {
            logoutItem.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                logDropdownAction('Logout link clicked');
                
                // Close dropdown first
                closeDropdown(this);
                
                // Call logout function
                if (typeof logout === 'function') {
                    logout();
                } else {
                    console.warn('Logout function not found');
                }
            });
        }
    });
    
    logDropdownAction('Dropdown menu handlers initialized');
}

/**
 * Navigate to history page with loading state
 */
function navigateToHistory(element) {
    try {
        logDropdownAction('Starting navigation to history page');
        
        // Close dropdown first
        closeDropdown(element);
        
        // Show loading state on the clicked element
        const originalContent = element.innerHTML;
        element.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        element.style.pointerEvents = 'none';
        
        // Show loading dialog if available
        if (typeof swal !== 'undefined') {
            swal({
                title: 'Loading...',
                text: 'Redirecting to prediction history',
                icon: 'info',
                buttons: false,
                timer: 1500,
                closeOnClickOutside: false
            });
        }
        
        // Navigate after short delay to ensure UI updates
        setTimeout(() => {
            logDropdownAction('Navigating to /history');
            window.location.href = '/history';
        }, 200);
        
        // Fallback: restore original content if navigation fails
        setTimeout(() => {
            if (element) {
                element.innerHTML = originalContent;
                element.style.pointerEvents = 'auto';
            }
        }, 3000);
        
    } catch (error) {
        console.error('Navigation error:', error);
        logDropdownAction('Navigation failed', error.message);
        
        if (typeof swal !== 'undefined') {
            swal({
                title: 'Error',
                text: 'Unable to navigate to history page. Please try again.',
                icon: 'error',
                button: 'OK'
            });
        } else {
            alert('Unable to navigate to history page. Please try again.');
        }
        
        // Restore original content
        if (element) {
            element.innerHTML = '<i class="fas fa-history"></i> Prediction History';
            element.style.pointerEvents = 'auto';
        }
    }
}

/**
 * Close dropdown menu
 */
function closeDropdown(element) {
    const dropdownMenu = element.closest('.dropdown-menu');
    if (dropdownMenu) {
        dropdownMenu.classList.remove('show');
        
        // Find and update dropdown button
        const dropdownBtn = document.getElementById('userDropdown') || 
                           document.querySelector('.user-dropdown-btn') ||
                           dropdownMenu.previousElementSibling;
        
        if (dropdownBtn) {
            dropdownBtn.setAttribute('aria-expanded', 'false');
            dropdownBtn.classList.remove('show');
        }
        
        logDropdownAction('Dropdown closed programmatically');
    }
}

// Initialize dropdown values with default selections
function initializeDropdowns() {
    const $modelSelect = $('#classification-model');
    
    // Set default values if not already set
    if (!$modelSelect.val() || $modelSelect.val() === '') {
        $modelSelect.val(getDefaultValue('classification-model'));
    }
    
    console.log('Dropdowns initialized:', {
        classification: $modelSelect.val()
    });
}

/**
 * Initialize user dropdown functionality
 */
function initializeUserDropdown() {
    const dropdownToggle = document.querySelector('#userDropdown, .user-dropdown-btn');
    const dropdownMenu = document.querySelector('#userDropdown + .dropdown-menu, .user-dropdown-btn + .dropdown-menu');

    if (dropdownToggle && dropdownMenu) {
        logDropdownAction('User dropdown found and ready for Bootstrap handling');
        
        // Check if Bootstrap is available
        if (typeof bootstrap !== 'undefined') {
            // Let Bootstrap handle the dropdown
            logDropdownAction('Using Bootstrap dropdown');
            setupMenuClickHandlers(dropdownMenu, dropdownToggle);
        } else {
            // Use fallback dropdown
            logDropdownAction('Bootstrap not found, using fallback');
            initializeFallbackDropdown();
        }
        
        // Initialize menu handlers regardless of dropdown method
        initializeDropdownMenuHandlers();
    } else {
        logDropdownAction('User dropdown elements not found');
        console.warn('User dropdown elements not found:', {
            toggle: dropdownToggle,
            menu: dropdownMenu
        });
    }
}

/**
 * Setup all dropdown initializations
 */
function initializeAllDropdowns() {
    logDropdownAction('Starting dropdown initialization');
    initializeDropdowns();
    initializeUserDropdown();
    logDropdownAction('All dropdowns initialized');
}

/**
 * Setup dropdown event handlers
 */
function setupDropdownHandlers() {
    const $modelSelect = $('#classification-model');
    
    // Remove any existing dropdown handlers first to prevent duplicates
    $(document).off('click.dropdown', '.dropdown-item');
    
    // Bootstrap Dropdown Event Handlers with namespace
    $(document).on('click.dropdown', '.dropdown-item', function(e) {
        const $item = $(this);
        const href = $item.attr('href');
        
        // Handle navigation items differently
        if (href && href !== '#') {
            if (href === '/history') {
                e.preventDefault();
                navigateToHistory(this);
                return false;
            }
            // For other navigation items, allow default behavior
            return true;
        }
        
        // For model selection items
        e.preventDefault();
        
        const value = $item.attr('data-value');
        const text = $item.text();
        const $dropdown = $item.closest('.dropdown');
        const $button = $dropdown.find('.dropdown-toggle');
        
        // Find the correct hidden input
        let $hiddenInput;
        const dropdownId = $button.attr('id');
        if (dropdownId === 'classificationDropdown') {
            $hiddenInput = $('#classification-model');
        }
        
        // Update button text
        $button.text(text);
        
        // Update hidden input value
        if ($hiddenInput && $hiddenInput.length) {
            $hiddenInput.val(value);
            $hiddenInput.trigger('change');
        }
        
        // Update active state
        updateActiveState($dropdown, $item);
    });

    // Remove any existing model select handlers to prevent duplicates
    $modelSelect.off('change');
    
    // Monitor dropdown changes for debugging
    $modelSelect.on('change', function() {
        console.log('Classification model changed to:', $(this).val());
    });
}

/**
 * Get dropdown value with validation
 */
function getDropdownValue(dropdownId) {
    const $select = $(`#${dropdownId}`);
    const value = $select.val();
    
    // Validate and return default if needed
    if (!value || value === 'null' || value === 'undefined') {
        return getDefaultValue(dropdownId);
    }
    
    return value;
}

/**
 * Set dropdown value programmatically
 */
function setDropdownValue(dropdownId, value) {
    const $select = $(`#${dropdownId}`);
    const $dropdown = $select.closest('.dropdown-container, .dropdown');
    const $button = $dropdown.find('.dropdown-toggle');
    
    // Set the hidden input value
    $select.val(value);
    
    // Find and activate the corresponding dropdown item
    const $targetItem = $dropdown.find(`.dropdown-item[data-value="${value}"]`);
    if ($targetItem.length) {
        // Update button text
        $button.text($targetItem.text());
        
        // Update active states
        updateActiveState($dropdown, $targetItem);
    }

    // Trigger change event
    $select.trigger('change');
}

/**
 * Validate all dropdown selections
 */
function validateDropdowns() {
    const validationResult = {
        isValid: true,
        errors: [],
        values: {}
    };
    
    // Validate classification model
    const classificationValue = getDropdownValue('classification-model');
    if (!classificationValue) {
        validationResult.isValid = false;
        validationResult.errors.push('Classification model is required');
    } else {
        validationResult.values.classification = classificationValue;
    }

    return validationResult;
}

/**
 * Reset dropdown to default values
 */
function resetDropdown(dropdownId = null) {
    if (dropdownId) {
        setDropdownValue(dropdownId, getDefaultValue(dropdownId));
    } else {
        setDropdownValue('classification-model', getDefaultValue('classification-model'));
    }
}

/**
 * Get all dropdown values as an object
 */
function getAllDropdownValues() {
    return {
        classification: getDropdownValue('classification-model')
    };
}

/**
 * Update dropdown button text based on current selection
 */
function updateDropdownButtonText(dropdownId) {
    const $select = $(`#${dropdownId}`);
    const value = $select.val();
    const $dropdown = $select.closest('.dropdown-container, .dropdown');
    const $button = $dropdown.find('.dropdown-toggle');
    
    if (value) {
        const $activeItem = $dropdown.find(`.dropdown-item[data-value="${value}"]`);
        if ($activeItem.length) {
            $button.text($activeItem.text());
            updateActiveState($dropdown, $activeItem);
        }
    }
}

// Export to global scope
if (typeof window !== 'undefined') {
    Object.assign(window, {
        logDropdownAction, initializeDropdowns, initializeUserDropdown, initializeAllDropdowns,
        setupDropdownHandlers, getDropdownValue, setDropdownValue, validateDropdowns,
        resetDropdown, getAllDropdownValues, updateDropdownButtonText,
        initializeFallbackDropdown, initializeDropdownMenuHandlers, navigateToHistory, closeDropdown
    });
}