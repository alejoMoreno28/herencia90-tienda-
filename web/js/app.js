// ── Nombres de categorías para mostrar (sin tocar la BD) ──────────────────────
const CATEGORY_LABELS = {
    'coleccion 2026': 'Mundial 2026',
    'colección 2026': 'Mundial 2026',
    'Coleccion 2026': 'Mundial 2026',
    'Colección 2026': 'Mundial 2026',
    'COLECCION 2026': 'Mundial 2026',
    'COLECCIÓN 2026': 'Mundial 2026',
};
function displayCategory(name) {
    return CATEGORY_LABELS[name] || CATEGORY_LABELS[name.toLowerCase()] || name;
}

const SUPABASE_URL = 'https://nlnrdtcgbdkzfzwnsffp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sbnJkdGNnYmRremZ6d25zZmZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDUyNTcsImV4cCI6MjA5MTQyMTI1N30.T51eC1fJFc5Wn79JcA5l4m9CIYSYVhE7B7YU19CPQ00';
const SUPABASE_SCRIPT_SRC = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
const GA_MEASUREMENT_ID = 'G-576MFSV66N';
const PHOSPHOR_STYLES_ROOT = 'https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.2/src';
const ENABLE_PUBLIC_ANALYTICS = false;
let db = null;
let supabasePromise = null;
let aosPromise = null;
let googleAnalyticsPromise = null;

let allProducts = [];
let catalogSearchTerm = '';
let catalogSort = 'recent';
let catalogPage = 1;
const CATALOG_PAGE_SIZE = 24;
const CATALOG_INITIAL_RENDER_COUNT = 8;
const CATALOG_RENDER_BATCH_SIZE = 8;
let catalogRenderToken = 0;
// Filtros del catalogo. Cada grupo es un Set; un grupo vacio no filtra.
const catalogFilters = { disponibilidad: new Set(), talla: new Set(), equipo: new Set(), tipo: new Set(), epoca: new Set() };
let catalogFilterPanelOpen = false;
let catalogLastResults = [];

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouchDevice = window.matchMedia('(hover: none), (pointer: coarse)').matches;
const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
const isConstrainedNetwork = Boolean(connection && (connection.saveData || /2g/.test(connection.effectiveType || '')));

function runWhenIdle(callback, timeout = 1800) {
    if ('requestIdleCallback' in window) {
        requestIdleCallback(callback, { timeout });
        return;
    }
    setTimeout(callback, Math.min(timeout, 1200));
}

function runAfterIdleDelay(callback, delay = 1800, timeout = 1800) {
    setTimeout(() => runWhenIdle(callback, timeout), delay);
}

function runAfterWindowLoadIdle(callback, delay = 0, timeout = 1800) {
    const schedule = () => {
        setTimeout(() => runWhenIdle(callback, timeout), delay);
    };

    if (document.readyState === 'complete') {
        schedule();
        return;
    }
    window.addEventListener('load', schedule, { once: true });
}

function runAfterFirstInteraction(callback, fallbackDelay = 9000) {
    let fired = false;
    const cleanup = () => {
        window.removeEventListener('pointerdown', run);
        window.removeEventListener('keydown', run);
        window.removeEventListener('scroll', run);
        window.removeEventListener('touchstart', run);
    };
    const run = () => {
        if (fired) return;
        fired = true;
        cleanup();
        callback();
    };
    window.addEventListener('pointerdown', run, { passive: true });
    window.addEventListener('keydown', run);
    window.addEventListener('scroll', run, { passive: true });
    window.addEventListener('touchstart', run, { passive: true });
    setTimeout(run, fallbackDelay);
}

function loadExternalScript(src) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            if (existing.dataset.loaded === 'true') {
                resolve();
                return;
            }
            existing.addEventListener('load', resolve, { once: true });
            existing.addEventListener('error', reject, { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => {
            script.dataset.loaded = 'true';
            resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

function loadStylesheet(href) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`link[rel="stylesheet"][href="${href}"]`);
        if (existing) {
            resolve();
            return;
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.onload = resolve;
        link.onerror = reject;
        document.head.appendChild(link);
    });
}

function loadPhosphorStyles(weights) {
    return Promise.all(weights.map((weight) => (
        loadStylesheet(`${PHOSPHOR_STYLES_ROOT}/${weight}/style.css`)
    ))).catch(function(){});
}

function loadGoogleAnalytics() {
    if (googleAnalyticsPromise) return googleAnalyticsPromise;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function() {
        window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID);

    googleAnalyticsPromise = loadExternalScript(
        `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
    ).catch(function(){});
    return googleAnalyticsPromise;
}

async function ensureSupabaseClient() {
    if (db) return db;
    if (!supabasePromise) {
        supabasePromise = loadExternalScript(SUPABASE_SCRIPT_SRC).then(() => {
            if (!window.supabase) throw new Error('Supabase no disponible');
            db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            return db;
        });
    }
    return supabasePromise;
}

function loadAOS() {
    if (window.AOS) return Promise.resolve(window.AOS);
    if (aosPromise) return aosPromise;

    aosPromise = new Promise((resolve, reject) => {
        if (!document.querySelector('link[href="https://unpkg.com/aos@2.3.4/dist/aos.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/aos@2.3.4/dist/aos.css';
            document.head.appendChild(link);
        }

        loadExternalScript('https://unpkg.com/aos@2.3.4/dist/aos.js')
            .then(() => resolve(window.AOS))
            .catch(reject);
    });

    return aosPromise;
}

function byId(id) {
    return document.getElementById(id);
}

function onId(id, eventName, handler) {
    const el = byId(id);
    if (el) el.addEventListener(eventName, handler);
}

function normalizeSearchTerm(value) {
    return String(value || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function isCatalogSearchPage() {
    return Boolean(byId('productGrid'));
}

function syncSearchInputs(value) {
    const raw = String(value || '');
    const desktopInput = byId('searchInput');
    const mobileInput = byId('mobileSearchInput');
    if (desktopInput && desktopInput.value !== raw) desktopInput.value = raw;
    if (mobileInput && mobileInput.value !== raw) mobileInput.value = raw;
}

function catalogSearchUrl(value) {
    const query = String(value || '').trim();
    return query ? `/catalogo.html?q=${encodeURIComponent(query)}` : '/catalogo.html';
}

function runCatalogSearch(value) {
    const raw = String(value || '').trim();
    if (!isCatalogSearchPage()) {
        if (raw) window.location.href = catalogSearchUrl(raw);
        return;
    }
    catalogSearchTerm = normalizeSearchTerm(raw);
    catalogPage = 1;
    syncSearchInputs(raw);
    renderProducts(allProducts);
}

let vanillaTiltPromise = null;
function loadVanillaTilt() {
    if (window.VanillaTilt) return Promise.resolve(window.VanillaTilt);
    if (vanillaTiltPromise) return vanillaTiltPromise;

    vanillaTiltPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/vanilla-tilt@1.8.1/dist/vanilla-tilt.min.js';
        script.async = true;
        script.onload = () => resolve(window.VanillaTilt);
        script.onerror = reject;
        document.head.appendChild(script);
    });

    return vanillaTiltPromise;
}

const PRODUCT_FETCH_TIMEOUT_MS = 8000;

function withTimeout(promise, timeoutMs, label) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label} agotó el tiempo de espera`)), timeoutMs);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                clearTimeout(timer);
                reject(error);
            }
        );
    });
}

function mergeLiveProducts(liveProducts, localProducts) {
    if (!Array.isArray(liveProducts) || liveProducts.length === 0) return localProducts || [];

    const localById = new Map((localProducts || []).map(lp => [lp.id, lp]));
    const merged = liveProducts.map(sp => {
        const lp = localById.get(sp.id);
        if (lp && (!Array.isArray(sp.imagenes) || sp.imagenes.length === 0) && Array.isArray(lp.imagenes) && lp.imagenes.length > 0) {
            return { ...sp, imagenes: lp.imagenes };
        }
        return sp;
    });

    (localProducts || []).forEach(lp => {
        if (!merged.some(sp => sp.id === lp.id)) {
            merged.push(lp);
        }
    });

    return merged;
}

async function loadLocalProducts() {
    let localProducts = [];
    try {
        const response = await fetch('/productos.json?v=d3866fc5cb7b');
        if (response.ok) localProducts = await response.json();
    } catch (e) {
        console.warn('No se pudo cargar productos.json local', e);
    }
    return localProducts;
}

async function fetchProductsFromSupabaseRest() {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/productos?select=*&order=id.asc`, {
        headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
    });
    if (!response.ok) {
        throw new Error(`Supabase productos respondió ${response.status}`);
    }
    return response.json();
}

async function loadProducts() {
    // El primer render no debe depender de Supabase; el refresco vivo corre diferido.
    return loadLocalProducts();
}

// ── Analytics ────────────────────────────────────────────────────────────────
async function refreshProductsFromSupabase(localProducts) {
    try {
        const data = await fetchProductsFromSupabaseRest();
        return mergeLiveProducts(data, localProducts);
    } catch (error) {
        console.warn('Fallo Supabase, usando productos locales', error);
        return localProducts || [];
    }
}

async function trackEvent(eventType, productData = {}) {
    if (!ENABLE_PUBLIC_ANALYTICS) return;
    try {
        const client = await ensureSupabaseClient();
        await client.from('analytics_events').insert({
            event_type: eventType,
            product_id: productData.id || null,
            product_name: productData.equipo || productData.product_name || null,
            category: productData.categoria || productData.category || null,
            extra: productData.extra || {},
            referrer: document.referrer || null
        });
    } catch (e) {
        // Analytics nunca interrumpe la experiencia del usuario
    }
}

// ── Carrito ───────────────────────────────────────────────────────────────────
let cart = JSON.parse(localStorage.getItem('herencia90_cart') || '[]');

function saveCart() {
    localStorage.setItem('herencia90_cart', JSON.stringify(cart));
    updateCartBadge();
}

function updateCartBadge() {
    const total = cart.reduce((sum, i) => sum + i.cantidad, 0);
    // Desktop badge
    const badge = document.getElementById('cartBadge');
    if (badge) {
        badge.textContent = total;
        badge.style.display = total > 0 ? 'flex' : 'none';
    }
    // Mobile badge
    const badgeMobile = document.getElementById('cartBadgeMobile');
    if (badgeMobile) {
        badgeMobile.textContent = total;
        badgeMobile.style.display = total > 0 ? 'flex' : 'none';
    }
}

function addToCart(product, size) {
    const existing = cart.find(i => i.id === product.id && i.talla === size);
    if (existing) {
        existing.cantidad++;
    } else {
        const imagen = toWebp((product.imagenes && product.imagenes.length > 0)
            ? product.imagenes[0] : (product.imagen || ''));
        const fitInfo = getProductFitInfo(product);
        cart.push({ id: product.id, equipo: product.equipo, talla: size, corte: fitInfo.label, precio: product.precio, imagen, cantidad: 1 });
    }
    saveCart();
    showToast();
    trackEvent('cart_add', { ...product, extra: { talla: size } });
}

function removeFromCart(id, talla) {
    cart = cart.filter(i => !(i.id === id && i.talla === talla));
    saveCart();
    renderCartDrawer();
}

function changeQty(id, talla, delta) {
    const item = cart.find(i => i.id === id && i.talla === talla);
    if (!item) return;
    item.cantidad = Math.max(1, item.cantidad + delta);
    saveCart();
    renderCartDrawer();
}

function clearCart() {
    cart = [];
    saveCart();
    renderCartDrawer();
}

function openCart() {
    renderCartDrawer();
    const drawer = byId('cartDrawer');
    const overlay = byId('cartOverlay');
    if (drawer) drawer.classList.add('open');
    if (overlay) overlay.classList.add('open');
}

function closeCart() {
    const drawer = byId('cartDrawer');
    const overlay = byId('cartOverlay');
    if (drawer) drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
}

function renderCartDrawer() {
    const container = byId('cartItems');
    const footer = byId('cartFooter');
    if (!container || !footer) return;
    if (cart.length === 0) {
        container.innerHTML = `
            <div class="cart-empty">
                <div class="cart-empty-icon">🛒</div>
                <p>Tu carrito está vacío</p>
                <p>¡Agrega tus camisetas favoritas!</p>
            </div>`;
        footer.style.display = 'none';
        return;
    }
    footer.style.display = 'flex';
    let total = 0;
    container.innerHTML = cart.map(item => {
        total += item.precio * item.cantidad;
        const itemLabel = escapeHtml(`${item.equipo} talla ${item.talla}`);
        return `
            <div class="cart-item">
                <img src="${item.imagen}" alt="${item.equipo}" class="cart-item-img" onerror="this.style.opacity='0.3'">
                <div class="cart-item-info">
                    <p class="cart-item-name">${item.equipo}</p>
                    <p class="cart-item-talla">Talla: ${item.talla}</p>
                    <p class="cart-item-price">${formatPrice(item.precio * item.cantidad)}</p>
                    <div class="cart-item-qty">
                        <button onclick="changeQty(${item.id}, '${item.talla}', -1)" aria-label="Disminuir cantidad de ${itemLabel}">−</button>
                        <span>${item.cantidad}</span>
                        <button onclick="changeQty(${item.id}, '${item.talla}', 1)" aria-label="Aumentar cantidad de ${itemLabel}">+</button>
                    </div>
                </div>
                <button class="cart-item-remove" onclick="removeFromCart(${item.id}, '${item.talla}')" title="Quitar" aria-label="Quitar ${itemLabel} del carrito">×</button>
            </div>`;
    }).join('');
    // La promo 2 x $180.000 solo aplica a refs seleccionadas, asi que se avisa
    // pero no se descuenta sola: el precio final se confirma por WhatsApp.
    const promoUnits = cart.reduce((sum, i) => sum + (Number(i.precio) === 99000 ? i.cantidad : 0), 0);
    if (promoUnits >= 2) {
        container.insertAdjacentHTML('beforeend', `
            <p class="cart-promo-note">Llevas ${promoUnits} camisetas de $99.000: si son de las referencias de la promo 2 x $180.000, te aplicamos el descuento al confirmar por WhatsApp.</p>`);
    }
    const totalEl = byId('cartTotal');
    if (totalEl) totalEl.textContent = formatPrice(total);
}

function checkoutWhatsApp() {
    if (cart.length === 0) return;
    let msg = '¡Hola Herencia 90! Quiero hacer el siguiente pedido:\n\n';
    cart.forEach((item, i) => {
        const fitLine = item.corte ? `\n   Corte: ${item.corte}` : '';
        msg += `${i + 1}. ${item.equipo}\n   Talla: ${item.talla}${fitLine}\n   Cantidad: ${item.cantidad} - ${formatPrice(item.precio * item.cantidad)}\n`;
    });
    const total = cart.reduce((sum, i) => sum + i.precio * i.cantidad, 0);
    msg += `\n💰 *Total: ${formatPrice(total)}*\n\nPor favor confirmar talla, corte, disponibilidad y forma de pago 🙏`;
    trackEvent('checkout', { extra: { items: cart.length, total } });
    window.open(`https://wa.me/573126428153?text=${encodeURIComponent(msg)}`, '_blank');
}

function setProductModalVisible(isVisible) {
    const modal = byId('productModal');
    if (!modal) return;
    modal.style.display = isVisible ? 'block' : 'none';
    document.body.classList.toggle('modal-open', isVisible);
}

let toastTimer = null;
function showToast() {
    const toast = byId('cartToast');
    if (!toast) return;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

// ── Category Title Reveal ─────────────────────────────────────────────────────
const titleRevealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('revealed');
        titleRevealObserver.unobserve(entry.target);
    });
}, { threshold: 0.2 });

// ── Lazy loading ──────────────────────────────────────────────────────────────
const imgObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        img.src = img.dataset.src;
        imgObserver.unobserve(img);
    });
}, { rootMargin: '120px' });

// ── Grid toggle ───────────────────────────────────────────────────────────────
function toggleGrid() {
    const isSingle = document.body.classList.toggle('grid-single');
    const icon2 = document.getElementById('iconGrid2');
    const icon1 = document.getElementById('iconGrid1');
    if (icon2 && icon1) {
        icon2.style.display = isSingle ? 'none' : 'block';
        icon1.style.display = isSingle ? 'block' : 'none';
    }
}

// ── Category drawer ───────────────────────────────────────────────────────────
function openDrawer() {
    const drawer = byId('categoryDrawer');
    const overlay = byId('drawerOverlay');
    if (!drawer || !overlay) return;
    drawer.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeDrawer() {
    const drawer = byId('categoryDrawer');
    const overlay = byId('drawerOverlay');
    if (drawer) drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
}

// ── Search overlay ────────────────────────────────────────────────────────────
function openSearchOverlay() {
    const overlay = byId('searchOverlay');
    const input = byId('mobileSearchInput');
    if (!overlay) return;
    overlay.classList.add('open');
    if (input) setTimeout(() => input.focus(), 300);
}

function closeSearchOverlay() {
    const overlay = byId('searchOverlay');
    const input = byId('mobileSearchInput');
    if (overlay) overlay.classList.remove('open');
    if (input) input.value = '';
    catalogSearchTerm = '';
    catalogPage = 1;
    renderProducts(allProducts);
}

function applySearchFromUrl() {
    if (!isCatalogSearchPage()) return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q') || '';
    if (!q) return;
    catalogSearchTerm = normalizeSearchTerm(q);
    catalogPage = 1;
    syncSearchInputs(q);
}

function hasProductSurface() {
    return Boolean(byId('productGrid') || byId('featuredProductGrid'));
}

function initializeProductSurface() {
    if (!hasProductSurface()) return;

    applySearchFromUrl();
    loadProducts().then((products) => {
        allProducts = products;
        renderProducts(allProducts);
        renderFeaturedProducts();

        if (!isConstrainedNetwork) {
            runAfterFirstInteraction(() => {
                runWhenIdle(() => {
                    refreshProductsFromSupabase(allProducts).then((freshProducts) => {
                        if (!Array.isArray(freshProducts) || freshProducts.length === 0) return;
                        allProducts = freshProducts;
                        renderProducts(allProducts);
                        renderFeaturedProducts();
                    });
                }, 1800);
            }, 16000);
        }
    });

    // Real-time solo aporta valor en rutas que muestran productos.
    if (!isConstrainedNetwork) {
        runAfterFirstInteraction(() => {
            runWhenIdle(() => {
                ensureSupabaseClient().then((client) => client.channel('stock-live')
                    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'productos' }, (payload) => {
                        const idx = allProducts.findIndex(p => p.id === payload.new.id);
                        if (idx !== -1) {
                            allProducts[idx] = payload.new;
                            renderProducts(allProducts);
                            renderFeaturedProducts();
                        }
                    })
                    .subscribe()).catch(function(){});
            }, 1800);
        }, 22000);
    }
}

// ── DOM Ready ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Forzar la reproducción del video de fondo en móviles (iOS/Android y Modo Ahorro)
    const heroVideo = document.getElementById('heroVideo');
    if (heroVideo) {
        heroVideo.muted = true;
        heroVideo.setAttribute('muted', '');
        heroVideo.setAttribute('playsinline', '');
        heroVideo.playsInline = true;
        
        const hydrateHeroVideo = () => {
            heroVideo.querySelectorAll('source[data-src]').forEach((source) => {
                source.src = source.dataset.src;
                source.removeAttribute('data-src');
            });
            heroVideo.load();
        };

        const playVideo = () => {
            hydrateHeroVideo();
            heroVideo.play().then(() => {
                cleanupListeners();
            }).catch(e => console.warn("Video playback prevented, waiting for interaction:", e));
        };
        
        const cleanupListeners = () => {
            document.removeEventListener('click', playVideo);
            document.removeEventListener('touchstart', playVideo);
            document.removeEventListener('scroll', playVideo);
        };
        
        // El poster pinta el hero; el video arranca despues para no competir con LCP.
        const requestHeroPlayback = () => {
            if (prefersReducedMotion || isTouchDevice || isConstrainedNetwork) return;
            hydrateHeroVideo();
            heroVideo.play().catch(() => {
            // Si el navegador bloquea la reproducción por políticas o ahorro de batería,
            // agregamos listeners en la primera interacción (click, scroll, touch) del usuario.
            document.addEventListener('click', playVideo, { passive: true });
            document.addEventListener('touchstart', playVideo, { passive: true });
            document.addEventListener('scroll', playVideo, { passive: true });
            });
        };
        window.addEventListener('load', () => {
            runAfterFirstInteraction(() => runWhenIdle(requestHeroPlayback, 1800), 12000);
        }, { once: true });
    }

    // AOS se carga en diferido para no competir con el primer render.
    if (false && !prefersReducedMotion && !isTouchDevice && document.querySelector('[data-aos]')) {
        runAfterIdleDelay(() => {
            loadAOS().then((AOS) => {
                if (!AOS) return;
                AOS.init({
                    duration: 420,
                    easing: 'ease-out-cubic',
                    once: true,
                    offset: 60,
                });
            }).catch(function(){});
        }, 1800, 1800);
    } else {
        document.querySelectorAll('[data-aos]').forEach(el => {
            el.removeAttribute('data-aos');
            el.removeAttribute('data-aos-delay');
        });
    }

    runAfterWindowLoadIdle(() => loadPhosphorStyles(['regular', 'bold', 'fill']), 1200, 1800);
    runAfterWindowLoadIdle(loadGoogleAnalytics, 4500, 2000);

    // Registrar visita a la página
    runAfterIdleDelay(() => trackEvent('page_view', {}), 2500, 1800);

    renderNavigation();
    initializeProductSurface();

    // Modal close
    const modal = byId('productModal');
    onId('closeModal', 'click', () => setProductModalVisible(false));
    onId('closeModal', 'keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setProductModalVisible(false);
        }
    });
    window.addEventListener('click', (e) => { if (modal && e.target === modal) setProductModalVisible(false); });

    // Zoom en imagen principal
    const mainImgContainer = document.getElementById('mainImageContainer');
    const mainImg = document.getElementById('mainImage');
    if (mainImgContainer && mainImg) {
        mainImgContainer.addEventListener('mousemove', (e) => {
            const rect = mainImgContainer.getBoundingClientRect();
            mainImg.style.transformOrigin = `${((e.clientX - rect.left) / rect.width) * 100}% ${((e.clientY - rect.top) / rect.height) * 100}%`;
        });
        mainImgContainer.addEventListener('mouseenter', () => mainImg.classList.add('zoomed'));
        mainImgContainer.addEventListener('mouseleave', () => {
            mainImg.classList.remove('zoomed');
            setTimeout(() => { if (!mainImg.classList.contains('zoomed')) mainImg.style.transformOrigin = 'center center'; }, 150);
        });
    }

    // Desktop search
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            if (isCatalogSearchPage()) runCatalogSearch(e.target.value);
        });
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                runCatalogSearch(e.currentTarget.value);
            }
        });
    }

    // Mobile search
    const mobileSearchInput = document.getElementById('mobileSearchInput');
    if (mobileSearchInput) {
        mobileSearchInput.addEventListener('input', (e) => {
            if (isCatalogSearchPage()) runCatalogSearch(e.target.value);
        });
        mobileSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                runCatalogSearch(e.currentTarget.value);
            }
        });
        mobileSearchInput.addEventListener('search', (e) => {
            runCatalogSearch(e.currentTarget.value);
        });
    }

    // Desktop cart
    onId('cartBtn', 'click', openCart);
    onId('cartClose', 'click', closeCart);
    onId('cartOverlay', 'click', closeCart);
    onId('cartCheckout', 'click', checkoutWhatsApp);
    onId('cartClear', 'click', clearCart);

    // Mobile bottom nav
    onId('mobileCartBtn', 'click', openCart);
    onId('mobileMenuBtn', 'click', openDrawer);
    onId('gridToggleBtn', 'click', toggleGrid);
    onId('mobileSearchBtn', 'click', openSearchOverlay);

    // Drawer & search close
    onId('categoryDrawerClose', 'click', closeDrawer);
    onId('drawerOverlay', 'click', closeDrawer);
    onId('searchOverlayClose', 'click', closeSearchOverlay);

    // Cerrar drawer al hacer click en un link
    document.querySelectorAll('.category-drawer-link').forEach(link => {
        link.addEventListener('click', () => {
            closeDrawer();
        });
    });

    // Cerrar búsqueda con Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSearchOverlay();
            closeDrawer();
            if (modal) setProductModalVisible(false);
        }
    });

    updateCartBadge();

    // Las fichas de producto agregan al mismo carrito y mandan aqui con #carrito.
    if (window.location.hash === '#carrito') openCart();
});

// ── Badge detection ───────────────────────────────────────────────────────────
function getProductBadge(product) {
    const cat = (product.categoria || '').toLowerCase();
    const name = (product.equipo || '').toLowerCase();
    if (cat.includes('2026') || cat.includes('mundial') || name.includes('mundial')) {
        return { text: 'Mundial 2026', cls: 'badge-mundial' };
    }
    if (name.includes('edicion especial') || name.includes('edición especial')) {
        return { text: 'Ed. Especial', cls: 'badge-edicion' };
    }
    if (cat.includes('retro') || name.includes('retro')) {
        return { text: 'Retro', cls: 'badge-retro' };
    }
    if (cat.includes('25/26') || cat.includes('25-26') || cat.includes('temporada')) {
        return { text: '25/26', cls: 'badge-temporada' };
    }
    return null;
}

// ── Size pills ────────────────────────────────────────────────────────────────
const SIZE_ORDER = { 'XS': 1, 'S': 2, 'M': 3, 'L': 4, 'XL': 5, 'XXL': 6, '2XL': 6, '3XL': 7 };
const LOW_STOCK_THRESHOLD = 2;
const SIZE_GUIDE_URL = '/img/guia-tallas-herencia90-vertical.png';

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function parseStockQty(qty) {
    return Math.max(0, parseInt(qty, 10) || 0);
}

function getSortedSizeEntries(tallas) {
    return Object.entries(tallas || {})
        .filter(([size]) => !size.startsWith('R_'))
        .map(([size, qty]) => ({ size, stock: parseStockQty(qty) }))
        .sort((a, b) => (SIZE_ORDER[a.size] || 99) - (SIZE_ORDER[b.size] || 99));
}

function getAvailableSizeEntries(product) {
    return getSortedSizeEntries(product.tallas).filter(item => item.stock > 0);
}

function getLowStockEntries(product) {
    return getAvailableSizeEntries(product).filter(item => item.stock <= LOW_STOCK_THRESHOLD);
}

function buildStockNoticeText(product, isBajoPedido = false) {
    if (isBajoPedido) return '';
    const lowEntries = getLowStockEntries(product);
    if (lowEntries.length === 0) return '';
    if (lowEntries.length === 1) {
        const item = lowEntries[0];
        return item.stock === 1
            ? `Ultima unidad en talla ${item.size}`
            : `Ultimas ${item.stock} unidades en talla ${item.size}`;
    }
    return `Ultimas unidades: ${lowEntries.map(item => `${item.size} (${item.stock})`).join(', ')}`;
}

function buildStockNotice(product, isBajoPedido = false) {
    const notice = buildStockNoticeText(product, isBajoPedido);
    return notice ? `<div class="product-stock-note">${escapeHtml(notice)}</div>` : '';
}

function getProductFitInfo(product) {
    const text = normalizeSearchTerm(`${product.equipo || ''} ${product.categoria || ''} ${product.descripcion || ''}`);
    if (text.includes('nino') || text.includes('nina') || text.includes('infantil') || text.includes('kid')) {
        return {
            label: 'Corte nino',
            text: 'Referencia infantil. Confirma edad, estatura y pecho antes de pedir.'
        };
    }
    if (text.includes('mujer') || text.includes('woman') || text.includes('women') || text.includes('femenino')) {
        return {
            label: 'Corte femenino',
            text: 'Horma mas ajustada. Compara pecho y largo con una camiseta comoda.'
        };
    }
    if (text.includes('player') || text.includes('jugador')) {
        return {
            label: 'Version Player',
            text: 'Horma ajustada al cuerpo, como la usan los jugadores. Si te gusta suelta, pide una talla mas.'
        };
    }
    return {
        label: 'Corte fan unisex',
        text: 'Puede funcionar para hombre o mujer. Compara pecho y largo antes de elegir.'
    };
}

function buildModalFitGuideHtml(product) {
    const fit = getProductFitInfo(product);
    return `
        <div class="modal-fit-guide-head">
            <span class="modal-fit-badge">${escapeHtml(fit.label)}</span>
            <a class="modal-fit-guide-link" href="${SIZE_GUIDE_URL}" target="_blank" rel="noopener noreferrer">Guia de tallas</a>
        </div>
        <p>${escapeHtml(fit.text)}</p>
        <p class="modal-fit-guide-note">Si dudas entre dos tallas, te asesoramos por WhatsApp.</p>
    `;
}

function buildSizePills(tallas, isBajoPedido = false) {
    return getSortedSizeEntries(tallas).map(({ size, stock }) => {
        const available = stock > 0 || isBajoPedido;
        const low = !isBajoPedido && stock > 0 && stock <= LOW_STOCK_THRESHOLD;
        const title = isBajoPedido
            ? `Talla ${size} disponible bajo pedido`
            : stock > 0
                ? `${stock} unidad${stock === 1 ? '' : 'es'} disponible${stock === 1 ? '' : 's'} en talla ${size}`
                : `Talla ${size} agotada`;
        const stockCount = !isBajoPedido && stock > 0
            ? `<span class="size-pill-count">${stock}</span>`
            : '';
        return `<span class="size-pill ${available ? 'available' : 'unavailable'}${low ? ' low' : ''}" title="${escapeHtml(title)}"><span>${escapeHtml(size)}</span>${stockCount}</span>`;
    }).join('');
}

function getAvailableStock(product) {
    return getAvailableSizeEntries(product).reduce((total, item) => total + item.stock, 0);
}

function isProductBajoPedido(product) {
    const hasStock = getAvailableStock(product) > 0;
    if (hasStock) return false;
    // Si no hay stock, SIEMPRE es bajo pedido (eliminando el concepto "Agotado")
    return true;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatPrice(price) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(price);
}

function toWebp(src) {
    if (!src) return src;
    let newSrc = src.replace(/\.(png|jpg|jpeg)$/i, '.webp');
    if (!newSrc.startsWith('/') && !newSrc.startsWith('http')) {
        newSrc = '/' + newSrc;
    }
    return newSrc;
}

// En la grilla la foto se ve a 640, asi que se sirve la version de 640 y no la
// de 1200: pesa entre la mitad y la cuarta parte. Antes las fotos de Supabase
// se saltaban esto y cargaban la grande, que es la mayoria del catalogo.
//
// Si a alguna le faltara su version liviana, bindProductImageFallback cae sola
// a la grande (data-full-src), asi que no se rompe nada.
function toCardImage(src) {
    const webpSrc = toWebp(src);
    if (!webpSrc) return webpSrc;
    return webpSrc.replace(/\.webp($|\?)/i, '-card.webp$1');
}

function markProductImageLoaded(img) {
    if (!img) return;
    img.classList.add('loaded');
    if (img.parentElement) img.parentElement.classList.remove('img-loading');
}

function bindProductImageFallback(img) {
    if (!img) return;
    img.onload = () => markProductImageLoaded(img);
    img.onerror = () => {
        const fallback = img.dataset.fullSrc;
        if (fallback && img.src !== fallback) {
            img.removeAttribute('srcset');
            img.src = fallback;
            img.dataset.fullSrc = '';
            return;
        }
        markProductImageLoaded(img);
    };
    if (img.complete) markProductImageLoaded(img);
}

function slugifyText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function buildProductUrl(product) {
    return `/camisetas/${slugifyText(product.equipo)}`;
}

function makeCategoryId(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');
}

function getCategoryTitle(pageCat) {
    const labels = {
        'mundial-2026': 'Mundial 2026',
        'temporada-25-26': 'Temporada 25/26',
        'retro': 'Leyendas Retro',
        'mujer': 'Women Collection',
        'colombia': 'Colombia',
        'real-madrid': 'Real Madrid',
        'barcelona': 'Barcelona',
        'arsenal': 'Arsenal',
        'liverpool': 'Liverpool',
        'manchester-united': 'Manchester United',
        'bayern-munich': 'Bayern Munich',
        'psg': 'PSG',
        'brasil': 'Brasil',
        'argentina': 'Argentina',
        'alemania': 'Alemania',
        'portugal': 'Portugal',
        'manchester-city': 'Manchester City'
    };
    return labels[pageCat] || 'Cat&aacute;logo';
}

function getCategoryRank(product) {
    const text = `${product.equipo || ''} ${product.categoria || ''}`.toLowerCase();
    const cat = (product.categoria || '').toLowerCase();
    if (cat.includes('2026') || text.includes('colombia')) return 0;
    if (text.includes('real madrid') || text.includes('barcelona')) return 1;
    if (text.includes('argentina') || text.includes('brasil')) return 2;
    if (cat.includes('retro') || cat.includes('leyendas')) return 3;
    if (cat.includes('25/26') || cat.includes('temporada')) return 4;
    return 5;
}

function getProductPhotoCount(product) {
    if (Array.isArray(product.imagenes)) return product.imagenes.length;
    return product.imagen ? 1 : 0;
}

function getProductPrice(product) {
    return Number(product.precio || 0);
}

function compareCatalogProducts(a, b) {
    const stockA = getAvailableStock(a) > 0 ? 1 : 0;
    const stockB = getAvailableStock(b) > 0 ? 1 : 0;
    if (stockA !== stockB) return stockB - stockA;

    let diff = 0;
    if (catalogSort === 'price-asc') diff = getProductPrice(a) - getProductPrice(b);
    if (catalogSort === 'price-desc') diff = getProductPrice(b) - getProductPrice(a);
    if (catalogSort === 'photos') diff = getProductPhotoCount(b) - getProductPhotoCount(a);
    if (catalogSort === 'az') diff = String(a.equipo || '').localeCompare(String(b.equipo || ''));
    if (catalogSort === 'popular') {
        diff = getCategoryRank(a) - getCategoryRank(b);
        if (diff === 0) diff = getProductPhotoCount(b) - getProductPhotoCount(a);
    }
    if (catalogSort === 'recent') diff = Number(b.id || 0) - Number(a.id || 0);
    if (diff !== 0) return diff;
    diff = getCategoryRank(a) - getCategoryRank(b);
    if (diff !== 0) return diff;
    return Number(a.id || 0) - Number(b.id || 0);
}

function isProductInPageCategory(product, pageCat) {
    const cat = (product.categoria || '').toLowerCase();
    const eq = (product.equipo || '').toLowerCase();
    if (!pageCat) return true;
    if (pageCat === 'mundial-2026' && cat.includes('2026')) return true;
    if (pageCat === 'temporada-25-26' && cat.includes('25/26')) return true;
    if (pageCat === 'retro' && cat.includes('leyendas')) return true;
    if (pageCat === 'mujer' && cat.includes('women')) return true;
    if (pageCat === 'colombia' && eq.includes('colombia')) return true;
    if (pageCat === 'real-madrid' && eq.includes('real madrid')) return true;
    if (pageCat === 'barcelona' && eq.includes('barcelona')) return true;
    if (pageCat === 'arsenal' && eq.includes('arsenal')) return true;
    if (pageCat === 'liverpool' && eq.includes('liverpool')) return true;
    if (pageCat === 'manchester-united' && eq.includes('manchester united')) return true;
    if (pageCat === 'bayern-munich' && eq.includes('bayern')) return true;
    if (pageCat === 'psg' && eq.includes('psg')) return true;
    if (pageCat === 'brasil' && eq.includes('brasil')) return true;
    if (pageCat === 'argentina' && eq.includes('argentina')) return true;
    if (pageCat === 'alemania' && eq.includes('alemania')) return true;
    if (pageCat === 'portugal' && eq.includes('portugal')) return true;
    if (pageCat === 'manchester-city' && eq.includes('manchester city')) return true;
    return false;
}

// ── Filtros del catalogo ─────────────────────────────────────────────────────
const NATIONAL_TEAM_WORDS = [
    'seleccion', 'colombia', 'brasil', 'argentina', 'alemania', 'francia', 'croacia', 'espana', 'italia',
    'portugal', 'mexico', 'belgica', 'corea', 'ghana', 'inglaterra', 'holanda', 'paises bajos', 'uruguay',
    'japon', 'estados unidos', 'peru', 'chile', 'ecuador', 'nigeria', 'marruecos', 'senegal', 'camerun',
    'paraguay', 'venezuela'
];
const CATALOG_FILTER_GROUPS = [
    { key: 'disponibilidad', title: 'Disponibilidad', options: [['stock', 'En stock'], ['pedido', 'Bajo pedido']] },
    { key: 'talla', title: 'Talla en stock', options: [] },
    { key: 'equipo', title: 'Equipo', options: [['seleccion', 'Selecciones'], ['club', 'Clubes']] },
    { key: 'tipo', title: 'Tipo', options: [['fan', 'Fan'], ['player', 'Player'], ['retro', 'Retro'], ['mujer', 'Mujer']] },
    { key: 'epoca', title: 'Época retro', options: [['70s', 'Años 70'], ['80s', 'Años 80'], ['90s', 'Años 90'], ['00s', '2000s'], ['10s', '2010s']] },
];

function productSearchText(product) {
    return normalizeSearchTerm(`${product.equipo || ''} ${product.categoria || ''}`);
}

function isRetroProduct(product) {
    const text = productSearchText(product);
    return text.includes('retro') || text.includes('leyendas');
}

function getProductEpoca(product) {
    if (!isRetroProduct(product)) return null;
    const year = Number((String(product.equipo || '').match(/\b(19[5-9]\d|20[01]\d)\b/) || [])[1]);
    if (!year) return null;
    if (year < 1980) return '70s';
    if (year < 1990) return '80s';
    if (year < 2000) return '90s';
    if (year < 2010) return '00s';
    return '10s';
}

function productMatchesFilterOption(product, groupKey, value) {
    const text = productSearchText(product);
    if (groupKey === 'disponibilidad') return (getAvailableStock(product) > 0 ? 'stock' : 'pedido') === value;
    if (groupKey === 'talla') return getAvailableSizeEntries(product).some((item) => item.size === value);
    if (groupKey === 'equipo') {
        const isNational = NATIONAL_TEAM_WORDS.some((word) => text.includes(word))
            || text.includes('selecciones nacionales') || text.includes('coleccion 2026');
        return (isNational ? 'seleccion' : 'club') === value;
    }
    if (groupKey === 'tipo') {
        const isPlayer = text.includes('player');
        const isRetro = isRetroProduct(product);
        if (value === 'player') return isPlayer;
        if (value === 'retro') return isRetro;
        if (value === 'mujer') return text.includes('mujer') || text.includes('women');
        if (value === 'fan') return !isPlayer && !isRetro;
    }
    if (groupKey === 'epoca') return getProductEpoca(product) === value;
    return false;
}

function productMatchesFilters(product, skipGroup = null) {
    return Object.entries(catalogFilters).every(([groupKey, values]) => {
        if (groupKey === skipGroup || values.size === 0) return true;
        return [...values].some((value) => productMatchesFilterOption(product, groupKey, value));
    });
}

function countActiveCatalogFilters() {
    return Object.values(catalogFilters).reduce((sum, values) => sum + values.size, 0);
}

// Productos de la pagina (categoria + busqueda) antes de aplicar los filtros.
function getCatalogBaseProducts(products) {
    const pageCat = document.body.getAttribute('data-category');
    let base = (products || []).filter(p => isProductInPageCategory(p, pageCat));
    if (catalogSearchTerm) {
        base = base.filter(p => {
            const haystack = normalizeSearchTerm(`${p.equipo || ''} ${p.categoria || ''} ${p.descripcion || ''}`);
            return haystack.includes(catalogSearchTerm);
        });
    }
    return base;
}

function getCatalogFilterGroups(baseProducts) {
    const sizes = [...new Set(baseProducts.flatMap((p) => getAvailableSizeEntries(p).map((item) => item.size)))]
        .sort((a, b) => (SIZE_ORDER[a] || 99) - (SIZE_ORDER[b] || 99));
    return CATALOG_FILTER_GROUPS.map((group) => {
        const options = group.key === 'talla' ? sizes.map((size) => [size, size]) : group.options;
        const facetBase = baseProducts.filter((p) => productMatchesFilters(p, group.key));
        return {
            ...group,
            options: options
                .map(([value, label]) => ({ value, label, count: facetBase.filter((p) => productMatchesFilterOption(p, group.key, value)).length }))
                .filter((option) => option.count > 0 || catalogFilters[group.key].has(option.value)),
        };
    }).filter((group) => group.options.length > 1 || group.options.some((option) => catalogFilters[group.key].has(option.value)));
}

function renderCatalogFilterPanel(baseProducts, resultCount) {
    const groups = getCatalogFilterGroups(baseProducts);
    const active = countActiveCatalogFilters();
    const groupsHtml = groups.map((group) => `
        <fieldset class="catalog-filter-group">
            <legend>${group.title}</legend>
            <div class="catalog-filter-options">
                ${group.options.map((option) => {
                    const on = catalogFilters[group.key].has(option.value);
                    return `<button type="button" class="catalog-filter-chip${on ? ' active' : ''}" aria-pressed="${on}" onclick="catalogToggleFilter('${group.key}', '${escapeHtml(option.value)}')">${escapeHtml(option.label)}<span>${option.count}</span></button>`;
                }).join('')}
            </div>
        </fieldset>`).join('');
    return `
        <div class="catalog-filter-head">
            <strong>Filtros</strong>
            <button type="button" class="catalog-filter-close" onclick="catalogCloseFilters()" aria-label="Cerrar filtros">&times;</button>
        </div>
        <div class="catalog-filter-body">${groupsHtml}</div>
        <div class="catalog-filter-foot">
            <button type="button" class="catalog-filter-clear" onclick="catalogClearFilters()"${active ? '' : ' disabled'}>Limpiar</button>
            <button type="button" class="catalog-filter-apply" onclick="catalogCloseFilters()">Ver ${resultCount} camiseta${resultCount === 1 ? '' : 's'}</button>
        </div>`;
}

// El panel vive fuera de #productGrid para que redibujar la grilla no le
// cambie el scroll mientras se tocan los filtros en el celular.
function ensureCatalogFilterPanel(container) {
    let panel = byId('catalogFilterPanel');
    if (!panel && container && container.parentElement) {
        panel = document.createElement('aside');
        panel.id = 'catalogFilterPanel';
        panel.className = 'catalog-filter-panel';
        panel.setAttribute('aria-label', 'Filtros del catalogo');
        container.parentElement.classList.add('catalog-with-filters');
        container.parentElement.insertBefore(panel, container);
        const overlay = document.createElement('div');
        overlay.id = 'catalogFilterOverlay';
        overlay.className = 'catalog-filter-overlay';
        overlay.addEventListener('click', () => window.catalogCloseFilters());
        document.body.appendChild(overlay);
    }
    return panel;
}

function setCatalogFilterPanelOpen(isOpen) {
    catalogFilterPanelOpen = isOpen;
    const panel = byId('catalogFilterPanel');
    const overlay = byId('catalogFilterOverlay');
    if (panel) panel.classList.toggle('open', isOpen);
    if (overlay) overlay.classList.toggle('open', isOpen);
    document.body.classList.toggle('catalog-filters-open', isOpen);
}

window.catalogToggleFilter = function (groupKey, value) {
    const values = catalogFilters[groupKey];
    if (!values) return;
    if (values.has(value)) values.delete(value);
    else values.add(value);
    catalogPage = 1;
    renderProducts(allProducts);
};

window.catalogClearFilters = function () {
    Object.values(catalogFilters).forEach((values) => values.clear());
    catalogPage = 1;
    renderProducts(allProducts);
};

window.catalogOpenFilters = function () { setCatalogFilterPanelOpen(true); };
window.catalogCloseFilters = function () { setCatalogFilterPanelOpen(false); };

function renderActiveFilterChips() {
    const chips = [];
    CATALOG_FILTER_GROUPS.forEach((group) => {
        catalogFilters[group.key].forEach((value) => {
            const label = (group.options.find(([v]) => v === value) || [value, value])[1];
            chips.push(`<button type="button" class="catalog-active-chip" onclick="catalogToggleFilter('${group.key}', '${escapeHtml(value)}')" aria-label="Quitar filtro ${escapeHtml(label)}">${escapeHtml(group.key === 'talla' ? `Talla ${label}` : label)} &times;</button>`);
        });
    });
    if (!chips.length) return '';
    return `<div class="catalog-active-filters">${chips.join('')}<button type="button" class="catalog-active-clear" onclick="catalogClearFilters()">Limpiar todo</button></div>`;
}

function renderCatalogMoreButton(shown, total) {
    if (shown >= total) return '';
    return `
        <div class="catalog-more">
            <p>Viendo ${shown} de ${total} camisetas</p>
            <button type="button" class="catalog-more-btn" onclick="catalogShowMore()">Ver m&aacute;s camisetas</button>
        </div>`;
}

function renderCatalogToolbar(total, shown) {
    const active = countActiveCatalogFilters();
    return `
        <div class="catalog-toolbar">
            <div class="catalog-results">${total ? `${total} camiseta${total === 1 ? '' : 's'}` : 'Sin resultados'}</div>
            <button type="button" class="catalog-filter-toggle" onclick="catalogOpenFilters()" aria-label="Abrir filtros">
                <i class="ph-bold ph-sliders-horizontal"></i> Filtros${active ? ` <span>${active}</span>` : ''}
            </button>
            <label class="catalog-sort-wrap">
                <span>Ordenar por</span>
                <select class="catalog-sort" onchange="catalogSetSort(this.value)" aria-label="Ordenar cat&aacute;logo">
                    <option value="recommended"${catalogSort === 'recommended' ? ' selected' : ''}>Recomendados</option>
                    <option value="popular"${catalogSort === 'popular' ? ' selected' : ''}>Popularidad</option>
                    <option value="recent"${catalogSort === 'recent' ? ' selected' : ''}>M&aacute;s recientes</option>
                    <option value="price-asc"${catalogSort === 'price-asc' ? ' selected' : ''}>Menor precio</option>
                    <option value="price-desc"${catalogSort === 'price-desc' ? ' selected' : ''}>Mayor precio</option>
                    <option value="photos"${catalogSort === 'photos' ? ' selected' : ''}>M&aacute;s fotos</option>
                    <option value="az"${catalogSort === 'az' ? ' selected' : ''}>A-Z</option>
                </select>
            </label>
        </div>`;
}

window.catalogSetSort = function (value) {
    catalogSort = value || 'recommended';
    catalogPage = 1;
    renderProducts(allProducts);
};

// "Ver mas" agrega la siguiente tanda al final sin redibujar lo que ya se ve,
// asi el scroll queda donde estaba.
window.catalogShowMore = function () {
    const grid = document.querySelector('#productGrid .product-grid-inner');
    if (!grid) return;
    const start = catalogPage * CATALOG_PAGE_SIZE;
    catalogPage += 1;
    const end = Math.min(catalogPage * CATALOG_PAGE_SIZE, catalogLastResults.length);
    const productIndexById = new Map(allProducts.map((product, index) => [product.id, index]));
    appendCatalogProductBatch(grid, catalogLastResults, start, end, productIndexById, catalogRenderToken);
    const more = document.querySelector('#productGrid .catalog-more');
    if (more) more.outerHTML = renderCatalogMoreButton(end, catalogLastResults.length);
};

function renderNavigation() {
    const desktopNav = document.getElementById('desktopCatNav');
    const mobileNav = document.getElementById('mobileCatNav');

    if (desktopNav) {
        const megaHtml = `
        <li><a href="/" style="display:flex;align-items:center;gap:6px;"><i class="ph ph-house" style="font-size:1.1em;"></i> Inicio</a></li>
        <li class="has-mega">
            <a href="/catalogo.html" class="mega-trigger" style="color:var(--gold);">
                <i class="ph ph-t-shirt" style="font-size:1.1em;"></i> Camisetas <i class="ph ph-caret-down mega-caret"></i>
            </a>
            <div class="mega-menu">
                <div class="mega-col">
                    <span class="mega-col-title">Selecciones</span>
                    <a href="/categorias/mundial-2026" class="mega-link"><i class="ph-fill ph-globe-hemisphere-west"></i> Mundial 2026</a>
                    <a href="/categorias/colombia" class="mega-link"><i class="ph-fill ph-flag"></i> Colombia</a>
                    <a href="/categorias/argentina" class="mega-link"><i class="ph-fill ph-flag"></i> Argentina</a>
                    <a href="/categorias/brasil" class="mega-link"><i class="ph-fill ph-flag"></i> Brasil</a>
                    <a href="/categorias/alemania" class="mega-link"><i class="ph-fill ph-flag"></i> Alemania</a>
                    <a href="/categorias/portugal" class="mega-link"><i class="ph-fill ph-flag"></i> Portugal</a>
                    <a href="/catalogo.html" class="mega-link mega-link-all"><i class="ph-fill ph-arrow-right"></i> Ver todas</a>
                </div>
                <div class="mega-col">
                    <span class="mega-col-title">Clubes</span>
                    <a href="/categorias/real-madrid" class="mega-link"><i class="ph-fill ph-soccer-ball"></i> Real Madrid</a>
                    <a href="/categorias/barcelona" class="mega-link"><i class="ph-fill ph-soccer-ball"></i> Barcelona</a>
                    <a href="/categorias/arsenal" class="mega-link"><i class="ph-fill ph-soccer-ball"></i> Arsenal</a>
                    <a href="/categorias/liverpool" class="mega-link"><i class="ph-fill ph-soccer-ball"></i> Liverpool</a>
                    <a href="/categorias/bayern-munich" class="mega-link"><i class="ph-fill ph-soccer-ball"></i> Bayern M&uuml;nich</a>
                    <a href="/categorias/manchester-united" class="mega-link"><i class="ph-fill ph-soccer-ball"></i> Manchester Utd</a>
                    <a href="/catalogo.html" class="mega-link mega-link-all"><i class="ph-fill ph-arrow-right"></i> Ver todos</a>
                </div>
                <div class="mega-col">
                    <span class="mega-col-title">Colecciones</span>
                    <a href="/categorias/temporada-25-26" class="mega-link"><i class="ph-fill ph-star"></i> Temporada 25/26</a>
                    <a href="/categorias/retro" class="mega-link"><i class="ph-fill ph-clock-counter-clockwise"></i> Leyendas Retro</a>
                    <a href="/categorias/mujer" class="mega-link"><i class="ph-fill ph-heart"></i> Women&#39;s Collection</a>
                    <a href="/catalogo.html" class="mega-link mega-link-all" style="margin-top:24px;"><i class="ph-fill ph-squares-four"></i> Cat&aacute;logo completo</a>
                </div>
            </div>
        </li>
        <li><a href="/preventa" style="color:var(--gold);display:flex;align-items:center;gap:6px;"><i class="ph ph-tag" style="font-size:1.1em;"></i> Pre-orden</a></li>
        <li><a href="/nosotros" style="display:flex;align-items:center;gap:6px;"><i class="ph ph-info" style="font-size:1.1em;"></i> Nosotros</a></li>
        <li><a href="/preguntas-frecuentes" style="display:flex;align-items:center;gap:6px;"><i class="ph ph-question" style="font-size:1.1em;"></i> Preguntas Frecuentes</a></li>`;
        desktopNav.innerHTML = megaHtml;
    }

    if (mobileNav) {
        const closeFn = () => {
            closeDrawer();
        };

        const mobileHtml = `
            <a href="/" class="category-drawer-link">
                <span class="drawer-link-icon"><i class="ph-bold ph-house"></i></span>
                <span>Inicio</span>
            </a>
            <a href="/catalogo.html" class="category-drawer-link">
                <span class="drawer-link-icon" style="color:var(--gold);"><i class="ph-fill ph-t-shirt"></i></span>
                <span style="color:var(--gold);">Explorar Cat&aacute;logo</span>
            </a>

            <!-- Acordeon: Selecciones -->
            <div class="drawer-accordion">
                <button class="drawer-accordion-trigger" data-target="acc-selecciones">
                    <span class="drawer-link-icon"><i class="ph-bold ph-flag"></i></span>
                    <span>Selecciones</span>
                    <i class="ph-bold ph-caret-down drawer-accordion-caret"></i>
                </button>
                <div class="drawer-accordion-body" id="acc-selecciones">
                    <a href="/categorias/colombia" class="drawer-sub-link"><i class="ph-fill ph-flag"></i> Colombia</a>
                    <a href="/categorias/argentina" class="drawer-sub-link"><i class="ph-fill ph-flag"></i> Argentina</a>
                    <a href="/categorias/brasil" class="drawer-sub-link"><i class="ph-fill ph-flag"></i> Brasil</a>
                    <a href="/categorias/alemania" class="drawer-sub-link"><i class="ph-fill ph-flag"></i> Alemania</a>
                    <a href="/categorias/portugal" class="drawer-sub-link"><i class="ph-fill ph-flag"></i> Portugal</a>
                    <a href="/categorias/mundial-2026" class="drawer-sub-link"><i class="ph-fill ph-globe-hemisphere-west"></i> Mundial 2026</a>
                </div>
            </div>

            <!-- Acordeon: Clubes -->
            <div class="drawer-accordion">
                <button class="drawer-accordion-trigger" data-target="acc-clubes">
                    <span class="drawer-link-icon"><i class="ph-bold ph-soccer-ball"></i></span>
                    <span>Clubes</span>
                    <i class="ph-bold ph-caret-down drawer-accordion-caret"></i>
                </button>
                <div class="drawer-accordion-body" id="acc-clubes">
                    <a href="/categorias/real-madrid" class="drawer-sub-link"><i class="ph-fill ph-soccer-ball"></i> Real Madrid</a>
                    <a href="/categorias/barcelona" class="drawer-sub-link"><i class="ph-fill ph-soccer-ball"></i> Barcelona</a>
                    <a href="/categorias/arsenal" class="drawer-sub-link"><i class="ph-fill ph-soccer-ball"></i> Arsenal</a>
                    <a href="/categorias/liverpool" class="drawer-sub-link"><i class="ph-fill ph-soccer-ball"></i> Liverpool</a>
                    <a href="/categorias/manchester-united" class="drawer-sub-link"><i class="ph-fill ph-soccer-ball"></i> Manchester Utd</a>
                    <a href="/categorias/manchester-city" class="drawer-sub-link"><i class="ph-fill ph-soccer-ball"></i> Manchester City</a>
                    <a href="/categorias/bayern-munich" class="drawer-sub-link"><i class="ph-fill ph-soccer-ball"></i> Bayern M&uuml;nich</a>
                    <a href="/categorias/psg" class="drawer-sub-link"><i class="ph-fill ph-soccer-ball"></i> PSG</a>
                </div>
            </div>

            <!-- Acordeon: Colecciones -->
            <div class="drawer-accordion">
                <button class="drawer-accordion-trigger" data-target="acc-colecciones">
                    <span class="drawer-link-icon"><i class="ph-bold ph-star"></i></span>
                    <span>Colecciones</span>
                    <i class="ph-bold ph-caret-down drawer-accordion-caret"></i>
                </button>
                <div class="drawer-accordion-body" id="acc-colecciones">
                    <a href="/categorias/temporada-25-26" class="drawer-sub-link"><i class="ph-fill ph-star"></i> Temporada 25/26</a>
                    <a href="/categorias/retro" class="drawer-sub-link"><i class="ph-fill ph-clock-counter-clockwise"></i> Leyendas Retro</a>
                    <a href="/categorias/mujer" class="drawer-sub-link"><i class="ph-fill ph-heart"></i> Women's Collection</a>
                </div>
            </div>

            <a href="/nosotros" class="category-drawer-link" style="margin-top:8px; border-top:1px solid rgba(255,255,255,0.05); padding-top:18px;">
                <span class="drawer-link-icon"><i class="ph-bold ph-info"></i></span>
                <span>Sobre Nosotros</span>
            </a>
            <a href="/preguntas-frecuentes" class="category-drawer-link">
                <span class="drawer-link-icon"><i class="ph-bold ph-question"></i></span>
                <span>Preguntas Frecuentes</span>
            </a>
            <a href="/preventa" class="category-drawer-link">
                <span class="drawer-link-icon" style="color:var(--gold);"><i class="ph-bold ph-tag"></i></span>
                <span style="color:var(--gold);">Pre-orden</span>
            </a>
        `;
        mobileNav.innerHTML = mobileHtml;

        // Close drawer on regular link click
        mobileNav.querySelectorAll('.category-drawer-link, .drawer-sub-link').forEach(link => {
            link.addEventListener('click', closeFn);
        });

        // Accordion toggle
        mobileNav.querySelectorAll('.drawer-accordion-trigger').forEach(btn => {
            btn.addEventListener('click', () => {
                const body = document.getElementById(btn.dataset.target);
                const isOpen = body.classList.contains('open');
                // Close all first
                mobileNav.querySelectorAll('.drawer-accordion-body').forEach(b => b.classList.remove('open'));
                mobileNav.querySelectorAll('.drawer-accordion-trigger').forEach(b => b.classList.remove('open'));
                // Toggle clicked
                if (!isOpen) {
                    body.classList.add('open');
                    btn.classList.add('open');
                }
            });
        });
    }
}

// ── Render Products ───────────────────────────────────────────────────────────
// Etiqueta de estado: pequena, en la esquina y con el mismo estilo para todas.
function getProductStatusChip(product, isBajoPedido) {
    if (isBajoPedido) return { text: 'Bajo pedido', cls: 'status-pedido' };
    const stock = getAvailableStock(product);
    if (stock === 1) return { text: 'Última unidad', cls: 'status-ultima' };
    return { text: 'En stock', cls: 'status-stock' };
}

// Tarjeta comun para el catalogo y las destacadas del inicio. Las tarjetas se
// muestran de una vez (antes entraban con una animacion que parecia carga
// lenta). En computador, al pasar el mouse se ve la segunda foto.
function buildProductCard(product, i, idx, eagerCount) {
    const firstImage = product.imagenes && product.imagenes.length > 0 ? product.imagenes[0] : (product.imagen || '');
    const coverImg = toWebp(firstImage);
    const cardImg = toCardImage(firstImage);
    const altImage = !isTouchDevice && product.imagenes && product.imagenes.length > 1 ? product.imagenes[1] : '';

    const isBajoPedido = isProductBajoPedido(product);
    const tallas = getSortedSizeEntries(product.tallas);
    const allSoldOut = !isBajoPedido && tallas.length > 0 && tallas.every(({ stock }) => stock === 0);
    const sizePills = buildSizePills(product.tallas, isBajoPedido);
    const stockNotice = buildStockNotice(product, isBajoPedido);
    const badge = getProductBadge(product);
    const status = getProductStatusChip(product, isBajoPedido);

    const card = document.createElement('div');
    card.className = 'product-card' + (allSoldOut ? ' soldout' : '') + (isBajoPedido ? ' bajopedido' : '');
    if (!allSoldOut || isBajoPedido) card.onclick = () => openModal(idx);

    const imageAttrs = i < eagerCount
        ? `src="${cardImg}" fetchpriority="${i === 0 ? 'high' : 'auto'}" loading="eager"`
        : `data-src="${cardImg}" loading="lazy" fetchpriority="low"`;

    card.innerHTML = `
        <div class="product-image-wrapper img-loading">
            <img ${imageAttrs} data-full-src="${coverImg}" alt="${product.equipo}" class="lazy-img" width="640" height="640" decoding="async">
            ${altImage ? `<img data-alt-src="${toCardImage(altImage)}" data-full-src="${toWebp(altImage)}" alt="" aria-hidden="true" class="product-img-alt" width="640" height="640" decoding="async">` : ''}
            <span class="product-status ${status.cls}">${status.text}</span>
            ${badge ? `<span class="product-badge ${badge.cls}">${badge.text}</span>` : ''}
        </div>
        <div class="product-info">
            <h3 class="product-title">${product.equipo}</h3>
            <div class="product-price">${formatPrice(product.precio)}</div>
            <div class="product-sizes">${sizePills}</div>
            ${stockNotice}
            <div class="product-actions">
                ${allSoldOut
                    ? `<span class="btn-whatsapp" style="opacity:0.4;cursor:not-allowed;">Sin stock</span>`
                    : `<button class="btn-whatsapp" onclick="event.stopPropagation(); openModal(${idx})">${isBajoPedido ? 'Pedir bajo pedido' : 'Elegir talla'}</button>`
                }
            </div>
        </div>
    `;

    const img = card.querySelector('.lazy-img');
    if (img && img.dataset.src) {
        bindProductImageFallback(img);
        imgObserver.observe(img);
    } else if (img) {
        bindProductImageFallback(img);
    }

    const alt = card.querySelector('.product-img-alt');
    if (alt) {
        card.addEventListener('mouseenter', () => {
            if (alt.src) return;
            alt.onload = () => alt.parentElement.classList.add('alt-ready');
            alt.onerror = () => {
                const fallback = alt.dataset.fullSrc;
                if (fallback && alt.src !== fallback) {
                    alt.src = fallback;
                    alt.dataset.fullSrc = '';
                }
            };
            alt.src = alt.dataset.altSrc;
        }, { once: true });
    }

    return card;
}

function createCatalogProductCard(product, i, productIndexById) {
    const idx = productIndexById.get(product.id) ?? allProducts.findIndex(p => p.id === product.id);
    return buildProductCard(product, i, idx, 4);
}

function appendCatalogProductBatch(grid, visibleProducts, start, end, productIndexById, renderToken) {
    if (renderToken !== catalogRenderToken) return;
    const fragment = document.createDocumentFragment();
    for (let i = start; i < end; i++) {
        fragment.appendChild(createCatalogProductCard(visibleProducts[i], i, productIndexById));
    }
    grid.appendChild(fragment);
}

function renderDeferredCatalogProducts(grid, visibleProducts, start, productIndexById, renderToken) {
    if (renderToken !== catalogRenderToken || start >= visibleProducts.length) return;
    const end = Math.min(start + CATALOG_RENDER_BATCH_SIZE, visibleProducts.length);
    requestAnimationFrame(() => {
        appendCatalogProductBatch(grid, visibleProducts, start, end, productIndexById, renderToken);
        setTimeout(() => renderDeferredCatalogProducts(grid, visibleProducts, end, productIndexById, renderToken), 0);
    });
}

function renderProducts(products) {
    const container = byId('productGrid');
    if (!container) return;

    const renderToken = ++catalogRenderToken;
    container.setAttribute('aria-busy', 'true');

    const pageCat = document.body.getAttribute('data-category');
    const baseProducts = getCatalogBaseProducts(products);
    const displayProducts = baseProducts.filter((p) => productMatchesFilters(p)).sort(compareCatalogProducts);
    catalogLastResults = displayProducts;

    const panel = ensureCatalogFilterPanel(container);
    if (panel) {
        const bodyScroll = panel.querySelector('.catalog-filter-body')?.scrollTop || 0;
        panel.innerHTML = renderCatalogFilterPanel(baseProducts, displayProducts.length);
        const body = panel.querySelector('.catalog-filter-body');
        if (body) body.scrollTop = bodyScroll;
        setCatalogFilterPanelOpen(catalogFilterPanelOpen);
    }

    container.replaceChildren();
    container.classList.remove('catalog-skeleton-active');

    if (displayProducts.length === 0) {
        container.innerHTML = `
            ${pageCat ? `<section class="catalog-page-head"><span>Cat&aacute;logo</span><h1>${getCategoryTitle(pageCat)}</h1></section>` : ''}
            ${renderCatalogToolbar(0, 0)}
            ${renderActiveFilterChips()}
            <p class="catalog-empty">No encontramos camisetas con esos filtros.${countActiveCatalogFilters() ? ' <button type="button" class="catalog-active-clear" onclick="catalogClearFilters()">Quitar filtros</button>' : ''}</p>`;
        container.setAttribute('aria-busy', 'false');
        return;
    }

    const shownCount = Math.min(Math.max(1, catalogPage) * CATALOG_PAGE_SIZE, displayProducts.length);
    const visibleProducts = displayProducts.slice(0, shownCount);
    const productIndexById = new Map(allProducts.map((product, index) => [product.id, index]));

    if (pageCat) {
        container.insertAdjacentHTML('beforeend', `<section class="catalog-page-head"><span>Cat&aacute;logo</span><h1>${getCategoryTitle(pageCat)}</h1></section>`);
    }
    container.insertAdjacentHTML('beforeend', renderCatalogToolbar(displayProducts.length, shownCount));
    container.insertAdjacentHTML('beforeend', renderActiveFilterChips());

    const grid = document.createElement('div');
    grid.className = 'product-grid-inner';
    container.appendChild(grid);

    const initialEnd = Math.min(CATALOG_INITIAL_RENDER_COUNT, visibleProducts.length);
    appendCatalogProductBatch(grid, visibleProducts, 0, initialEnd, productIndexById, renderToken);

    container.insertAdjacentHTML('beforeend', renderCatalogMoreButton(shownCount, displayProducts.length));
    container.setAttribute('aria-busy', 'false');

    if (initialEnd < visibleProducts.length) {
        renderDeferredCatalogProducts(grid, visibleProducts, initialEnd, productIndexById, renderToken);
    }

    if (false && !prefersReducedMotion && !isTouchDevice && window.matchMedia('(min-width: 1024px)').matches) {
        runAfterIdleDelay(() => {
            loadVanillaTilt().then((VanillaTilt) => {
                VanillaTilt.init(document.querySelectorAll('.product-card'), {
                    max: 4,
                    speed: 400,
                    glare: true,
                    'max-glare': 0.05,
                    scale: 1.01,
                    perspective: 900,
                });
            }).catch(function(){});
        }, 2500, 1800);
    }
}

// â”€â”€ Render Featured Products (HOME) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderFeaturedProducts() {
    const container = byId('featuredProductGrid');
    if (!container) return;

    // Destacadas: solo camisetas con stock y con foto. Primero las de siempre
    // (si tienen stock) y se completa con las mas recientes que haya en stock.
    const FEATURED_COUNT = 6;
    const preferredIds = [10, 1, 2, 28, 26, 41];
    const canFeature = (p) => p && getAvailableStock(p) > 0 && Array.isArray(p.imagenes) && p.imagenes.length > 0;
    const featured = preferredIds.map(id => allProducts.find(p => p.id === id)).filter(canFeature);
    allProducts
        .filter(p => canFeature(p) && !featured.includes(p))
        .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
        .forEach(p => { if (featured.length < FEATURED_COUNT) featured.push(p); });

    container.innerHTML = '';

    featured.slice(0, FEATURED_COUNT).forEach((product, i) => {
        const idx = allProducts.findIndex(p => p.id === product.id);
        container.appendChild(buildProductCard(product, i, idx, 2));
    });

    if (false && !prefersReducedMotion && !isTouchDevice && window.matchMedia('(min-width: 1024px)').matches) {
        runAfterIdleDelay(() => {
            loadVanillaTilt().then((VanillaTilt) => {
                VanillaTilt.init(container.querySelectorAll('.product-card'), {
                    max: 4,
                    speed: 400,
                    glare: true,
                    'max-glare': 0.05,
                    scale: 1.01,
                    perspective: 900,
                });
            }).catch(function(){});
        }, 2500, 1800);
    }
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal(productIndex) {
    const product = allProducts[productIndex];
    if (!product) return;
    const modal = document.getElementById('productModal');
    trackEvent('modal_open', product);

    document.getElementById('modalTitle').innerText = product.equipo;
    document.getElementById('modalPrice').innerText = formatPrice(product.precio);

    const isBajoPedido = isProductBajoPedido(product);

    // Descripción con aviso de preventa
    const descEl = document.getElementById('modalDescription');
    let descText = product.descripcion || '';
    if (isBajoPedido) {
        descText = `✈️ BAJO PEDIDO: Tiempo de entrega estimado de 15 a 20 días hábiles.\n\n` + descText;
    }
    descEl.textContent = descText;
    descEl.style.display = descText ? 'block' : 'none';

    let modalStockNotice = document.getElementById('modalStockNotice');
    if (!modalStockNotice) {
        modalStockNotice = document.createElement('div');
        modalStockNotice.id = 'modalStockNotice';
        modalStockNotice.className = 'modal-stock-note';
        descEl.parentNode.insertBefore(modalStockNotice, descEl);
    }
    const stockNoticeText = buildStockNoticeText(product, isBajoPedido);
    modalStockNotice.textContent = stockNoticeText;
    modalStockNotice.style.display = stockNoticeText ? 'block' : 'none';

    const mainImg = document.getElementById('mainImage');
    const thumbContainer = document.getElementById('thumbnailsContainer');
    thumbContainer.innerHTML = '';

    let images = (product.imagenes || (product.imagen ? [product.imagen] : [])).map(toWebp);
    if (images.length > 0) {
        mainImg.src = images[0];
        images.forEach((src, i) => {
            const thumb = document.createElement('img');
            thumb.src = src;
            thumb.className = i === 0 ? 'active' : '';
            thumb.loading = 'lazy';
            thumb.onclick = () => {
                mainImg.src = src;
                Array.from(thumbContainer.children).forEach(c => c.classList.remove('active'));
                thumb.classList.add('active');
            };
            thumbContainer.appendChild(thumb);
        });
    }

    // Tallas
    const sizeContainer = document.getElementById('sizeButtons');
    sizeContainer.innerHTML = '';
    let fitGuideEl = document.getElementById('modalFitGuide');
    if (!fitGuideEl) {
        fitGuideEl = document.createElement('div');
        fitGuideEl.id = 'modalFitGuide';
        fitGuideEl.className = 'modal-fit-guide';
        fitGuideEl.setAttribute('aria-label', 'Guia de tallas y corte');
        sizeContainer.insertAdjacentElement('afterend', fitGuideEl);
    }
    fitGuideEl.innerHTML = buildModalFitGuideHtml(product);
    const wsBtn = document.getElementById('modalWsBtn');
    const addCartBtn = document.getElementById('modalAddCartBtn');

    // Estado inicial deshabilitado unificado
    wsBtn.style.display = 'inline-flex';
    wsBtn.style.pointerEvents = 'none';
    wsBtn.style.opacity = '0.4';
    wsBtn.className = 'btn-whatsapp';
    wsBtn.innerHTML = `
        <svg viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217s.233-.002.332-.002c.099-.001.233-.037.363.275.13.312.443 1.08.482 1.159.039.079.065.171.017.266-.048.096-.073.155-.138.229-.065.074-.136.162-.195.226-.065.069-.133.143-.058.272.075.129.333.551.713.889.49.438.905.576 1.033.64.128.064.204.053.28-.032.076-.085.328-.376.415-.506.087-.13.174-.108.291-.064.117.044.743.349.871.413.128.064.212.096.242.148.03.052.03.303-.114.708zM12 2C6.477 2 2 6.477 2 12c0 1.758.455 3.425 1.29 4.903L2 22l5.226-1.213C8.68 21.554 10.312 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
        ${isBajoPedido ? 'Selecciona una talla (Bajo pedido)' : 'Selecciona una talla'}`;

    addCartBtn.style.display = 'inline-flex';
    addCartBtn.style.pointerEvents = 'none';
    addCartBtn.style.opacity = '0.4';
    addCartBtn.onclick = null;

    getSortedSizeEntries(product.tallas).forEach(({ size, stock }) => {
        const btn = document.createElement('button');
        btn.innerHTML = isBajoPedido || stock <= 0
            ? `<span class="size-btn-code">${escapeHtml(size)}</span>`
            : `<span class="size-btn-code">${escapeHtml(size)}</span><span class="size-btn-stock">${stock} disp.</span>`;
        const available = isBajoPedido || stock > 0;
        if (!available) {
            btn.className = 'size-btn out-of-stock';
            btn.title = 'Agotada';
        } else {
            btn.className = 'size-btn' + (!isBajoPedido && stock <= LOW_STOCK_THRESHOLD ? ' low-stock' : '');
            btn.title = isBajoPedido ? `Talla ${size} bajo pedido` : `${stock} unidad${stock === 1 ? '' : 'es'} disponible${stock === 1 ? '' : 's'}`;
            btn.onclick = () => {
                Array.from(sizeContainer.children).forEach(c => c.classList.remove('selected'));
                btn.classList.add('selected');
                trackEvent('whatsapp_click', { ...product, extra: { talla: size } });
                
                const stockLine = !isBajoPedido && stock <= LOW_STOCK_THRESHOLD
                    ? ` Quedan ${stock} unidad${stock === 1 ? '' : 'es'} disponible${stock === 1 ? '' : 's'} en esa talla.`
                    : '';
                const fitInfo = getProductFitInfo(product);
                const confirmLine = ` Quiero confirmar talla, corte (${fitInfo.label}) y disponibilidad.`;
                const msgText = isBajoPedido
                    ? `Hola Herencia 90, me interesa pre-ordenar la camiseta: ${product.equipo} en Talla ${size}.${confirmLine} Entiendo que tiene un tiempo de espera de 15 a 20 dias habiles aprox.`
                    : `Hola Herencia 90, me interesa comprar la camiseta: ${product.equipo} en Talla ${size}.${stockLine}${confirmLine}`;
                const msg = encodeURIComponent(msgText);
                wsBtn.href = `https://wa.me/573126428153?text=${msg}`;
                wsBtn.style.pointerEvents = 'auto';
                wsBtn.style.opacity = '1';
                wsBtn.className = 'btn-whatsapp green';
                wsBtn.innerHTML = `
                    <svg viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217s.233-.002.332-.002c.099-.001.233-.037.363.275.13.312.443 1.08.482 1.159.039.079.065.171.017.266-.048.096-.073.155-.138.229-.065.074-.136.162-.195.226-.065.069-.133.143-.058.272.075.129.333.551.713.889.49.438.905.576 1.033.64.128.064.204.053.28-.032.076-.085.328-.376.415-.506.087-.13.174-.108.291-.064.117.044.743.349.871.413.128.064.212.096.242.148.03.052.03.303-.114.708zM12 2C6.477 2 2 6.477 2 12c0 1.758.455 3.425 1.29 4.903L2 22l5.226-1.213C8.68 21.554 10.312 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
                    ${isBajoPedido ? 'Pre-ordenar Talla ' + size : 'Comprar Talla ' + size}`;
                
                // Habilitar y actualizar Carrito
                addCartBtn.style.pointerEvents = 'auto';
                addCartBtn.style.opacity = '1';
                addCartBtn.onclick = () => {
                    addToCart(product, size);
                    setProductModalVisible(false);
                };
            };
        }
        sizeContainer.appendChild(btn);
    });

    const preorderLinkContainer = document.getElementById('modalPreorderLinkContainer');
    if (preorderLinkContainer) {
        if (isBajoPedido) {
            preorderLinkContainer.innerHTML = `
                <a href="/preventa" class="btn-secondary-preorder">
                    <i class="ph ph-tag"></i> Ver Catálogo Completo de Pre-Orden →
                </a>
            `;
            preorderLinkContainer.style.display = 'block';
        } else {
            preorderLinkContainer.innerHTML = '';
            preorderLinkContainer.style.display = 'none';
        }
    }

    setProductModalVisible(true);
}

// Inject Global Floating WhatsApp Button & FAQ Accordion Listener
document.addEventListener('DOMContentLoaded', () => {
    const floatingWspHtml = `
    <a href="https://wa.me/573126428153" target="_blank" rel="noopener noreferrer" class="floating-wsp" aria-label="Escr&iacute;benos por WhatsApp">
        <i class="ph-fill ph-whatsapp-logo"></i>
    </a>
    `;
    document.body.insertAdjacentHTML('beforeend', floatingWspHtml);

    // Lógica del Acordeón de FAQs
    const faqTriggers = document.querySelectorAll('.faq-trigger');
    faqTriggers.forEach(trigger => {
        trigger.addEventListener('click', () => {
            const item = trigger.parentElement;
            const content = trigger.nextElementSibling;
            const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
            
            // Cerrar otros acordeones
            document.querySelectorAll('.faq-item').forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                    otherItem.querySelector('.faq-trigger').setAttribute('aria-expanded', 'false');
                    otherItem.querySelector('.faq-content').style.maxHeight = null;
                }
            });
            
            // Alternar el actual
            if (!isExpanded) {
                item.classList.add('active');
                trigger.setAttribute('aria-expanded', 'true');
                content.style.maxHeight = content.scrollHeight + "px";
            } else {
                item.classList.remove('active');
                trigger.setAttribute('aria-expanded', 'false');
                content.style.maxHeight = null;
            }
        });
    });
});
