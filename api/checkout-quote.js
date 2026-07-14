import { createClient } from '@supabase/supabase-js';
import checkoutCore from '../web/js/checkout-core.js';

const MAX_CART_LINES = 20;
const MAX_BODY_BYTES = 16 * 1024;

function bodyIsTooLarge(body) {
  try {
    return Buffer.byteLength(JSON.stringify(body || {}), 'utf8') > MAX_BODY_BYTES;
  } catch {
    return true;
  }
}

function sanitizeCart(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_CART_LINES).map((line) => ({
    id: String(line && line.id || '').slice(0, 80),
    talla: String(line && line.talla || '').slice(0, 40),
    cantidad: Math.max(1, Math.min(10, Math.floor(Number(line && line.cantidad) || 1)))
  })).filter((line) => line.id);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  if (bodyIsTooLarge(req.body)) return res.status(413).json({ error: 'Solicitud demasiado grande.' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(503).json({ error: 'Cotizacion temporalmente no disponible.' });
  }

  const cart = sanitizeCart(req.body && req.body.cart);
  const ids = [...new Set(cart.map((line) => line.id))];

  try {
    let products = [];
    if (ids.length) {
      const supabase = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const { data, error } = await supabase
        .from('productos')
        .select('id,equipo,categoria,precio,tallas,imagenes')
        .in('id', ids);
      if (error) throw error;
      products = Array.isArray(data) ? data : [];
    }

    const quote = checkoutCore.buildCheckout(cart, products);
    return res.status(200).json({ ...quote, quotedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Error checkout-quote:', error);
    return res.status(503).json({ error: 'No pudimos validar precio y stock en este momento.' });
  }
}
