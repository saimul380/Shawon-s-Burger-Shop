const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const { auth } = require('../middleware/auth');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Create new order
router.post('/', auth, async (req, res) => {
    try {
        const { items, totalAmount, deliveryFee, deliveryAddress, paymentMethod } = req.body;
        
        const order = new Order({
            user: req.user._id,
            items,
            totalAmount,
            deliveryFee,
            deliveryAddress,
            paymentMethod
        });

        if (paymentMethod === 'card') {
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round((totalAmount + deliveryFee) * 100),
                currency: 'bdt',
                metadata: { orderId: order._id.toString() }
            });
            
            await order.save();
            res.json({ clientSecret: paymentIntent.client_secret, order });
        } else {
            await order.save();
            res.status(201).json(order);
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get user's orders
router.get('/my-orders', auth, async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user._id })
            .sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get order by ID
router.get('/:id', auth, async (req, res) => {
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            user: req.user._id
        });
        
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        res.json(order);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update payment status (webhook endpoint for Stripe)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const sig = req.headers['stripe-signature'];
        const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);

        if (event.type === 'payment_intent.succeeded') {
            const orderId = event.data.object.metadata.orderId;
            await Order.findByIdAndUpdate(orderId, {
                paymentStatus: 'completed',
                orderStatus: 'confirmed'
            });
        }

        res.json({ received: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
