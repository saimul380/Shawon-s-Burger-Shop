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
app.use(express.static(__dirname));

// Create temp directory
const fs = require('fs');
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

// Log environment
console.log('Starting server with environment:', {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    mongoDbConfigured: !!process.env.MONGODB_URI
});

// Database connection
const connectToMongoDB = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI environment variable is not set');
        }

        // Log sanitized connection string
        const sanitizedUri = process.env.MONGODB_URI.replace(/(mongodb\+srv:\/\/)([^@]+)(@)/, '$1****$3');
        console.log('Attempting MongoDB connection with URI:', sanitizedUri);

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB connected successfully');

        // Create admin user
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

        return true;
    } catch (error) {
        console.error('MongoDB connection error:', {
            message: error.message,
            name: error.name,
            stack: error.stack
        });
        return false;
    }
};

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', reviewRoutes);

// Health check
app.get('/health', (req, res) => {
    const mongoStatus = mongoose.connection.readyState;
    res.json({
        status: 'ok',
        mongo: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoStatus],
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

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server running on port ${PORT}`);
    
    // Connect to MongoDB after server starts
    const connected = await connectToMongoDB();
    if (!connected) {
        console.error('Failed to connect to MongoDB. Server will continue running but database operations will fail.');
    }
});

// Handle server errors
server.on('error', (err) => {
    console.error('Server error:', err);
});
