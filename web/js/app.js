let allProducts = [];

// ── Intersection Observer para lazy loading real ─────────────────────────────
const imgObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.onload = () => {
                img.classList.add('loaded');
                img.parentElement.classList.remove('img-loading');
            };
            img.onerror = () => {
                img.classList.add('loaded'); // ocultar skeleton aunque falle
                img.parentElement.classList.remove('img-loading');
            };
            imgObserver.unobserve(img);
        }
    });
}, { rootMargin: '200px' }); // Pre-carga 200px antes de que entre al viewport

document.addEventListener('DOMContentLoaded', () => {
    fetch('productos.json')
        .then(response => response.json())
        .then(data => {
            allProducts = data;
            renderProducts(allProducts);
        })
        .catch(error => console.error('Error loading products:', error));

    const modal = document.getElementById('productModal');
    const closeBtn = document.getElementById('closeModal');
    
    closeBtn.onclick = () => { modal.style.display = "none"; }
    window.onclick = (event) => { if (event.target == modal) modal.style.display = "none"; }

    // Search logic
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = allProducts.filter(p => p.equipo.toLowerCase().includes(query));
            renderProducts(filtered);
        });
    }
});

function formatPrice(price) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency', currency: 'COP', minimumFractionDigits: 0
    }).format(price);
}

// Convierte un path de imagen a .webp si no lo es ya
function toWebp(src) {
    if (!src) return src;
    return src.replace(/\.(png|jpg|jpeg)$/i, '.webp');
}

function renderProducts(products) {
    const container = document.getElementById('productGrid');
    container.innerHTML = '';
    container.style.display = 'block';

    if (products.length === 0) {
        container.innerHTML = '<p style="text-align:center; margin-top:50px;">No se encontraron resultados.</p>';
        return;
    }

    const ORDER = ["Equipos Actuales", "Equipos Nacionales", "Retros", "Mujer"];
    const categories = {};
    ORDER.forEach(cat => categories[cat] = []);

    products.forEach(product => {
        const cat = product.categoria || "Equipos Actuales";
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(product);
    });

    for (const [catName, catProducts] of Object.entries(categories)) {
        if (catProducts.length === 0) continue;

        const catTitle = document.createElement('h2');
        catTitle.id = catName.toLowerCase().replace(/\s+/g, '_');
        catTitle.innerText = catName;
        Object.assign(catTitle.style, {
            marginTop: '40px', marginBottom: '20px', color: 'var(--gold)',
            textTransform: 'uppercase', borderBottom: '1px solid #333',
            paddingBottom: '10px', scrollMarginTop: '140px'
        });
        container.appendChild(catTitle);

        const grid = document.createElement('div');
        grid.className = 'product-grid-inner';
        container.appendChild(grid);

        catProducts.forEach((product) => {
            const idx = allProducts.findIndex(p => p.id === product.id);

            let coverImg = product.imagenes && product.imagenes.length > 0
                ? product.imagenes[0]
                : (product.imagen || "");
            coverImg = toWebp(coverImg);

            const tallas = Object.entries(product.tallas || {});
            const hasStock = tallas.some(([_, qty]) => qty > 0);
            const sizesStr = tallas.map(([s, qty]) =>
                qty > 0 ? s : `<span style="text-decoration:line-through;opacity:0.4">${s}</span>`
            ).join(' · ');

            const card = document.createElement('div');
            card.className = 'product-card';
            card.onclick = () => openModal(idx);

            card.innerHTML = `
                <div class="product-image-wrapper img-loading">
                    <img data-src="${coverImg}" alt="${product.equipo}" class="lazy-img">
                </div>
                <div class="product-info">
                    <h3 class="product-title">${product.equipo}</h3>
                    <div class="product-price">${formatPrice(product.precio)}</div>
                    <div class="product-sizes">Tallas: ${sizesStr}</div>
                    <button class="btn-whatsapp" style="margin-top:auto"
                        onclick="event.stopPropagation(); openModal(${idx})">
                        Ver Detalles
                    </button>
                </div>
            `;

            // Registrar la imagen en el observer
            const lazyImg = card.querySelector('.lazy-img');
            imgObserver.observe(lazyImg);

            grid.appendChild(card);
        });
    }
}

function openModal(productIndex) {
    const product = allProducts[productIndex];
    if (!product) return;
    const modal = document.getElementById('productModal');

    document.getElementById('modalTitle').innerText = product.equipo;
    document.getElementById('modalPrice').innerText = formatPrice(product.precio);

    const mainImg = document.getElementById('mainImage');
    const thumbContainer = document.getElementById('thumbnailsContainer');
    thumbContainer.innerHTML = '';

    let images = product.imagenes || (product.imagen ? [product.imagen] : []);
    images = images.map(toWebp);

    if (images.length > 0) {
        mainImg.src = images[0];
        images.forEach((imgSrc, i) => {
            const thumb = document.createElement('img');
            thumb.src = imgSrc;
            thumb.className = i === 0 ? 'active' : '';
            thumb.loading = 'lazy';
            thumb.onclick = () => {
                mainImg.src = imgSrc;
                Array.from(thumbContainer.children).forEach(c => c.classList.remove('active'));
                thumb.classList.add('active');
            };
            thumbContainer.appendChild(thumb);
        });
    }

    // Sizes
    const sizeContainer = document.getElementById('sizeButtons');
    sizeContainer.innerHTML = '';
    const wsBtn = document.getElementById('modalWsBtn');
    wsBtn.style.pointerEvents = 'none';
    wsBtn.style.opacity = '0.5';
    wsBtn.innerHTML = `
        <svg viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217s.233-.002.332-.002c.099-.001.233-.037.363.275.13.312.443 1.08.482 1.159.039.079.065.171.017.266-.048.096-.073.155-.138.229-.065.074-.136.162-.195.226-.065.069-.133.143-.058.272.075.129.333.551.713.889.49.438.905.576 1.033.64.128.064.204.053.28-.032.076-.085.328-.376.415-.506.087-.13.174-.108.291-.064.117.044.743.349.871.413.128.064.212.096.242.148.03.052.03.303-.114.708zM12 2C6.477 2 2 6.477 2 12c0 1.758.455 3.425 1.29 4.903L2 22l5.226-1.213C8.68 21.554 10.312 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
        Selecciona una talla
    `;

    const tallas = Object.entries(product.tallas || {});
    tallas.forEach(([size, stock]) => {
        const btn = document.createElement('button');
        btn.innerText = size;
        if (stock <= 0) {
            btn.className = 'size-btn out-of-stock';
            btn.title = "Agotada";
        } else {
            btn.className = 'size-btn';
            btn.onclick = () => {
                Array.from(sizeContainer.children).forEach(c => c.classList.remove('selected'));
                btn.classList.add('selected');
                const msg = encodeURIComponent(`Hola Herencia 90, me interesa comprar la camiseta: ${product.equipo} en Talla ${size}.`);
                wsBtn.href = `https://wa.me/573183867147?text=${msg}`;
                wsBtn.style.pointerEvents = 'auto';
                wsBtn.style.opacity = '1';
                wsBtn.innerHTML = `
                    <svg viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217s.233-.002.332-.002c.099-.001.233-.037.363.275.13.312.443 1.08.482 1.159.039.079.065.171.017.266-.048.096-.073.155-.138.229-.065.074-.136.162-.195.226-.065.069-.133.143-.058.272.075.129.333.551.713.889.49.438.905.576 1.033.64.128.064.204.053.28-.032.076-.085.328-.376.415-.506.087-.13.174-.108.291-.064.117.044.743.349.871.413.128.064.212.096.242.148.03.052.03.303-.114.708zM12 2C6.477 2 2 6.477 2 12c0 1.758.455 3.425 1.29 4.903L2 22l5.226-1.213C8.68 21.554 10.312 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
                    Comprar Talla ${size}
                `;
            };
        }
        sizeContainer.appendChild(btn);
    });

    modal.style.display = "block";
}
