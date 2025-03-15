const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        required: true,
        trim: true,
        maxLength: 500
    },
    images: [{
        type: String,
        validate: {
            validator: function(url) {
                return /^https?:\/\/.*\.(png|jpg|jpeg|gif)$/i.test(url);
            },
            message: 'Invalid image URL format'
        }
    }],
    adminResponse: {
        text: String,
        respondedAt: Date,
        respondedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }
}, {
    timestamps: true
});

// Index for efficient querying
reviewSchema.index({ rating: 1, createdAt: -1 });
reviewSchema.index({ user: 1, order: 1 }, { unique: true });

// Virtual for calculating time since review
reviewSchema.virtual('timeSince').get(function() {
    const now = new Date();
    const diff = now - this.createdAt;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
});

// Method to check if admin has responded
reviewSchema.methods.hasAdminResponse = function() {
    return !!this.adminResponse && !!this.adminResponse.text;
};

const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;
