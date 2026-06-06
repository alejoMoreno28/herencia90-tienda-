(function () {
    function toNumber(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function parseCopAmount(value) {
        if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
        const raw = String(value || '').trim().toLowerCase();
        if (!raw) return 0;

        const hasMil = /\bmil\b/.test(raw);
        let text = raw
            .replace(/\bmil\b/g, '')
            .replace(/[^\d,.\-]/g, '')
            .trim();

        if (!text) return 0;

        const lastComma = text.lastIndexOf(',');
        const lastDot = text.lastIndexOf('.');
        if (lastComma > -1 && lastDot > -1) {
            if (lastComma > lastDot) {
                text = text.replace(/\./g, '').replace(',', '.');
            } else {
                text = text.replace(/,/g, '');
            }
        } else if (lastComma > -1) {
            const decimals = text.length - lastComma - 1;
            text = decimals === 3 ? text.replace(/,/g, '') : text.replace(',', '.');
        } else if (lastDot > -1) {
            const decimals = text.length - lastDot - 1;
            text = decimals === 3 ? text.replace(/\./g, '') : text;
        }

        let amount = Number(text);
        if (!Number.isFinite(amount)) return 0;
        if (hasMil && Math.abs(amount) < 1000) amount *= 1000;
        return Math.round(amount);
    }

    function normalizePaymentState(totalValue, abonoValue) {
        const total = Math.max(0, toNumber(totalValue));
        const rawAbono = Math.max(0, toNumber(abonoValue));
        const abono = total > 0 ? Math.min(rawAbono, total) : rawAbono;
        const saldo = Math.max(0, total - abono);
        const estado_pago = total > 0 && saldo === 0 ? 'Pagado' : abono > 0 ? 'Abonado' : 'Pendiente';
        return { total, abono, saldo, estado_pago, wasCapped: rawAbono !== abono };
    }

    function getPedidoTotal(pedido) {
        return toNumber(pedido && pedido.precio_venta);
    }

    function getPedidoAbono(pedido) {
        return toNumber(pedido && pedido.abono);
    }

    function allocateClientPayment(pedidos, amountValue) {
        const amount = Math.max(0, toNumber(amountValue));
        let remaining = amount;
        const updates = [];

        (pedidos || []).forEach((pedido) => {
            if (remaining <= 0) return;
            const current = normalizePaymentState(getPedidoTotal(pedido), getPedidoAbono(pedido));
            if (current.saldo <= 0) return;

            const delta = Math.min(current.saldo, remaining);
            const next = normalizePaymentState(current.total, current.abono + delta);
            updates.push({
                id: pedido.id,
                pedido,
                previousAbono: current.abono,
                delta,
                nextAbono: next.abono,
                saldo: next.saldo,
                estado_pago: next.estado_pago
            });
            remaining -= delta;
        });

        return {
            updates,
            appliedAmount: amount - remaining,
            unappliedAmount: remaining
        };
    }

    function normalizeGroupText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    }

    function buildGroupKey(pedido) {
        const cliente = normalizeGroupText(pedido && pedido.cliente) || 'pendiente por asignar';
        const lote = normalizeGroupText(pedido && pedido.lote_codigo) || 'manual';
        return `${cliente}__${lote}`;
    }

    function buildClientPaymentGroups(pedidos) {
        const groups = new Map();

        (pedidos || []).forEach((pedido) => {
            const state = normalizePaymentState(getPedidoTotal(pedido), getPedidoAbono(pedido));
            if (state.saldo <= 0) return;

            const key = buildGroupKey(pedido);
            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    cliente: String((pedido && pedido.cliente) || 'Pendiente por Asignar').trim() || 'Pendiente por Asignar',
                    lote: String((pedido && pedido.lote_codigo) || 'Manual').trim() || 'Manual',
                    pedidos: [],
                    total: 0,
                    abono: 0,
                    saldo: 0
                });
            }

            const group = groups.get(key);
            group.pedidos.push(pedido);
            group.total += state.total;
            group.abono += state.abono;
            group.saldo += state.saldo;
        });

        return Array.from(groups.values()).sort((a, b) => {
            const aMax = Math.max(...a.pedidos.map((pedido) => Number(pedido.id) || 0));
            const bMax = Math.max(...b.pedidos.map((pedido) => Number(pedido.id) || 0));
            return bMax - aMax;
        });
    }

    window.AdminPedidoPayments = {
        parseCopAmount,
        normalizePaymentState,
        allocateClientPayment,
        buildClientPaymentGroups,
        buildGroupKey
    };
})();
