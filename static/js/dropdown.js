// DROPDOWN MANAGEMENT MODULE

function getDefaultValue(dropdownId) {
    const defaults = { 'classification-model': 'efficientnetv2b0' };
    return defaults[dropdownId] || '';
}

function updateActiveState($dropdown, $activeItem) {
    $dropdown.find('.dropdown-item').removeClass('active');
    $activeItem.addClass('active');
}

function setupOutsideClickHandler() {
    document.addEventListener('click', function(e) {
        const userToggle = document.querySelector('#userDropdown');
        const userMenu = document.querySelector('#userDropdown + .dropdown-menu, .user-dropdown-btn + .dropdown-menu');
        
        if (userToggle && userMenu && !userToggle.contains(e.target) && !userMenu.contains(e.target)) {
            userMenu.classList.remove('show');
            userToggle.setAttribute('aria-expanded', 'false');
        }
        
        if (!e.target.closest('.dropdown')) {
            document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                if (menu !== userMenu) menu.classList.remove('show');
            });
        }
    });
}

function setupMenuClickHandlers(menu, toggle) {
    menu.addEventListener('click', function(e) {
        if (!e.target.classList.contains('dropdown-item')) {
            e.stopPropagation();
        }
    });
    
    menu.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', function(e) {
            logDropdownAction('item clicked', this.textContent.trim());
            menu.classList.remove('show');
            toggle.setAttribute('aria-expanded', 'false');
            return true;
        });
    });
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
    const dropdownToggle = document.querySelector('#userDropdown');
    const dropdownMenu = document.querySelector('#userDropdown + .dropdown-menu, .user-dropdown-btn + .dropdown-menu');

    if (dropdownToggle) {
        // Remove any existing event listeners
        const newToggle = dropdownToggle.cloneNode(true);
        dropdownToggle.parentNode.replaceChild(newToggle, dropdownToggle);
        
        // Get the new reference
        const freshToggle = document.querySelector('#userDropdown');
        const freshMenu = document.querySelector('#userDropdown + .dropdown-menu, .user-dropdown-btn + .dropdown-menu');
        
        if (freshToggle && freshMenu) {
            // Initialize Bootstrap dropdown
            let bsDropdown;
            if (typeof bootstrap !== 'undefined' && bootstrap.Dropdown) {
                bsDropdown = new bootstrap.Dropdown(freshToggle);
            }
            
            // Manual click handler
            freshToggle.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const isShown = freshMenu.classList.contains('show');
                
                // Close all other dropdowns first
                document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                    if (menu !== freshMenu) {
                        menu.classList.remove('show');
                    }
                });
                
                if (isShown) {
                    freshMenu.classList.remove('show');
                    freshToggle.setAttribute('aria-expanded', 'false');
                } else {
                    freshMenu.classList.add('show');
                    freshToggle.setAttribute('aria-expanded', 'true');
                }
            });
            
            // Setup menu from closing when clicking inside
            if (freshMenu) {
                setupMenuClickHandlers(freshMenu, freshToggle);
            }

            // Setup outside click handler
            setupOutsideClickHandler();
        }
    }
}

/**
 * Setup all dropdown initializations
 */
function initializeAllDropdowns() {
    initializeDropdowns();
    initializeUserDropdown();
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
        e.preventDefault();
        
        const $item = $(this);
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
        initializeDropdowns, initializeUserDropdown, initializeAllDropdowns,
        setupDropdownHandlers, getDropdownValue, setDropdownValue, validateDropdowns,
        resetDropdown, getAllDropdownValues, updateDropdownButtonText
    });
}