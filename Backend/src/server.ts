import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import productRoutes from './routes/product.routes';
import uploadRoutes from './routes/upload.routes';
import jobRoutes from './routes/job.routes';
import searchRoutes from './routes/search.routes';
import analyticsRoutes from './routes/analytics.routes';
import insightsRoutes from './routes/insights.routes';
import vtoRoutes from './routes/vto.routes';
import vtoModelsRoutes from './routes/vtoModels.routes';
import { errorHandler } from './middleware/errorHandler';
import { resetStaleProcessingJobs } from './services/job.service';
import { startVTOPoller } from './services/vto.service';

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
app.use('/api/uploads', uploadRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/vto', vtoRoutes);
app.use('/api/vto-models', vtoModelsRoutes);

// Global error handler — must be registered after all routes
app.use(errorHandler);

// Define the port (fallback to 5000 if not provided)
const PORT = process.env.PORT || 5000;

// Start the server
app.listen(PORT, async () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  await resetStaleProcessingJobs();
  // Resume polling if any VTO jobs were in-flight when the server last stopped
  startVTOPoller();
});
