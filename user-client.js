document.addEventListener('DOMContentLoaded', () => {
    // Check user authentication state
    checkAuthState();
    
    // Logout button event listener
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Function to check if user is logged in
    function checkAuthState() {
        const token = localStorage.getItem('userToken');
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        
        // Get auth section elements
        const loggedInButtons = document.getElementById('loggedInButtons');
        const loggedOutButtons = document.getElementById('loggedOutButtons');
        const userGreeting = document.getElementById('userGreeting');
        
        if (token && userData.name) {
            // User is logged in
            if (loggedInButtons) loggedInButtons.style.display = 'flex';
            if (loggedOutButtons) loggedOutButtons.style.display = 'none';
            if (userGreeting) userGreeting.textContent = `Hello, ${userData.name}`;
            
            // Make authenticated API calls possible with Authorization header
            setupAuthenticatedAxios(token);
        } else {
            // User is logged out
            if (loggedInButtons) loggedInButtons.style.display = 'none';
            if (loggedOutButtons) loggedOutButtons.style.display = 'flex';
        }
    }
    
    // Function to handle logout
    function handleLogout() {
        // Clear local storage
        localStorage.removeItem('userToken');
        localStorage.removeItem('userData');
        
        // Update UI
        checkAuthState();
        
        // Optional: redirect to home page if on a protected page
        if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
            window.location.href = '/';
        }
    }
    
    // Setup axios with authentication token (if using axios)
    function setupAuthenticatedAxios(token) {
        // If using axios, you would configure it here
        if (window.axios) {
            window.axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
    }
});
