require('dotenv').config();
const mongoose = require('mongoose');

async function testConnection() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Successfully connected to MongoDB!');
        
        // Test creating a document
        const Test = mongoose.model('Test', new mongoose.Schema({ name: String }));
        await Test.create({ name: 'test' });
        console.log('Successfully created a test document!');
        
        // Clean up
        await Test.deleteMany({});
        console.log('Successfully cleaned up test data!');
        
        await mongoose.connection.close();
        console.log('Connection closed.');
    } catch (error) {
        console.error('Database connection error:', error);
    }
}

testConnection();
