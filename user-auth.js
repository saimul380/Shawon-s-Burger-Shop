document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const otpForm = document.getElementById('otpForm');
    const messageContainer = document.getElementById('messageContainer');
    const authTabs = document.querySelectorAll('.auth-tab');
    const otpDigits = document.querySelectorAll('.otp-digit');
    const resendOtpBtn = document.getElementById('resendOtpBtn');
    const otpTimer = document.getElementById('otpTimer');

    // Check if user is already logged in
    if (localStorage.getItem('userToken')) {
        window.location.href = 'index.html';
    }

    // Tab switching functionality
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and forms
            authTabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding form
            tab.classList.add('active');
            document.getElementById(tab.dataset.form).classList.add('active');
            
            // Clear any messages
            hideMessage();
        });
    });

    // Login form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        
        if (!email || !password) {
            showMessage('Please enter both email and password', 'error');
            return;
        }
        
        // Show loading state
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                // If account is not verified, show OTP form
                if (response.status === 403 && data.userId) {
                    document.getElementById('userId').value = data.userId;
                    showOtpForm();
                    startOtpTimer();
                    showMessage(data.message, 'warning');
                } else {
                    throw new Error(data.error || 'Login failed');
                }
            } else {
                // Store user data and token
                localStorage.setItem('userToken', data.token);
                localStorage.setItem('userData', JSON.stringify(data.user));
                
                // Show success message and redirect
                showMessage('Login successful!', 'success');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);
            }
        } catch (error) {
            showMessage(error.message, 'error');
        } finally {
            // Reset button state
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    });

    // Registration form submission
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const phone = document.getElementById('registerPhone').value.trim();
        const address = document.getElementById('registerAddress').value.trim();
        
        if (!name || !email || !password || !phone || !address) {
            showMessage('Please fill in all fields', 'error');
            return;
        }
        
        if (password.length < 6) {
            showMessage('Password must be at least 6 characters long', 'error');
            return;
        }
        
        // Show loading state
        const submitBtn = registerForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Registering...';
        
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, email, password, phone, address })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Registration failed');
            }
            
            // Store user ID for OTP verification
            document.getElementById('userId').value = data.userId;
            
            // Show OTP form and start timer
            showOtpForm();
            startOtpTimer();
            showMessage(data.message, 'success');
        } catch (error) {
            showMessage(error.message, 'error');
        } finally {
            // Reset button state
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    });

    // OTP form submission
    otpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Collect OTP digits
        let otpValue = '';
        otpDigits.forEach(digit => {
            otpValue += digit.value;
        });
        
        if (otpValue.length !== 6) {
            showMessage('Please enter the complete 6-digit code', 'error');
            return;
        }
        
        const userId = document.getElementById('userId').value;
        
        if (!userId) {
            showMessage('User ID is missing, please try again', 'error');
            return;
        }
        
        // Show loading state
        const submitBtn = otpForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Verifying...';
        
        try {
            const response = await fetch('/api/auth/verify-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId, otp: otpValue })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Verification failed');
            }
            
            // Store user data and token
            localStorage.setItem('userToken', data.token);
            localStorage.setItem('userData', JSON.stringify(data.user));
            
            // Show success message and redirect
            showMessage('Account verified successfully!', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        } catch (error) {
            showMessage(error.message, 'error');
        } finally {
            // Reset button state
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    });

    // Resend OTP button
    resendOtpBtn.addEventListener('click', async () => {
        const userId = document.getElementById('userId').value;
        
        if (!userId) {
            showMessage('User ID is missing, please try again', 'error');
            return;
        }
        
        resendOtpBtn.disabled = true;
        
        try {
            const response = await fetch('/api/auth/resend-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to resend code');
            }
            
            // Reset timer
            startOtpTimer();
            showMessage(data.message, 'success');
        } catch (error) {
            showMessage(error.message, 'error');
        }
    });

    // OTP input handling - auto focus next input
    otpDigits.forEach((digit, index) => {
        // Focus next input after entering a digit
        digit.addEventListener('input', () => {
            if (digit.value && index < otpDigits.length - 1) {
                otpDigits[index + 1].focus();
            }
        });
        
        // Handle backspace
        digit.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !digit.value && index > 0) {
                otpDigits[index - 1].focus();
            }
        });
        
        // Ensure only numbers are entered
        digit.addEventListener('input', () => {
            digit.value = digit.value.replace(/[^0-9]/g, '');
        });
    });

    // Helper functions
    function showMessage(message, type = 'info') {
        messageContainer.textContent = message;
        messageContainer.className = `alert alert-${type === 'error' ? 'danger' : type}`;
        messageContainer.style.display = 'block';
    }

    function hideMessage() {
        messageContainer.style.display = 'none';
    }

    function showOtpForm() {
        // Hide tabs and other forms
        authTabs.forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
        
        // Show OTP form
        otpForm.classList.add('active');
        
        // Clear and focus first OTP input
        otpDigits.forEach(digit => digit.value = '');
        otpDigits[0].focus();
    }

    function startOtpTimer() {
        let timeLeft = 15 * 60; // 15 minutes in seconds
        
        // Clear any existing timer
        if (window.otpTimerInterval) {
            clearInterval(window.otpTimerInterval);
        }
        
        // Disable resend button initially
        resendOtpBtn.disabled = true;
        
        // Update timer every second
        window.otpTimerInterval = setInterval(() => {
            if (timeLeft <= 0) {
                clearInterval(window.otpTimerInterval);
                otpTimer.textContent = 'Code expired';
                resendOtpBtn.disabled = false;
                return;
            }
            
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            
            otpTimer.textContent = `Code expires in: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            timeLeft--;
            
            // Enable resend button after 1 minute
            if (timeLeft === 14 * 60) { // 14 minutes left = 1 minute has passed
                resendOtpBtn.disabled = false;
            }
        }, 1000);
    }
});
