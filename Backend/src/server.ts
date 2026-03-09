import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json()); // Allow the server to parse JSON bodies

// Initial test route
app.get('/', (req: Request, res: Response) => {
  res.send('Welcome to SeekSuit API! The TypeScript server is running');
});

// Define the port (fallback to 5000 if not provided)
const PORT = process.env.PORT || 5000;

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});