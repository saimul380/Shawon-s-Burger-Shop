// Initialize Stripe and auth state
const stripe = Stripe('pk_test_your_publishable_key');
const elements = stripe.elements();
const cardElement = elements.create('card', {
    style: {
        base: {
            fontSize: '16px',
            color: '#32325d',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            '::placeholder': {
                color: '#aab7c4'
            }
        },
        invalid: {
            color: '#fa755a',
            iconColor: '#fa755a'
        }
    }
});

// Auth state
let currentUser = null;
let authToken = localStorage.getItem('authToken');

// Event handlers for auth forms
function showLoginModal() {
    const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
    loginModal.show();
}

function showRegisterModal() {
    const registerModal = new bootstrap.Modal(document.getElementById('registerModal'));
    registerModal.show();
}

// Handle login form submission
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Login failed');
        }
        
        const data = await response.json();
        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('authToken', authToken);
        
        updateAuthUI();
        if (currentUser.role === 'admin') {
            showAdminPanel();
        }
        
        const loginModal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
        if (loginModal) {
            loginModal.hide();
        }
        
        alert('Welcome back, ' + currentUser.name + '!');
    } catch (error) {
        console.error('Login error:', error);
        alert(error.message || 'Login failed. Please check your credentials.');
    }
});

function handleLogout() {
    console.log('Logging out...');
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    updateAuthUI();
    window.location.href = '/';
}

// Update UI based on auth state
function updateAuthUI() {
    const loggedOutButtons = document.getElementById('loggedOutButtons');
    const loggedInButtons = document.getElementById('loggedInButtons');
    const userGreeting = document.getElementById('userGreeting');
    
    if (currentUser) {
        if (loggedOutButtons) loggedOutButtons.style.display = 'none';
        if (loggedInButtons) loggedInButtons.style.display = 'flex';
        if (userGreeting) userGreeting.textContent = `Welcome, ${currentUser.name}!`;
        
        // Enable all menu item buttons
        document.querySelectorAll('.login-required').forEach(button => {
            button.disabled = false;
            button.onclick = null;
        });
    } else {
        if (loggedOutButtons) loggedOutButtons.style.display = 'flex';
        if (loggedInButtons) loggedInButtons.style.display = 'none';
        if (userGreeting) userGreeting.textContent = '';
        
        // Disable menu item buttons that require login
        document.querySelectorAll('.login-required').forEach(button => {
            button.disabled = true;
            button.onclick = showLoginPrompt;
        });
    }
}

// Check authentication on page load
document.addEventListener('DOMContentLoaded', async () => {
    if (authToken) {
        try {
            const response = await fetch('/api/auth/profile', {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            if (response.ok) {
                currentUser = await response.json();
                updateAuthUI();
                if (currentUser.role === 'admin') {
                    showAdminPanel();
                }
            } else {
                localStorage.removeItem('authToken');
                authToken = null;
                updateAuthUI();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            localStorage.removeItem('authToken');
            authToken = null;
            updateAuthUI();
        }
    }
    updateAuthUI();
    displayReviews();
});

// Function to show/hide payment forms based on selected method
function togglePaymentForms(paymentMethod) {
    const cardForm = document.getElementById('cardPaymentForm');
    const mobileForm = document.getElementById('mobilePaymentForm');
    const bkashInst = document.getElementById('bkashInstructions');
    const nagadInst = document.getElementById('nagadInstructions');
    const rocketInst = document.getElementById('rocketInstructions');

    // Hide all forms first
    cardForm.style.display = 'none';
    mobileForm.style.display = 'none';
    bkashInst.style.display = 'none';
    nagadInst.style.display = 'none';
    rocketInst.style.display = 'none';

    // Show relevant form based on payment method
    switch(paymentMethod) {
        case 'card':
            cardForm.style.display = 'block';
            break;
        case 'bkash':
            mobileForm.style.display = 'block';
            bkashInst.style.display = 'block';
            break;
        case 'nagad':
            mobileForm.style.display = 'block';
            nagadInst.style.display = 'block';
            break;
        case 'rocket':
            mobileForm.style.display = 'block';
            rocketInst.style.display = 'block';
            break;
    }
}

// Handle payment method selection
document.getElementById('paymentMethod').addEventListener('change', function(e) {
    togglePaymentForms(e.target.value);
});

// Function to add item to cart
function addToCart(name, price, quantity = 1, description = '') {
    const existingItem = cart.find(item => item.name === name);
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart.push({ name, price, quantity, description });
    }
    updateOrderItems();
    updateCartTotal();
}

// Function to update order items display
function updateOrderItems() {
    const orderItems = document.getElementById('orderItems');
    orderItems.innerHTML = '';
    
    cart.forEach((item, index) => {
        const itemElement = document.createElement('div');
        itemElement.className = 'list-group-item d-flex justify-content-between align-items-center';
        itemElement.innerHTML = `
            <div>
                <h6 class="mb-0">${item.name}</h6>
                <small class="text-muted">Price: ${formatPrice(item.price)}</small>
                ${item.description ? `<small class="text-muted">${item.description}</small>` : ''}
            </div>
            <div class="d-flex align-items-center">
                <button class="btn btn-sm btn-outline-secondary me-2" onclick="updateQuantity(${index}, -1)">-</button>
                <span class="mx-2">${item.quantity}</span>
                <button class="btn btn-sm btn-outline-secondary ms-2" onclick="updateQuantity(${index}, 1)">+</button>
                <button class="btn btn-sm btn-danger ms-3" onclick="removeItem(${index})">×</button>
            </div>
        `;
        orderItems.appendChild(itemElement);
    });
}

// Function to update item quantity
function updateQuantity(index, change) {
    const item = cart[index];
    const newQuantity = item.quantity + change;
    
    if (newQuantity > 0) {
        item.quantity = newQuantity;
    } else {
        cart.splice(index, 1);
    }
    
    updateOrderItems();
    updateCartTotal();
}

// Function to remove item from cart
function removeItem(index) {
    cart.splice(index, 1);
    updateOrderItems();
    updateCartTotal();
}

// Handle delivery address changes
document.getElementById('deliveryAddress').addEventListener('input', function() {
    updateCartTotal(); // Recalculate delivery fee when address changes
});

// Menu items data
const menuItems = {
    drinks: [
        {
            name: "Coca-Cola",
            price: 35,
            category: "Cold Drinks",
            sizes: {
                "250ml": 35,
                "400ml": 50
            }
        },
        {
            name: "Shawon's JuiceCola",
            price: 45,
            category: "Signature Drinks",
            description: "Our signature cola mixed with fresh fruit juice",
            sizes: {
                "350ml": 45,
                "500ml": 65
            }
        },
        {
            name: "Fresh Orange Juice",
            price: 120,
            category: "Fresh Juices",
            sizes: {
                "Regular": 120,
                "Large": 160
            }
        },
        {
            name: "Watermelon Juice",
            price: 110,
            category: "Fresh Juices",
            sizes: {
                "Regular": 110,
                "Large": 150
            }
        },
        {
            name: "Pistachio Special",
            price: 200,
            category: "Special Drinks",
            sizes: {
                "Regular": 200,
                "Large": 250
            }
        },
        {
            name: "Special Lassi",
            price: 130,
            category: "Special Drinks",
            sizes: {
                "Regular": 130,
                "Large": 180
            }
        }
    ],
    burgers: [
        {
            name: "Classic Burger",
            price: 8.99,
            description: "Our signature beef patty with fresh lettuce, tomatoes, and special sauce"
        },
        {
            name: "Double Cheese Burger",
            price: 10.99,
            description: "Double cheese with caramelized onions and bacon"
        },
        {
            name: "Veggie Burger",
            price: 9.99,
            description: "Plant-based patty with fresh vegetables and vegan sauce"
        },
        {
            name: "BBQ Burger",
            price: 11.99,
            description: "Smoky BBQ sauce, crispy onion rings, and cheddar cheese"
        },
        {
            name: "Spicy Jalapeño Burger",
            price: 10.99,
            description: "Fresh jalapeños, pepper jack cheese, and spicy mayo"
        },
        {
            name: "Mushroom Swiss Burger",
            price: 11.49,
            description: "Sautéed mushrooms, Swiss cheese, and garlic aioli"
        },
        {
            name: "Chicken Avocado Burger",
            price: 10.49,
            description: "Grilled chicken, fresh avocado, and ranch dressing"
        },
        {
            name: "Hawaiian Burger",
            price: 11.99,
            description: "Grilled pineapple, ham, and teriyaki sauce"
        },
        {
            name: "Triple Stack Burger",
            price: 14.99,
            description: "Three beef patties, triple cheese, bacon, and our special sauce"
        },
        {
            name: "BBQ Bacon Burger",
            price: 12.99,
            description: "Crispy bacon, BBQ sauce, cheddar cheese, and onion rings"
        }
    ],
    pizzas: [
        {
            name: "Margherita",
            price: 12.99,
            description: "Fresh tomatoes, mozzarella, basil, and olive oil"
        },
        {
            name: "Pepperoni",
            price: 14.99,
            description: "Classic pepperoni with mozzarella and tomato sauce"
        },
        {
            name: "BBQ Chicken",
            price: 15.99,
            description: "Grilled chicken, BBQ sauce, red onions, and cilantro"
        },
        {
            name: "Buffalo Chicken",
            price: 15.99,
            description: "Spicy buffalo chicken, blue cheese, and ranch drizzle"
        },
        {
            name: "Vegetarian",
            price: 13.99,
            description: "Assorted vegetables, mushrooms, and olives"
        },
        {
            name: "Supreme",
            price: 16.99,
            description: "Pepperoni, sausage, vegetables, and extra cheese"
        },
        {
            name: "Meat Lovers",
            price: 17.99,
            description: "Pepperoni, sausage, bacon, and ground beef"
        },
        {
            name: "Hawaiian",
            price: 14.99,
            description: "Ham, pineapple, and extra mozzarella"
        },
        {
            name: "Four Cheese",
            price: 15.99,
            description: "Mozzarella, cheddar, parmesan, and gorgonzola"
        },
        {
            name: "Spinach & Feta",
            price: 14.99,
            description: "Fresh spinach, feta cheese, and garlic olive oil"
        }
    ]
};

// Handle drink size selection
function handleDrinkSize(drinkName, basePrice) {
    const drink = menuItems.drinks.find(d => d.name === drinkName);
    if (!drink || !drink.sizes) return;

    const modal = new bootstrap.Modal(document.getElementById('orderModal'));
    modal.show();

    const sizeOptions = Object.entries(drink.sizes).map(([size, price]) => 
        `<div class="form-check">
            <input class="form-check-input" type="radio" name="drinkSize" id="${size}" value="${size}" data-price="${price}">
            <label class="form-check-label" for="${size}">
                ${size} - ৳${price}
            </label>
        </div>`
    ).join('');

    document.getElementById('orderItems').innerHTML = `
        <div class="mb-3">
            <h5>${drinkName}</h5>
            <p class="text-muted">${drink.description || ''}</p>
            <div class="size-options">
                ${sizeOptions}
            </div>
        </div>
    `;

    // Handle size selection
    document.querySelectorAll('input[name="drinkSize"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const selectedSize = this.value;
            const selectedPrice = drink.sizes[selectedSize];
            addToCart(`${drinkName} (${selectedSize})`, selectedPrice, 1);
            modal.hide();
        });
    });

    // Select first size by default
    const firstSizeInput = document.querySelector('input[name="drinkSize"]');
    if (firstSizeInput) {
        firstSizeInput.checked = true;
    }
}

// Add drink to cart
function addDrinkToCart(drinkName) {
    const drink = menuItems.drinks.find(d => d.name === drinkName);
    if (!drink) return;

    if (drink.sizes) {
        handleDrinkSize(drinkName, drink.price);
    } else {
        addToCart(drinkName, drink.price, 1);
    }
}

// Update event listeners for drink buttons
document.querySelectorAll('.drinks-section .card button').forEach(button => {
    button.addEventListener('click', function() {
        const card = this.closest('.card');
        const drinkName = card.querySelector('.card-title').textContent;
        addDrinkToCart(drinkName);
    });
});

// Combo deals data
const comboDeals = {
    'Family Feast': {
        items: [
            { type: 'pizza', quantity: 2, size: 'large' },
            { type: 'burger', quantity: 2 },
            { type: 'drink', quantity: 2 }
        ],
        originalPrice: 66.65,
        discountPrice: 49.99,
        discount: 25,
        description: '2 Large Pizzas + 2 Burgers + 2 Drinks'
    },
    'Lunch Special': {
        items: [
            { type: 'burger', quantity: 1 },
            { type: 'fries', quantity: 1 },
            { type: 'drink', quantity: 1 }
        ],
        originalPrice: 18.74,
        discountPrice: 14.99,
        discount: 20,
        description: 'Any Burger + Fries + Drink (11 AM - 3 PM)',
        timeRestriction: {
            start: '11:00',
            end: '15:00'
        }
    },
    'Pizza Party Pack': {
        items: [
            { type: 'pizza', quantity: 3, size: 'large' },
            { type: 'drink', quantity: 1, size: '2L' }
        ],
        originalPrice: 57.13,
        discountPrice: 39.99,
        discount: 30,
        description: '3 Large Pizzas + 2L Soft Drink'
    }
};

// Function to check if lunch special is available
function isLunchSpecialAvailable() {
    const now = new Date();
    const hours = now.getHours();
    return hours >= 11 && hours < 15;
}

// Handle combo order
function handleComboOrder(comboName) {
    const combo = comboDeals[comboName];
    if (!combo) {
        alert('Sorry, this combo is not available.');
        return;
    }

    // Check time restriction for Lunch Special
    if (comboName === 'Lunch Special' && !isLunchSpecialAvailable()) {
        alert('Lunch Special is only available between 11 AM and 3 PM.');
        return;
    }

    // Open order modal
    const orderModal = new bootstrap.Modal(document.getElementById('orderModal'));
    orderModal.show();

    // Add combo to cart
    addToCart(comboName, combo.discountPrice, 1, combo.description);
}

// Update event listeners for combo buttons
document.querySelectorAll('.combo-card button').forEach(button => {
    button.addEventListener('click', function() {
        const card = this.closest('.card');
        const comboName = card.querySelector('.card-title').textContent;
        handleComboOrder(comboName);
    });
});

// Update order handling
async function placeOrder() {
    if (!currentUser) {
        showLoginModal();
        return;
    }

    const order = {
        items: cart,
        totalAmount: cart.reduce((total, item) => total + (item.price * item.quantity), 0),
        deliveryFee: calculateDeliveryFee(),
        deliveryAddress: document.getElementById('deliveryAddress').value,
        paymentMethod: document.getElementById('paymentMethod').value
    };

    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(order)
        });

        if (!response.ok) {
            throw new Error('Order failed');
        }

        const data = await response.json();
        
        if (order.paymentMethod === 'card') {
            const result = await stripe.confirmCardPayment(data.clientSecret, {
                payment_method: {
                    card: cardElement,
                    billing_details: {
                        name: currentUser.name,
                        email: currentUser.email
                    }
                }
            });

            if (result.error) {
                throw new Error(result.error.message);
            }
        }

        cart = [];
        updateOrderItems();
        updateCartTotal();
        $('#orderModal').modal('hide');
        alert('Order placed successfully!');
    } catch (error) {
        alert(`Order failed: ${error.message}`);
    }
}

// Handle place order button with payment processing
document.getElementById('placeOrderBtn').addEventListener('click', async function() {
    const form = document.getElementById('orderForm');
    const paymentMethod = document.getElementById('paymentMethod').value;

    if (form.checkValidity() && cart.length > 0) {
        const orderDetails = {
            customer: {
                name: document.getElementById('customerName').value,
                phone: document.getElementById('customerPhone').value,
                address: document.getElementById('deliveryAddress').value
            },
            items: cart,
            payment: {
                method: paymentMethod,
                amount: parseFloat(document.getElementById('totalAmount').textContent.replace(/[^0-9.-]+/g, ''))
            },
            instructions: document.getElementById('specialInstructions').value,
            estimatedDeliveryTime: '30-45 minutes'
        };

        try {
            let paymentSuccess = false;

            switch(paymentMethod) {
                case 'card':
                    // Process card payment with Stripe
                    const {paymentIntent, error} = await stripe.createPaymentMethod({
                        type: 'card',
                        card: cardElement,
                        billing_details: {
                            name: orderDetails.customer.name,
                            phone: orderDetails.customer.phone
                        }
                    });

                    if (error) {
                        throw new Error(error.message);
                    }
                    paymentSuccess = true;
                    break;

                case 'bkash':
                case 'nagad':
                case 'rocket':
                    // Validate mobile payment details
                    const mobileNumber = document.getElementById('mobileNumber').value;
                    const transactionId = document.getElementById('transactionId').value;
                    
                    if (!mobileNumber || !transactionId) {
                        throw new Error('Please enter mobile number and transaction ID');
                    }
                    
                    orderDetails.payment.mobileNumber = mobileNumber;
                    orderDetails.payment.transactionId = transactionId;
                    paymentSuccess = true;
                    break;

                case 'cash':
                    paymentSuccess = true;
                    break;

                default:
                    throw new Error('Please select a payment method');
            }

            if (paymentSuccess) {
                // Here you would typically send orderDetails to your server
                alert(`Thank you for your order at Shawon's Burger Shop!\n\n` +
                      `Payment Method: ${paymentMethod.toUpperCase()}\n` +
                      `Amount: ${formatPrice(orderDetails.payment.amount)}\n` +
                      `Estimated delivery time: ${orderDetails.estimatedDeliveryTime}\n` +
                      `We will contact you at ${orderDetails.customer.phone} to confirm your order.`);
                
                cart = [];
                form.reset();
                cardElement.clear();
                bootstrap.Modal.getInstance(document.getElementById('orderModal')).hide();
                updateOrderItems();
                updateCartTotal();
            }
        } catch (error) {
            alert('Payment Error: ' + error.message);
        }
    } else {
        if (cart.length === 0) {
            alert('Please add items to your cart before placing an order.');
        } else {
            alert('Please fill in all required fields.');
        }
    }
});

// Mount the card element
cardElement.mount('#card-element');

// Handle card errors
cardElement.on('change', function(event) {
    const displayError = document.getElementById('card-errors');
    if (event.error) {
        displayError.textContent = event.error.message;
    } else {
        displayError.textContent = '';
    }
});

// Mock reviews data
const mockReviews = [
    {
        id: 1,
        name: 'Rahim Ahmed',
        rating: 5,
        text: 'Best burgers in Chittagong! The Classic Burger is absolutely delicious, and the service is always fast and friendly.',
        date: '2025-03-07',
        helpful: 12
    },
    {
        id: 2,
        name: 'Fatima Khan',
        rating: 4,
        text: 'Love their Family Feast deal! Great value for money. The pizzas are amazing, though the delivery took a bit longer than expected.',
        date: '2025-03-06',
        helpful: 8
    },
    {
        id: 3,
        name: 'Mohammad Hassan',
        rating: 5,
        text: 'The Spicy Jalapeño burger is perfect for those who love spicy food. Definitely coming back for more!',
        date: '2025-03-05',
        helpful: 15
    }
];

// Initialize reviews
let currentPage = 1;
const reviewsPerPage = 3;

// Handle star rating selection
document.querySelectorAll('.rating i').forEach(star => {
    star.addEventListener('mouseover', function() {
        const rating = this.dataset.rating;
        updateStars(rating, 'hover');
    });

    star.addEventListener('mouseout', function() {
        const currentRating = document.getElementById('ratingValue').value;
        updateStars(currentRating || 0, 'hover');
    });

    star.addEventListener('click', function() {
        const rating = this.dataset.rating;
        document.getElementById('ratingValue').value = rating;
        updateStars(rating, 'select');
    });
});

// Update star display
function updateStars(rating, action) {
    document.querySelectorAll('.rating i').forEach(star => {
        const starRating = star.dataset.rating;
        if (action === 'hover') {
            star.className = starRating <= rating ? 'fas fa-star' : 'far fa-star';
        } else if (action === 'select') {
            star.className = starRating <= rating ? 'fas fa-star' : 'far fa-star';
        }
    });
}

// Format date
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

// Generate stars HTML
function generateStars(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        stars += `<i class="${i <= rating ? 'fas' : 'far'} fa-star"></i>`;
    }
    return stars;
}

// Display reviews
function displayReviews(page = 1) {
    const reviewsList = document.getElementById('reviewsList');
    const start = (page - 1) * reviewsPerPage;
    const end = start + reviewsPerPage;
    const reviews = mockReviews.slice(start, end);

    reviews.forEach(review => {
        const reviewCard = document.createElement('div');
        reviewCard.className = 'card review-card';
        reviewCard.innerHTML = `
            <div class="card-body">
                <div class="review-header">
                    <div>
                        <h5 class="review-author">${review.name}</h5>
                        <div class="review-rating">
                            ${generateStars(review.rating)}
                        </div>
                    </div>
                    <div class="review-date">${formatDate(review.date)}</div>
                </div>
                <p class="review-text">${review.text}</p>
                <div class="review-helpful">
                    <span>${review.helpful} people found this helpful</span>
                    <button onclick="markHelpful(${review.id})">Helpful</button>
                </div>
            </div>
        `;
        reviewsList.appendChild(reviewCard);
    });

    // Show/hide load more button
    const loadMoreBtn = document.getElementById('loadMoreReviews');
    if (end >= mockReviews.length) {
        loadMoreBtn.style.display = 'none';
    } else {
        loadMoreBtn.style.display = 'block';
    }
}

// Handle load more button
document.getElementById('loadMoreReviews').addEventListener('click', function() {
    currentPage++;
    displayReviews(currentPage);
});

// Handle review form submission
document.getElementById('reviewForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const rating = document.getElementById('ratingValue').value;
    const name = document.getElementById('reviewName').value;
    const text = document.getElementById('reviewText').value;

    if (!rating || !name || !text) {
        alert('Please fill in all fields and provide a rating.');
        return;
    }

    // Create new review
    const newReview = {
        id: mockReviews.length + 1,
        name: name,
        rating: parseInt(rating),
        text: text,
        date: new Date().toISOString().split('T')[0],
        helpful: 0
    };

    // Add to mock data
    mockReviews.unshift(newReview);

    // Reset form
    this.reset();
    document.querySelectorAll('.rating i').forEach(star => {
        star.className = 'far fa-star';
    });
    document.getElementById('ratingValue').value = '';

    // Refresh reviews display
    document.getElementById('reviewsList').innerHTML = '';
    currentPage = 1;
    displayReviews();

    alert('Thank you for your review!');
});

// Mark review as helpful
function markHelpful(reviewId) {
    const review = mockReviews.find(r => r.id === reviewId);
    if (review) {
        review.helpful++;
        document.getElementById('reviewsList').innerHTML = '';
        displayReviews(currentPage);
    }
}

// Initialize reviews on page load
document.addEventListener('DOMContentLoaded', function() {
    displayReviews();
});

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Contact form submission handling
const contactForm = document.querySelector('#contact form');
if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        alert('Thank you for your message! We will get back to you soon.');
        this.reset();
    });
}

// Navbar background change on scroll
window.addEventListener('scroll', function() {
    if (window.scrollY > 50) {
        document.querySelector('.navbar').classList.add('bg-dark');
    } else {
        document.querySelector('.navbar').classList.remove('bg-dark');
    }
});

// Shopping cart to store ordered items
let cart = [];

// Function to format price in Bangladeshi Taka
function formatPrice(price) {
    return '৳' + parseFloat(price).toFixed(2);
}

// Function to calculate delivery fee based on order total
function calculateDeliveryFee(subtotal) {
    if (subtotal >= 1000) {
        return 0; // Free delivery for orders over ৳1000
    }
    
    // Get delivery address and calculate distance (this would typically be done with a mapping service)
    const address = document.getElementById('deliveryAddress').value.toLowerCase();
    
    if (address.includes('gec') || address.includes('agrabad')) {
        return 30; // Within 2km
    } else if (address.includes('nasirabad')) {
        return 50; // 2-5km
    } else if (address.includes('halishahar')) {
        return 70; // 5-8km
    } else {
        return 100; // Above 8km
    }
}

// Function to update cart total and payment amounts
function updateCartTotal() {
    const subtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    const deliveryFee = calculateDeliveryFee(subtotal);
    const total = subtotal + deliveryFee;

    document.getElementById('subtotal').textContent = formatPrice(subtotal);
    document.getElementById('deliveryFee').textContent = formatPrice(deliveryFee);
    document.getElementById('totalAmount').textContent = formatPrice(total);

    // Update payment amounts in instructions
    document.querySelectorAll('.payment-amount').forEach(element => {
        element.textContent = formatPrice(total);
    });
}

// Admin functionality
function showAdminPanel() {
    const adminNav = document.createElement('li');
    adminNav.className = 'nav-item';
    adminNav.innerHTML = '<a class="nav-link" href="/admin.html">Admin Panel</a>';
    document.querySelector('.navbar-nav').appendChild(adminNav);
}

// Logout function
function logout() {
    handleLogout();
}
