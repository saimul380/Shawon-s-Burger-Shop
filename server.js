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
app.use('/api/auth', async (req, res, next) => {
    try {
        // Even if DB isn't connected yet, try to use the real auth handlers
        // This allows login/signup to work once DB connects
        const authRoutes = require('./routes/auth');
        
        // Create a mini express router just for this request
        const router = express.Router();
        router.use('/', authRoutes);
        
        // Process the request with the auth routes
        router(req, res, next);
    } catch (error) {
        console.error('Auth route error:', error);
        res.status(503).json({ 
            error: 'Service Unavailable', 
            message: 'Authentication services temporarily unavailable',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
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

// Test route to create and verify admin login
app.get('/test-admin-login', async (req, res) => {
    try {
        console.log('Starting admin account creation/verification...');
        
        // Delete existing admin user if it exists
        const User = require('./models/User');
        const bcrypt = require('bcryptjs');
        const jwt = require('jsonwebtoken');
        
        const existingAdmin = await User.findOne({ email: 'admin@shawonburger.com' });
        if (existingAdmin) {
            console.log('Removing existing admin account...');
            await User.deleteOne({ email: 'admin@shawonburger.com' });
        }
        
        // Create a fresh admin user with known credentials
        console.log('Creating fresh admin account...');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        const admin = new User({
            name: 'Admin User',
            email: 'admin@shawonburger.com',
            password: 'admin123', // Will be hashed by the pre-save hook
            phone: '1234567890',
            address: 'Admin Address',
            role: 'admin'
        });
        
        await admin.save();
        console.log('Admin saved to database, ID:', admin._id);
        
        // Verify we can retrieve the admin
        const savedAdmin = await User.findOne({ email: 'admin@shawonburger.com' });
        if (!savedAdmin) {
            throw new Error('Failed to find admin after saving');
        }
        
        console.log('Admin retrieved successfully');
        
        // Test password verification
        console.log('Testing password verification...');
        const passwordMatches = await bcrypt.compare('admin123', savedAdmin.password);
        
        if (!passwordMatches) {
            console.log('Password verification failed!');
            console.log('Stored password hash:', savedAdmin.password);
            return res.status(500).json({ error: 'Admin created but password verification failed' });
        }
        
        console.log('Password verification successful!');
        
        // Create a token for testing
        const token = jwt.sign(
            { userId: savedAdmin._id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        
        return res.json({ 
            message: 'Admin created and verified successfully',
            adminId: savedAdmin._id,
            token
        });
    } catch (error) {
        console.error('Admin creation error:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Special route for manual login tests
app.post('/test-manual-login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('Manual login attempt:', { email, passwordLength: password?.length });
        
        const User = require('./models/User');
        const bcrypt = require('bcryptjs');
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(401).json({ 
                error: 'User not found',
                email
            });
        }
        
        // Try both comparison methods
        const manualCompare = await bcrypt.compare(password, user.password);
        const modelCompare = await user.comparePassword(password);
        
        if (manualCompare) {
            const jwt = require('jsonwebtoken');
            const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
            
            res.json({
                success: true,
                token,
                user: { 
                    id: user._id, 
                    name: user.name,
                    email,
                    role: user.role
                }
            });
        } else {
            res.status(401).json({
                error: 'Invalid password',
                manualCompare,
                modelCompare,
                providedPassword: password,
                hashedPassword: user.password
            });
        }
    } catch (error) {
        console.error('Manual login error:', error);
        res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
});

// Create test user route
app.get('/create-test-user', async (req, res) => {
    try {
        const User = require('./models/User');
        const bcrypt = require('bcryptjs');
        
        const email = 'test@example.com';
        const hashedPassword = await bcrypt.hash('password123', 10);
        
        // Check if user exists
        let user = await User.findOne({ email });
        
        if (user) {
            // Update password
            user = await User.findOneAndUpdate(
                { email },
                { password: hashedPassword },
                { new: true }
            );
        } else {
            // Create new user
            user = await User.create({
                name: 'Test User',
                email,
                password: hashedPassword,
                phone: '123456789',
                address: 'Test Address',
                role: 'user'
            });
        }
        
        res.json({
            success: true,
            message: 'Test user created/updated',
            loginInfo: {
                email: 'test@example.com',
                password: 'password123'
            }
        });
    } catch (error) {
        console.error('Create test user error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
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
