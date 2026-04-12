const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BASE = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}`;

async function sendMessage(chatId, text) {
  await fetch(`${BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
  });
}

const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });
const today = () => new Date().toISOString().split('T')[0];
const thisMonth = () => today().substring(0, 7);

const CATEGORIAS_GASTO = {
  'envio': 'Envíos Nacionales', 'envíos': 'Envíos Nacionales',
  'caja': 'Material Empaques', 'cajas': 'Material Empaques', 'empaque': 'Material Empaques',
  'publicidad': 'Publicidad Pauta', 'pauta': 'Publicidad Pauta',
  'comision': 'Comisión / PayPal', 'comisión': 'Comisión / PayPal', 'paypal': 'Comisión / PayPal',
  'varios': 'Varios', 'otro': 'Varios'
};

function parseMessage(text) {
  const raw = text.trim().toLowerCase();

  if (['ayuda', '/ayuda', '/help', '/start'].includes(raw)) return { cmd: 'ayuda' };
  if (['caja', '/caja'].includes(raw)) return { cmd: 'caja' };
  if (['resumen', '/resumen'].includes(raw)) return { cmd: 'resumen' };
  if (raw.startsWith('top') || raw === '/top') return { cmd: 'top' };
  if (['pendientes', '/pendientes'].includes(raw)) return { cmd: 'pendientes' };
  if (['anular', '/anular'].includes(raw)) return { cmd: 'anular' };

  if (raw.startsWith('ventas')) {
    const periodo = raw.includes('hoy') ? 'hoy' : raw.includes('mes') ? 'mes' : 'todo';
    return { cmd: 'ventas', periodo };
  }
  if (raw.startsWith('stock') || raw.startsWith('/stock')) {
    const busqueda = raw.replace(/^\/?(stock)\s*/i, '').trim();
    return { cmd: 'stock', busqueda: busqueda || null };
  }
  if (raw.startsWith('pedido') || raw.startsWith('/pedido')) {
    return { cmd: 'pedido', descripcion: text.replace(/^\/?(pedido)\s*/i, '').trim() };
  }

  const ventaMatch = raw.match(/^\/?(venta|vendí|vendi)\s+/i);
  if (ventaMatch) {
    const resto = text.replace(/^\/?(venta|vendí|vendi)\s+/i, '').trim();
    const tallaMatch = resto.match(/\b(XS|S|M|L|XL|XXL)\b/i);
    const precioMatch = resto.match(/\b(\d{4,7})\b/);
    const costoMatch = resto.match(/costo\s+([\d.]+)/i);
    const talla = tallaMatch ? tallaMatch[1].toUpperCase() : 'M';
    const precio = precioMatch ? parseInt(precioMatch[1]) : null;
    const costoUsd = costoMatch ? parseFloat(costoMatch[1]) : 10.44;
    const equipo = resto.replace(/\b(XS|S|M|L|XL|XXL)\b/i, '').replace(/\b\d{4,7}\b/, '').replace(/costo\s+[\d.]+/i, '').trim();
    if (!precio) return { cmd: 'error', msg: 'No entendí el precio. Ej: `venta colombia L 90000`' };
    return { cmd: 'venta', equipo, talla, precio, costoUsd };
  }

  const gastoMatch = raw.match(/^\/?(gasto|gasté|gaste)\s+/i);
  if (gastoMatch) {
    const resto = text.replace(/^\/?(gasto|gasté|gaste)\s+/i, '').trim();
    const montoMatch = resto.match(/\b(\d{3,9})\b/);
    const monto = montoMatch ? parseInt(montoMatch[1]) : null;
    if (!monto) return { cmd: 'error', msg: 'No entendí el monto. Ej: `gasto envio cajas 22000`' };
    const descripcion = resto.replace(/\b\d{3,9}\b/, '').trim();
    let categoria = 'Varios';
    for (const p of descripcion.toLowerCase().split(/\s+/)) {
      if (CATEGORIAS_GASTO[p]) { categoria = CATEGORIAS_GASTO[p]; break; }
    }
    return { cmd: 'gasto', categoria, descripcion, monto };
  }

  return { cmd: 'desconocido' };
}

async function handleAyuda() {
  return `🏆 *H90 Assistant — Herencia 90*\n\n` +
    `*Registrar:*\n• \`venta colombia L 90000\`\n• \`gasto envio cajas 22000\`\n• \`gasto publicidad instagram 50000\`\n\n` +
    `*Consultar:*\n• \`caja\` — saldo actual\n• \`stock colombia\` — inventario\n• \`ventas hoy\` / \`ventas mes\`\n• \`resumen\` — resumen del mes\n• \`top\` — más vendidas\n• \`pendientes\` — pedidos sin enviar\n\n` +
    `*Pedidos:*\n• \`pedido Juan García - Colombia L - Bogotá\`\n\n` +
    `*Correcciones:*\n• \`anular\` — anula la última transacción del día`;
}

async function handleCaja() {
  const { data } = await db.from('transacciones').select('tipo, monto');
  const ingresos = data.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + Number(t.monto), 0);
  const gastos = data.filter(t => t.tipo === 'gasto').reduce((s, t) => s + Number(t.monto), 0);
  return `💵 *Caja actual:* ${fmt.format(ingresos - gastos)}\n📈 Ingresos: ${fmt.format(ingresos)}\n📉 Gastos: ${fmt.format(gastos)}`;
}

async function handleVenta({ equipo, talla, precio, costoUsd }) {
  const trm = 3714;
  const { error } = await db.from('transacciones').insert({
    id: randomUUID(), tipo: 'ingreso', categoria: 'Venta de Producto',
    fecha: today(), monto: precio, usd_amount: precio / trm, trm,
    descripcion: `Camiseta ${equipo} talla ${talla} ${fmt.format(precio)}`,
    costo_usd_asociado: costoUsd
  });
  if (error) return `❌ Error: ${error.message}`;

  const { data: prods } = await db.from('productos').select('id, equipo, tallas').ilike('equipo', `%${equipo}%`);

  // Si hay multiples matches, avisar al usuario para que sea mas especifico
  if (prods && prods.length > 1) {
    const lista = prods.map(p => `• ${p.equipo}`).join('\n');
    return `✅ *Venta registrada*\n📦 ${equipo} — Talla ${talla}\n💰 ${fmt.format(precio)}\n\n⚠️ *Stock NO actualizado* — hay ${prods.length} productos con ese nombre:\n${lista}\n\nUsa el nombre exacto para descontar stock.`;
  }

  if (prods && prods.length === 1) {
    const prod = prods[0];
    const tallas = prod.tallas;
    if (tallas[talla] > 0) {
      tallas[talla]--;
      await db.from('productos').update({ tallas }).eq('id', prod.id);
      const alerta = tallas[talla] === 0 ? `\n⚠️ *Stock talla ${talla} agotado*` :
                     tallas[talla] <= 2 ? `\n⚡ Solo quedan ${tallas[talla]} en talla ${talla}` : '';
      return `✅ *Venta registrada*\n📦 ${prod.equipo} — Talla ${talla}\n💰 ${fmt.format(precio)}${alerta}`;
    } else {
      return `✅ *Venta registrada*\n📦 ${prod.equipo} — Talla ${talla}\n💰 ${fmt.format(precio)}\n⚠️ *Talla ${talla} ya estaba en 0*`;
    }
  }

  return `✅ *Venta registrada*\n📦 ${equipo} — Talla ${talla}\n💰 ${fmt.format(precio)}\n_(producto no encontrado en inventario — stock no actualizado)_`;
}

async function handleGasto({ categoria, descripcion, monto }) {
  const { error } = await db.from('transacciones').insert({
    id: randomUUID(), tipo: 'gasto', categoria, fecha: today(),
    monto, usd_amount: monto / 3714, trm: 3714, descripcion, costo_usd_asociado: 0
  });
  if (error) return `❌ Error: ${error.message}`;
  return `✅ *Gasto registrado*\n📁 ${categoria}\n📝 ${descripcion}\n💸 -${fmt.format(monto)}`;
}

async function handleStock({ busqueda }) {
  let query = db.from('productos').select('equipo, tallas');
  if (busqueda) query = query.ilike('equipo', `%${busqueda}%`);
  const { data } = await query.order('equipo');
  if (!data || data.length === 0) return `❌ No encontré productos con "${busqueda}"`;
  let msg = `📦 *Stock${busqueda ? ` — "${busqueda}"` : ' completo'}:*\n\n`;
  data.forEach(p => {
    const t = p.tallas;
    const total = (t.S||0)+(t.M||0)+(t.L||0)+(t.XL||0);
    msg += `${total === 0 ? '🔴' : total <= 3 ? '🟡' : '🟢'} *${p.equipo}*\n   S:${t.S||0} M:${t.M||0} L:${t.L||0} XL:${t.XL||0} | Total: ${total}\n`;
  });
  return msg;
}

async function handleVentas({ periodo }) {
  let query = db.from('transacciones').select('*').eq('tipo', 'ingreso').eq('categoria', 'Venta de Producto');
  if (periodo === 'hoy') query = query.eq('fecha', today());
  else if (periodo === 'mes') query = query.like('fecha', `${thisMonth()}%`);
  const { data } = await query.order('fecha', { ascending: false });
  if (!data || data.length === 0) return `📊 No hay ventas ${periodo === 'hoy' ? 'hoy' : periodo === 'mes' ? 'este mes' : ''}.`;
  const total = data.reduce((s, t) => s + Number(t.monto), 0);
  const ganancia = data.reduce((s, t) => s + Number(t.monto) - (Number(t.costo_usd_asociado) * Number(t.trm)), 0);
  let msg = `📊 *Ventas ${periodo === 'hoy' ? 'de hoy' : periodo === 'mes' ? 'del mes' : 'totales'}:*\n\n`;
  data.slice(0, 10).forEach(t => { msg += `• ${t.descripcion} — ${fmt.format(t.monto)}\n`; });
  if (data.length > 10) msg += `_...y ${data.length - 10} más_\n`;
  return msg + `\n💰 *Total:* ${fmt.format(total)}\n💎 *Ganancia:* ${fmt.format(ganancia)}`;
}

async function handleResumen() {
  const { data } = await db.from('transacciones').select('*').like('fecha', `${thisMonth()}%`);
  if (!data || data.length === 0) return `📋 No hay transacciones este mes.`;
  const ingresos = data.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + Number(t.monto), 0);
  const gastos = data.filter(t => t.tipo === 'gasto').reduce((s, t) => s + Number(t.monto), 0);
  const ventas = data.filter(t => t.tipo === 'ingreso' && t.categoria === 'Venta de Producto');
  const ganancia = ventas.reduce((s, t) => s + Number(t.monto) - (Number(t.costo_usd_asociado) * Number(t.trm)), 0);
  const [y, m] = thisMonth().split('-');
  const nombreMes = new Date(y, m - 1).toLocaleString('es-CO', { month: 'long', year: 'numeric' });
  return `📋 *Resumen ${nombreMes}*\n\n📈 Ingresos: ${fmt.format(ingresos)}\n📉 Gastos: ${fmt.format(gastos)}\n💰 Saldo: ${fmt.format(ingresos - gastos)}\n\n👕 Ventas: ${ventas.length} unidades\n💎 Ganancia neta: ${fmt.format(ganancia)}`;
}

async function handleTop() {
  const { data } = await db.from('transacciones').select('descripcion').eq('tipo', 'ingreso').eq('categoria', 'Venta de Producto');
  if (!data || data.length === 0) return '📊 No hay ventas aún.';
  const conteo = {};
  data.forEach(t => {
    const key = t.descripcion.split(' talla ')[0].replace('Camiseta ', '');
    conteo[key] = (conteo[key] || 0) + 1;
  });
  const sorted = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const medallas = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
  return '🏆 *Top camisetas:*\n\n' + sorted.map(([n, c], i) => `${medallas[i]} ${n}: ${c}`).join('\n');
}

async function handlePedido({ descripcion }) {
  const { error } = await db.from('transacciones').insert({
    id: randomUUID(), tipo: 'gasto', categoria: 'Envíos Nacionales',
    fecha: today(), monto: 0, usd_amount: 0, trm: 3714,
    descripcion: `[PENDIENTE] ${descripcion}`, costo_usd_asociado: 0
  });
  if (error) return `❌ Error: ${error.message}`;
  return `📦 *Pedido pendiente registrado:*\n${descripcion}`;
}

async function handlePendientes() {
  const { data } = await db.from('transacciones').select('fecha, descripcion').like('descripcion', '[PENDIENTE]%').order('fecha', { ascending: false });
  if (!data || data.length === 0) return '✅ No hay pedidos pendientes.';
  return '📦 *Pedidos pendientes:*\n\n' + data.map(t => `• ${t.fecha} — ${t.descripcion.replace('[PENDIENTE] ', '')}`).join('\n');
}

async function handleAnular() {
  // Busca la ultima transaccion de hoy
  const { data, error } = await db.from('transacciones')
    .select('*')
    .eq('fecha', today())
    .order('created_at', { ascending: false })
    .limit(1);

  // Fallback si no hay created_at: buscar por id desc no aplica con UUID, buscar todas de hoy
  const trans = data && data.length > 0 ? data[0] : null;

  if (!trans) return `❌ No hay transacciones de hoy para anular.`;

  // Si era venta, restaurar stock
  if (trans.tipo === 'ingreso' && trans.categoria === 'Venta de Producto') {
    const tallaMatch = trans.descripcion.match(/talla\s+(XS|S|M|L|XL|XXL)/i);
    const equipoMatch = trans.descripcion.match(/Camiseta\s+(.+?)\s+talla/i);
    if (tallaMatch && equipoMatch) {
      const talla = tallaMatch[1].toUpperCase();
      const equipo = equipoMatch[1];
      const { data: prods } = await db.from('productos').select('id, tallas').ilike('equipo', `%${equipo}%`);
      if (prods && prods.length === 1) {
        const prod = prods[0];
        const tallas = prod.tallas;
        tallas[talla] = (tallas[talla] || 0) + 1;
        await db.from('productos').update({ tallas }).eq('id', prod.id);
      }
    }
  }

  const { error: delError } = await db.from('transacciones').delete().eq('id', trans.id);
  if (delError) return `❌ Error al anular: ${delError.message}`;

  const tipo = trans.tipo === 'ingreso' ? '💰 Ingreso' : '💸 Gasto';
  return `🗑️ *Transacción anulada:*\n${tipo}: ${trans.descripcion}\nMonto: ${fmt.format(trans.monto)}${trans.tipo === 'ingreso' && trans.categoria === 'Venta de Producto' ? '\n📦 Stock restaurado' : ''}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true });

  try {
    const { message } = req.body;
    if (!message || !message.text) return res.status(200).json({ ok: true });

    const chatId = message.chat.id;
    const allowedChat = process.env.TELEGRAM_CHAT_ID;
    if (allowedChat && String(chatId) !== String(allowedChat)) {
      await sendMessage(chatId, '⛔ No estás autorizado.');
      return res.status(200).json({ ok: true });
    }

    const parsed = parseMessage(message.text);
    let reply;
    switch (parsed.cmd) {
      case 'ayuda':      reply = await handleAyuda(); break;
      case 'caja':       reply = await handleCaja(); break;
      case 'venta':      reply = await handleVenta(parsed); break;
      case 'gasto':      reply = await handleGasto(parsed); break;
      case 'stock':      reply = await handleStock(parsed); break;
      case 'ventas':     reply = await handleVentas(parsed); break;
      case 'resumen':    reply = await handleResumen(); break;
      case 'top':        reply = await handleTop(); break;
      case 'pedido':     reply = await handlePedido(parsed); break;
      case 'pendientes': reply = await handlePendientes(); break;
      case 'anular':     reply = await handleAnular(); break;
      case 'error':      reply = `❌ ${parsed.msg}`; break;
      default: reply = `🤔 No entendí. Escribe *ayuda* para ver los comandos.`;
    }

    await sendMessage(chatId, reply);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Bot error:', err);
    return res.status(200).json({ ok: true });
  }
};
