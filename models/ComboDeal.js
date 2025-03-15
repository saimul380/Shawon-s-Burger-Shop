const mongoose = require('mongoose');

const comboDealSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    items: [{
        menuItem: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'MenuItem',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        }
    }],
    image: {
        type: String,
        required: true
    },
    totalPrice: {
        type: Number,
        required: true,
        min: 0
    },
    discountedPrice: {
        type: Number,
        required: true,
        min: 0
    },
    validFrom: {
        type: Date,
        required: true,
        default: Date.now
    },
    validUntil: {
        type: Date,
        required: true
    },
    active: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Virtual for savings amount
comboDealSchema.virtual('savings').get(function() {
    return this.totalPrice - this.discountedPrice;
});

// Virtual for savings percentage
comboDealSchema.virtual('savingsPercentage').get(function() {
    return Math.round((this.savings / this.totalPrice) * 100);
});

// Virtual for formatted prices
comboDealSchema.virtual('formattedTotalPrice').get(function() {
    return `৳${this.totalPrice}`;
});

comboDealSchema.virtual('formattedDiscountedPrice').get(function() {
    return `৳${this.discountedPrice}`;
});

comboDealSchema.virtual('formattedSavings').get(function() {
    return `৳${this.savings}`;
});

const ComboDeal = mongoose.model('ComboDeal', comboDealSchema);
module.exports = ComboDeal;
