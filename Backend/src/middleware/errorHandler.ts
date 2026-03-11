import { Request, Response, NextFunction } from 'express';

// Global error handling middleware.
// Must be registered LAST in server.ts (after all routes).
// Catches any error passed via next(error) or thrown in async routes.
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log the error stack in development for easier debugging
  console.error(err.stack || err.message || err);

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(status).json({ error: message });
};
