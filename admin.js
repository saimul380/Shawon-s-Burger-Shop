// Auth state
let authToken = localStorage.getItem('authToken');
let currentUser = null;

// Check authentication and redirect if not admin
async function checkAdminAuth() {
    try {
        // Skip authentication check if we're on the login page
        if (document.getElementById('adminLoginForm') && 
            document.getElementById('adminLoginForm').style.display !== 'none') {
            return false; // Just return false without redirecting
        }
        
        const token = localStorage.getItem('adminToken');
        if (!token) {
            throw new Error('No authentication token');
        }
        
        // Use our direct admin verification instead of the profile endpoint
        try {
            const response = await fetch('/direct-admin-verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ token })
            });
            
            if (!response.ok) {
                throw new Error('Authentication failed');
            }
            
            const data = await response.json();
            if (data.user.role !== 'admin') {
                throw new Error('Not authorized');
            }
            
            currentUser = data.user;
            return true;
        } catch (error) {
            console.error('Auth verification error:', error);
            throw error;
        }
    } catch (error) {
        console.log('Auth check failed:', error.message);
        // Only redirect if not on the login page
        if (!document.getElementById('adminLoginForm') || 
            document.getElementById('adminLoginForm').style.display === 'none') {
            showLoginForm();
        }
        return false;
    }
}

// Admin panel functionality
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('adminLoginForm');
    const adminPanel = document.getElementById('adminPanel');
    const loginContainer = document.getElementById('loginContainer');
    const logoutBtn = document.getElementById('logoutBtn');

    // Check if user is already logged in
    const token = localStorage.getItem('adminToken');
    if (token) {
        showAdminPanel();
    } else {
        showLoginForm();
    }

    // Admin login form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Get form data
        const email = document.getElementById('adminEmail').value.trim();
        const password = document.getElementById('adminPassword').value;
        
        // Validate form data
        if (!email || !password) {
            showMessage('Please enter both email and password', 'error');
            return;
        }
        
        // Disable the button and show loading state
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';
        
        try {
            console.log('Attempting admin login with:', { email, passwordProvided: !!password });
            
            // Send login request to direct admin login endpoint
            const response = await fetch('/direct-admin-login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }
            
            if (data.user.role !== 'admin') {
                throw new Error('Access denied. Admin privileges required.');
            }
            
            // Store admin token
            localStorage.setItem('adminToken', data.token);
            localStorage.setItem('adminUser', JSON.stringify(data.user));
            
            console.log('Admin login successful:', data.user);
            
            // Show success message and admin panel
            showMessage('Login successful!', 'success');
            showAdminPanel();
        } catch (error) {
            console.error('Admin login error:', error);
            showMessage(error.message || 'Login failed. Please check your credentials.', 'error');
        } finally {
            // Reset button state
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    });

    // Logout functionality
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        showLoginForm();
        showMessage('Logged out successfully', 'success');
    });

    // Utility functions
    function showAdminPanel() {
        const loginContainer = document.getElementById('loginContainer');
        const adminPanel = document.getElementById('adminPanel');
        
        if (loginContainer) loginContainer.style.display = 'none';
        if (adminPanel) adminPanel.style.display = 'block';
        
        // Display admin user info
        const adminUser = JSON.parse(localStorage.getItem('adminUser') || '{}');
        document.getElementById('adminName').textContent = adminUser.name || 'Admin';
    }

    function showLoginForm() {
        const loginContainer = document.getElementById('loginContainer');
        const adminPanel = document.getElementById('adminPanel');
        
        if (loginContainer) loginContainer.style.display = 'block';
        if (adminPanel) adminPanel.style.display = 'none';
    }

    function showMessage(message, type = 'info') {
        const messageDiv = document.getElementById('messageContainer');
        messageDiv.textContent = message;
        messageDiv.className = `alert alert-${type === 'error' ? 'danger' : type}`;
        messageDiv.style.display = 'block';
        
        // Hide message after 5 seconds
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }
});

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async function() {
    if (await checkAdminAuth()) {
        await loadDashboard();
        initializeEventListeners();
    }
});

async function loadDashboard() {
    await Promise.all([
        updateDashboardStats(),
        loadOrders(),
        loadMenuItems(),
        loadComboDeals(),
        loadReviews(),
        initializeCharts()
    ]);
}

// Initialize all event listeners
function initializeEventListeners() {
    // Menu management
    document.getElementById('addMenuItem')?.addEventListener('click', showAddMenuItemModal);
    document.getElementById('saveMenuItem')?.addEventListener('click', saveMenuItem);
    
    // Combo deals
    document.getElementById('addComboBtn')?.addEventListener('click', showAddComboModal);
    document.getElementById('saveComboBtn')?.addEventListener('click', saveCombo);
    
    // Order filters
    document.getElementById('orderStatusFilter')?.addEventListener('change', loadOrders);
    document.getElementById('dateRangeFilter')?.addEventListener('change', updateDashboardStats);
    
    // Review management
    document.getElementById('reviewFilter')?.addEventListener('change', loadReviews);
    document.getElementById('exportReviews')?.addEventListener('click', exportReviews);
    
    // Admin Dashboard Functionality
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = '/';
        return;
    }

    // Date range filter
    const dateRangeFilter = document.getElementById('dateRangeFilter');
    let currentDateRange = 'today';

    // Initialize dashboard
    loadDashboardData();

    // Date range change handler
    dateRangeFilter.addEventListener('change', function() {
        currentDateRange = this.value;
        loadDashboardData();
    });

    // Export button handler
    document.getElementById('exportDashboard').addEventListener('click', function() {
        exportDashboardPDF();
    });

    // Print button handler
    document.getElementById('printDashboard').addEventListener('click', function() {
        window.print();
    });

    async function loadDashboardData() {
        try {
            const response = await fetch(`/api/admin/dashboard?dateRange=${currentDateRange}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Failed to load dashboard data');
            
            const data = await response.json();
            updateDashboard(data);
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to load dashboard data');
        }
    }

    async function exportDashboardPDF() {
        try {
            const response = await fetch(`/api/admin/dashboard/export?dateRange=${currentDateRange}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Failed to export dashboard');

            // Create a blob from the PDF stream
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `dashboard-report-${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to export dashboard');
        }
    }

    function updateDashboard(data) {
        // Update overview cards
        document.getElementById('totalOrders').textContent = data.totalOrders;
        document.getElementById('periodOrders').textContent = data.periodOrders;
        document.getElementById('totalRevenue').textContent = `৳${data.totalRevenue}`;
        document.getElementById('periodRevenue').textContent = `৳${data.periodRevenue}`;
        document.getElementById('totalCustomers').textContent = data.userCount;

        // Update order status chart
        updateOrderStatusChart(data.orderStatusCounts);

        // Update popular items chart
        updatePopularItemsChart(data.popularItems);

        // Update daily statistics chart
        updateDailyStatsChart(data.dailyStats);
    }

    function updateOrderStatusChart(statusCounts) {
        const ctx = document.getElementById('orderStatusChart').getContext('2d');
        if (window.orderStatusChart) {
            window.orderStatusChart.destroy();
        }

        const labels = Object.keys(statusCounts);
        const data = Object.values(statusCounts);

        window.orderStatusChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#FF6384',
                        '#36A2EB',
                        '#FFCE56',
                        '#4BC0C0',
                        '#9966FF'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right'
                    }
                }
            }
        });
    }

    function updatePopularItemsChart(popularItems) {
        const ctx = document.getElementById('popularItemsChart').getContext('2d');
        if (window.popularItemsChart) {
            window.popularItemsChart.destroy();
        }

        window.popularItemsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: popularItems.map(item => item._id),
                datasets: [{
                    label: 'Orders',
                    data: popularItems.map(item => item.count),
                    backgroundColor: '#36A2EB'
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    function updateDailyStatsChart(dailyStats) {
        const ctx = document.getElementById('dailyStatsChart').getContext('2d');
        if (window.dailyStatsChart) {
            window.dailyStatsChart.destroy();
        }

        window.dailyStatsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dailyStats.map(stat => stat._id),
                datasets: [
                    {
                        label: 'Orders',
                        data: dailyStats.map(stat => stat.orders),
                        borderColor: '#36A2EB',
                        fill: false
                    },
                    {
                        label: 'Revenue',
                        data: dailyStats.map(stat => stat.revenue),
                        borderColor: '#FF6384',
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
}

// Dashboard Statistics
async function updateDashboardStats() {
    try {
        const response = await fetch('/api/admin/dashboard', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) throw new Error('Failed to fetch dashboard stats');
        
        const stats = await response.json();
        
        // Update dashboard cards
        document.getElementById('todayOrders').textContent = stats.todayOrders;
        document.getElementById('todayRevenue').textContent = `৳${stats.todayRevenue}`;
        document.getElementById('pendingOrders').textContent = stats.orderStatusCounts.pending || 0;
        document.getElementById('totalCustomers').textContent = stats.userCount;
        
        // Update charts
        updateSalesChart(stats.popularItems);
        updatePopularItemsChart(stats.popularItems);
    } catch (error) {
        console.error('Error updating dashboard:', error);
        showError('Failed to update dashboard statistics');
    }
}

// Order Management
async function loadOrders() {
    try {
        const status = document.getElementById('orderStatusFilter')?.value || 'all';
        const response = await fetch(`/api/admin/orders?status=${status}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) throw new Error('Failed to fetch orders');
        
        const { orders } = await response.json();
        displayOrders(orders);
    } catch (error) {
        console.error('Error loading orders:', error);
        showError('Failed to load orders');
    }
}

function displayOrders(orders) {
    const ordersList = document.getElementById('recentOrdersList');
    if (!ordersList) return;
    
    ordersList.innerHTML = orders.map(order => `
        <tr>
            <td>${order._id}</td>
            <td>
                <div>${order.user.name}</div>
                <small class="text-muted">${order.user.phone}</small>
            </td>
            <td>${formatOrderItems(order.items)}</td>
            <td>৳${order.totalAmount}</td>
            <td>
                <span class="badge bg-${getStatusColor(order.orderStatus)}">
                    ${formatStatus(order.orderStatus)}
                </span>
            </td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-sm btn-info" onclick="viewOrderDetails('${order._id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-success" onclick="updateOrderStatus('${order._id}', 'completed')">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="updateOrderStatus('${order._id}', 'cancelled')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function updateOrderStatus(orderId, status) {
    try {
        const response = await fetch(`/api/admin/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ orderStatus: status })
        });

        if (!response.ok) throw new Error('Failed to update order status');

        await loadOrders();
        await updateDashboardStats();
        showSuccess('Order status updated successfully');
    } catch (error) {
        console.error('Error updating order status:', error);
        showError('Failed to update order status');
    }
}

// Menu Management
async function loadMenuItems() {
    try {
        const response = await fetch('/api/admin/menu', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) throw new Error('Failed to fetch menu items');
        
        const { items } = await response.json();
        displayMenuItems(items);
    } catch (error) {
        console.error('Error loading menu items:', error);
        showError('Failed to load menu items');
    }
}

function displayMenuItems(items) {
    const menuList = document.getElementById('menuItemsList');
    if (!menuList) return;

    menuList.innerHTML = items.map(item => `
        <tr>
            <td>
                <img src="${item.image}" alt="${item.name}" class="menu-item-thumb" width="50">
                ${item.name}
            </td>
            <td>${item.category}</td>
            <td>৳${item.price}</td>
            <td>
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" 
                           ${item.inStock ? 'checked' : ''} 
                           onchange="updateStock('${item._id}', this.checked)">
                </div>
            </td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-sm btn-primary" onclick="showEditMenuItemModal('${item._id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteMenuItem('${item._id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function saveMenuItem(event) {
    event.preventDefault();
    const form = document.getElementById('menuItemForm');
    const formData = new FormData(form);
    
    try {
        const response = await fetch('/api/admin/menu', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(Object.fromEntries(formData))
        });
        
        if (!response.ok) throw new Error('Failed to save menu item');
        
        await loadMenuItems();
        closeModal('menuItemModal');
        showSuccess('Menu item saved successfully');
    } catch (error) {
        console.error('Error saving menu item:', error);
        showError('Failed to save menu item');
    }
}

async function updateStock(itemId, inStock) {
    try {
        const response = await fetch(`/api/admin/menu/${itemId}/stock`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ inStock })
        });
        
        if (!response.ok) throw new Error('Failed to update stock status');
        
        showSuccess('Stock status updated successfully');
    } catch (error) {
        console.error('Error updating stock:', error);
        showError('Failed to update stock status');
    }
}

async function updatePrice(itemId, price) {
    try {
        const response = await fetch(`/api/admin/menu/${itemId}/price`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ price })
        });
        
        if (!response.ok) throw new Error('Failed to update price');
        
        await loadMenuItems();
        showSuccess('Price updated successfully');
    } catch (error) {
        console.error('Error updating price:', error);
        showError('Failed to update price');
    }
}

// Combo Deals Management
async function loadComboDeals() {
    try {
        const response = await fetch('/api/admin/combos', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) throw new Error('Failed to fetch combo deals');
        
        const { combos } = await response.json();
        displayComboDeals(combos);
    } catch (error) {
        console.error('Error loading combo deals:', error);
        showError('Failed to load combo deals');
    }
}

function displayComboDeals(combos) {
    const comboList = document.getElementById('comboDealsTable').querySelector('tbody');
    if (!comboList) return;

    comboList.innerHTML = combos.map(combo => `
        <tr>
            <td>${combo.name}</td>
            <td>
                <ul class="list-unstyled mb-0">
                    ${combo.items.map(item => `
                        <li>${item.quantity}x ${item.menuItem.name}</li>
                    `).join('')}
                </ul>
            </td>
            <td>৳${combo.totalPrice}</td>
            <td>৳${combo.discountedPrice}</td>
            <td>${new Date(combo.validUntil).toLocaleDateString()}</td>
            <td>
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" 
                           ${combo.isActive ? 'checked' : ''} 
                           onchange="updateComboStatus('${combo._id}', this.checked)">
                </div>
            </td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-sm btn-primary" onclick="showEditComboModal('${combo._id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteCombo('${combo._id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function saveCombo(event) {
    event.preventDefault();
    const form = document.getElementById('comboForm');
    const formData = new FormData(form);
    
    try {
        const response = await fetch('/api/admin/combos', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(Object.fromEntries(formData))
        });
        
        if (!response.ok) throw new Error('Failed to save combo deal');
        
        await loadComboDeals();
        closeModal('comboModal');
        showSuccess('Combo deal saved successfully');
    } catch (error) {
        console.error('Error saving combo deal:', error);
        showError('Failed to save combo deal');
    }
}

// Review Management
async function loadReviews() {
    try {
        const rating = document.getElementById('reviewFilter')?.value;
        const response = await fetch(`/api/admin/reviews${rating !== 'all' ? `?rating=${rating}` : ''}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) throw new Error('Failed to fetch reviews');
        
        const { reviews } = await response.json();
        displayReviews(reviews);
    } catch (error) {
        console.error('Error loading reviews:', error);
        showError('Failed to load reviews');
    }
}

function displayReviews(reviews) {
    const reviewsList = document.getElementById('reviewsList');
    if (!reviewsList) return;

    reviewsList.innerHTML = reviews.map(review => `
        <div class="review-card">
            <div class="review-header">
                <div>
                    <h6>${review.user.name}</h6>
                    <small class="text-muted">${new Date(review.createdAt).toLocaleDateString()}</small>
                </div>
                <div class="rating">
                    ${Array(5).fill(0).map((_, i) => `
                        <i class="fas fa-star ${i < review.rating ? 'text-warning' : 'text-muted'}"></i>
                    `).join('')}
                </div>
            </div>
            <p class="review-text">${review.comment}</p>
            <div class="review-actions">
                <button class="btn btn-sm btn-outline-primary" onclick="respondToReview('${review._id}')">
                    <i class="fas fa-reply"></i> Respond
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteReview('${review._id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
}

async function exportReviews() {
    try {
        const response = await fetch('/api/admin/reviews/export', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) throw new Error('Failed to export reviews');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'reviews-export.csv';
        a.click();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error exporting reviews:', error);
        showError('Failed to export reviews');
    }
}

// Charts Initialization
function initializeCharts() {
    initializeSalesChart();
    initializePopularItemsChart();
}

// Helper Functions
function formatStatus(status) {
    return status.charAt(0).toUpperCase() + status.slice(1);
}

function getStatusColor(status) {
    const colors = {
        'pending': 'warning',
        'preparing': 'info',
        'ready': 'primary',
        'delivered': 'success',
        'cancelled': 'danger'
    };
    return colors[status] || 'secondary';
}

function formatOrderItems(items) {
    return items.map(item => `${item.quantity}x ${item.name}`).join(', ');
}

function showError(message) {
    // Implement toast or alert for error messages
    alert(message);
}

function showSuccess(message) {
    // Implement toast or alert for success messages
    alert(message);
}

function closeModal(modalId) {
    const modal = bootstrap.Modal.getInstance(document.getElementById(modalId));
    if (modal) modal.hide();
}

// Add print styles
const style = document.createElement('style');
style.textContent = `
    @media print {
        .no-print {
            display: none !important;
        }
        .print-only {
            display: block !important;
        }
        .dashboard-card {
            break-inside: avoid;
        }
        canvas {
            max-width: 100% !important;
            height: auto !important;
        }
    }
`;
document.head.appendChild(style);
