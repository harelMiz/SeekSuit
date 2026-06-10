import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Validates the Supabase JWT and checks that the user has admin role in app_metadata.
// Set app_metadata.role = 'admin' on admin users via Supabase dashboard or Admin API.
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = auth.slice(7);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const meta = data.user.app_metadata ?? {};
  const isAdmin = meta.role === 'admin' || meta.is_admin === true;
  if (!isAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  next();
}
