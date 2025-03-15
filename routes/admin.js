const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const User = require('../models/User');
const MenuItem = require('../models/MenuItem');
const ComboDeal = require('../models/ComboDeal');
const PDFDocument = require('pdfkit');
const { auth, isAdmin } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');

// Get dashboard statistics with date range
router.get('/dashboard', auth, isAdmin, async (req, res) => {
    try {
        const { dateRange } = req.query;
        let startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        
        // Set date range based on filter
        switch(dateRange) {
            case 'week':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case 'month':
                startDate.setMonth(startDate.getMonth() - 1);
                break;
            case 'year':
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
            default: // today
                break;
        }
        
        const [
            totalOrders,
            periodOrders,
            totalRevenue,
            periodRevenue,
            userCount,
            statusCounts,
            popularItems,
            dailyStats
        ] = await Promise.all([
            Order.countDocuments(),
            Order.countDocuments({ createdAt: { $gte: startDate } }),
            Order.aggregate([
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            Order.aggregate([
                { $match: { createdAt: { $gte: startDate } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            User.countDocuments({ role: 'user' }),
            Order.aggregate([
                { $group: { _id: '$orderStatus', count: { $sum: 1 } } }
            ]),
            Order.aggregate([
                { $unwind: '$items' },
                { $group: { 
                    _id: '$items.name',
                    count: { $sum: '$items.quantity' },
                    revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
                }},
                { $sort: { count: -1 } },
                { $limit: 5 }
            ]),
            Order.aggregate([
                { $match: { createdAt: { $gte: startDate } } },
                {
                    $group: {
                        _id: { 
                            $dateToString: { 
                                format: '%Y-%m-%d', 
                                date: '$createdAt' 
                            } 
                        },
                        orders: { $sum: 1 },
                        revenue: { $sum: '$totalAmount' }
                    }
                },
                { $sort: { _id: 1 } }
            ])
        ]);
        
        res.json({
            totalOrders,
            periodOrders,
            totalRevenue: totalRevenue[0]?.total || 0,
            periodRevenue: periodRevenue[0]?.total || 0,
            userCount,
            orderStatusCounts: statusCounts.reduce((acc, curr) => {
                acc[curr._id] = curr.count;
                return acc;
            }, {}),
            popularItems,
            dailyStats
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Export dashboard data as PDF
router.get('/dashboard/export', auth, isAdmin, async (req, res) => {
    try {
        const { dateRange } = req.query;
        let startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        
        // Set date range based on filter
        switch(dateRange) {
            case 'week':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case 'month':
                startDate.setMonth(startDate.getMonth() - 1);
                break;
            case 'year':
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
            default: // today
                break;
        }

        // Fetch dashboard data
        const [
            totalOrders,
            periodOrders,
            totalRevenue,
            periodRevenue,
            userCount,
            statusCounts,
            popularItems,
            dailyStats
        ] = await Promise.all([
            Order.countDocuments(),
            Order.countDocuments({ createdAt: { $gte: startDate } }),
            Order.aggregate([
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            Order.aggregate([
                { $match: { createdAt: { $gte: startDate } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            User.countDocuments({ role: 'user' }),
            Order.aggregate([
                { $group: { _id: '$orderStatus', count: { $sum: 1 } } }
            ]),
            Order.aggregate([
                { $unwind: '$items' },
                { $group: { 
                    _id: '$items.name',
                    count: { $sum: '$items.quantity' },
                    revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
                }},
                { $sort: { count: -1 } },
                { $limit: 5 }
            ]),
            Order.aggregate([
                { $match: { createdAt: { $gte: startDate } } },
                {
                    $group: {
                        _id: { 
                            $dateToString: { 
                                format: '%Y-%m-%d', 
                                date: '$createdAt' 
                            } 
                        },
                        orders: { $sum: 1 },
                        revenue: { $sum: '$totalAmount' }
                    }
                },
                { $sort: { _id: 1 } }
            ])
        ]);

        // Create PDF
        const doc = new PDFDocument();
        const filename = `dashboard-report-${new Date().toISOString().split('T')[0]}.pdf`;
        const filePath = path.join(__dirname, '../temp', filename);
        
        // Pipe PDF to file
        doc.pipe(fs.createWriteStream(filePath));
        
        // Add content to PDF
        doc.fontSize(20).text('Shawon Burger Shop - Dashboard Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Report Period: ${dateRange || 'Today'}`, { align: 'center' });
        doc.moveDown();
        
        // Overview section
        doc.fontSize(16).text('Overview');
        doc.moveDown();
        doc.fontSize(12).text(`Total Orders: ${totalOrders}`);
        doc.text(`Period Orders: ${periodOrders}`);
        doc.text(`Total Revenue: ৳${totalRevenue[0]?.total || 0}`);
        doc.text(`Period Revenue: ৳${periodRevenue[0]?.total || 0}`);
        doc.text(`Total Customers: ${userCount}`);
        doc.moveDown();
        
        // Order Status section
        doc.fontSize(16).text('Order Status');
        doc.moveDown();
        statusCounts.forEach(status => {
            doc.fontSize(12).text(`${status._id}: ${status.count}`);
        });
        doc.moveDown();
        
        // Popular Items section
        doc.fontSize(16).text('Popular Items');
        doc.moveDown();
        popularItems.forEach(item => {
            doc.fontSize(12).text(`${item._id}: ${item.count} orders (৳${item.revenue})`);
        });
        doc.moveDown();
        
        // Daily Statistics
        doc.fontSize(16).text('Daily Statistics');
        doc.moveDown();
        dailyStats.forEach(stat => {
            doc.fontSize(12).text(`${stat._id}: ${stat.orders} orders (৳${stat.revenue})`);
        });
        
        // Finalize PDF
        doc.end();
        
        // Send file
        res.download(filePath, filename, (err) => {
            if (err) {
                console.error('Error downloading file:', err);
            }
            // Clean up temp file
            fs.unlink(filePath, (err) => {
                if (err) console.error('Error deleting temp file:', err);
            });
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all orders (admin only)
router.get('/orders', auth, isAdmin, async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const query = status && status !== 'all' ? { orderStatus: status } : {};
        
        const orders = await Order.find(query)
            .populate('user', 'name email phone')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);
            
        const total = await Order.countDocuments(query);
        
        res.json({
            orders,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page)
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update order status (admin only)
router.patch('/orders/:id/status', auth, isAdmin, async (req, res) => {
    try {
        const { orderStatus } = req.body;
        const order = await Order.findByIdAndUpdate(
            req.params.id,
            { orderStatus },
            { new: true }
        ).populate('user', 'name email phone');
        
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        res.json(order);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Menu Management Routes
// Get all menu items
router.get('/menu', auth, isAdmin, async (req, res) => {
    try {
        const items = await MenuItem.find().sort({ category: 1, name: 1 });
        res.json({ items });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Add new menu item
router.post('/menu', auth, isAdmin, async (req, res) => {
    try {
        const menuItem = new MenuItem(req.body);
        await menuItem.save();
        res.status(201).json(menuItem);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update menu item
router.patch('/menu/:id', auth, isAdmin, async (req, res) => {
    try {
        const menuItem = await MenuItem.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        if (!menuItem) {
            return res.status(404).json({ error: 'Menu item not found' });
        }
        res.json(menuItem);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update stock status
router.patch('/menu/:id/stock', auth, isAdmin, async (req, res) => {
    try {
        const { inStock } = req.body;
        const menuItem = await MenuItem.findByIdAndUpdate(
            req.params.id,
            { inStock },
            { new: true }
        );
        if (!menuItem) {
            return res.status(404).json({ error: 'Menu item not found' });
        }
        res.json(menuItem);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update price
router.patch('/menu/:id/price', auth, isAdmin, async (req, res) => {
    try {
        const { price } = req.body;
        const menuItem = await MenuItem.findByIdAndUpdate(
            req.params.id,
            { price },
            { new: true }
        );
        if (!menuItem) {
            return res.status(404).json({ error: 'Menu item not found' });
        }
        res.json(menuItem);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete menu item
router.delete('/menu/:id', auth, isAdmin, async (req, res) => {
    try {
        const menuItem = await MenuItem.findByIdAndDelete(req.params.id);
        if (!menuItem) {
            return res.status(404).json({ error: 'Menu item not found' });
        }
        res.json({ message: 'Menu item deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Combo Deals Routes
// Get all combo deals
router.get('/combos', auth, isAdmin, async (req, res) => {
    try {
        const combos = await ComboDeal.find().sort({ createdAt: -1 });
        res.json({ combos });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Add new combo deal
router.post('/combos', auth, isAdmin, async (req, res) => {
    try {
        const combo = new ComboDeal(req.body);
        await combo.save();
        res.status(201).json(combo);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update combo deal
router.patch('/combos/:id', auth, isAdmin, async (req, res) => {
    try {
        const combo = await ComboDeal.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        if (!combo) {
            return res.status(404).json({ error: 'Combo deal not found' });
        }
        res.json(combo);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete combo deal
router.delete('/combos/:id', auth, isAdmin, async (req, res) => {
    try {
        const combo = await ComboDeal.findByIdAndDelete(req.params.id);
        if (!combo) {
            return res.status(404).json({ error: 'Combo deal not found' });
        }
        res.json({ message: 'Combo deal deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// User Management Routes
router.get('/users', auth, isAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const users = await User.find()
            .select('-password')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);
            
        const total = await User.countDocuments();
        
        res.json({
            users,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page)
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
