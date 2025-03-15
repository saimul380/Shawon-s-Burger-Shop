require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const MenuItem = require('./models/MenuItem');
const ComboDeal = require('./models/ComboDeal');

async function setupDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        // Create admin user
        const adminPassword = await bcrypt.hash('admin123', 10);
        await User.findOneAndUpdate(
            { email: 'admin@shawonburger.com' },
            {
                name: 'Admin',
                email: 'admin@shawonburger.com',
                password: adminPassword,
                role: 'admin'
            },
            { upsert: true }
        );
        console.log('Admin user created/updated');

        // Create sample menu items
        const menuItems = [
            {
                name: 'Classic Burger',
                description: 'Juicy beef patty with fresh lettuce, tomato, and our special sauce',
                price: 250,
                category: 'burger',
                image: 'https://example.com/classic-burger.jpg',
                inStock: true,
                nutritionalInfo: {
                    calories: 550,
                    protein: 25,
                    carbs: 35,
                    fat: 28
                }
            },
            {
                name: 'Chicken Supreme',
                description: 'Grilled chicken breast with crispy lettuce and mayo',
                price: 220,
                category: 'burger',
                image: 'https://example.com/chicken-supreme.jpg',
                inStock: true,
                nutritionalInfo: {
                    calories: 450,
                    protein: 28,
                    carbs: 30,
                    fat: 22
                }
            },
            {
                name: 'French Fries',
                description: 'Crispy golden fries with our special seasoning',
                price: 120,
                category: 'side',
                image: 'https://example.com/fries.jpg',
                inStock: true,
                nutritionalInfo: {
                    calories: 320,
                    protein: 4,
                    carbs: 42,
                    fat: 16
                }
            },
            {
                name: 'Coca Cola',
                description: 'Ice-cold Coca Cola (500ml)',
                price: 60,
                category: 'drink',
                image: 'https://example.com/coke.jpg',
                inStock: true,
                nutritionalInfo: {
                    calories: 140,
                    protein: 0,
                    carbs: 39,
                    fat: 0
                }
            }
        ];

        // Clear and create menu items
        await MenuItem.deleteMany({});
        const createdMenuItems = await MenuItem.insertMany(menuItems);
        console.log('Sample menu items created');

        // Create a map of menu item names to their IDs
        const menuItemMap = {};
        createdMenuItems.forEach(item => {
            menuItemMap[item.name] = item._id;
        });

        // Create sample combo deals
        const comboDeals = [
            {
                name: 'Family Feast',
                description: '2 Classic Burgers, 2 Chicken Supreme, 2 Large Fries',
                items: [
                    { menuItem: menuItemMap['Classic Burger'], quantity: 2 },
                    { menuItem: menuItemMap['Chicken Supreme'], quantity: 2 },
                    { menuItem: menuItemMap['French Fries'], quantity: 2 }
                ],
                image: 'https://example.com/family-feast.jpg',
                totalPrice: 1180,
                discountedPrice: 999,
                validFrom: new Date(),
                validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
                active: true
            },
            {
                name: 'Burger Combo',
                description: '1 Classic Burger, 1 French Fries, 1 Coca Cola',
                items: [
                    { menuItem: menuItemMap['Classic Burger'], quantity: 1 },
                    { menuItem: menuItemMap['French Fries'], quantity: 1 },
                    { menuItem: menuItemMap['Coca Cola'], quantity: 1 }
                ],
                image: 'https://example.com/burger-combo.jpg',
                totalPrice: 430,
                discountedPrice: 379,
                validFrom: new Date(),
                validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                active: true
            }
        ];

        await ComboDeal.deleteMany({}); // Clear existing deals
        await ComboDeal.insertMany(comboDeals);
        console.log('Sample combo deals created');

        console.log('Database setup completed successfully!');
    } catch (error) {
        console.error('Error setting up database:', error);
    } finally {
        await mongoose.connection.close();
        console.log('Database connection closed');
    }
}

setupDatabase();
