const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { generateOTP, setOTPExpiry, sendVerificationEmail, verifyOTP } = require('../utils/emailService');

// Register
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, phone, address } = req.body;
        
        // Input validation
        if (!name || !email || !password || !phone || !address) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        // Check if email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Generate OTP for verification
        const otp = generateOTP();
        const otpExpiry = setOTPExpiry();
        
        // Create new user with OTP
        const user = new User({
            name,
            email,
            password,
            phone,
            address,
            otp: {
                code: otp,
                expiry: otpExpiry
            }
        });

        // Save user to database
        await user.save();
        
        // Send verification email
        const emailSent = await sendVerificationEmail(email, otp, name);
        
        if (!emailSent) {
            return res.status(500).json({ error: 'Failed to send verification email' });
        }
        
        // Return success with user ID for verification
        res.status(201).json({ 
            success: true,
            message: 'Registration successful! Please check your email for verification code',
            userId: user._id
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
    try {
        const { userId, otp } = req.body;
        
        if (!userId || !otp) {
            return res.status(400).json({ error: 'User ID and OTP are required' });
        }
        
        // Find user by ID
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Verify OTP
        if (!verifyOTP(user, otp)) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }
        
        // Mark user as verified and clear OTP
        user.verified = true;
        user.otp = undefined;
        await user.save();
        
        // Generate token for auto-login after verification
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        // Return success with token and user info
        res.json({
            success: true,
            message: 'Account verified successfully',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Resend OTP
router.post('/resend-otp', async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }
        
        // Find user by ID
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Check if user is already verified
        if (user.verified) {
            return res.status(400).json({ error: 'User is already verified' });
        }
        
        // Generate new OTP
        const otp = generateOTP();
        const otpExpiry = setOTPExpiry();
        
        // Update user's OTP
        user.otp = {
            code: otp,
            expiry: otpExpiry
        };
        await user.save();
        
        // Send verification email
        const emailSent = await sendVerificationEmail(user.email, otp, user.name);
        
        if (!emailSent) {
            return res.status(500).json({ error: 'Failed to send verification email' });
        }
        
        // Return success
        res.json({
            success: true,
            message: 'Verification code resent. Please check your email'
        });
    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('Login attempt with:', { email, passwordLength: password?.length });
        
        // Input validation
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        
        // Find user by email
        const user = await User.findOne({ email });
        
        if (!user) {
            console.log(`User not found with email: ${email}`);
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        // Check if user is verified
        if (!user.verified) {
            // Generate new OTP for unverified user
            const otp = generateOTP();
            const otpExpiry = setOTPExpiry();
            
            // Update user's OTP
            user.otp = {
                code: otp,
                expiry: otpExpiry
            };
            await user.save();
            
            // Send verification email
            await sendVerificationEmail(user.email, otp, user.name);
            
            return res.status(403).json({
                error: 'Account not verified',
                message: 'Please verify your account. A new verification code has been sent to your email',
                userId: user._id
            });
        }
        
        console.log('User found, comparing password...');
        
        // Use direct bcrypt comparison
        const bcrypt = require('bcryptjs');
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            console.log('Password comparison failed for user:', email);
            console.log('User password hash:', user.password);
            console.log('Input password:', password);
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        console.log('Login successful for user:', email);
        
        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        // Send successful response
        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Get user profile
router.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password -otp');
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
