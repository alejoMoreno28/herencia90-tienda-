(function initAnalyticsConsent(globalScope, factory) {
    const exported = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = exported;
    }

    if (!globalScope || !globalScope.document) return;

    const currentScript = globalScope.document.currentScript;
    const measurementId = currentScript && currentScript.dataset
        ? currentScript.dataset.gaId || ''
        : '';
    const consent = exported.createAnalyticsConsent(globalScope.localStorage);
    let googleAnalyticsLoaded = false;

    function loadGoogleAnalytics() {
        if (googleAnalyticsLoaded || !measurementId || !consent.canTrack()) return;
        googleAnalyticsLoaded = true;

        globalScope.dataLayer = globalScope.dataLayer || [];
        globalScope.gtag = globalScope.gtag || function gtag() {
            globalScope.dataLayer.push(arguments);
        };

        const script = globalScope.document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
        script.dataset.h90Analytics = 'google';
        globalScope.document.head.appendChild(script);
        globalScope.gtag('js', new Date());
        globalScope.gtag('config', measurementId, { anonymize_ip: true });
    }

    function announceDecision(decision) {
        globalScope.dispatchEvent(new globalScope.CustomEvent('h90:analytics-consent', {
            detail: { decision }
        }));
    }

    function removeBanner() {
        const banner = globalScope.document.getElementById('h90-analytics-consent');
        if (banner) banner.remove();
    }

    function renderBanner() {
        if (consent.getDecision() !== 'undecided' || globalScope.document.getElementById('h90-analytics-consent')) return;

        const banner = globalScope.document.createElement('section');
        banner.id = 'h90-analytics-consent';
        banner.className = 'h90-consent';
        banner.setAttribute('role', 'region');
        banner.setAttribute('aria-label', 'Preferencias de analítica');
        banner.innerHTML = `
            <div class="h90-consent__copy">
                <strong>Tu privacidad también juega de local.</strong>
                <span>Usamos analítica opcional para entender qué camisetas interesan y mejorar la tienda. No es necesaria para comprar.</span>
            </div>
            <div class="h90-consent__actions">
                <button type="button" data-consent="reject">Solo lo necesario</button>
                <button type="button" data-consent="accept">Aceptar analítica</button>
            </div>`;

        const style = globalScope.document.createElement('style');
        style.id = 'h90-analytics-consent-style';
        style.textContent = `
            .h90-consent{position:fixed;z-index:10050;right:1rem;bottom:1rem;left:1rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;max-width:920px;margin:auto;padding:1rem 1.1rem;border:1px solid rgba(201,162,39,.65);background:rgba(5,5,5,.98);color:#f7f4eb;box-shadow:0 18px 55px rgba(0,0,0,.5);font-family:Montserrat,Arial,sans-serif}
            .h90-consent__copy{display:grid;gap:.35rem;line-height:1.45}.h90-consent__copy strong{color:#d9b94e}.h90-consent__copy span{font-size:.84rem;color:#ddd}
            .h90-consent__actions{display:flex;flex-wrap:wrap;gap:.55rem;flex:none}.h90-consent button{min-height:44px;padding:.65rem .85rem;border:1px solid #c9a227;background:transparent;color:#fff;font:700 .78rem Montserrat,Arial,sans-serif;cursor:pointer}
            .h90-consent button[data-consent="accept"]{background:#c9a227;color:#090909}.h90-consent button:focus-visible{outline:3px solid #fff;outline-offset:3px}
            @media(max-width:720px){.h90-consent{align-items:stretch;flex-direction:column}.h90-consent__actions{display:grid;grid-template-columns:1fr 1fr}.h90-consent button{width:100%}}
            @media(max-width:430px){.h90-consent__actions{grid-template-columns:1fr}}`;

        if (!globalScope.document.getElementById(style.id)) {
            globalScope.document.head.appendChild(style);
        }
        banner.addEventListener('click', (event) => {
            const button = event.target.closest('[data-consent]');
            if (!button) return;
            const decision = button.dataset.consent;
            if (decision === 'accept') {
                consent.accept();
                loadGoogleAnalytics();
                announceDecision('accepted');
            } else {
                consent.reject();
                announceDecision('rejected');
            }
            removeBanner();
        });
        globalScope.document.body.appendChild(banner);
    }

    globalScope.H90AnalyticsConsent = {
        getDecision: consent.getDecision,
        canTrack: consent.canTrack,
        accept: function accept() {
            consent.accept();
            loadGoogleAnalytics();
            announceDecision('accepted');
            removeBanner();
        },
        reject: function reject() {
            consent.reject();
            announceDecision('rejected');
            removeBanner();
        },
        reset: consent.reset,
        sanitizeEvent: exported.sanitizeAnalyticsEvent
    };

    if (consent.canTrack()) loadGoogleAnalytics();
    if (globalScope.document.readyState === 'loading') {
        globalScope.document.addEventListener('DOMContentLoaded', renderBanner, { once: true });
    } else {
        renderBanner();
    }
}(typeof window !== 'undefined' ? window : undefined, function analyticsConsentFactory() {
    const STORAGE_KEY = 'h90_analytics_consent_v1';
    const ALLOWED_EVENTS = new Set([
        'page_view',
        'view_item',
        'select_size',
        'add_to_cart',
        'begin_checkout',
        'whatsapp_support'
    ]);

    function createAnalyticsConsent(storage) {
        let fallbackDecision = 'undecided';

        function getDecision() {
            try {
                const stored = storage && storage.getItem(STORAGE_KEY);
                return stored === 'accepted' || stored === 'rejected' ? stored : fallbackDecision;
            } catch (error) {
                return fallbackDecision;
            }
        }

        function setDecision(decision) {
            fallbackDecision = decision;
            try {
                if (storage) storage.setItem(STORAGE_KEY, decision);
            } catch (error) {
                // La preferencia sigue activa durante esta visita si el navegador bloquea storage.
            }
            return decision;
        }

        return {
            getDecision,
            canTrack: () => getDecision() === 'accepted',
            accept: () => setDecision('accepted'),
            reject: () => setDecision('rejected'),
            reset: () => {
                fallbackDecision = 'undecided';
                try {
                    if (storage) storage.removeItem(STORAGE_KEY);
                } catch (error) {
                    // Sin efecto fuera de esta visita.
                }
            }
        };
    }

    function safeText(value, maxLength) {
        if (typeof value !== 'string') return null;
        const normalized = value.trim().replace(/\s+/g, ' ');
        return normalized ? normalized.slice(0, maxLength) : null;
    }

    function safeReferrer(value) {
        if (!value) return null;
        try {
            const url = new URL(value);
            if (!/^https?:$/.test(url.protocol)) return null;
            return `${url.origin}${url.pathname}`.slice(0, 500);
        } catch (error) {
            return null;
        }
    }

    function sanitizeAnalyticsEvent(input) {
        if (!input || !ALLOWED_EVENTS.has(input.event_type)) return null;

        const payload = { event_type: input.event_type };
        if (typeof input.product_id === 'number' && Number.isFinite(input.product_id)) {
            payload.product_id = input.product_id;
        } else {
            const productId = safeText(input.product_id, 80);
            if (productId) payload.product_id = productId;
        }

        const productName = safeText(input.product_name, 160);
        const category = safeText(input.category, 80);
        const referrer = safeReferrer(input.referrer);
        if (productName) payload.product_name = productName;
        if (category) payload.category = category;
        if (referrer) payload.referrer = referrer;

        const source = safeText(input.extra && input.extra.source, 40);
        const talla = safeText(input.extra && input.extra.talla, 20);
        const items = Number(input.extra && input.extra.items);
        const total = Number(input.extra && input.extra.total);
        const extra = {};
        if (source) extra.source = source;
        if (talla) extra.talla = talla;
        if (Number.isFinite(items) && items >= 0) extra.items = Math.round(items);
        if (Number.isFinite(total) && total >= 0) extra.total = Math.round(total);
        if (Object.keys(extra).length) payload.extra = extra;

        return payload;
    }

    return { ALLOWED_EVENTS, STORAGE_KEY, createAnalyticsConsent, sanitizeAnalyticsEvent };
}));
