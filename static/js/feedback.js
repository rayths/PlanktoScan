/**
 * Feedback management module for PlanktoScan
 */

/**
 * Set rating value and update UI
 * @param {number} rating - Rating value (1-5)
 */
function setRating(rating) {
    document.getElementById('feedback-rating').value = rating;
    
    // Update visual stars
    const stars = document.querySelectorAll('.btn-rating');
    stars.forEach((star, index) => {
        if (index < rating) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
    
    console.log('Rating set to:', rating);
}

/**
 * Reset feedback form to initial state
 */
function resetFeedbackForm() {
    const feedbackForm = document.getElementById('feedback-form');
    if (feedbackForm) {
        feedbackForm.reset();
    }
    
    const feedbackRating = document.getElementById('feedback-rating');
    if (feedbackRating) {
        feedbackRating.value = '';
    }
    
    // Reset rating stars
    const stars = document.querySelectorAll('.btn-rating');
    stars.forEach(star => star.classList.remove('active'));
    
    // Reset character counter
    updateCharCount();
    
    console.log('Feedback form reset');
}

/**
 * Update character counter for textarea
 */
function updateCharCount() {
    const textarea = document.getElementById('feedback-message');
    const counter = document.getElementById('char-count');
    
    if (textarea && counter) {
        const currentLength = textarea.value.length;
        counter.textContent = currentLength;
        
        // Change color based on length
        if (currentLength > 800) {
            counter.style.color = '#e74c3c';
        } else if (currentLength > 600) {
            counter.style.color = '#f39c12';
        } else {
            counter.style.color = '#6c757d';
        }
    }
}

/**
 * Edit existing feedback (show form again)
 */
function editFeedback() {
    swal({
        title: "Edit Feedback",
        text: "Apakah Anda ingin mengubah feedback yang sudah dikirim?",
        icon: "question",
        buttons: {
            cancel: "Batal",
            confirm: "Ya, Edit"
        }
    }).then((willEdit) => {
        if (willEdit) {
            // Reload page with edit parameter
            window.location.href = window.location.href + '?edit_feedback=1';
        }
    });
}

/**
 * Submit feedback form with validation
 * @param {Event} event - Form submit event
 */
function submitFeedback(event) {
    event.preventDefault();
    
    const form = document.getElementById('feedback-form');
    if (!form) {
        console.error('Feedback form not found');
        return;
    }
    
    const formData = new FormData(form);
    
    // Validate required fields
    const status = formData.get('status');
    const message = formData.get('message');
    
    if (!status) {
        swal({
            title: "Status Diperlukan",
            text: "Silakan pilih status analisis (Sesuai atau Belum Sesuai)",
            icon: "warning"
        });
        return;
    }
    
    if (!message || message.trim().length < 10) {
        swal({
            title: "Pesan Terlalu Pendek",
            text: "Silakan berikan masukan yang lebih detail (minimal 10 karakter)",
            icon: "warning"
        });
        return;
    }
    
    // Show loading state
    const submitBtn = document.getElementById('submit-feedback-btn');
    if (!submitBtn) {
        console.error('Submit button not found');
        return;
    }
    
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengirim...';
    submitBtn.disabled = true;
    
    // Submit feedback
    fetch('/submit-feedback', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            swal({
                title: "Feedback Berhasil Dikirim",
                text: "Terima kasih atas feedback Anda. Masukan Anda sangat berharga!",
                icon: "success"
            }).then(() => {
                // Reload page to show submitted feedback
                window.location.reload();
            });
        } else {
            throw new Error(data.message || 'Gagal mengirim feedback');
        }
    })
    .catch(error => {
        console.error('Error submitting feedback:', error);
        swal({
            title: "Gagal Mengirim Feedback",
            text: error.message || "Terjadi kesalahan. Silakan coba lagi.",
            icon: "error"
        });
    })
    .finally(() => {
        // Reset button state
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    });
}

/**
 * Initialize feedback form with event handlers
 */
function initializeFeedbackForm() {
    try {
        // Character counter for textarea
        const textarea = document.getElementById('feedback-message');
        if (textarea) {
            textarea.removeEventListener('input', updateCharCount); // Remove existing listener
            textarea.addEventListener('input', updateCharCount);
            updateCharCount(); // Initial count
            console.log('Feedback textarea initialized');
        }
        
        // Form submission
        const feedbackForm = document.getElementById('feedback-form');
        if (feedbackForm) {
            feedbackForm.removeEventListener('submit', submitFeedback); // Remove existing listener
            feedbackForm.addEventListener('submit', submitFeedback);
            console.log('Feedback form submission handler attached');
        }
        
        // Rating hover effects and click handlers
        const ratingButtons = document.querySelectorAll('.btn-rating');
        if (ratingButtons.length > 0) {
            ratingButtons.forEach((button, index) => {
                // Remove existing listeners
                button.removeEventListener('mouseenter', handleRatingHover);
                button.removeEventListener('mouseleave', handleRatingLeave);
                button.removeEventListener('click', handleRatingClick);
                
                // Add new listeners
                button.addEventListener('mouseenter', () => handleRatingHover(index, ratingButtons));
                button.addEventListener('mouseleave', () => handleRatingLeave(ratingButtons));
                button.addEventListener('click', () => handleRatingClick(index + 1));
            });
            console.log(`Feedback rating buttons initialized (${ratingButtons.length} buttons)`);
        }
        
        console.log('Feedback form fully initialized');
        
    } catch (error) {
        console.error('Error initializing feedback form:', error);
    }
}

/**
 * Handle rating button hover
 */
function handleRatingHover(index, ratingButtons) {
    // Highlight stars up to hovered star
    ratingButtons.forEach((star, starIndex) => {
        if (starIndex <= index) {
            star.style.color = '#ffc107';
        } else {
            star.style.color = '#ddd';
        }
    });
}

/**
 * Handle rating button leave
 */
function handleRatingLeave(ratingButtons) {
    // Reset to actual rating
    const ratingInput = document.getElementById('feedback-rating');
    const currentRating = ratingInput ? parseInt(ratingInput.value) || 0 : 0;
    ratingButtons.forEach((star, starIndex) => {
        if (starIndex < currentRating) {
            star.style.color = '#ffc107';
        } else {
            star.style.color = '#ddd';
        }
    });
}

/**
 * Handle rating button click
 */
function handleRatingClick(rating) {
    setRating(rating);
}

/**
 * Setup feedback event handlers
 */
function setupFeedbackHandlers() {
    // Initialize feedback form on DOM load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeFeedbackForm);
    } else {
        initializeFeedbackForm();
    }
    
    console.log('Feedback event handlers setup complete');
}

// Export to global scope
if (typeof window !== 'undefined') {
    window.setRating = setRating;
    window.resetFeedbackForm = resetFeedbackForm;
    window.updateCharCount = updateCharCount;
    window.editFeedback = editFeedback;
    window.submitFeedback = submitFeedback;
    window.initializeFeedbackForm = initializeFeedbackForm;
    window.setupFeedbackHandlers = setupFeedbackHandlers;
}