import { createClient } from '@supabase/supabase-js';
import adminSecurity from './_lib/admin-security.cjs';

const { applyAdminCors, authorizeAdminRequest, hasOversizedJsonBody } = adminSecurity;

const BUCKET = 'product-images';
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

function decodeBase64Data(data) {
  const clean = String(data || '').replace(/^data:[^;]+;base64,/, '');
  return Buffer.from(clean, 'base64');
}

export default async function handler(req, res) {
  const corsAllowed = applyAdminCors(req, res);
  if (req.method === 'OPTIONS') return corsAllowed ? res.status(204).end() : res.status(403).end();
  if (!corsAllowed) return res.status(403).json({ error: 'Origen no permitido.' });
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  if (hasOversizedJsonBody(req.body, 5 * 1024 * 1024)) {
    return res.status(413).json({ error: 'Solicitud demasiado grande.' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase server credentials are not configured.' });
  }

  try {
    const authorization = await authorizeAdminRequest(req, process.env, createClient);
    if (!authorization.ok) return res.status(authorization.status).json({ error: authorization.error });
    const supabase = authorization.supabase;

    const { filename, contentType, data } = req.body || {};
    if (!filename || !data) {
      return res.status(400).json({ error: 'Faltan filename o data.' });
    }

    const buffer = decodeBase64Data(data);
    if (!buffer.length) return res.status(400).json({ error: 'Imagen vacia.' });
    if (buffer.length > MAX_UPLOAD_BYTES) {
      return res.status(413).json({ error: 'Imagen demasiado pesada. Maximo 3 MB despues de optimizar.' });
    }

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filename, buffer, {
        upsert: true,
        contentType: contentType || 'image/webp',
        cacheControl: '31536000'
      });

    if (uploadError) {
      return res.status(500).json({ error: uploadError.message });
    }

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(filename);
    return res.status(200).json({ url: publicData.publicUrl, filename });
  } catch (error) {
    console.error('Error admin-upload-image:', error);
    return res.status(500).json({ error: 'Error subiendo imagen.' });
  }
}
