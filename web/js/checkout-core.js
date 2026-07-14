(function checkoutCoreModule(globalScope, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (globalScope) globalScope.H90CheckoutCore = api;
}(typeof window !== 'undefined' ? window : undefined, function checkoutCoreFactory() {
    const MAX_QUANTITY_PER_LINE = 10;

    function asText(value, maxLength = 180) {
        return String(value == null ? '' : value).trim().replace(/\s+/g, ' ').slice(0, maxLength);
    }

    function asPositiveInteger(value, fallback = 1) {
        const number = Math.floor(Number(value));
        return Number.isFinite(number) && number > 0 ? number : fallback;
    }

    function isPreorderProduct(product) {
        if (!product) return false;
        if (product.is_preventa === true || product.preventa === true || product.bajo_pedido === true) return true;
        const descriptor = [product.categoria, product.modalidad, product.tipo, product.estado]
            .map((value) => asText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())
            .join(' ');
        return /pre[ -]?venta|pre[ -]?orden|bajo pedido/.test(descriptor);
    }

    function getSizeEntry(product, requestedSize) {
        const target = asText(requestedSize, 40).toUpperCase();
        const entries = Object.entries(product && product.tallas && typeof product.tallas === 'object' ? product.tallas : {});
        return entries.find(([size]) => !size.toUpperCase().startsWith('R_') && asText(size, 40).toUpperCase() === target) || null;
    }

    function getProductImage(product) {
        const candidate = Array.isArray(product.imagenes) && product.imagenes.length
            ? product.imagenes[0]
            : product.imagen;
        const image = asText(candidate, 500);
        if (!image) return '/img/logo-ui.webp';
        if (/^https?:\/\//i.test(image) || image.startsWith('/')) return image;
        return `/${image.replace(/^\.?\//, '')}`;
    }

    function buildCheckout(cart, catalog) {
        const products = new Map((Array.isArray(catalog) ? catalog : []).map((product) => [String(product.id), product]));
        const lines = [];
        const errors = [];

        for (const cartItem of Array.isArray(cart) ? cart : []) {
            const product = products.get(String(cartItem && cartItem.id));
            const requestedSize = asText(cartItem && cartItem.talla, 40);
            if (!product) {
                errors.push({ code: 'unknown_product', blocking: true, productId: cartItem && cartItem.id, message: 'Una referencia ya no existe en el catálogo.' });
                continue;
            }

            const price = Number(product.precio);
            if (!Number.isFinite(price) || price <= 0) {
                errors.push({ code: 'invalid_price', blocking: true, productId: product.id, message: 'No pudimos verificar el precio de esta referencia.' });
                continue;
            }

            const sizeEntry = getSizeEntry(product, requestedSize);
            if (!sizeEntry) {
                errors.push({ code: 'unknown_size', blocking: true, productId: product.id, size: requestedSize, message: 'La talla elegida ya no está disponible en el catálogo.' });
                continue;
            }

            const preorder = isPreorderProduct(product);
            const available = Math.max(0, Math.floor(Number(sizeEntry[1]) || 0));
            if (!preorder && available <= 0) {
                errors.push({ code: 'out_of_stock', blocking: true, productId: product.id, size: sizeEntry[0], message: 'Esta talla se agotó antes de confirmar el pedido.' });
                continue;
            }

            const requestedQuantity = asPositiveInteger(cartItem && cartItem.cantidad);
            const quantityLimit = preorder ? MAX_QUANTITY_PER_LINE : Math.min(MAX_QUANTITY_PER_LINE, available);
            const quantity = Math.min(requestedQuantity, quantityLimit);
            if (quantity !== requestedQuantity) {
                errors.push({
                    code: 'quantity_adjusted',
                    blocking: false,
                    productId: product.id,
                    size: sizeEntry[0],
                    message: `La cantidad de ${product.equipo} se ajustó a ${quantity}.`
                });
            }

            const existing = lines.find((line) => String(line.id) === String(product.id) && line.size === sizeEntry[0]);
            if (existing) {
                const mergedLimit = preorder ? MAX_QUANTITY_PER_LINE : available;
                existing.quantity = Math.min(existing.quantity + quantity, mergedLimit);
                existing.lineTotal = existing.quantity * existing.unitPrice;
                continue;
            }

            lines.push({
                id: product.id,
                name: asText(product.equipo || product.nombre || 'Camiseta HERENCIA90', 160),
                category: asText(product.categoria, 80),
                size: sizeEntry[0],
                quantity,
                requestedQuantity,
                available: preorder ? null : available,
                mode: preorder ? 'preorder' : 'stock',
                unitPrice: Math.round(price),
                lineTotal: Math.round(price) * quantity,
                image: getProductImage(product)
            });
        }

        if (lines.length === 0 && errors.length === 0) {
            errors.push({ code: 'empty_cart', blocking: true, message: 'Tu carrito está vacío.' });
        }

        const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
        const hasBlockingErrors = errors.some((error) => error.blocking !== false);
        return {
            currency: 'COP',
            lines,
            errors,
            subtotal,
            shipping: null,
            total: subtotal,
            ready: lines.length > 0 && !hasBlockingErrors
        };
    }

    function validateCustomer(customer) {
        const values = {
            name: asText(customer && customer.name, 80),
            phone: asText(customer && customer.phone, 24),
            city: asText(customer && customer.city, 80),
            address: asText(customer && customer.address, 180)
        };
        const errors = {};
        if (values.name.length < 2) errors.name = 'Escribe el nombre de quien recibe.';
        const phoneDigits = values.phone.replace(/\D/g, '');
        if (phoneDigits.length < 10 || phoneDigits.length > 15) errors.phone = 'Escribe un teléfono válido.';
        if (values.city.length < 2) errors.city = 'Escribe la ciudad de entrega.';
        if (values.address.length < 5) errors.address = 'Escribe una dirección completa.';
        values.phone = phoneDigits;
        return { valid: Object.keys(errors).length === 0, values, errors };
    }

    function formatCOP(value) {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(Number(value) || 0).replace(/\s/g, '');
    }

    function buildWhatsAppOrder(checkout, customer) {
        const customerResult = validateCustomer(customer);
        if (!checkout || checkout.ready !== true || !customerResult.valid) {
            return { valid: false, message: '', errors: customerResult.errors };
        }

        const recipient = customerResult.values;
        const lines = checkout.lines.map((line, index) => [
            `${index + 1}. ${line.name}`,
            `   Talla: ${line.size} · Cantidad: ${line.quantity}`,
            `   ${formatCOP(line.lineTotal)}${line.mode === 'preorder' ? ' · Bajo pedido' : ''}`
        ].join('\n'));
        const message = [
            'Hola HERENCIA90, quiero confirmar este pedido desde la web:',
            '',
            ...lines,
            '',
            `Subtotal verificado: ${formatCOP(checkout.subtotal)}`,
            'Envío: por confirmar antes de aceptar el pedido',
            '',
            `Recibe: ${recipient.name}`,
            `Teléfono: ${recipient.phone}`,
            `Ciudad: ${recipient.city}`,
            `Dirección: ${recipient.address}`,
            '',
            'Por favor confirma disponibilidad, costo de envío, total y fecha estimada.'
        ].join('\n');
        return { valid: true, message, errors: {} };
    }

    return {
        MAX_QUANTITY_PER_LINE,
        buildCheckout,
        buildWhatsAppOrder,
        formatCOP,
        isPreorderProduct,
        validateCustomer
    };
}));
