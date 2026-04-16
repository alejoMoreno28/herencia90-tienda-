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
const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allProducts = [];

async function loadProducts() {
    try {
        const { data, error } = await db.from('productos').select('*').order('id');
        if (error) throw error;
        if (Array.isArray(data) && data.length > 0) return data;
        throw new Error('Catalogo vacio desde Supabase');
    } catch (error) {
        try {
            const response = await fetch('/productos.json', { cache: 'no-store' });
            if (!response.ok) throw new Error(`Fallback local fallo: ${response.status}`);
            return await response.json();
        } catch (fallbackError) {
            console.error('No fue posible cargar productos', error, fallbackError);
            return [];
        }
    }
}

// ── Analytics ────────────────────────────────────────────────────────────────
async function trackEvent(eventType, productData = {}) {
    try {
        await db.from('analytics_events').insert({
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
        cart.push({ id: product.id, equipo: product.equipo, talla: size, precio: product.precio, imagen, cantidad: 1 });
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
    document.getElementById('cartDrawer').classList.add('open');
    document.getElementById('cartOverlay').classList.add('open');
}

function closeCart() {
    document.getElementById('cartDrawer').classList.remove('open');
    document.getElementById('cartOverlay').classList.remove('open');
}

function renderCartDrawer() {
    const container = document.getElementById('cartItems');
    const footer = document.getElementById('cartFooter');
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
    document.getElementById('cartTotal').textContent = formatPrice(total);
}

function checkoutWhatsApp() {
    if (cart.length === 0) return;
    let msg = '¡Hola Herencia 90! Quiero hacer el siguiente pedido:\n\n';
    cart.forEach((item, i) => {
        msg += `${i + 1}. ${item.equipo}\n   Talla: ${item.talla}  ×${item.cantidad}  →  ${formatPrice(item.precio * item.cantidad)}\n`;
    });
    const total = cart.reduce((sum, i) => sum + i.precio * i.cantidad, 0);
    msg += `\n💰 *Total: ${formatPrice(total)}*\n\nPor favor confirmar disponibilidad y forma de pago 🙏`;
    trackEvent('checkout', { extra: { items: cart.length, total } });
    window.open(`https://wa.me/573126428153?text=${encodeURIComponent(msg)}`, '_blank');
}

let toastTimer = null;
function showToast() {
    const toast = document.getElementById('cartToast');
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
        img.onload = () => { img.classList.add('loaded'); img.parentElement.classList.remove('img-loading'); };
        img.onerror = () => { img.classList.add('loaded'); img.parentElement.classList.remove('img-loading'); };
        imgObserver.unobserve(img);
    });
}, { rootMargin: '200px' });

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
    document.getElementById('categoryDrawer').classList.add('open');
    document.getElementById('drawerOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeDrawer() {
    document.getElementById('categoryDrawer').classList.remove('open');
    document.getElementById('drawerOverlay').classList.remove('open');
    document.body.style.overflow = '';
}

// ── Search overlay ────────────────────────────────────────────────────────────
function openSearchOverlay() {
    document.getElementById('searchOverlay').classList.add('open');
    setTimeout(() => document.getElementById('mobileSearchInput').focus(), 300);
}

function closeSearchOverlay() {
    document.getElementById('searchOverlay').classList.remove('open');
    document.getElementById('mobileSearchInput').value = '';
    renderProducts(allProducts);
}

// ── DOM Ready ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // AOS - Animate On Scroll
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 600,
            easing: 'ease-out-cubic',
            once: true,
            offset: 60,
        });
    }

    // Registrar visita a la página
    trackEvent('page_view', {});

    loadProducts().then((products) => {
        allProducts = products;
        renderNavigation();
        renderProducts(allProducts);
    });

    // Real-time: actualiza stock cuando cambia un producto
    db.channel('stock-live')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'productos' }, (payload) => {
            const idx = allProducts.findIndex(p => p.id === payload.new.id);
            if (idx !== -1) {
                allProducts[idx] = payload.new;
                renderProducts(allProducts);
            }
        })
        .subscribe();

    // Modal close
    const modal = document.getElementById('productModal');
    document.getElementById('closeModal').onclick = () => { modal.style.display = 'none'; };
    window.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

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
            const q = e.target.value.toLowerCase();
            renderProducts(q ? allProducts.filter(p => p.equipo.toLowerCase().includes(q)) : allProducts);
        });
    }

    // Mobile search
    const mobileSearchInput = document.getElementById('mobileSearchInput');
    if (mobileSearchInput) {
        mobileSearchInput.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            renderProducts(q ? allProducts.filter(p => p.equipo.toLowerCase().includes(q)) : allProducts);
        });
    }

    // Desktop cart
    document.getElementById('cartBtn').onclick = openCart;
    document.getElementById('cartClose').onclick = closeCart;
    document.getElementById('cartOverlay').onclick = closeCart;
    document.getElementById('cartCheckout').onclick = checkoutWhatsApp;
    document.getElementById('cartClear').onclick = clearCart;

    // Mobile bottom nav
    document.getElementById('mobileCartBtn').onclick = openCart;
    document.getElementById('mobileMenuBtn').onclick = openDrawer;
    document.getElementById('gridToggleBtn').onclick = toggleGrid;
    document.getElementById('mobileSearchBtn').onclick = openSearchOverlay;

    // Drawer & search close
    document.getElementById('categoryDrawerClose').onclick = closeDrawer;
    document.getElementById('drawerOverlay').onclick = closeDrawer;
    document.getElementById('searchOverlayClose').onclick = closeSearchOverlay;

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
            modal.style.display = 'none';
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
function buildSizePills(tallas) {
    return Object.entries(tallas || {}).map(([s, qty]) =>
        `<span class="size-pill ${qty > 0 ? 'available' : 'unavailable'}">${s}</span>`
    ).join('');
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
        <li><a href="/preventa" style="color:var(--gold);display:flex;align-items:center;gap:6px;"><i class="ph ph-tag" style="font-size:1.1em;"></i> Pre-Venta</a></li>
        <li><a href="/nosotros" style="display:flex;align-items:center;gap:6px;"><i class="ph ph-info" style="font-size:1.1em;"></i> Nosotros</a></li>
        <li><a href="/preguntas-frecuentes" style="display:flex;align-items:center;gap:6px;"><i class="ph ph-question" style="font-size:1.1em;"></i> Preguntas Frecuentes</a></li>`;
        desktopNav.innerHTML = megaHtml;
    }

    if (mobileNav) {
        const closeFn = () => {
            document.getElementById('categoryDrawer').classList.remove('open');
            document.getElementById('drawerOverlay').classList.remove('open');
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
                <span style="color:var(--gold);">Pre-Venta</span>
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
function renderProducts(products) {
    const container = document.getElementById('productGrid');
    if (!container) return;

    let displayProducts = products;
    const pageCat = document.body.getAttribute('data-category');
    if (pageCat) {
        displayProducts = products.filter(p => {
            const cat = (p.categoria || '').toLowerCase();
            const eq = (p.equipo || '').toLowerCase();
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
        });
    }

    container.innerHTML = '';

    if (displayProducts.length === 0) {
        container.innerHTML = '<p style="text-align:center;margin-top:50px;color:#aaa;">No se encontraron resultados en esta categoría.</p>';
        return;
    }

    const uniqueCats = [...new Set(displayProducts.map(p => p.categoria || 'Sin Categoría'))];
    const categories = {};
    uniqueCats.forEach(cat => categories[cat] = []);

    displayProducts.forEach(p => {
        const cat = p.categoria || 'Clubes 25/26';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(p);
    });

    for (const [catName, catProducts] of Object.entries(categories)) {
        if (catProducts.length === 0) continue;

        const catTitle = document.createElement('h2');
        catTitle.id = makeCategoryId(catName);
        catTitle.className = 'category-title';
        catTitle.innerText = displayCategory(catName);
        container.appendChild(catTitle);

        const grid = document.createElement('div');
        grid.className = 'product-grid-inner';
        container.appendChild(grid);

        catProducts.forEach((product, i) => {
            const idx = allProducts.findIndex(p => p.id === product.id);
            let coverImg = toWebp(product.imagenes && product.imagenes.length > 0
                ? product.imagenes[0] : (product.imagen || ''));

            const tallas = Object.entries(product.tallas || {});
            const allSoldOut = tallas.length > 0 && tallas.every(([, qty]) => qty === 0);
            const sizePills = buildSizePills(product.tallas);
            const badge = getProductBadge(product);

            const card = document.createElement('div');
            card.className = 'product-card card-hidden' + (allSoldOut ? ' soldout' : '');
            card.style.transitionDelay = `${Math.min(i * 65, 260)}ms`;
            if (!allSoldOut) card.onclick = () => openModal(idx);

            card.innerHTML = `
                <div class="product-image-wrapper img-loading">
                    <img data-src="${coverImg}" alt="${product.equipo}" class="lazy-img">
                    ${badge ? `<span class="product-badge ${badge.cls}">${badge.text}</span>` : ''}
                </div>
                <div class="product-info">
                    <h3 class="product-title">${product.equipo}</h3>
                    <div class="product-price">${formatPrice(product.precio)}</div>
                    <div class="product-sizes">${sizePills}</div>
                    ${product.descripcion ? `<p class="product-description">${product.descripcion}</p>` : ''}
                    <div class="product-actions">
                        ${allSoldOut
                    ? `<span class="btn-whatsapp" style="opacity:0.4;cursor:not-allowed;">Sin stock</span>`
                    : `<button class="btn-whatsapp" onclick="event.stopPropagation(); openModal(${idx})">Ver Detalles</button>`
                }
                    </div>
                </div>
            `;

            imgObserver.observe(card.querySelector('.lazy-img'));
            cardRevealObserver.observe(card);
            grid.appendChild(card);
        });

        titleRevealObserver.observe(catTitle);
    }

    // VanillaTilt on desktop only
    if (typeof VanillaTilt !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
        VanillaTilt.init(document.querySelectorAll('.product-card'), {
            max: 5,
            speed: 500,
            glare: true,
            'max-glare': 0.07,
            scale: 1.02,
            perspective: 900,
        });
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

    // Descripción
    const descEl = document.getElementById('modalDescription');
    descEl.textContent = product.descripcion || '';
    descEl.style.display = product.descripcion ? 'block' : 'none';

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
    const wsBtn = document.getElementById('modalWsBtn');
    const addCartBtn = document.getElementById('modalAddCartBtn');

    wsBtn.style.pointerEvents = 'none';
    wsBtn.style.opacity = '0.5';
    wsBtn.innerHTML = `
        <svg viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217s.233-.002.332-.002c.099-.001.233-.037.363.275.13.312.443 1.08.482 1.159.039.079.065.171.017.266-.048.096-.073.155-.138.229-.065.074-.136.162-.195.226-.065.069-.133.143-.058.272.075.129.333.551.713.889.49.438.905.576 1.033.64.128.064.204.053.28-.032.076-.085.328-.376.415-.506.087-.13.174-.108.291-.064.117.044.743.349.871.413.128.064.212.096.242.148.03.052.03.303-.114.708zM12 2C6.477 2 2 6.477 2 12c0 1.758.455 3.425 1.29 4.903L2 22l5.226-1.213C8.68 21.554 10.312 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
        Selecciona una talla`;
    addCartBtn.style.display = 'none';
    addCartBtn.onclick = null;

    Object.entries(product.tallas || {}).forEach(([size, stock]) => {
        const btn = document.createElement('button');
        btn.innerText = size;
        if (stock <= 0) {
            btn.className = 'size-btn out-of-stock';
            btn.title = 'Agotada';
        } else {
            btn.className = 'size-btn';
            btn.onclick = () => {
                Array.from(sizeContainer.children).forEach(c => c.classList.remove('selected'));
                btn.classList.add('selected');
                trackEvent('whatsapp_click', { ...product, extra: { talla: size } });
                const msg = encodeURIComponent(`Hola Herencia 90, me interesa comprar la camiseta: ${product.equipo} en Talla ${size}.`);
                wsBtn.href = `https://wa.me/573126428153?text=${msg}`;
                wsBtn.style.pointerEvents = 'auto';
                wsBtn.style.opacity = '1';
                wsBtn.className = 'btn-whatsapp green';
                wsBtn.innerHTML = `
                    <svg viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217s.233-.002.332-.002c.099-.001.233-.037.363.275.13.312.443 1.08.482 1.159.039.079.065.171.017.266-.048.096-.073.155-.138.229-.065.074-.136.162-.195.226-.065.069-.133.143-.058.272.075.129.333.551.713.889.49.438.905.576 1.033.64.128.064.204.053.28-.032.076-.085.328-.376.415-.506.087-.13.174-.108.291-.064.117.044.743.349.871.413.128.064.212.096.242.148.03.052.03.303-.114.708zM12 2C6.477 2 2 6.477 2 12c0 1.758.455 3.425 1.29 4.903L2 22l5.226-1.213C8.68 21.554 10.312 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
                    Comprar Talla ${size}`;
                addCartBtn.style.display = 'inline-flex';
                addCartBtn.onclick = () => {
                    addToCart(product, size);
                    modal.style.display = 'none';
                };
            };
        }
        sizeContainer.appendChild(btn);
    });

    modal.style.display = 'block';
}

// Inject Global Floating WhatsApp Button
document.addEventListener('DOMContentLoaded', () => {
    const floatingWspHtml = `
    <a href="https://wa.me/573126428153" target="_blank" rel="noopener noreferrer" class="floating-wsp" aria-label="Escríbenos por WhatsApp">
        <i class="ph-fill ph-whatsapp-logo"></i>
    </a>
    `;
    document.body.insertAdjacentHTML('beforeend', floatingWspHtml);
});
