const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
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
    price: {
        type: Number,
        required: true,
        min: 0
    },
    category: {
        type: String,
        required: true,
        enum: ['burger', 'side', 'drink', 'dessert'],
        lowercase: true
    },
    image: {
        type: String,
        required: true
    },
    inStock: {
        type: Boolean,
        default: true
    },
    nutritionalInfo: {
        calories: {
            type: Number,
            required: true
        },
        protein: {
            type: Number,
            required: true
        },
        carbs: {
            type: Number,
            required: true
        },
        fat: {
            type: Number,
            required: true
        }
    }
}, {
    timestamps: true
});

// Virtual for formatted price
menuItemSchema.virtual('formattedPrice').get(function() {
    return `৳${this.price}`;
});

const MenuItem = mongoose.model('MenuItem', menuItemSchema);
module.exports = MenuItem;
