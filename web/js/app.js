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
const ENABLE_PUBLIC_ANALYTICS = false;
let db = null;
let supabasePromise = null;
let aosPromise = null;

let allProducts = [];
let catalogSearchTerm = '';
let catalogSort = 'recommended';
let catalogPage = 1;
const CATALOG_PAGE_SIZE = 24;
const CATALOG_INITIAL_RENDER_COUNT = 8;
const CATALOG_RENDER_BATCH_SIZE = 8;
let catalogRenderToken = 0;

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
        const response = await fetch('/productos.json?v=1780613504326');
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
    const localProducts = await loadLocalProducts();
    try {
        const liveProducts = await withTimeout(
            fetchProductsFromSupabaseRest(),
            PRODUCT_FETCH_TIMEOUT_MS,
            'Supabase productos'
        );
        return mergeLiveProducts(liveProducts, localProducts);
    } catch (error) {
        console.warn('Fallo Supabase inicial, usando productos locales', error);
        return localProducts;
    }
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
        return `
            <div class="cart-item">
                <img src="${item.imagen}" alt="${item.equipo}" class="cart-item-img" onerror="this.style.opacity='0.3'">
                <div class="cart-item-info">
                    <p class="cart-item-name">${item.equipo}</p>
                    <p class="cart-item-talla">Talla: ${item.talla}</p>
                    <p class="cart-item-price">${formatPrice(item.precio * item.cantidad)}</p>
                    <div class="cart-item-qty">
                        <button onclick="changeQty(${item.id}, '${item.talla}', -1)">−</button>
                        <span>${item.cantidad}</span>
                        <button onclick="changeQty(${item.id}, '${item.talla}', 1)">+</button>
                    </div>
                </div>
                <button class="cart-item-remove" onclick="removeFromCart(${item.id}, '${item.talla}')" title="Quitar">×</button>
            </div>`;
    }).join('');
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

// ── Card Scroll Reveal ────────────────────────────────────────────────────────
const cardRevealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const card = entry.target;
        card.classList.remove('card-hidden');
        card.addEventListener('transitionend', () => {
            card.style.transitionDelay = '';
        }, { once: true });
        cardRevealObserver.unobserve(card);
    });
}, { threshold: 0.08, rootMargin: '0px 0px -20px 0px' });

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

    // Registrar visita a la página
    runAfterIdleDelay(() => trackEvent('page_view', {}), 2500, 1800);

    applySearchFromUrl();

    loadProducts().then((products) => {
        allProducts = products;
        renderNavigation();
        renderProducts(allProducts);
        renderFeaturedProducts();
    if (!isConstrainedNetwork) {
        runAfterFirstInteraction(() => {
            runWhenIdle(() => {
                refreshProductsFromSupabase(allProducts).then((freshProducts) => {
                    if (!Array.isArray(freshProducts) || freshProducts.length === 0) return;
                    allProducts = freshProducts;
                    renderNavigation();
                    renderProducts(allProducts);
                    renderFeaturedProducts();
                });
            }, 1800);
        }, 16000);
        }
    });

    // Real-time: se difiere para no competir con el primer render.
    if (!isConstrainedNetwork) {
        runAfterFirstInteraction(() => {
            runWhenIdle(() => {
            ensureSupabaseClient().then((client) => client.channel('stock-live')
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'productos' }, (payload) => {
                    const idx = allProducts.findIndex(p => p.id === payload.new.id);
                    if (idx !== -1) {
                        allProducts[idx] = payload.new;
                        renderProducts(allProducts);
                    }
                })
                .subscribe()).catch(function(){});
            }, 1800);
        }, 22000);
    }

    // Modal close
    const modal = byId('productModal');
    onId('closeModal', 'click', () => setProductModalVisible(false));
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

function toCardImage(src) {
    const webpSrc = toWebp(src);
    if (!webpSrc || webpSrc.startsWith('http')) return webpSrc;
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

function renderCatalogPagination(page, totalPages) {
    if (totalPages <= 1) return '';
    const pages = [];
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
    const end = Math.min(totalPages, Math.max(page + 2, 5));
    for (let i = start; i <= end; i++) {
        pages.push(`<button class="catalog-page-btn${i === page ? ' active' : ''}" onclick="catalogGoPage(${i})" aria-label="Ir a p&aacute;gina ${i}">${i}</button>`);
    }
    return `
        <div class="catalog-pagination" aria-label="Paginaci&oacute;n del cat&aacute;logo">
            <button class="catalog-page-btn catalog-page-arrow" onclick="catalogGoPage(${Math.max(1, page - 1)})" ${page === 1 ? 'disabled' : ''} aria-label="P&aacute;gina anterior"><i class="ph-bold ph-caret-left"></i></button>
            ${pages.join('')}
            <button class="catalog-page-btn catalog-page-arrow" onclick="catalogGoPage(${Math.min(totalPages, page + 1)})" ${page === totalPages ? 'disabled' : ''} aria-label="P&aacute;gina siguiente"><i class="ph-bold ph-caret-right"></i></button>
        </div>`;
}

function renderCatalogToolbar(total, page, totalPages, start, end) {
    return `
        <div class="catalog-toolbar">
            <div class="catalog-results">${total ? `Mostrando ${start}-${end} de ${total}` : 'Sin resultados'}</div>
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
            ${renderCatalogPagination(page, totalPages)}
        </div>`;
}

window.catalogSetSort = function (value) {
    catalogSort = value || 'recommended';
    catalogPage = 1;
    renderProducts(allProducts);
};

window.catalogGoPage = function (page) {
    catalogPage = Math.max(1, Number(page) || 1);
    renderProducts(allProducts);
    const anchor = byId('catalogo') || byId('productGrid');
    if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
                    <h4 class="mega-col-title">Selecciones</h4>
                    <a href="/categorias/mundial-2026" class="mega-link"><i class="ph-fill ph-globe-hemisphere-west"></i> Mundial 2026</a>
                    <a href="/categorias/colombia" class="mega-link"><i class="ph-fill ph-flag"></i> Colombia</a>
                    <a href="/categorias/argentina" class="mega-link"><i class="ph-fill ph-flag"></i> Argentina</a>
                    <a href="/categorias/brasil" class="mega-link"><i class="ph-fill ph-flag"></i> Brasil</a>
                    <a href="/categorias/alemania" class="mega-link"><i class="ph-fill ph-flag"></i> Alemania</a>
                    <a href="/categorias/portugal" class="mega-link"><i class="ph-fill ph-flag"></i> Portugal</a>
                    <a href="/catalogo.html" class="mega-link mega-link-all"><i class="ph-fill ph-arrow-right"></i> Ver todas</a>
                </div>
                <div class="mega-col">
                    <h4 class="mega-col-title">Clubes</h4>
                    <a href="/categorias/real-madrid" class="mega-link"><i class="ph-fill ph-soccer-ball"></i> Real Madrid</a>
                    <a href="/categorias/barcelona" class="mega-link"><i class="ph-fill ph-soccer-ball"></i> Barcelona</a>
                    <a href="/categorias/arsenal" class="mega-link"><i class="ph-fill ph-soccer-ball"></i> Arsenal</a>
                    <a href="/categorias/liverpool" class="mega-link"><i class="ph-fill ph-soccer-ball"></i> Liverpool</a>
                    <a href="/categorias/bayern-munich" class="mega-link"><i class="ph-fill ph-soccer-ball"></i> Bayern M&uuml;nich</a>
                    <a href="/categorias/manchester-united" class="mega-link"><i class="ph-fill ph-soccer-ball"></i> Manchester Utd</a>
                    <a href="/catalogo.html" class="mega-link mega-link-all"><i class="ph-fill ph-arrow-right"></i> Ver todos</a>
                </div>
                <div class="mega-col">
                    <h4 class="mega-col-title">Colecciones</h4>
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
function createCatalogProductCard(product, i, productIndexById) {
    const idx = productIndexById.get(product.id) ?? allProducts.findIndex(p => p.id === product.id);
    const coverImg = toWebp(product.imagenes && product.imagenes.length > 0
        ? product.imagenes[0] : (product.imagen || ''));
    const cardImg = toCardImage(product.imagenes && product.imagenes.length > 0
        ? product.imagenes[0] : (product.imagen || ''));

    const isBajoPedido = isProductBajoPedido(product);
    const tallas = getSortedSizeEntries(product.tallas);
    const allSoldOut = !isBajoPedido && tallas.length > 0 && tallas.every(({ stock }) => stock === 0);
    const sizePills = buildSizePills(product.tallas, isBajoPedido);
    const stockNotice = buildStockNotice(product, isBajoPedido);
    const badge = getProductBadge(product);

    const card = document.createElement('div');
    card.className = 'product-card card-hidden' + (allSoldOut ? ' soldout' : '') + (isBajoPedido ? ' bajopedido' : '');
    if (!prefersReducedMotion && !isTouchDevice) {
        card.style.transitionDelay = `${Math.min(i * 35, 160)}ms`;
    }
    if (!allSoldOut || isBajoPedido) card.onclick = () => openModal(idx);

    const imageAttrs = i < 3
        ? `src="${cardImg}" fetchpriority="${i === 0 ? 'high' : 'auto'}" loading="eager"`
        : `data-src="${cardImg}" loading="lazy" fetchpriority="low"`;

    card.innerHTML = `
        <div class="product-image-wrapper img-loading">
            <img ${imageAttrs} data-full-src="${coverImg}" alt="${product.equipo}" class="lazy-img" width="640" height="640" decoding="async">
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
                    : `<button class="btn-whatsapp" onclick="event.stopPropagation(); openModal(${idx})">${isBajoPedido ? 'Bajo pedido' : 'Ver detalles'}</button>`
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

    if (!prefersReducedMotion && !isTouchDevice) {
        cardRevealObserver.observe(card);
    } else {
        card.classList.remove('card-hidden');
    }

    return card;
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
    let displayProducts = (products || []).filter(p => isProductInPageCategory(p, pageCat));
    if (catalogSearchTerm) {
        displayProducts = displayProducts.filter(p => {
            const haystack = normalizeSearchTerm(`${p.equipo || ''} ${p.categoria || ''} ${p.descripcion || ''}`);
            return haystack.includes(catalogSearchTerm);
        });
    }
    displayProducts = displayProducts.slice().sort(compareCatalogProducts);

    container.replaceChildren();
    container.classList.remove('catalog-skeleton-active');

    if (displayProducts.length === 0) {
        container.innerHTML = `
            ${pageCat ? `<section class="catalog-page-head"><span>Cat&aacute;logo</span><h1>${getCategoryTitle(pageCat)}</h1></section>` : ''}
            ${renderCatalogToolbar(0, 1, 1, 0, 0)}
            <p class="catalog-empty">No se encontraron resultados.</p>`;
        container.setAttribute('aria-busy', 'false');
        return;
    }

    const totalPages = Math.max(1, Math.ceil(displayProducts.length / CATALOG_PAGE_SIZE));
    catalogPage = Math.min(Math.max(1, catalogPage), totalPages);
    const startIndex = (catalogPage - 1) * CATALOG_PAGE_SIZE;
    const visibleProducts = displayProducts.slice(startIndex, startIndex + CATALOG_PAGE_SIZE);
    const start = startIndex + 1;
    const end = startIndex + visibleProducts.length;
    const productIndexById = new Map(allProducts.map((product, index) => [product.id, index]));

    if (pageCat) {
        container.insertAdjacentHTML('beforeend', `<section class="catalog-page-head"><span>Cat&aacute;logo</span><h1>${getCategoryTitle(pageCat)}</h1></section>`);
    }
    container.insertAdjacentHTML('beforeend', renderCatalogToolbar(displayProducts.length, catalogPage, totalPages, start, end));

    const grid = document.createElement('div');
    grid.className = 'product-grid-inner';
    container.appendChild(grid);

    const initialEnd = Math.min(CATALOG_INITIAL_RENDER_COUNT, visibleProducts.length);
    appendCatalogProductBatch(grid, visibleProducts, 0, initialEnd, productIndexById, renderToken);

    container.insertAdjacentHTML('beforeend', `<div class="catalog-toolbar catalog-toolbar-bottom">${renderCatalogPagination(catalogPage, totalPages)}</div>`);
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

    // Seleccionar algunas camisetas específicas para destacar (3 de stock, 3 de pre-orden retro)
    const idsToFeature = [1, 2, 10, 28, 29, 30]; // Alemania, Argentina, Colombia, Barcelona 125, Real Madrid 99, Milan 06/07
    let featured = idsToFeature.map(id => allProducts.find(p => p.id === id)).filter(Boolean);
    
    // Si no hay suficientes por alguna razón, tomar los primeros 6 del catálogo
    if (featured.length < 3) {
        featured = allProducts.slice(0, 6);
    }

    container.innerHTML = '';

    featured.forEach((product, i) => {
        const idx = allProducts.findIndex(p => p.id === product.id);
        const coverImg = toWebp(product.imagenes && product.imagenes.length > 0
            ? product.imagenes[0] : (product.imagen || ''));
        const cardImg = toCardImage(product.imagenes && product.imagenes.length > 0
            ? product.imagenes[0] : (product.imagen || ''));

        const isBajoPedido = isProductBajoPedido(product);

        const tallas = getSortedSizeEntries(product.tallas);
        const allSoldOut = !isBajoPedido && tallas.length > 0 && tallas.every(({ stock }) => stock === 0);
        const sizePills = buildSizePills(product.tallas, isBajoPedido);
        const stockNotice = buildStockNotice(product, isBajoPedido);
        const badge = getProductBadge(product);

        const card = document.createElement('div');
        card.className = 'product-card card-hidden' + (allSoldOut ? ' soldout' : '') + (isBajoPedido ? ' bajopedido' : '');
        if (!prefersReducedMotion && !isTouchDevice) {
            card.style.transitionDelay = `${Math.min(i * 35, 160)}ms`;
        }
        if (!allSoldOut || isBajoPedido) card.onclick = () => openModal(idx);

        card.innerHTML = `
            <div class="product-image-wrapper img-loading">
                <img ${i < 2 ? `src="${cardImg}" fetchpriority="${i === 0 ? 'high' : 'auto'}" loading="eager"` : `data-src="${cardImg}" loading="lazy" fetchpriority="low"`} data-full-src="${coverImg}" alt="${product.equipo}" class="lazy-img" width="640" height="640" decoding="async">
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
                        : `<button class="btn-whatsapp" onclick="event.stopPropagation(); openModal(${idx})">${isBajoPedido ? 'Bajo pedido' : 'Ver detalles'}</button>`
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
        if (!prefersReducedMotion && !isTouchDevice) {
            cardRevealObserver.observe(card);
        } else {
            card.classList.remove('card-hidden');
        }
        container.appendChild(card);
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
