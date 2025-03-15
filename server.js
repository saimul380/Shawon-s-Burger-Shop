require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const compression = require('compression');

// Start with just loading the Express app
const app = express();

// Basic middleware
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.static(__dirname));

// Create temp directory
const fs = require('fs');
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

// Log environment variables (sanitized)
console.log('Starting server with environment:', {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT || 3000,
    mongoDbConfigured: !!process.env.MONGODB_URI
});

// Global error handler for all route handlers
const safeHandler = (fn) => async (req, res, next) => {
    try {
        await fn(req, res, next);
    } catch (error) {
        console.error('Route handler error:', {
            path: req.path,
            method: req.method,
            error: error.message
        });
        res.status(500).json({ 
            error: 'Server error', 
            message: 'Operation failed',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Set up minimal API routes that work without DB
app.use('/api/auth', (req, res) => {
    res.status(503).json({ 
        error: 'Service Unavailable', 
        message: 'Authentication services temporarily unavailable' 
    });
});

app.use('/api/orders', (req, res) => {
    res.status(503).json({ 
        error: 'Service Unavailable', 
        message: 'Order services temporarily unavailable' 
    });
});

app.use('/api/admin', (req, res) => {
    res.status(503).json({ 
        error: 'Service Unavailable', 
        message: 'Admin services temporarily unavailable' 
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    const mongoStatus = mongoose.connection.readyState;
    const statusNames = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    
    res.json({
        status: 'ok',
        server: 'running',
        mongo: statusNames[mongoStatus] || 'unknown',
        routes: 'full', 
        timestamp: new Date().toISOString()
    });
});

// Serve static files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Handle 404
app.use((req, res) => {
    if (req.path.startsWith('/api')) {
        res.status(404).json({ error: 'API endpoint not found' });
    } else {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Server error:', {
        message: err.message,
        path: req.path,
        method: req.method,
        stack: err.stack
    });
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server first - before trying DB connection
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    
    // Now attempt to connect to MongoDB
    connectToMongoDB()
        .then(isConnected => {
            if (isConnected) {
                console.log('MongoDB connected successfully - enabling full API functionality');
                // Only enable real routes after DB connection
                setupFullRoutes();
            } else {
                console.log('Server running with limited functionality (no database connection)');
            }
        })
        .catch(err => {
            console.error('Unhandled error during MongoDB connection:', err);
        });
});

// Handle server errors
server.on('error', (err) => {
    console.error('Server error:', err);
});

// Replace placeholder routes with real ones after DB connection
function setupFullRoutes() {
    try {
        // Remove placeholder routes by path pattern matching
        let routerIndex = -1;
        for (let i = 0; i < app._router.stack.length; i++) {
            const layer = app._router.stack[i];
            if (layer && layer.regexp && 
                (layer.regexp.toString().includes('/api/auth') || 
                 layer.regexp.toString().includes('/api/orders') || 
                 layer.regexp.toString().includes('/api/admin'))) {
                routerIndex = i;
                break;
            }
        }
        
        if (routerIndex !== -1) {
            // Remove the middleware placeholders
            app._router.stack.splice(routerIndex, 3); // Remove 3 placeholders
        }
        
        // Add real routes
        const authRoutes = require('./routes/auth');
        const orderRoutes = require('./routes/orders');
        const adminRoutes = require('./routes/admin');
        const reviewRoutes = require('./routes/reviews');
        
        app.use('/api/auth', authRoutes);
        app.use('/api/orders', orderRoutes);
        app.use('/api/admin', adminRoutes);
        app.use('/api', reviewRoutes);
        
        console.log('Full API routes enabled successfully');
    } catch (error) {
        console.error('Error setting up full routes:', error.message);
    }
}

// Database connection function
async function connectToMongoDB() {
    // Default to no connection
    if (!process.env.MONGODB_URI) {
        console.error('MONGODB_URI environment variable is not set');
        return false;
    }

    try {
        // Log sanitized connection string
        const sanitizedUri = process.env.MONGODB_URI.replace(/(mongodb\+srv:\/\/)([^@]+)(@)/, '$1****$3');
        console.log('Attempting MongoDB connection with URI:', sanitizedUri);

        // Set mongoose options
        mongoose.set('strictQuery', false);
        
        // Connect with retry logic
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                console.log(`Connection attempt ${attempt} of 3`);
                await mongoose.connect(process.env.MONGODB_URI, {
                    serverSelectionTimeoutMS: 5000
                });
                
                console.log('MongoDB connected successfully');
                
                // Only try to create admin user if we successfully connected
                await createAdminUser();
                
                return true;
            } catch (err) {
                console.error(`MongoDB connection attempt ${attempt} failed:`, err.message);
                
                if (attempt < 3) {
                    const delay = attempt * 1000;
                    console.log(`Waiting ${delay}ms before next attempt...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        console.error('All MongoDB connection attempts failed');
        return false;
    } catch (error) {
        console.error('MongoDB connection error:', {
            message: error.message,
            name: error.name
        });
        return false;
    }
}

// Create admin user function
async function createAdminUser() {
    try {
        const User = require('./models/User');
        const adminExists = await User.findOne({ email: 'admin@shawonburger.com' });
        if (!adminExists) {
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await User.create({
                name: 'Admin',
                email: 'admin@shawonburger.com',
                password: hashedPassword,
                role: 'admin'
            });
            console.log('Admin user created successfully');
        }
    } catch (error) {
        console.error('Error creating admin user:', error.message);
    }
}
