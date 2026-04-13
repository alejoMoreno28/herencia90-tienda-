const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BASE = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}`;
const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });
const today = () => new Date().toISOString().split('T')[0];
const thisMonth = () => today().substring(0, 7);

// ─── Telegram API ─────────────────────────────────────────────────────────────

async function sendMessage(chatId, text, inlineKeyboard = null) {
  const body = { chat_id: chatId, text, parse_mode: 'Markdown' };
  if (inlineKeyboard) body.reply_markup = { inline_keyboard: inlineKeyboard };
  await fetch(`${BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function answerCallback(callbackQueryId, text = '') {
  await fetch(`${BASE}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text })
  });
}

// ─── Sesiones (Supabase) ──────────────────────────────────────────────────────

async function getSession(chatId) {
  const { data } = await db.from('bot_sessions').select('*').eq('chat_id', chatId).maybeSingle();
  return data || { chat_id: chatId, state: 'idle', data: {} };
}

async function setState(chatId, state, data = {}) {
  await db.from('bot_sessions').upsert(
    { chat_id: chatId, state, data, updated_at: new Date().toISOString() },
    { onConflict: 'chat_id' }
  );
}

async function clearSession(chatId) {
  await setState(chatId, 'idle', {});
}

// ─── Config ───────────────────────────────────────────────────────────────────

async function getTRM() {
  try {
    const { data } = await db.from('configuracion').select('valor').eq('clave', 'trm').maybeSingle();
    return data ? parseFloat(data.valor) : 4000;
  } catch { return 4000; }
}

// ─── Categorías de gasto ──────────────────────────────────────────────────────

const CATEGORIAS_GASTO = [
  'Envíos Nacionales',
  'Material Empaques',
  'Publicidad / Pauta',
  'Comisión / PayPal',
  'Compra Inventario',
  'Varios'
];

// ─── HANDLERS DE CONSULTA (sin estado, siempre disponibles) ──────────────────

async function handleAyuda() {
  return (
    `🏆 *H90 Assistant — Herencia 90*\n\n` +
    `*📝 Registrar (flujo guiado):*\n` +
    `• Escribe \`venta\` → te guío paso a paso\n` +
    `• Escribe \`gasto\` → te guío paso a paso\n\n` +
    `*📊 Consultar:*\n` +
    `• \`caja\` — saldo actual\n` +
    `• \`stock\` o \`stock real madrid\` — inventario\n` +
    `• \`ventas hoy\` / \`ventas mes\`\n` +
    `• \`resumen\` — resumen del mes\n` +
    `• \`top\` — más vendidas\n\n` +
    `*📦 Pedidos:*\n` +
    `• \`pedido Juan García - Colombia L - Bogotá\`\n` +
    `• \`pedidos\` — ver todos con estado\n` +
    `• \`pagar Juan García\` — marcar como pagado\n` +
    `• \`enviar Juan García 15000\` — marcar enviado\n\n` +
    `*↩️ Correcciones:*\n` +
    `• \`anular\` — anula la última transacción del día`
  );
}

async function handleCaja() {
  const { data } = await db.from('transacciones').select('tipo, monto');
  const ingresos = data.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + Number(t.monto), 0);
  const gastos   = data.filter(t => t.tipo === 'gasto').reduce((s, t) => s + Number(t.monto), 0);
  return `💵 *Caja actual:* ${fmt.format(ingresos - gastos)}\n📈 Ingresos: ${fmt.format(ingresos)}\n📉 Gastos: ${fmt.format(gastos)}`;
}

async function handleStock({ busqueda }) {
  let query = db.from('productos').select('equipo, tallas');
  if (busqueda) query = query.ilike('equipo', `%${busqueda}%`);
  const { data } = await query.order('equipo');
  if (!data || data.length === 0) return `❌ No encontré productos con "${busqueda}"`;
  let msg = `📦 *Stock${busqueda ? ` — "${busqueda}"` : ' completo'}:*\n\n`;
  data.forEach(p => {
    const t = p.tallas;
    const total = (t.S || 0) + (t.M || 0) + (t.L || 0) + (t.XL || 0);
    msg += `${total === 0 ? '🔴' : total <= 3 ? '🟡' : '🟢'} *${p.equipo}*\n   S:${t.S || 0} M:${t.M || 0} L:${t.L || 0} XL:${t.XL || 0} | Total: ${total}\n`;
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
  const trm = await getTRM();
  const ganancia = data.reduce((s, t) => s + Number(t.monto) - (Number(t.costo_usd_asociado) * (Number(t.trm) || trm)), 0);
  let msg = `📊 *Ventas ${periodo === 'hoy' ? 'de hoy' : periodo === 'mes' ? 'del mes' : 'totales'}:*\n\n`;
  data.slice(0, 10).forEach(t => { msg += `• ${t.descripcion} — ${fmt.format(t.monto)}\n`; });
  if (data.length > 10) msg += `_...y ${data.length - 10} más_\n`;
  return msg + `\n💰 *Total:* ${fmt.format(total)}\n💎 *Ganancia est.:* ${fmt.format(ganancia)}`;
}

async function handleResumen() {
  const { data } = await db.from('transacciones').select('*').like('fecha', `${thisMonth()}%`);
  if (!data || data.length === 0) return `📋 No hay transacciones este mes.`;
  const ingresos = data.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + Number(t.monto), 0);
  const gastos   = data.filter(t => t.tipo === 'gasto').reduce((s, t) => s + Number(t.monto), 0);
  const ventas   = data.filter(t => t.tipo === 'ingreso' && t.categoria === 'Venta de Producto');
  const trm = await getTRM();
  const ganancia = ventas.reduce((s, t) => s + Number(t.monto) - (Number(t.costo_usd_asociado) * (Number(t.trm) || trm)), 0);
  const [y, m] = thisMonth().split('-');
  const nombreMes = new Date(y, m - 1).toLocaleString('es-CO', { month: 'long', year: 'numeric' });
  return (
    `📋 *Resumen ${nombreMes}*\n\n` +
    `📈 Ingresos totales: ${fmt.format(ingresos)}\n` +
    `📉 Gastos operacionales: ${fmt.format(gastos)}\n` +
    `💰 Saldo caja: ${fmt.format(ingresos - gastos)}\n\n` +
    `👕 Ventas: ${ventas.length} unidades\n` +
    `💎 Ganancia bruta: ${fmt.format(ganancia)}\n` +
    `🏆 Ganancia real: ${fmt.format(ganancia - gastos)}`
  );
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
  return '🏆 *Top camisetas:*\n\n' + sorted.map(([n, c], i) => `${medallas[i]} ${n}: ${c} vendida${c > 1 ? 's' : ''}`).join('\n');
}

async function handlePendientes() {
  const { data } = await db.from('transacciones').select('fecha, descripcion').like('descripcion', '[PENDIENTE]%').order('fecha', { ascending: false });
  if (!data || data.length === 0) return '✅ No hay pedidos pendientes.';
  return '📦 *Pedidos pendientes:*\n\n' + data.map(t => `• ${t.fecha} — ${t.descripcion.replace('[PENDIENTE] ', '')}`).join('\n');
}

async function handlePedidos() {
  const { data } = await db.from('transacciones')
    .select('fecha, descripcion')
    .or('descripcion.like.[PENDIENTE]%,descripcion.like.[PAGADO]%,descripcion.like.[ENVIADO]%')
    .order('fecha', { ascending: false });
  if (!data || data.length === 0) return '✅ No hay pedidos registrados.';
  const iconos = { 'PENDIENTE': '🟡', 'PAGADO': '🟢', 'ENVIADO': '📦' };
  let msg = '📋 *Estado de pedidos:*\n\n';
  data.forEach(t => {
    const estado = Object.keys(iconos).find(k => t.descripcion.startsWith(`[${k}]`)) || 'PENDIENTE';
    const desc = t.descripcion.replace(/^\[.*?\]\s*/, '');
    msg += `${iconos[estado]} *${estado}* — ${t.fecha}\n   ${desc}\n`;
  });
  return msg;
}

async function handlePagar({ texto }) {
  if (!texto) return `❌ Indica el nombre. Ej: \`pagar Juan García\``;
  const { data } = await db.from('transacciones').select('id, descripcion').like('descripcion', `[PENDIENTE]%${texto}%`).limit(1);
  if (!data || data.length === 0) return `❌ No encontré pedido pendiente con "${texto}"`;
  const nuevaDesc = data[0].descripcion.replace('[PENDIENTE]', '[PAGADO]');
  const { error } = await db.from('transacciones').update({ descripcion: nuevaDesc }).eq('id', data[0].id);
  if (error) return `❌ Error: ${error.message}`;
  return `✅ *Pedido marcado como pagado:*\n${nuevaDesc.replace('[PAGADO] ', '')}`;
}

async function handleEnviar({ texto, costo }) {
  if (!texto) return `❌ Indica el nombre. Ej: \`enviar Juan García 15000\``;
  let registroId = null;
  const { data } = await db.from('transacciones').select('id, descripcion').like('descripcion', `[PAGADO]%${texto}%`).limit(1);
  if (data && data.length > 0) {
    const nuevaDesc = data[0].descripcion.replace('[PAGADO]', '[ENVIADO]');
    await db.from('transacciones').update({ descripcion: nuevaDesc }).eq('id', data[0].id);
  } else {
    const { data: d2 } = await db.from('transacciones').select('id, descripcion').like('descripcion', `[PENDIENTE]%${texto}%`).limit(1);
    if (!d2 || d2.length === 0) return `❌ No encontré pedido con "${texto}".`;
    const nuevaDesc = d2[0].descripcion.replace('[PENDIENTE]', '[ENVIADO]');
    await db.from('transacciones').update({ descripcion: nuevaDesc }).eq('id', d2[0].id);
  }
  let gastoMsg = '';
  if (costo > 0) {
    const trm = await getTRM();
    await db.from('transacciones').insert({
      id: randomUUID(), tipo: 'gasto', categoria: 'Envíos Nacionales',
      fecha: today(), monto: costo, usd_amount: costo / trm, trm,
      descripcion: `Envío — ${texto}`, costo_usd_asociado: 0
    });
    gastoMsg = `\n💸 Gasto de envío: ${fmt.format(costo)}`;
  }
  return `📦 *Pedido marcado como enviado:*\n${texto}${gastoMsg}`;
}

async function handleAnular() {
  const { data } = await db.from('transacciones').select('*').eq('fecha', today()).order('created_at', { ascending: false }).limit(1);
  const trans = data && data.length > 0 ? data[0] : null;
  if (!trans) return `❌ No hay transacciones de hoy para anular.`;
  if (trans.tipo === 'ingreso' && trans.categoria === 'Venta de Producto') {
    const tallaMatch  = trans.descripcion.match(/talla\s+(XS|S|M|L|XL|XXL)/i);
    const equipoMatch = trans.descripcion.match(/Camiseta\s+(.+?)\s+talla/i);
    if (tallaMatch && equipoMatch) {
      const talla = tallaMatch[1].toUpperCase();
      const equipo = equipoMatch[1];
      const { data: prods } = await db.from('productos').select('id, tallas').ilike('equipo', `%${equipo}%`);
      if (prods && prods.length === 1) {
        const tallas = prods[0].tallas;
        tallas[talla] = (tallas[talla] || 0) + 1;
        await db.from('productos').update({ tallas }).eq('id', prods[0].id);
      }
    }
  }
  const { error } = await db.from('transacciones').delete().eq('id', trans.id);
  if (error) return `❌ Error: ${error.message}`;
  const tipo = trans.tipo === 'ingreso' ? '💰 Ingreso' : '💸 Gasto';
  return `🗑️ *Anulado:*\n${tipo}: ${trans.descripcion}\nMonto: ${fmt.format(trans.monto)}${trans.tipo === 'ingreso' && trans.categoria === 'Venta de Producto' ? '\n📦 Stock restaurado' : ''}`;
}

async function handlePedido({ descripcion }) {
  const { error } = await db.from('transacciones').insert({
    id: randomUUID(), tipo: 'gasto', categoria: 'Envíos Nacionales',
    fecha: today(), monto: 0, usd_amount: 0, trm: 4000,
    descripcion: `[PENDIENTE] ${descripcion}`, costo_usd_asociado: 0
  });
  if (error) return `❌ Error: ${error.message}`;
  return `📦 *Pedido pendiente registrado:*\n${descripcion}`;
}

// ─── FLUJO VENTA (multi-paso) ─────────────────────────────────────────────────

async function startVenta(chatId) {
  await setState(chatId, 'venta:buscar', {});
  await sendMessage(chatId,
    `👕 *Nueva Venta*\n\n¿Qué equipo buscas?\nEscribe el nombre o parte del nombre:\n_(ej: "real", "colombia", "boca")_`
  );
}

async function handleBuscarEquipo(chatId, texto) {
  const { data: prods } = await db.from('productos')
    .select('id, equipo, tallas, precio')
    .ilike('equipo', `%${texto}%`)
    .order('equipo');

  if (!prods || prods.length === 0) {
    await setState(chatId, 'venta:buscar', {});
    await sendMessage(chatId,
      `❌ No encontré camisetas con *"${texto}"*\n\nIntenta con otro término _(ej: "real", "colombia")_\no escribe \`stock\` para ver todo el inventario.`
    );
    return;
  }

  // Si coincide exactamente uno, saltar directo a talla
  if (prods.length === 1) {
    await handleElegirProductoById(chatId, prods[0].id);
    return;
  }

  // Múltiples: mostrar como botones inline (máx 8 para no saturar)
  const lista = prods.slice(0, 8);
  const keyboard = lista.map(p => {
    const total = Object.values(p.tallas || {}).reduce((a, b) => a + (parseInt(b) || 0), 0);
    const emoji = total === 0 ? '🔴' : total <= 3 ? '🟡' : '🟢';
    return [{ text: `${emoji} ${p.equipo}`, callback_data: `prod:${p.id}` }];
  });
  keyboard.push([{ text: '🔍 Buscar diferente', callback_data: 'back:buscar' }, { text: '❌ Cancelar', callback_data: 'cancel' }]);

  await setState(chatId, 'venta:elegir', { matches: lista.map(p => p.id) });
  await sendMessage(chatId,
    `👕 Encontré *${prods.length}* referencia${prods.length > 1 ? 's' : ''} para *"${texto}"*:\n_(🟢 disponible · 🟡 poco stock · 🔴 agotado)_`,
    keyboard
  );
}

async function handleElegirProductoById(chatId, productId) {
  const { data: prod } = await db.from('productos')
    .select('id, equipo, tallas, precio, costo_usd')
    .eq('id', productId)
    .single();

  if (!prod) {
    await sendMessage(chatId, '❌ Producto no encontrado.');
    return;
  }

  const tallas = prod.tallas || {};
  const disponibles = Object.entries(tallas).filter(([, qty]) => (parseInt(qty) || 0) > 0);

  if (disponibles.length === 0) {
    await clearSession(chatId);
    await sendMessage(chatId,
      `⚠️ *${prod.equipo}* no tiene stock disponible en ninguna talla.\n\nEscribe \`venta\` para buscar otro producto.`
    );
    return;
  }

  // Botones de talla en una fila: "S (3)" "M (5)" "L (1)"
  const tallaRow = disponibles.map(([s, qty]) => ({
    text: `${s} (${qty})`, callback_data: `talla:${s}`
  }));
  const keyboard = [
    tallaRow,
    [{ text: '← Buscar otro equipo', callback_data: 'back:buscar' }, { text: '❌ Cancelar', callback_data: 'cancel' }]
  ];

  await setState(chatId, 'venta:talla', {
    product_id:    prod.id,
    product_name:  prod.equipo,
    product_price: prod.precio,
    costo_usd:     prod.costo_usd || 10.44
  });

  await sendMessage(chatId,
    `👕 *${prod.equipo}*\n💰 Precio sugerido: ${fmt.format(prod.precio)}\n\n¿En qué talla fue la venta?\n_(el número entre paréntesis es el stock actual)_`,
    keyboard
  );
}

async function handleElegirTalla(chatId, talla, sesData) {
  await setState(chatId, 'venta:precio', { ...sesData, talla });
  await sendMessage(chatId,
    `👕 *${sesData.product_name}* — Talla *${talla}*\n\n💵 ¿En cuánto la vendiste?\nEscribe el precio en pesos _(ej: 90000)_\n\n_Precio sugerido: ${fmt.format(sesData.product_price)}_`
  );
}

async function handlePrecioVenta(chatId, texto, sesData) {
  const precio = parseInt(texto.replace(/[^\d]/g, ''), 10);
  if (!precio || precio < 10000) {
    await sendMessage(chatId, `❌ No entendí el precio. Escribe solo el número, ej: \`90000\``);
    return;
  }
  const trm = await getTRM();
  const gananciaEst = precio - (sesData.costo_usd * trm);
  const keyboard = [[
    { text: '✅ Confirmar', callback_data: 'confirm:yes' },
    { text: '❌ Cancelar', callback_data: 'cancel' }
  ]];
  await setState(chatId, 'venta:confirmar', { ...sesData, precio, trm });
  await sendMessage(chatId,
    `📋 *Confirmar venta:*\n\n` +
    `👕 ${sesData.product_name}\n` +
    `📏 Talla: ${sesData.talla}\n` +
    `💰 Precio: ${fmt.format(precio)}\n` +
    `💎 Ganancia estimada: ${fmt.format(gananciaEst)}\n\n` +
    `¿Todo correcto?`,
    keyboard
  );
}

async function confirmarVenta(chatId, sesData) {
  const { product_id, product_name, talla, precio, trm, costo_usd } = sesData;

  const { error } = await db.from('transacciones').insert({
    id: randomUUID(), tipo: 'ingreso', categoria: 'Venta de Producto',
    fecha: today(), monto: precio,
    usd_amount: precio / trm, trm,
    descripcion: `Camiseta ${product_name} talla ${talla} ${fmt.format(precio)}`,
    costo_usd_asociado: costo_usd || 10.44
  });

  if (error) {
    await sendMessage(chatId, `❌ Error guardando: ${error.message}`);
    return;
  }

  // Descontar stock usando el ID exacto del producto
  const { data: prods } = await db.from('productos').select('id, tallas').eq('id', product_id);
  let alertaStock = '';
  if (prods && prods.length === 1) {
    const tallas = prods[0].tallas || {};
    if ((tallas[talla] || 0) > 0) {
      tallas[talla]--;
      await db.from('productos').update({ tallas }).eq('id', prods[0].id);
      const restante = tallas[talla];
      alertaStock = restante === 0 ? `\n⚠️ *Stock talla ${talla} AGOTADO*` :
                    restante <= 2  ? `\n⚡ Solo quedan *${restante}* en talla ${talla}` :
                                     `\n📦 Quedan ${restante} en talla ${talla}`;
    } else {
      alertaStock = `\n⚠️ Talla ${talla} ya estaba en 0 (stock no modificado)`;
    }
  }

  await sendMessage(chatId,
    `✅ *Venta registrada*\n👕 ${product_name} — Talla ${talla}\n💰 ${fmt.format(precio)}${alertaStock}`
  );
}

// ─── FLUJO GASTO (multi-paso) ─────────────────────────────────────────────────

async function startGasto(chatId) {
  const keyboard = CATEGORIAS_GASTO.map(cat => [{ text: cat, callback_data: `cat:${cat}` }]);
  keyboard.push([{ text: '❌ Cancelar', callback_data: 'cancel' }]);
  await setState(chatId, 'gasto:categoria', {});
  await sendMessage(chatId, `💸 *Nuevo Gasto*\n\n¿De qué categoría es?`, keyboard);
}

async function handleDescripcionGasto(chatId, texto, sesData) {
  await setState(chatId, 'gasto:monto', { ...sesData, descripcion: texto });
  await sendMessage(chatId,
    `💸 *${sesData.categoria}*\n📝 ${texto}\n\n¿Cuánto fue el gasto?\nEscribe el monto en pesos _(ej: 22000)_`
  );
}

async function handleMontoGasto(chatId, texto, sesData) {
  const monto = parseInt(texto.replace(/[^\d]/g, ''), 10);
  if (!monto || monto < 100) {
    await sendMessage(chatId, `❌ No entendí el monto. Escribe el número, ej: \`22000\``);
    return;
  }
  const trm = await getTRM();
  const { error } = await db.from('transacciones').insert({
    id: randomUUID(), tipo: 'gasto',
    categoria: sesData.categoria,
    fecha: today(), monto,
    usd_amount: monto / trm, trm,
    descripcion: sesData.descripcion,
    costo_usd_asociado: 0
  });
  await clearSession(chatId);
  if (error) {
    await sendMessage(chatId, `❌ Error: ${error.message}`);
    return;
  }
  await sendMessage(chatId,
    `✅ *Gasto registrado*\n📁 ${sesData.categoria}\n📝 ${sesData.descripcion}\n💸 -${fmt.format(monto)}`
  );
}

// ─── ROUTER PRINCIPAL ─────────────────────────────────────────────────────────

async function routeMessage(chatId, rawText, session) {
  const raw = rawText.trim().toLowerCase();

  // ── Comandos de consulta (siempre disponibles, limpian cualquier flujo activo)
  if (['ayuda', '/ayuda', '/help', '/start'].includes(raw)) {
    await clearSession(chatId);
    return handleAyuda();
  }
  if (['caja', '/caja'].includes(raw)) {
    await clearSession(chatId); return handleCaja();
  }
  if (['resumen', '/resumen'].includes(raw)) {
    await clearSession(chatId); return handleResumen();
  }
  if (raw.startsWith('top') || raw === '/top') {
    await clearSession(chatId); return handleTop();
  }
  if (['pendientes', '/pendientes'].includes(raw)) {
    await clearSession(chatId); return handlePendientes();
  }
  if (['pedidos', '/pedidos'].includes(raw)) {
    await clearSession(chatId); return handlePedidos();
  }
  if (['anular', '/anular'].includes(raw)) {
    await clearSession(chatId); return handleAnular();
  }
  if (raw.startsWith('pagar') || raw.startsWith('/pagar')) {
    await clearSession(chatId);
    return handlePagar({ texto: rawText.replace(/^\/?(pagar)\s*/i, '').trim() });
  }
  if (raw.startsWith('enviar') || raw.startsWith('/enviar')) {
    await clearSession(chatId);
    const resto = rawText.replace(/^\/?(enviar)\s*/i, '').trim();
    const montoMatch = resto.match(/\b(\d{3,9})\b/);
    const costo = montoMatch ? parseInt(montoMatch[1]) : 0;
    const textoEnvio = resto.replace(/\b\d{3,9}\b/, '').trim();
    return handleEnviar({ texto: textoEnvio, costo });
  }
  if (raw.startsWith('ventas')) {
    await clearSession(chatId);
    const periodo = raw.includes('hoy') ? 'hoy' : raw.includes('mes') ? 'mes' : 'todo';
    return handleVentas({ periodo });
  }
  if (raw.startsWith('stock') || raw.startsWith('/stock')) {
    await clearSession(chatId);
    const busqueda = raw.replace(/^\/?(stock)\s*/i, '').trim() || null;
    return handleStock({ busqueda });
  }
  if (raw.startsWith('pedido') || raw.startsWith('/pedido')) {
    await clearSession(chatId);
    return handlePedido({ descripcion: rawText.replace(/^\/?(pedido)\s*/i, '').trim() });
  }

  // ── Iniciar flujos guiados
  if (['venta', '/venta', 'registrar', 'vender', 'nueva venta'].includes(raw)) {
    await startVenta(chatId);
    return null;
  }
  if (['gasto', '/gasto', 'nuevo gasto'].includes(raw)) {
    await startGasto(chatId);
    return null;
  }
  if (['cancelar', 'cancel'].includes(raw) && session.state !== 'idle') {
    await clearSession(chatId);
    return '❌ Acción cancelada.';
  }

  // ── Procesar según el estado activo del flujo
  if (session.state !== 'idle') {
    return routeByState(chatId, rawText, session);
  }

  return `🤔 No entendí. Escribe *ayuda* para ver los comandos.\n\n_Registro rápido:_ \`venta\` · \`gasto\`\n_Consulta:_ \`caja\` · \`top\` · \`stock\``;
}

async function routeByState(chatId, rawText, session) {
  const { state, data } = session;

  if (state === 'venta:buscar') {
    await handleBuscarEquipo(chatId, rawText.trim());
    return null;
  }
  if (state === 'venta:elegir') {
    // El usuario escribe un número en vez de tocar el botón
    const idx = parseInt(rawText.trim()) - 1;
    const matches = data.matches || [];
    if (idx >= 0 && idx < matches.length) {
      await handleElegirProductoById(chatId, matches[idx]);
      return null;
    }
    // Intenta como búsqueda nueva
    await handleBuscarEquipo(chatId, rawText.trim());
    return null;
  }
  if (state === 'venta:precio') {
    await handlePrecioVenta(chatId, rawText, data);
    return null;
  }
  if (state === 'gasto:descripcion') {
    await handleDescripcionGasto(chatId, rawText.trim(), data);
    return null;
  }
  if (state === 'gasto:monto') {
    await handleMontoGasto(chatId, rawText, data);
    return null;
  }

  // Estado activo pero texto no reconocido
  return `📍 Estás en el flujo de *${state.split(':')[0]}*. Escribe *cancelar* para salir.`;
}

async function routeCallback(chatId, callbackData, callbackQueryId, session) {
  await answerCallback(callbackQueryId);

  if (callbackData === 'cancel') {
    await clearSession(chatId);
    await sendMessage(chatId, '❌ Cancelado.\n\nEscribe *venta* o *gasto* cuando quieras registrar.');
    return;
  }

  if (callbackData === 'back:buscar') {
    await setState(chatId, 'venta:buscar', {});
    await sendMessage(chatId, '🔍 ¿Qué equipo buscas? Escribe el nombre o parte del nombre:');
    return;
  }

  if (callbackData.startsWith('prod:')) {
    const productId = parseInt(callbackData.replace('prod:', ''));
    await handleElegirProductoById(chatId, productId);
    return;
  }

  if (callbackData.startsWith('talla:') && session.state === 'venta:talla') {
    const talla = callbackData.replace('talla:', '');
    await handleElegirTalla(chatId, talla, session.data);
    return;
  }

  if (callbackData === 'confirm:yes' && session.state === 'venta:confirmar') {
    await clearSession(chatId);
    await confirmarVenta(chatId, session.data);
    return;
  }

  if (callbackData.startsWith('cat:') && session.state === 'gasto:categoria') {
    const categoria = callbackData.replace('cat:', '');
    await setState(chatId, 'gasto:descripcion', { categoria });
    await sendMessage(chatId, `💸 *${categoria}*\n\n¿Cuál es la descripción del gasto?\n_(ej: "Cajas envíos semana 15")_`);
    return;
  }
}

// ─── WEBHOOK HANDLER ──────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true });

  try {
    const body = req.body;
    const allowedChat = process.env.TELEGRAM_CHAT_ID;

    // ── Callback de botón inline
    if (body.callback_query) {
      const cq = body.callback_query;
      const chatId = cq.message.chat.id;
      if (allowedChat && String(chatId) !== String(allowedChat)) {
        await answerCallback(cq.id, '⛔ No autorizado');
        return res.status(200).json({ ok: true });
      }
      const session = await getSession(chatId);
      await routeCallback(chatId, cq.data, cq.id, session);
      return res.status(200).json({ ok: true });
    }

    // ── Mensaje de texto
    if (!body.message || !body.message.text) return res.status(200).json({ ok: true });

    const chatId = body.message.chat.id;
    if (allowedChat && String(chatId) !== String(allowedChat)) {
      await sendMessage(chatId, '⛔ No estás autorizado.');
      return res.status(200).json({ ok: true });
    }

    const session = await getSession(chatId);
    const reply = await routeMessage(chatId, body.message.text, session);
    if (reply) await sendMessage(chatId, reply);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Bot error:', err);
    return res.status(200).json({ ok: true });
  }
};
