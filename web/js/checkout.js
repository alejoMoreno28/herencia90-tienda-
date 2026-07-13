(function checkoutPage() {
    const CART_KEY = 'herencia90_cart';
    const WHATSAPP_NUMBER = '573126428153';
    let checkout = null;

    function byId(id) {
        return document.getElementById(id);
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function readCart() {
        try {
            const cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
            return Array.isArray(cart) ? cart : [];
        } catch (error) {
            return [];
        }
    }

    function renderCheckout(result) {
        const items = byId('checkoutItems');
        const issues = byId('checkoutIssues');
        const summary = byId('checkoutSummary');
        const submit = byId('checkoutSubmit');
        const core = window.H90CheckoutCore;

        if (!result.lines.length) {
            items.innerHTML = '<div class="checkout-empty">No hay productos listos para revisar. <a href="/catalogo">Volver al catálogo</a>.</div>';
        } else {
            items.innerHTML = result.lines.map((line) => `
                <article class="checkout-line">
                    <img src="${escapeHtml(line.image)}" alt="${escapeHtml(line.name)}" width="92" height="92">
                    <div>
                        <p class="checkout-line-name">${escapeHtml(line.name)}</p>
                        <p class="checkout-line-meta">Talla ${escapeHtml(line.size)} · ${line.quantity} unidad${line.quantity === 1 ? '' : 'es'}<br><span class="checkout-line-mode">${line.mode === 'preorder' ? 'Bajo pedido' : `${line.available} ${line.available === 1 ? 'disponible' : 'disponibles'} al validar`}</span></p>
                    </div>
                    <strong class="checkout-line-price">${core.formatCOP(line.lineTotal)}</strong>
                </article>`).join('');
        }

        issues.innerHTML = result.errors.map((error) => `<div>${escapeHtml(error.message)}</div>`).join('');
        summary.hidden = result.lines.length === 0;
        byId('checkoutSubtotal').textContent = core.formatCOP(result.subtotal);
        byId('checkoutTotal').textContent = core.formatCOP(result.total);
        submit.disabled = !result.ready;
    }

    function customerFromForm(form) {
        const data = new FormData(form);
        return {
            name: data.get('name'),
            phone: data.get('phone'),
            city: data.get('city'),
            address: data.get('address')
        };
    }

    function clearFieldErrors() {
        for (const id of ['customerNameError', 'customerPhoneError', 'customerCityError', 'customerAddressError', 'acceptPoliciesError']) {
            byId(id).textContent = '';
        }
    }

    function showFieldErrors(errors) {
        const targets = {
            name: 'customerNameError',
            phone: 'customerPhoneError',
            city: 'customerCityError',
            address: 'customerAddressError'
        };
        for (const [field, message] of Object.entries(errors)) {
            if (targets[field]) byId(targets[field]).textContent = message;
        }
    }

    function trackWhatsAppCheckout() {
        if (!window.H90AnalyticsConsent || !window.H90AnalyticsConsent.canTrack()) return;
        if (typeof window.gtag === 'function') {
            window.gtag('event', 'whatsapp_support', { source: 'checkout', items: checkout.lines.length, total: checkout.total });
        }
    }

    async function initialize() {
        const form = byId('checkoutForm');
        try {
            const response = await fetch('/productos.json', { headers: { Accept: 'application/json' } });
            if (!response.ok) throw new Error('No fue posible cargar el catálogo');
            const catalog = await response.json();
            checkout = window.H90CheckoutCore.buildCheckout(readCart(), catalog);
            renderCheckout(checkout);
        } catch (error) {
            checkout = { lines: [], errors: [{ blocking: true, message: 'No pudimos verificar el catálogo. Intenta de nuevo.' }], subtotal: 0, total: 0, ready: false };
            renderCheckout(checkout);
        }

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            clearFieldErrors();
            if (!checkout || !checkout.ready) return;

            const customer = customerFromForm(form);
            const result = window.H90CheckoutCore.buildWhatsAppOrder(checkout, customer);
            if (!result.valid) {
                showFieldErrors(result.errors);
                const firstInvalid = form.querySelector('input:invalid') || byId('customerName');
                if (firstInvalid) firstInvalid.focus();
                return;
            }
            if (!byId('acceptPolicies').checked) {
                byId('acceptPoliciesError').textContent = 'Debes aceptar las condiciones para continuar.';
                byId('acceptPolicies').focus();
                return;
            }

            trackWhatsAppCheckout();
            const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(result.message)}`;
            window.open(url, '_blank', 'noopener,noreferrer');
        });
    }

    document.addEventListener('DOMContentLoaded', initialize, { once: true });
}());
