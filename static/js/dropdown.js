/**
 * Dropdown management module for PlanktoScan
 */

/**
 * Initialize dropdown values with default selections
 */
function initializeDropdowns() {
    const $modelSelect = $('#classification-model');
    
    // Set default values if not already set
    if (!$modelSelect.val() || $modelSelect.val() === '') {
        $modelSelect.val('efficientnetv2b0');
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
        console.log('Initializing user dropdown...');
        
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
                
                console.log('User dropdown clicked');
                
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
            
            // Prevent menu from closing when clicking inside
            if (freshMenu) {
                freshMenu.addEventListener('click', function(e) {
                    e.stopPropagation();
                });
                
                // Ensure dropdown items are clickable
                const dropdownItems = freshMenu.querySelectorAll('.dropdown-item');
                dropdownItems.forEach(item => {
                    item.addEventListener('click', function(e) {
                        console.log('Dropdown item clicked:', this.textContent.trim());
                        
                        // Close dropdown after item click
                        freshMenu.classList.remove('show');
                        freshToggle.setAttribute('aria-expanded', 'false');
                        
                        // Allow the default action (href or onclick)
                        return true;
                    });
                });
            }
            
            // Close dropdown when clicking outside
            document.addEventListener('click', function(e) {
                if (!freshToggle.contains(e.target) && !freshMenu?.contains(e.target)) {
                    freshMenu?.classList.remove('show');
                    freshToggle.setAttribute('aria-expanded', 'false');
                }
            });
            
            console.log('User dropdown initialized successfully');
        }
    } else {
        console.warn('User dropdown toggle not found');
    }
}

/**
 * Setup all dropdown initializations
 */
function initializeAllDropdowns() {
    // Initialize regular dropdowns
    initializeDropdowns();
    
    // Initialize user dropdown
    initializeUserDropdown();
    
    console.log('All dropdowns initialized');
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
        $dropdown.find('.dropdown-item').removeClass('active');
        $item.addClass('active');
        
        console.log('Dropdown updated:', {
            button: dropdownId,
            value: value,
            text: text,
            hiddenInputExists: $hiddenInput && $hiddenInput.length > 0
        });
    });

    // Remove any existing model select handlers to prevent duplicates
    $modelSelect.off('change');
    
    // Monitor dropdown changes for debugging
    $modelSelect.on('change', function() {
        console.log('Classification model changed to:', $(this).val());
    });
    
    console.log('Dropdown event handlers setup complete');
}

/**
 * Get dropdown value with validation
 */
function getDropdownValue(dropdownId) {
    const $select = $(`#${dropdownId}`);
    const value = $select.val();
    
    // Validate and return default if needed
    if (!value || value === 'null' || value === 'undefined') {
        console.warn(`Invalid dropdown value for ${dropdownId}:`, value);
        
        // Return appropriate defaults
        switch(dropdownId) {
            case 'classification-model':
                return 'efficientnetv2b0';
            default:
                return '';
        }
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
        $dropdown.find('.dropdown-item').removeClass('active');
        $targetItem.addClass('active');
        
        console.log(`Dropdown ${dropdownId} set to:`, {
            value: value,
            text: $targetItem.text()
        });
    } else {
        console.warn(`Dropdown item not found for value: ${value}`);
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
    
    console.log('Dropdown validation result:', validationResult);
    return validationResult;
}

/**
 * Reset dropdown to default values
 */
function resetDropdown(dropdownId = null) {
    if (dropdownId) {
        // Reset specific dropdown
        switch(dropdownId) {
            case 'classification-model':
                setDropdownValue(dropdownId, 'efficientnetv2b0');
                break;
            default:
                console.warn('Unknown dropdown ID:', dropdownId);
        }
    } else {
        // Reset all dropdowns
        setDropdownValue('classification-model', 'efficientnetv2b0');
    }
    
    console.log('Dropdown(s) reset to default values');
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
            $activeItem.addClass('active');
            console.log(`Updated ${dropdownId} button text to:`, $activeItem.text());
        }
    }
}

/**
 * Initialize dropdown button texts on page load
 */
function initializeDropdownTexts() {
    // Wait for DOM to be ready
    setTimeout(() => {
        console.log('=== Initializing Dropdown Texts ===');
        
        const classificationValue = getDropdownValue('classification-model');
        
        console.log('Setting initial dropdown texts:', {
            classificationValue
        });
        
        // Update classification dropdown
        if (classificationValue) {
            updateDropdownButtonText('classification-model');
        }
        
        console.log('Dropdown texts initialization complete');
    }, 100);
}

/**
 * Setup responsive dropdown behavior
 */
function setupResponsiveDropdowns() {
    // Close dropdowns when clicking outside
    $(document).on('click', function(e) {
        if (!$(e.target).closest('.dropdown').length) {
            $('.dropdown-menu').removeClass('show');
        }
    });
    
    // Handle dropdown toggle clicks
    $(document).on('click', '.dropdown-toggle', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const $this = $(this);
        const $menu = $this.siblings('.dropdown-menu');
        const $dropdown = $this.closest('.dropdown');
        
        // Close other dropdowns
        $('.dropdown-menu').not($menu).removeClass('show');
        
        // Toggle current dropdown
        $menu.toggleClass('show');
        
        // Position dropdown if needed
        positionDropdownMenu($dropdown, $menu);
    });
    
    console.log('Responsive dropdown behavior setup complete');
}

/**
 * Position dropdown menu to prevent overflow
 */
function positionDropdownMenu($dropdown, $menu) {
    const dropdownRect = $dropdown[0].getBoundingClientRect();
    const menuHeight = $menu.outerHeight();
    const windowHeight = window.innerHeight;
    
    // Check if dropdown would overflow bottom of viewport
    if (dropdownRect.bottom + menuHeight > windowHeight) {
        $menu.addClass('dropdown-menu-up');
    } else {
        $menu.removeClass('dropdown-menu-up');
    }
}

// Export to global scope
if (typeof window !== 'undefined') {
    window.initializeDropdowns = initializeDropdowns;
    window.initializeUserDropdown = initializeUserDropdown;
    window.initializeAllDropdowns = initializeAllDropdowns;
    window.setupDropdownHandlers = setupDropdownHandlers;
    window.getDropdownValue = getDropdownValue;
    window.setDropdownValue = setDropdownValue;
    window.validateDropdowns = validateDropdowns;
    window.resetDropdown = resetDropdown;
    window.getAllDropdownValues = getAllDropdownValues;
    window.updateDropdownButtonText = updateDropdownButtonText;
    window.initializeDropdownTexts = initializeDropdownTexts;
    window.setupResponsiveDropdowns = setupResponsiveDropdowns;
}