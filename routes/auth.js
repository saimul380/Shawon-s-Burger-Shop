const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

// Register
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, phone, address } = req.body;
        
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const user = new User({
            name,
            email,
            password,
            phone,
            address
        });

        await user.save();
        
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
        res.status(201).json({ token, user: { id: user._id, name, email, role: user.role } });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('Login attempt:', { email, passwordProvided: !!password });
        
        if (!email || !password) {
            return res.status(400).json({ 
                error: 'Email and password are required',
                received: { emailProvided: !!email, passwordProvided: !!password }
            });
        }
        
        const user = await User.findOne({ email });
        
        if (!user) {
            console.log(`User not found: ${email}`);
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        console.log('User found, comparing password...');
        
        // Try direct bcrypt compare instead of using the model method
        const bcrypt = require('bcryptjs');
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            console.log('Password comparison failed');
            return res.status(401).json({ 
                error: 'Invalid email or password',
                message: 'Password does not match'
            });
        }
        
        console.log('Login successful, generating token...');
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
        res.json({ 
            token, 
            user: { 
                id: user._id, 
                name: user.name, 
                email, 
                role: user.role 
            } 
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(400).json({ 
            error: error.message,
            stack: error.stack
        });
    }
});

// Get user profile
router.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        res.json(user);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update user profile
router.patch('/profile', auth, async (req, res) => {
    const updates = Object.keys(req.body);
    const allowedUpdates = ['name', 'phone', 'address'];
    const isValidOperation = updates.every(update => allowedUpdates.includes(update));

    if (!isValidOperation) {
        return res.status(400).json({ error: 'Invalid updates' });
    }

    try {
        updates.forEach(update => req.user[update] = req.body[update]);
        await req.user.save();
        res.json(req.user);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
