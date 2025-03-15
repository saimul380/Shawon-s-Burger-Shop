const nodemailer = require('nodemailer');

// Configure email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'shawonburger@gmail.com', // Replace with your email address
        pass: process.env.EMAIL_PASSWORD || 'app_password_here' // Replace with your app password
    }
});

// Generate a random numeric string of specified length
const generateRandomString = (length) => {
    const digits = '0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += digits.charAt(Math.floor(Math.random() * digits.length));
    }
    return result;
};

// Generate a 6-digit OTP
const generateOTP = () => {
    return generateRandomString(6);
};

// Set the OTP expiry time (15 minutes from now)
const setOTPExpiry = () => {
    return new Date(Date.now() + 15 * 60 * 1000); // 15 minutes in milliseconds
};

// Send OTP verification email
const sendVerificationEmail = async (email, otp, name) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER || 'shawonburger@gmail.com',
            to: email,
            subject: 'Your Verification Code for Shawon Burger Shop',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h1 style="color: #f44336;">Shawon Burger Shop</h1>
                    </div>
                    <div style="margin-bottom: 30px;">
                        <p>Hello ${name},</p>
                        <p>Thank you for registering with Shawon Burger Shop. Please use the following verification code to complete your registration:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <div style="font-size: 24px; font-weight: bold; letter-spacing: 5px; background-color: #f5f5f5; padding: 15px; border-radius: 5px;">${otp}</div>
                        </div>
                        <p>This code will expire in 15 minutes.</p>
                        <p>If you did not request this code, please ignore this email.</p>
                    </div>
                    <div style="text-align: center; font-size: 12px; color: #757575; margin-top: 30px;">
                        <p>&copy; ${new Date().getFullYear()} Shawon Burger Shop. All rights reserved.</p>
                    </div>
                </div>
            `
        };

        console.log(`Attempting to send verification email to ${email} with OTP: ${otp}`);
        await transporter.sendMail(mailOptions);
        console.log(`Verification email sent successfully to ${email}`);
        return true;
    } catch (error) {
        console.error('Error sending verification email:', error);
        return false;
    }
};

// Verify OTP
const verifyOTP = (user, enteredOTP) => {
    if (!user.otp || !user.otp.code || !user.otp.expiry) {
        return false;
    }

    // Check if OTP has expired
    if (new Date() > new Date(user.otp.expiry)) {
        return false;
    }

    // Check if OTP matches
    return user.otp.code === enteredOTP;
};

module.exports = {
    generateOTP,
    setOTPExpiry,
    sendVerificationEmail,
    verifyOTP
};
