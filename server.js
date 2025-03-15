require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const compression = require('compression');
const authRoutes = require('./routes/auth');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const reviewRoutes = require('./routes/reviews');
const User = require('./models/User');

const app = express();

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json());

// Serve static files with caching
app.use(express.static(__dirname, {
    maxAge: '1h',
    etag: true
}));
app.use('/temp', express.static(path.join(__dirname, 'temp')));

// Create temp directory for exports if it doesn't exist
const fs = require('fs');
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

// Create admin user function
async function createAdminUser() {
    try {
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
        console.error('Error creating admin user:', error);
    }
}

// Database connection with retry logic
const connectDB = async (retries = 5) => {
    const mongoURI = process.env.MONGODB_URI;
    console.log('Starting MongoDB connection attempt...');
    console.log('Node Environment:', process.env.NODE_ENV);
    
    if (!mongoURI) {
        throw new Error('MONGODB_URI environment variable is not set');
    }

    // Log the URI format (without credentials)
    const sanitizedUri = mongoURI.replace(/(mongodb\+srv:\/\/)([^@]+)(@)/, '$1*****$3');
    console.log('MongoDB URI format:', sanitizedUri);

    mongoose.set('strictQuery', false);

    for (let i = 0; i < retries; i++) {
        try {
            console.log(`Connection attempt ${i + 1} of ${retries}`);
            
            const connection = await mongoose.connect(mongoURI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                serverSelectionTimeoutMS: 30000,
                socketTimeoutMS: 45000,
                connectTimeoutMS: 30000,
                keepAlive: true,
                keepAliveInitialDelay: 300000,
                maxPoolSize: 50,
                minPoolSize: 10,
                maxIdleTimeMS: 30000,
                family: 4
            });

            console.log('MongoDB Connected Successfully');
            console.log('MongoDB version:', connection.connection.version);
            console.log('MongoDB host:', connection.connection.host);
            
            // Set up connection event handlers
            mongoose.connection.on('error', err => {
                console.error('MongoDB connection error:', err);
            });

            mongoose.connection.on('disconnected', () => {
                console.log('MongoDB disconnected. Attempting to reconnect...');
            });

            mongoose.connection.on('reconnected', () => {
                console.log('MongoDB reconnected successfully');
            });

            await createAdminUser();
            return true;
        } catch (err) {
            console.error(`MongoDB connection attempt ${i + 1} failed:`, {
                message: err.message,
                code: err.code,
                name: err.name,
                stack: err.stack
            });
            
            if (i === retries - 1) {
                console.error('All MongoDB connection attempts failed');
                throw err;
            }
            
            const waitTime = Math.min(1000 * Math.pow(2, i), 10000);
            console.log(`Waiting ${waitTime}ms before next attempt...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
    return false;
};

// Initialize server only after DB connection
async function startServer() {
    try {
        await connectDB();
        
        // API Routes
        app.use('/api/auth', authRoutes);
        app.use('/api/orders', orderRoutes);
        app.use('/api/admin', adminRoutes);
        app.use('/api', reviewRoutes);

        // Basic health check endpoint
        app.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
            });
        });

        // Serve HTML files
        app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'index.html'));
        });

        app.get('/admin', (req, res) => {
            res.sendFile(path.join(__dirname, 'admin.html'));
        });

        // Handle all other routes by serving index.html (for client-side routing)
        app.get('*', (req, res) => {
            if (req.path.startsWith('/api')) {
                res.status(404).json({ error: 'API endpoint not found' });
            } else {
                res.sendFile(path.join(__dirname, 'index.html'));
            }
        });

        // Error handling middleware
        app.use((err, req, res, next) => {
            console.error('Error:', {
                message: err.message,
                stack: err.stack,
                path: req.path,
                method: req.method
            });
            res.status(500).json({ error: 'Something went wrong!' });
        });

        // Start server
        const PORT = process.env.PORT || 3000;
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server is running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV}`);
            console.log(`MongoDB Status: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
        });

        // Handle server errors
        server.on('error', (err) => {
            console.error('Server error:', err);
        });

        // Handle process termination
        const gracefulShutdown = async () => {
            console.log('Received shutdown signal. Starting graceful shutdown...');
            
            try {
                // Close server first
                await new Promise((resolve) => {
                    server.close(resolve);
                });
                console.log('Server closed successfully');

                // Then close database connection
                await mongoose.connection.close();
                console.log('Database connection closed successfully');

                process.exit(0);
            } catch (err) {
                console.error('Error during shutdown:', err);
                process.exit(1);
            }
        };

        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGINT', gracefulShutdown);

    } catch (error) {
        console.error('Failed to start server:', {
            message: error.message,
            stack: error.stack
        });
        process.exit(1);
    }
}

// Start the server
console.log('Starting application...');
startServer().catch(err => {
    console.error('Fatal error during startup:', err);
    process.exit(1);
});
