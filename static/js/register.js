$(document).ready(function() {
    let selectedRole = null;

    // Pastikan semua library ter-load
    if (typeof firebase === 'undefined') {
        console.error('Firebase not loaded');
        alert('Firebase is not loaded. Please refresh the page.');
        return;
    }

    if (typeof swal === 'undefined') {
        console.warn('SweetAlert not loaded');
        // Fallback function
        window.showAlert = function(title, text, icon) {
            alert(title + ': ' + text);
        };
    } else {
        console.log('SweetAlert loaded successfully');
        window.showAlert = function(title, text, icon) {
            swal({
                title: title,
                text: text,
                icon: icon,
                button: "OK"
            });
        };
    }

    // Role card selection
    $('.role-card').click(function() {
        $('.role-card').removeClass('selected');
        $(this).addClass('selected');
        
        const role = $(this).data('role');
        selectedRole = role;
        
        // Update radio button
        $('input[name="role"]').prop('checked', false);
        $(`#role${role.charAt(0).toUpperCase() + role.slice(1)}`).prop('checked', true);

        // Show registration form with animation
        showRegistrationForm(role);

    });

    // Email validation
    $('#email').on('input', function() {
        const email = $(this).val();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (email && !emailRegex.test(email)) {
            $(this).addClass('is-invalid');
            $('#emailFeedback').text('Please enter a valid email address');
        } else {
            $(this).removeClass('is-invalid');
            $('#emailFeedback').text('');
            
            // Role-specific email validation
            if (selectedRole === 'expert' && email && !email.endsWith('@brin.go.id')) {
                $(this).addClass('is-invalid');
                $('#emailFeedback').text('Expert accounts require @brin.go.id email address');
            }
        }
    });

    // Password confirmation validation
    $('#confirmPassword').on('input', function() {
        const password = $('#password').val();
        const confirmPassword = $(this).val();
        
        if (confirmPassword && password !== confirmPassword) {
            $(this).addClass('is-invalid');
            $(this).next('.invalid-feedback').remove();
            $(this).after('<div class="invalid-feedback">Passwords do not match</div>');
        } else {
            $(this).removeClass('is-invalid');
            $(this).next('.invalid-feedback').remove();
        }
    });

    // Form submission
    $('#registerForm').submit(function(e) {
        e.preventDefault();
        
        if (!selectedRole) {
            showAlert('Role Required', 'Please select your role (Expert or Basic)', 'warning');
            // Scroll back to role selection
            $('html, body').animate({
                scrollTop: $('.role-selection').offset().top - 100
            }, 500);
            return;
        }

        const formData = {
            name: $('#fullName').val().trim(),
            email: $('#email').val().trim(),
            password: $('#password').val(),
            confirmPassword: $('#confirmPassword').val(),
            role: selectedRole,
            organization: $('#organization').val().trim()
        };

        // Validation
        if (!validateForm(formData)) {
            return;
        }

        // Show loading
        $('#loadingModal').modal('show');
        $('#submitBtn').prop('disabled', true);

        // Register with Firebase
        registerWithFirebase(formData);
    });

    // Google Sign Up
    $('#googleSignUpBtn').click(function() {
        if (!selectedRole) {
            showAlert('Role Required', 'Please select your role before signing up with Google', 'warning');
            return;
        }

        signUpWithGoogle();
    });

    // Show registration form
    function showRegistrationForm(role) {
        // Add completed class to role selection
        $('.role-selection').addClass('completed');
        
        // Show the registration form
        $('#registrationForm').hide().fadeIn(500).addClass('form-reveal');
        $('#backToLoginSection').hide().fadeIn(600);
        
        // Configure role-specific settings
        if (role === 'basic') {
            $('#conditionalFields').slideDown(300);
            $('#basicHint').show();
            $('#expertHint').hide();
            $('#organization').attr('required', true);
        } else {
            $('#conditionalFields').slideUp(300);
            $('#expertHint').show();
            $('#basicHint').hide();
            $('#organization').attr('required', false);
        }
        
        // Scroll to form smoothly
        setTimeout(() => {
            $('html, body').animate({
                scrollTop: $('#registrationForm').offset().top - 100
            }, 500);
        }, 200);
    }

    // Function to reset form
    function resetForm() {
        selectedRole = null;
        $('.role-card').removeClass('selected');
        $('.role-selection').removeClass('completed');
        $('#registrationForm').hide();
        $('#backToLoginSection').hide();
        $('#conditionalFields').hide();
        $('.email-hint').hide();
        $('input[name="role"]').prop('checked', false);
        
        // Reset form fields
        $('#registerForm')[0].reset();
        $('.form-control').removeClass('is-invalid');
        $('.invalid-feedback').text('');
    }

    function validateForm(data) {
        // Basic validation
        if (!data.name || !data.email || !data.password) {
            showAlert('Missing Information', 'Please fill in all required fields', 'error');
            return false;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.email)) {
            showAlert('Invalid Email', 'Please enter a valid email address', 'error');
            return false;
        }

        // Role-specific email validation
        if (data.role === 'expert' && !data.email.endsWith('@brin.go.id')) {
            showAlert('Invalid Email for Expert', 'Expert accounts require @brin.go.id email address', 'error');
            return false;
        }

        // Password validation
        if (data.password.length < 6) {
            showAlert('Password Too Short', 'Password must be at least 6 characters long', 'error');
            return false;
        }

        if (data.password !== data.confirmPassword) {
            showAlert('Password Mismatch', 'Passwords do not match', 'error');
            return false;
        }

        // Organization required for basic users
        if (data.role === 'basic' && !data.organization) {
            showAlert('Organization Required', 'Please specify your organization for basic account', 'error');
            return false;
        }

        return true;
    }
    
    function showSuccessWithHTML(title, htmlContent, callback = null) {
        if (typeof swal !== 'undefined') {
            swal({
                title: title,
                content: {
                    element: "div",
                    attributes: {
                        innerHTML: htmlContent,
                    },
                },
                icon: 'success',
                button: {
                    text: "Continue to Login",
                    closeModal: true,
                }
            }).then(() => {
                if (callback) callback();
            });
        } else {
            // Fallback to regular alert
            const textContent = htmlContent.replace(/<[^>]*>/g, ''); // Strip HTML tags
            alert(title + '\n' + textContent);
            if (callback) callback();
        }
    }

    async function registerWithFirebase(formData) {
        try {
            console.log('Creating Firebase user with email:', formData.email);
            console.log('Full name from form:', formData.name);

            // Create user with Firebase Auth
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(
                formData.email, 
                formData.password
            );

            console.log('Firebase user created successfully:', userCredential.user.uid);
            console.log('Initial displayName:', userCredential.user.displayName);

            // Update user profile with name
            console.log('Updating user profile with displayName:', formData.name);
            await userCredential.user.updateProfile({
                displayName: formData.name
            });

            // Reload user to get updated profile
            await userCredential.user.reload();
            console.log('User profile updated. New displayName:', userCredential.user.displayName);

            // Send email verification
            await userCredential.user.sendEmailVerification();
            console.log('Email verification sent');

            // Wait a bit to ensure profile updates are propagated
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Get ID token for backend (this will include updated profile info)
            const idToken = await userCredential.user.getIdToken(true); // Force refresh token
            console.log('ID token retrieved, length:', idToken.length);

            // Send to backend for user creation
            console.log('Sending authentication request to backend...');
            const response = await fetch('/auth/firebase', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    id_token: idToken,
                    next_url: '/',
                    role: formData.role,
                    organization: formData.organization || ''
                })
            });

            console.log('Backend response status:', response.status);
            console.log('Backend response headers:', Object.fromEntries(response.headers.entries()));
            
            let result;
            try {
                result = await response.json();
            } catch (parseError) {
                console.error('Failed to parse response as JSON:', parseError);
                const responseText = await response.text();
                console.error('Response text:', responseText);
                throw new Error('Invalid response from server');
            }
            
            console.log('Backend response:', result);

            $('#loadingModal').modal('hide');
            $('#submitBtn').prop('disabled', false);

            if (response.ok && result.success) {
                const htmlContent = `
                    <p>Your ${formData.role} account has been created.</p>
                    <p><strong>Please check your email to verify your account.</strong></p>
                `;
                
                showSuccessWithHTML('Account Created Successfully!', htmlContent, () => {
                    window.location.href = '/login';
                });
            } else {
                throw new Error(result.message || 'Registration failed');
            }

        } catch (error) {
            $('#loadingModal').modal('hide');
            $('#submitBtn').prop('disabled', false);

            console.error('Registration error:', error);
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                stack: error.stack
            });
            
            let errorMessage = 'Registration failed. Please try again.';
            
            if (error.code) {
                switch (error.code) {
                    case 'auth/email-already-in-use':
                        errorMessage = 'An account with this email already exists.';
                        break;
                    case 'auth/invalid-email':
                        errorMessage = 'Please enter a valid email address.';
                        break;
                    case 'auth/operation-not-allowed':
                        errorMessage = 'Email registration is not enabled.';
                        break;
                    case 'auth/weak-password':
                        errorMessage = 'Password is too weak. Please choose a stronger password.';
                        break;
                    default:
                        errorMessage = error.message || errorMessage;
                }
            } else if (error.message) {
                // Check if this is a backend error
                if (error.message.includes('User authentication failed')) {
                    errorMessage = 'Account created in Firebase but backend authentication failed. Please try logging in directly.';
                } else {
                    errorMessage = error.message;
                }
            }

            showAlert('Registration Failed', errorMessage, 'error');
        }
    }

    async function signUpWithGoogle() {
        try {
            $('#loadingModal').modal('show');

            const provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('email');
            provider.addScope('profile');

            const userCredential = await firebase.auth().signInWithPopup(provider);
            const user = userCredential.user;

            // Validate email for expert role
            if (selectedRole === 'expert' && !user.email.endsWith('@brin.go.id')) {
                await user.delete(); // Delete the created account
                throw new Error('Expert accounts require @brin.go.id email address');
            }

            // Get ID token for backend
            const idToken = await user.getIdToken();

            // Send to backend for user creation
            const response = await fetch('/auth/firebase', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    id_token: idToken,
                    next_url: '/',
                    role: selectedRole,
                    organization: selectedRole === 'basic' ? 'Google Account' : ''
                })
            });

            const result = await response.json();

            $('#loadingModal').modal('hide');

            if (result.success) {
                showSuccess(`Welcome to PlanktoScan! Your ${selectedRole} account is ready.`);
                
                // Redirect after showing success message
                setTimeout(() => {
                    window.location.href = result.redirect_url || '/';
                }, 2000); // Wait for success message timer
            } else {
                throw new Error(result.message || 'Registration failed');
            }

        } catch (error) {
            $('#loadingModal').modal('hide');
            
            console.error('Google registration error:', error);
            
            let errorMessage = 'Google registration failed. Please try again.';
            
            if (error.code) {
                switch (error.code) {
                    case 'auth/popup-closed-by-user':
                        return; // User cancelled, don't show error
                    case 'auth/popup-blocked':
                        errorMessage = 'Popup was blocked. Please allow popups and try again.';
                        break;
                    default:
                        errorMessage = error.message || errorMessage;
                }
            } else if (error.message) {
                errorMessage = error.message;
            }

            showAlert('Registration Failed', errorMessage, 'error');
        }
    }
});