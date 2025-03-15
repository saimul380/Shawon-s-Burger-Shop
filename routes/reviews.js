const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const { auth, isAdmin } = require('../middleware/auth');
const { createObjectCsvWriter } = require('csv-writer');
const path = require('path');

// Get all reviews (admin)
router.get('/admin/reviews', auth, isAdmin, async (req, res) => {
    try {
        const { rating, page = 1, limit = 10 } = req.query;
        const query = rating && rating !== 'all' ? { rating: parseInt(rating) } : {};
        
        const reviews = await Review.find(query)
            .populate('user', 'name email')
            .populate('order', 'orderNumber totalAmount')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);
            
        const total = await Review.countDocuments(query);
        
        // Get rating statistics
        const stats = await Review.aggregate([
            {
                $group: {
                    _id: null,
                    averageRating: { $avg: '$rating' },
                    totalReviews: { $sum: 1 },
                    ratingCounts: {
                        $push: {
                            rating: '$rating',
                            count: 1
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    averageRating: 1,
                    totalReviews: 1,
                    ratingCounts: {
                        $reduce: {
                            input: '$ratingCounts',
                            initialValue: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
                            in: {
                                $mergeObjects: [
                                    '$$value',
                                    { ['$$this.rating']: { $add: ['$$value.$$this.rating', 1] } }
                                ]
                            }
                        }
                    }
                }
            }
        ]);
        
        res.json({
            reviews,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            stats: stats[0] || {
                averageRating: 0,
                totalReviews: 0,
                ratingCounts: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
            }
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Respond to a review (admin)
router.post('/admin/reviews/:id/respond', auth, isAdmin, async (req, res) => {
    try {
        const { text } = req.body;
        
        const review = await Review.findByIdAndUpdate(
            req.params.id,
            {
                'adminResponse': {
                    text,
                    respondedAt: new Date(),
                    respondedBy: req.user._id
                }
            },
            { new: true }
        ).populate('user', 'name email')
         .populate('order', 'orderNumber totalAmount');
        
        if (!review) {
            return res.status(404).json({ error: 'Review not found' });
        }
        
        res.json(review);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete a review (admin)
router.delete('/admin/reviews/:id', auth, isAdmin, async (req, res) => {
    try {
        const review = await Review.findByIdAndDelete(req.params.id);
        
        if (!review) {
            return res.status(404).json({ error: 'Review not found' });
        }
        
        res.json({ message: 'Review deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Export reviews to CSV (admin)
router.get('/admin/reviews/export', auth, isAdmin, async (req, res) => {
    try {
        const reviews = await Review.find()
            .populate('user', 'name email')
            .populate('order', 'orderNumber totalAmount')
            .sort({ createdAt: -1 });
            
        const csvWriter = createObjectCsvWriter({
            path: path.join(__dirname, '../temp/reviews-export.csv'),
            header: [
                { id: 'date', title: 'Date' },
                { id: 'customerName', title: 'Customer Name' },
                { id: 'customerEmail', title: 'Customer Email' },
                { id: 'orderNumber', title: 'Order Number' },
                { id: 'rating', title: 'Rating' },
                { id: 'comment', title: 'Comment' },
                { id: 'adminResponse', title: 'Admin Response' },
                { id: 'responseDate', title: 'Response Date' }
            ]
        });
        
        const records = reviews.map(review => ({
            date: review.createdAt.toLocaleDateString(),
            customerName: review.user.name,
            customerEmail: review.user.email,
            orderNumber: review.order.orderNumber,
            rating: review.rating,
            comment: review.comment,
            adminResponse: review.adminResponse?.text || '',
            responseDate: review.adminResponse?.respondedAt?.toLocaleDateString() || ''
        }));
        
        await csvWriter.writeRecords(records);
        
        res.download(path.join(__dirname, '../temp/reviews-export.csv'), 'reviews-export.csv', (err) => {
            if (err) {
                console.error('Error downloading file:', err);
            }
            // Clean up the temporary file
            require('fs').unlink(path.join(__dirname, '../temp/reviews-export.csv'), (err) => {
                if (err) console.error('Error deleting temporary file:', err);
            });
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get reviews for a specific order (customer & admin)
router.get('/orders/:orderId/reviews', auth, async (req, res) => {
    try {
        const reviews = await Review.find({ order: req.params.orderId })
            .populate('user', 'name')
            .sort({ createdAt: -1 });
            
        res.json(reviews);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Add a review for an order (customer)
router.post('/orders/:orderId/reviews', auth, async (req, res) => {
    try {
        const { rating, comment, images } = req.body;
        
        // Check if user has already reviewed this order
        const existingReview = await Review.findOne({
            user: req.user._id,
            order: req.params.orderId
        });
        
        if (existingReview) {
            return res.status(400).json({ error: 'You have already reviewed this order' });
        }
        
        const review = new Review({
            user: req.user._id,
            order: req.params.orderId,
            rating,
            comment,
            images: images || []
        });
        
        await review.save();
        
        const populatedReview = await Review.findById(review._id)
            .populate('user', 'name')
            .populate('order', 'orderNumber');
            
        res.status(201).json(populatedReview);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update a review (customer)
router.patch('/reviews/:id', auth, async (req, res) => {
    try {
        const { rating, comment, images } = req.body;
        
        const review = await Review.findOne({
            _id: req.params.id,
            user: req.user._id
        });
        
        if (!review) {
            return res.status(404).json({ error: 'Review not found' });
        }
        
        // Only allow updates within 24 hours of posting
        const hoursSincePosted = (Date.now() - review.createdAt) / (1000 * 60 * 60);
        if (hoursSincePosted > 24) {
            return res.status(400).json({ error: 'Reviews can only be updated within 24 hours of posting' });
        }
        
        review.rating = rating || review.rating;
        review.comment = comment || review.comment;
        review.images = images || review.images;
        
        await review.save();
        
        const populatedReview = await Review.findById(review._id)
            .populate('user', 'name')
            .populate('order', 'orderNumber');
            
        res.json(populatedReview);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
