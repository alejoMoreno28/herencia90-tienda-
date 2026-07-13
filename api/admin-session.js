import { createClient } from '@supabase/supabase-js';
import adminSecurity from './_lib/admin-security.cjs';

const { applyAdminCors, authorizeAdminRequest, hasAdminDatabaseGrant } = adminSecurity;

export default async function handler(req, res) {
  const corsAllowed = applyAdminCors(req, res);
  if (req.method === 'OPTIONS') return corsAllowed ? res.status(204).end() : res.status(403).end();
  if (!corsAllowed) return res.status(403).json({ error: 'Origen no permitido.' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  const authorization = await authorizeAdminRequest(req, process.env, createClient);
  if (!authorization.ok) {
    return res.status(authorization.status).json({ error: authorization.error });
  }
  if (!hasAdminDatabaseGrant(authorization.user)) {
    return res.status(403).json({ error: 'El panel requiere un claim de administrador en app_metadata.' });
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ok: true });
}
