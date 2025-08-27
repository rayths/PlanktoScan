// ============================================================================
// EXPERT FEEDBACK STATE
// ============================================================================

const ExpertFeedbackApp = {
    isInitialized: false,
    currentValue: null,
    isEditMode: false
};

// ============================================================================
// DROPDOWN MANAGEMENT FOR CLASSIFICATION ACCURACY
// ============================================================================

/**
 * Handle accuracy dropdown selection
 * @param {Element} element - Clicked dropdown item
 * @param {string} value - Selected value (true/false)
 * @param {string} displayText - Text to display on button
 */
function selectAccuracy(element, value, displayText) {
    try {
        // Update display text
        const selectedText = document.getElementById('selectedAccuracy');
        if (selectedText) {
            selectedText.textContent = displayText;
        }
        
        // Update hidden input value
        const hiddenInput = document.getElementById('is_correct');
        if (hiddenInput) {
            hiddenInput.value = value;
            ExpertFeedbackApp.currentValue = value;
        }
        
        // Remove active class from all items
        document.querySelectorAll('#accuracyDropdown + .dropdown-menu .dropdown-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Add active class to selected item
        element.classList.add('active');
        
        // Close dropdown
        const dropdown = bootstrap.Dropdown.getInstance(document.getElementById('accuracyDropdown'));
        if (dropdown) {
            dropdown.hide();
        }
        
        // Toggle correct class field
        toggleCorrectClassField();
        
        // Add visual feedback
        const dropdownBtn = document.getElementById('accuracyDropdown');
        if (dropdownBtn) {
            dropdownBtn.style.borderColor = value === 'true' ? '#28a745' : '#dc3545';
            dropdownBtn.style.backgroundColor = value === 'true' ? '#f8fff9' : '#fff5f5';
        }
        
        console.log('Expert feedback accuracy selected:', value, displayText);
        
    } catch (error) {
        console.error('Error in selectAccuracy:', error);
    }
}

/**
 * Toggle correct classification field based on accuracy selection
 */
function toggleCorrectClassField() {
    const isCorrect = document.getElementById('is_correct')?.value;
    const correctClassField = document.getElementById('correct-class-field');
    const correctClassInput = document.getElementById('correct_class');
    
    if (isCorrect === 'false') {
        if (correctClassField) correctClassField.style.display = 'block';
        if (correctClassInput) correctClassInput.required = true;
    } else {
        if (correctClassField) correctClassField.style.display = 'none';
        if (correctClassInput) {
            correctClassInput.required = false;
            correctClassInput.value = '';
        }
    }
}

// ============================================================================
// FORM MANAGEMENT
// ============================================================================

/**
 * Reset expert feedback form to initial state
 */
function resetForm() {
    try {
        const elements = {
            userFeedback: document.getElementById('user_feedback'),
            isCorrect: document.getElementById('is_correct'),
            correctClass: document.getElementById('correct_class'),
            charCount: document.getElementById('char-count'),
            selectedAccuracy: document.getElementById('selectedAccuracy')
        };
        
        if (elements.userFeedback) elements.userFeedback.value = '';
        if (elements.isCorrect) elements.isCorrect.value = '';
        if (elements.correctClass) elements.correctClass.value = '';
        if (elements.charCount) elements.charCount.textContent = '0';
        if (elements.selectedAccuracy) elements.selectedAccuracy.textContent = '-- Select Status --';
        
        // Remove active class from dropdown items
        document.querySelectorAll('#accuracyDropdown + .dropdown-menu .dropdown-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Reset dropdown button styling
        const dropdownBtn = document.getElementById('accuracyDropdown');
        if (dropdownBtn) {
            dropdownBtn.style.borderColor = '';
            dropdownBtn.style.backgroundColor = '';
        }
        
        // Reset state
        ExpertFeedbackApp.currentValue = null;
        
        toggleCorrectClassField();
        
        console.log('Expert feedback form reset successfully');
        
    } catch (error) {
        console.error('Error resetting expert feedback form:', error);
    }
}

/**
 * Enable edit mode for existing feedback
 */
function enableEdit() {
    try {
        const alertSuccess = document.querySelector('.alert-success');
        const editForm = document.getElementById('edit-form');
        
        if (alertSuccess) alertSuccess.style.display = 'none';
        if (editForm) editForm.style.display = 'block';
        
        ExpertFeedbackApp.isEditMode = true;
        console.log('Expert feedback edit mode enabled');
        
    } catch (error) {
        console.error('Error enabling edit mode:', error);
    }
}

/**
 * Cancel edit mode
 */
function cancelEdit() {
    try {
        const alertSuccess = document.querySelector('.alert-success');
        const editForm = document.getElementById('edit-form');
        
        if (alertSuccess) alertSuccess.style.display = 'block';
        if (editForm) editForm.style.display = 'none';
        
        ExpertFeedbackApp.isEditMode = false;
        console.log('Expert feedback edit mode cancelled');
        
    } catch (error) {
        console.error('Error cancelling edit mode:', error);
    }
}

// ============================================================================
// CHARACTER COUNTER
// ============================================================================

/**
 * Update character counter for expert feedback textarea
 */
function updateCharCount() {
    const textarea = document.getElementById('user_feedback');
    const counter = document.getElementById('char-count');
    
    if (textarea && counter) {
        const current = textarea.value.length;
        counter.textContent = current;
        
        // Change color based on length
        if (current > 1800) {
            counter.style.color = '#dc3545';
        } else if (current > 1500) {
            counter.style.color = '#ffc107';
        } else {
            counter.style.color = '#6c757d';
        }
    }
}

// ============================================================================
// FORM VALIDATION & SUBMISSION
// ============================================================================

/**
 * Validate expert feedback form
 * @returns {Object} Validation result
 */
function validateExpertFeedback() {
    const feedback = document.getElementById('user_feedback')?.value.trim() || '';
    const accuracy = document.getElementById('is_correct')?.value || '';
    const correctClass = document.getElementById('correct_class')?.value.trim() || '';
    
    const validation = {
        isValid: true,
        errors: []
    };
    
    // Validate feedback length
    if (feedback.length < 1) {
        validation.isValid = false;
        validation.errors.push({
            field: 'user_feedback',
            message: 'Please provide more detailed expert analysis',
            title: 'Feedback Too Short'
        });
    }
    
    // Validate accuracy selection
    if (!accuracy) {
        validation.isValid = false;
        validation.errors.push({
            field: 'is_correct',
            message: 'Please select whether the classification is correct or incorrect',
            title: 'Classification Status Required'
        });
    }
    
    // Validate correct class if incorrect is selected
    if (accuracy === 'false' && !correctClass) {
        validation.isValid = false;
        validation.errors.push({
            field: 'correct_class',
            message: 'Please specify the correct classification when marking as incorrect',
            title: 'Correct Classification Required'
        });
    }
    
    return validation;
}

/**
 * Handle expert feedback form submission
 * @param {Event} e - Form submit event
 */
function submitFeedback(e) {
    const validation = validateExpertFeedback();
    
    if (!validation.isValid) {
        e.preventDefault();
        
        const firstError = validation.errors[0];
        
        // Use SweetAlert if available, otherwise use regular alert
        if (typeof showWarning === 'function') {
            showWarning(firstError.message);
        } else {
            // Fallback if utils.js not loaded
            alert(`${firstError.title}: ${firstError.message}`);
        }        
        // Focus on the problematic field
        const field = document.getElementById(firstError.field);
        if (field) {
            if (firstError.field === 'is_correct') {
                // Highlight dropdown
                const dropdownBtn = document.getElementById('accuracyDropdown');
                if (dropdownBtn) {
                    dropdownBtn.style.borderColor = '#dc3545';
                    dropdownBtn.style.backgroundColor = '#fff5f5';
                    dropdownBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            } else {
                field.focus();
                field.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
        
        return;
    }

    // Show loading modal if available
    const loadingModal = document.getElementById('loadingModal');
    if (loadingModal && typeof bootstrap !== 'undefined') {
        const modal = new bootstrap.Modal(loadingModal);
        modal.show();
    }

    // Disable submit button
    const submitBtn = document.getElementById('submit-feedback-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    }
    
    console.log('Expert feedback form submitted successfully');
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize expert feedback dropdown with existing values
 */
function initializeDropdown() {
    const currentValue = document.getElementById('is_correct')?.value;
    
    if (currentValue) {
        const displayText = currentValue === 'true' 
            ? 'Correct - Classification is accurate' 
            : 'Incorrect - Classification needs correction';
        
        const selectedAccuracy = document.getElementById('selectedAccuracy');
        if (selectedAccuracy) {
            selectedAccuracy.textContent = displayText;
        }
        
        // Set active state
        const targetItem = document.querySelector(`[data-value="${currentValue}"]`);
        if (targetItem) {
            targetItem.classList.add('active');
            selectAccuracy(targetItem, currentValue, displayText);
        }
        
        ExpertFeedbackApp.currentValue = currentValue;
    }
}

/**
 * Initialize expert feedback form
 */
function initializeFeedbackForm() {
    if (ExpertFeedbackApp.isInitialized) {
        console.log('Expert feedback already initialized');
        return;
    }
    
    try {
        console.log('Initializing expert feedback module...');
        
        // Initialize character counter
        const textarea = document.getElementById('user_feedback');
        if (textarea) {
            textarea.removeEventListener('input', updateCharCount);
            textarea.addEventListener('input', updateCharCount);
            updateCharCount(); // Initial count
        }
        
        // Initialize form submission
        const form = document.querySelector('form[action*="/feedback/"]');
        if (form) {
            form.removeEventListener('submit', submitFeedback);
            form.addEventListener('submit', submitFeedback);
        }
        
        // Initialize dropdown
        initializeDropdown();
        toggleCorrectClassField();
        
        // Check for URL error parameters
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');
        
        if (error) {
            let errorMessage = 'An error occurred while submitting feedback.';
            if (error === 'save_failed') {
                errorMessage = 'Failed to save feedback to database. Please try again.';
            } else if (error === 'general') {
                errorMessage = 'An unexpected error occurred. Please try again.';
            }

            showError("Submission Failed", errorMessage);
        }
        
        ExpertFeedbackApp.isInitialized = true;
        console.log('Expert feedback module initialized successfully');
        
    } catch (error) {
        console.error('Error initializing expert feedback:', error);
    }
}

// ============================================================================
// LEGACY COMPATIBILITY (if needed)
// ============================================================================

/**
 * Legacy function for basic rating (kept for compatibility)
 * @param {number} rating - Rating value (1-5)
 */
function setRating(rating) {
    console.log('setRating called with:', rating);
    // This function is kept for legacy compatibility but not used in expert feedback
}

/**
 * Reset feedback form (alias for resetForm)
 */
function resetFeedbackForm() {
    resetForm();
}

// ============================================================================
// DOCUMENT READY & EXPORTS
// ============================================================================

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeFeedbackForm);

// Export to global scope for onclick handlers
if (typeof window !== 'undefined') {
    // Expert feedback functions
    window.selectAccuracy = selectAccuracy;
    window.toggleCorrectClassField = toggleCorrectClassField;
    window.resetForm = resetForm;
    window.enableEdit = enableEdit;
    window.cancelEdit = cancelEdit;
    window.updateCharCount = updateCharCount;
    window.submitFeedback = submitFeedback;
    window.initializeFeedbackForm = initializeFeedbackForm;
    
    // Legacy compatibility
    window.setRating = setRating;
    window.resetFeedbackForm = resetFeedbackForm;
    
    // Module export
    window.ExpertFeedbackApp = ExpertFeedbackApp;
}