import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import productRoutes from './routes/product.routes';
import { errorHandler } from './middleware/errorHandler';

// Load environment variables from .env file
dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Health check route
app.get('/', (req: Request, res: Response) => {
  res.send('Welcome to SeekSuit API! The TypeScript server is running');
});

// API routes
app.use('/api/products', productRoutes);

// Global error handler — must be registered after all routes
app.use(errorHandler);

// Define the port (fallback to 5000 if not provided)
const PORT = process.env.PORT || 5000;

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
