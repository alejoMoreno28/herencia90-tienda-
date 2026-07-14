(function adminInventoryEditorModule(globalScope, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (globalScope) globalScope.AdminInventoryEditor = api;
}(typeof window !== 'undefined' ? window : undefined, function adminInventoryEditorFactory() {
    const MAX_STOCK_PER_SIZE = 10000;

    function snapshot(products) {
        return JSON.parse(JSON.stringify(Array.isArray(products) ? products : []));
    }

    function parseQuantity(value) {
        if (value === '' || value === null || value === undefined) {
            return { ok: false, value: null, error: 'El stock no puede estar vacio.' };
        }
        const quantity = Number(value);
        if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_STOCK_PER_SIZE) {
            return { ok: false, value: null, error: `El stock debe ser un entero entre 0 y ${MAX_STOCK_PER_SIZE}.` };
        }
        return { ok: true, value: quantity, error: '' };
    }

    function isSafeSize(size) {
        return /^[A-Z0-9.+_-]{1,16}$/i.test(String(size || '')) && !String(size).startsWith('R_');
    }

    function getProduct(products, index) {
        if (!Array.isArray(products) || !Number.isInteger(index) || !products[index]) return null;
        const product = products[index];
        if (!product.tallas || typeof product.tallas !== 'object' || Array.isArray(product.tallas)) product.tallas = {};
        return product;
    }

    function setStock(products, index, size, rawValue) {
        const product = getProduct(products, index);
        if (!product || !isSafeSize(size)) return { ok: false, value: null, error: 'Producto o talla invalida.' };
        const parsed = parseQuantity(rawValue);
        if (!parsed.ok) return parsed;
        product.tallas[size] = parsed.value;
        return { ok: true, value: parsed.value, productId: product.id, error: '' };
    }

    function moveReservation(products, index, size, direction) {
        const product = getProduct(products, index);
        if (!product || !isSafeSize(size) || !['reserve', 'release'].includes(direction)) {
            return { ok: false, error: 'Movimiento de reserva invalido.' };
        }
        const available = parseQuantity(product.tallas[size] ?? 0);
        const reservedKey = `R_${size}`;
        const reserved = parseQuantity(product.tallas[reservedKey] ?? 0);
        if (!available.ok || !reserved.ok) return { ok: false, error: 'El stock actual contiene valores invalidos.' };
        if (direction === 'reserve' && available.value === 0) return { ok: false, error: 'No hay unidades disponibles para reservar.' };
        if (direction === 'release' && reserved.value === 0) return { ok: false, error: 'No hay unidades reservadas para liberar.' };

        product.tallas[size] = available.value + (direction === 'release' ? 1 : -1);
        product.tallas[reservedKey] = reserved.value + (direction === 'reserve' ? 1 : -1);
        return { ok: true, productId: product.id, error: '' };
    }

    function canonicalize(value) {
        if (Array.isArray(value)) return value.map(canonicalize);
        if (value && typeof value === 'object') {
            return Object.keys(value).sort().reduce((result, key) => {
                result[key] = canonicalize(value[key]);
                return result;
            }, {});
        }
        return value;
    }

    function fingerprint(value) {
        return JSON.stringify(canonicalize(value));
    }

    function validateProducts(products) {
        const errors = [];
        const ids = new Set();
        for (const [index, product] of (Array.isArray(products) ? products : []).entries()) {
            const label = String(product && (product.equipo || product.id) || `fila ${index + 1}`);
            const id = Number(product && product.id);
            if (!Number.isInteger(id) || id <= 0) errors.push(`${label}: ID invalido.`);
            if (ids.has(String(id))) errors.push(`${label}: ID duplicado (${id}).`);
            ids.add(String(id));
            if (!String(product && product.equipo || '').trim()) errors.push(`${label}: falta la referencia.`);
            if (!String(product && product.categoria || '').trim()) errors.push(`${label}: falta la categoria.`);
            const price = Number(product && product.precio);
            if (!Number.isFinite(price) || price < 0) errors.push(`${label}: precio invalido.`);
            const cost = Number(product && product.costo_usd || 0);
            if (!Number.isFinite(cost) || cost < 0) errors.push(`${label}: costo invalido.`);
            if (!product || !product.tallas || typeof product.tallas !== 'object' || Array.isArray(product.tallas)) {
                errors.push(`${label}: tallas invalidas.`);
                continue;
            }
            for (const [size, quantity] of Object.entries(product.tallas)) {
                const parsed = parseQuantity(quantity);
                if (!parsed.ok) errors.push(`${label}: stock invalido en ${size}.`);
            }
        }
        return errors;
    }

    function buildSavePlan(currentProducts, baselineProducts, onlyIds) {
        const current = Array.isArray(currentProducts) ? currentProducts : [];
        const errors = validateProducts(current);
        if (errors.length) return { ok: false, payload: [], changedIds: [], errors };

        const baselineById = new Map((Array.isArray(baselineProducts) ? baselineProducts : [])
            .map((product) => [String(product.id), product]));
        const selectedIds = Array.isArray(onlyIds) ? new Set(onlyIds.map(String)) : null;
        const payload = [];
        const changedIds = [];

        for (const product of current) {
            const id = String(product.id);
            if (selectedIds && !selectedIds.has(id)) continue;
            const baseline = baselineById.get(id);
            if (!baseline || fingerprint(product) !== fingerprint(baseline)) {
                payload.push(snapshot([product])[0]);
                changedIds.push(product.id);
            }
        }
        return { ok: true, payload, changedIds, errors: [] };
    }

    return {
        MAX_STOCK_PER_SIZE,
        buildSavePlan,
        moveReservation,
        parseQuantity,
        setStock,
        snapshot,
        validateProducts,
    };
}));
