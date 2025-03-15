# Shawon Burger Shop

A modern burger shop website with a complete ordering system and admin panel.

## Features

- User Authentication
- Online Ordering System
- Menu Management
- Combo Deals
- Customer Reviews
- Admin Dashboard with Analytics
- Order Management
- PDF Export and Printing

## Tech Stack

- Frontend: HTML, CSS, JavaScript, Bootstrap 5, Chart.js
- Backend: Node.js, Express.js
- Database: MongoDB
- Payment: Stripe Integration

## Deployment Instructions

1. Create a MongoDB Atlas account and database
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Create a new cluster (free tier available)
   - Get your connection string

2. Create a Stripe account
   - Go to [Stripe](https://stripe.com)
   - Get your API keys

3. Deploy to Render.com
   - Sign up at [Render](https://render.com)
   - Create a new Web Service
   - Connect your GitHub repository
   - Add environment variables:
     ```
     MONGODB_URI=your_mongodb_uri
     JWT_SECRET=your_secure_jwt_secret
     STRIPE_SECRET_KEY=your_stripe_secret_key
     PORT=3000
     ```
   - Deploy!

## Local Development

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/shwon-burger-shop.git
   cd shwon-burger-shop
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create a `.env` file based on `.env.example`
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

4. Start the development server
   ```bash
   npm run dev
   ```

5. Visit `http://localhost:3000`

## Admin Access

Default admin credentials:
- Email: admin@shawonburger.com
- Password: admin123

**Important:** Change these credentials after first login in production!

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, email support@shawonburger.com or create an issue in the GitHub repository.
