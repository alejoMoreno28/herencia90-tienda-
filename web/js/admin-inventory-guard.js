(function () {
    function toNumber(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : 0;
    }

    function isSaleCategory(category) {
        return String(category || '').toLowerCase().includes('venta');
    }

    function normalizeCategory(category) {
        return String(category || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    }

    function isStockMovementCategory(category) {
        const text = normalizeCategory(category);
        return text.includes('venta')
            || text.includes('regalo')
            || text.includes('retiro personal')
            || text.includes('defectuoso');
    }

    function prefixForCategory(category) {
        const text = normalizeCategory(category);
        if (text.includes('regalo')) return 'REGALO';
        if (text.includes('retiro personal')) return 'RETIRO PERSONAL';
        if (text.includes('defectuoso')) return 'DEFECTUOSO';
        return 'VENTA';
    }

    function normalizeItem(rawItem, products) {
        if (!rawItem || !rawItem.prodId) return { error: 'Selecciona una camiseta para cada linea.' };

        const product = (products || []).find(item => String(item.id) === String(rawItem.prodId));
        if (!product) return { error: 'Una camiseta seleccionada ya no existe en inventario.' };

        const size = String(rawItem.talla || '').trim();
        if (!size) return { error: `Selecciona talla para ${product.equipo}.` };

        const quantity = Math.max(0, parseInt(rawItem.cantidad, 10) || 0);
        if (quantity <= 0) return { error: `Ingresa una cantidad valida para ${product.equipo}.` };

        const stock = toNumber((product.tallas || {})[size]);
        if (stock < quantity) {
            return { error: `${product.equipo} talla ${size}: solo hay ${stock} disponible(s).` };
        }

        const unitCostUsd = toNumber(product.costo_usd);
        return {
            prodId: product.id,
            productName: product.equipo || `Producto ${product.id}`,
            talla: size,
            cantidad: quantity,
            stock,
            unitCostUsd,
            subtotalCostUsd: unitCostUsd * quantity
        };
    }

    function buildDescription(prefix, items, note) {
        const lines = items.map(item => `${item.productName} talla ${item.talla} x${item.cantidad}`);
        const cleanNote = String(note || '').trim();
        return `[${prefix}] ${lines.join('; ')}${cleanNote ? ` | Nota: ${cleanNote}` : ''}`;
    }

    function buildStockMovement(options) {
        const opts = options || {};
        const category = opts.category || '';
        const amountCOP = toNumber(opts.amountCOP);
        const errors = [];

        if (isSaleCategory(category) && amountCOP <= 0) {
            errors.push('Una venta cobrada debe tener monto mayor a $0. Usa regalo/retiro para salidas sin ingreso.');
        }

        const rawItems = (opts.items || []).filter(Boolean);
        if (!rawItems.length) {
            errors.push('Selecciona al menos una camiseta, talla y cantidad.');
        }

        const items = [];
        rawItems.forEach(rawItem => {
            const item = normalizeItem(rawItem, opts.products || []);
            if (item.error) errors.push(item.error);
            else items.push(item);
        });

        const totalCostUsd = items.reduce((sum, item) => sum + item.subtotalCostUsd, 0);
        const totalUnits = items.reduce((sum, item) => sum + item.cantidad, 0);

        return {
            ok: errors.length === 0,
            errors,
            items,
            totalUnits,
            totalCostUsd: Number(totalCostUsd.toFixed(2)),
            description: errors.length ? '' : buildDescription(prefixForCategory(category), items, opts.note)
        };
    }

    window.AdminInventoryGuard = {
        buildStockMovement,
        isStockMovementCategory
    };
}());
