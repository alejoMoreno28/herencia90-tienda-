'use strict';

const { createClient } = require('@supabase/supabase-js');
const { load: cheerioLoad } = require('cheerio');
const sharp = require('sharp');
const crypto = require('crypto');
const {
    applyAdminCors,
    authorizeAdminRequest,
    fetchExternalResource,
    hasOversizedJsonBody,
    validateExternalUrl,
} = require('./_lib/admin-security.cjs');

const BUCKET = 'preventa-images'; // Reutilizamos el bucket existente
const MAX_PROVIDER_IMAGES = 8;
const MAX_DOWNLOAD_BYTES = 12 * 1024 * 1024;
const PROVIDERS = [
    'futboldeprimera.com.co',
    'sportshirts.co',
    'panitastienda.com',
    'leyendasdelfutbol.com'
];

function slugify(str) {
    return str.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim().replace(/\s+/g, '-').replace(/-+/g, '-');
}

async function searchNative(query, domain, longName) {
    let searchUrl = `https://${domain}/?s=${encodeURIComponent(query)}&post_type=product`;
    let isShopify = domain.includes('panitas');
    if (isShopify) {
        searchUrl = `https://${domain}/search?q=${encodeURIComponent(query)}`;
    }

    try {
        const res = await fetchExternalResource(searchUrl, {
            allowedHosts: [domain],
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        });
        if (!res.ok) return null;
        const html = await res.text();
        const $ = cheerioLoad(html);
        
        let validLinks = [];
        $('a').each((i, el) => {
            let link = $(el).attr('href');
            if (!link) return;
            if (link.startsWith('/')) link = `https://${domain}${link}`;
            try {
                if (new URL(link).hostname !== domain) return;
            } catch {
                return;
            }
            
            // Ignorar links de admin o carritos
            if (link.includes('add-to-cart') || link.includes('?add-to-cart=')) return;

            if (isShopify && link.includes('/products/')) {
                validLinks.push(link.split('?')[0]); // Quitar params raros de shopify
            } else if (!isShopify && (link.includes('/producto/') || link.includes('/product/'))) {
                validLinks.push(link.split('#')[0]); // Quitar anchors
            }
        });
        
        validLinks = [...new Set(validLinks)]; // Remover duplicados
        
        if (validLinks.length === 0) return null;
        if (validLinks.length === 1 || !longName) return validLinks[0];

        // Tenemos múltiples links, usar longName para decidir el mejor (Ej: Home vs Away)
        const keywords = slugify(longName).split('-').filter(w => w.length > 2);
        
        let bestLink = validLinks[0];
        let maxScore = -1;

        for (const link of validLinks) {
            let score = 0;
            const linkSlug = link.toLowerCase();
            for (const kw of keywords) {
                if (linkSlug.includes(kw)) score++;
            }
            if (score > maxScore) {
                maxScore = score;
                bestLink = link;
            }
        }
        return bestLink;
    } catch (e) {
        console.error('Error Native Search:', e);
        return null;
    }
}

async function scrapeImages(url, fetcher = fetchExternalResource) {
    try {
        const baseUrl = new URL(url);
        const res = await fetcher(url, {
            allowedSuffixes: PROVIDERS,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            redirect: 'error'
        });
        if (!res.ok) return [];
        const html = await res.text();
        const $ = cheerioLoad(html);
        
        const images = [];
        const seenImages = new Set();

        function imageVariantKey(src) {
            try {
                const parsed = new URL(src);
                parsed.search = '';
                parsed.hash = '';
                parsed.pathname = parsed.pathname
                    .replace(/[-_]\d{2,5}x\d{2,5}(?=\.(?:jpg|jpeg|png|webp|avif)$)/i, '')
                    .replace(/-\d{2,5}x(?=\.(?:jpg|jpeg|png|webp|avif)$)/i, '');
                return parsed.href.toLowerCase();
            } catch {
                return String(src || '').toLowerCase();
            }
        }

        function imageVariantScore(src) {
            const lower = String(src || '').toLowerCase();
            if (!/[-_]\d{2,5}x\d{2,5}(?=\.(?:jpg|jpeg|png|webp|avif)$)/i.test(lower)) return 1000000000;
            const match = lower.match(/[-_](\d{2,5})x(\d{2,5})(?=\.(?:jpg|jpeg|png|webp|avif)$)/i);
            if (!match) return 0;
            return (parseInt(match[1], 10) || 0) * (parseInt(match[2], 10) || 0);
        }

        function addCleanImage(src) {
            const key = imageVariantKey(src);
            const existingIndex = images.findIndex(image => imageVariantKey(image) === key);
            if (existingIndex >= 0) {
                if (imageVariantScore(src) > imageVariantScore(images[existingIndex])) {
                    seenImages.delete(images[existingIndex]);
                    images[existingIndex] = src;
                    seenImages.add(src);
                }
                return;
            }
            if (seenImages.has(src)) return;
            images.push(src);
            seenImages.add(src);
        }

        function addImageCandidate(raw) {
            if (!raw || typeof raw !== 'string') return;
            const candidates = raw.split(',').map(part => part.trim().split(/\s+/)[0]).filter(Boolean);
            for (let candidate of candidates) {
                if (!candidate || candidate.startsWith('data:')) continue;
                const lowerSrc = candidate.toLowerCase();
                if (lowerSrc.includes('logo') || lowerSrc.includes('icon') || lowerSrc.includes('.svg') ||
                    lowerSrc.includes('placeholder') || lowerSrc.includes('banner') || lowerSrc.includes('footer') ||
                    lowerSrc.includes('payment') || lowerSrc.includes('stars') || lowerSrc.includes('avatar') ||
                    lowerSrc.includes('guia-de-tallas') || lowerSrc.includes('size-chart') || lowerSrc.includes('whatsapp')) {
                    continue;
                }

                try {
                    candidate = new URL(candidate, baseUrl.origin).href;
                } catch {
                    continue;
                }

                const cleanSrc = candidate.split('?')[0];
                if (cleanSrc.match(/\.(jpg|jpeg|png|webp|avif)$/i)) {
                    addCleanImage(cleanSrc);
                }
            }
        }
        
        function collectImagesFrom(container) {
            container.find('img').each((i, el) => {
                const $img = $(el);
                [
                    'src',
                    'data-src',
                    'data-original',
                    'data-origin-src',
                    'data-large_image',
                    'data-zoom-image',
                    'data-image',
                    'data-full',
                    'data-full-size-image-url',
                    'srcset',
                    'data-srcset',
                ].forEach(attr => addImageCandidate($img.attr(attr)));
            });

            container.find('a[href]').each((i, el) => {
                const href = $(el).attr('href') || '';
                if (href.match(/\.(jpg|jpeg|png|webp|avif)(\?|$)/i)) addImageCandidate(href);
            });

            container.find('[style]').each((i, el) => {
                const style = $(el).attr('style') || '';
                const matches = style.match(/url\((['"]?)(.*?)\1\)/gi) || [];
                matches.forEach(match => addImageCandidate(match.replace(/^url\((['"]?)/i, '').replace(/(['"]?)\)$/i, '')));
            });
        }

        const productSelectors = [
            '#pb-right-column',
            '#image-block, #views_block, #thumbs_list, .thumbnail-list',
            '.woocommerce-product-gallery',
            '.product__media-wrapper',
            '.product-single__media-group',
            '#product-photos',
            '.product-gallery',
            '.product-images',
            '.product-image-main',
            '.product-image',
            '.product-info',
            'main .product, #main .product, .site-main .product',
        ];

        for (const selector of productSelectors) {
            const before = images.length;
            const container = $(selector);
            if (!container.length) continue;
            collectImagesFrom(container);
            if (images.length > before) break;
        }

        $('meta[property="og:image"], meta[name="twitter:image"], link[rel="image_src"]').each((i, el) => {
            addImageCandidate($(el).attr('content') || $(el).attr('href'));
        });
        
        // Fallback: si no encontro nada en el contenedor, buscar links directos a imagenes (suele pasar en galerias Lightbox)
        if (images.length === 0) {
            $('a').each((i, el) => {
                addImageCandidate($(el).attr('href'));
            });
        }

        return Array.from(images);
    } catch(e) {
        console.error('Error scraping:', e);
        return [];
    }
}

async function downloadAndUpload(supabase, imgUrl, storagePath) {
    const res = await fetchExternalResource(imgUrl, {
        maxBytes: MAX_DOWNLOAD_BYTES,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        redirect: 'error'
    });
    if (!res.ok) throw new Error('Error descarga img');
    const declaredBytes = Number(res.headers?.get?.('content-length') || 0);
    if (declaredBytes > MAX_DOWNLOAD_BYTES) throw new Error('Imagen externa demasiado pesada');
    const rawBuffer = Buffer.from(await res.arrayBuffer());
    if (rawBuffer.length > MAX_DOWNLOAD_BYTES) throw new Error('Imagen externa demasiado pesada');
    
    let buffer = rawBuffer;
    let contentType = 'image/webp';
    try {
        buffer = await sharp(rawBuffer)
            .resize({ width: 1000, withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer();
    } catch (e) {
        // Fallback original
        const ext = imgUrl.split('.').pop().toLowerCase();
        contentType = (ext === 'png') ? 'image/png' : 'image/jpeg';
    }

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, { contentType, upsert: false });
    
    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    return data.publicUrl;
}

async function searchShopifyApi(query, domain, longName) {
    try {
        const url = `https://${domain}/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product`;
        const r = await fetchExternalResource(url, { allowedHosts: [domain], headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!r.ok) return [];
        const data = await r.json();
        const products = data.resources?.results?.products || [];
        if (products.length === 0) return [];
        
        let bestProduct = products[0];
        if (products.length > 1 && longName) {
            const keywords = slugify(longName).split('-').filter(w => w.length > 2);
            let maxScore = -1;
            for (const p of products) {
                let score = 0;
                const pSlug = slugify(p.title);
                for (const kw of keywords) if (pSlug.includes(kw)) score++;
                if (score > maxScore) { maxScore = score; bestProduct = p; }
            }
        }
        
        const jsonUrl = `https://${domain}${bestProduct.url.split('?')[0]}.js`;
        const pReq = await fetchExternalResource(jsonUrl, { allowedHosts: [domain], headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!pReq.ok) return [];
        const pData = await pReq.json();
        return pData.images.map(img => img.startsWith('//') ? 'https:' + img : img);
    } catch(e) { return []; }
}

async function searchWooApi(query, domain, longName) {
    try {
        const url = `https://${domain}/wp-json/wc/store/products?search=${encodeURIComponent(query)}`;
        const r = await fetchExternalResource(url, { allowedHosts: [domain], headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!r.ok) return [];
        const products = await r.json();
        if (products.length === 0) return [];
        
        let bestProduct = products[0];
        if (products.length > 1 && longName) {
            const keywords = slugify(longName).split('-').filter(w => w.length > 2);
            let maxScore = -1;
            for (const p of products) {
                let score = 0;
                const pSlug = slugify(p.name);
                for (const kw of keywords) if (pSlug.includes(kw)) score++;
                if (score > maxScore) { maxScore = score; bestProduct = p; }
            }
        }
        
        return bestProduct.images.map(img => img.src);
    } catch(e) { return []; }
}

module.exports = async function handler(req, res) {
    const corsAllowed = applyAdminCors(req, res);
    if (req.method === 'OPTIONS') return corsAllowed ? res.status(204).end() : res.status(403).end();
    if (!corsAllowed) return res.status(403).json({ error: 'Origen no permitido.' });
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    if (hasOversizedJsonBody(req.body)) return res.status(413).json({ error: 'Solicitud demasiado grande.' });

    const authorization = await authorizeAdminRequest(req, process.env, createClient);
    if (!authorization.ok) return res.status(authorization.status).json({ error: authorization.error });
    
    const debugLogs = [];
    const { query, longName, exactUrl } = req.body || {};
    
    // Si se pasa exactUrl, el query puede ser usado solo para el slug de guardado
    if (!query && !exactUrl) return res.status(400).json({ error: 'query o exactUrl requerido' });
    if (String(query || '').length > 160 || String(longName || '').length > 240) {
        return res.status(400).json({ error: 'Texto de busqueda demasiado largo.' });
    }

    let safeExactUrl = '';
    if (exactUrl) {
        try {
            safeExactUrl = (await validateExternalUrl(exactUrl, { allowedSuffixes: PROVIDERS })).href;
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }

    console.log(`Buscando imagenes para: ${query || safeExactUrl} (longName: ${longName})`);
    const supabase = authorization.supabase;
    const slug = slugify(query || 'manual') || crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();

    // === MODO HIBRIDO: EXTRACCION POR URL DIRECTA ===
    if (safeExactUrl) {
        console.log(`Extrayendo directamente de URL: ${safeExactUrl}`);
        let candidateImages = [];
        
        try {
            if (safeExactUrl.includes('panitastienda.com')) {
                // Tratar como shopify
                const jsonUrl = safeExactUrl.split('?')[0] + '.js';
                const pReq = await fetchExternalResource(jsonUrl, { allowedSuffixes: PROVIDERS, headers: { 'User-Agent': 'Mozilla/5.0' } });
                if (pReq.ok) {
                    const pData = await pReq.json();
                    candidateImages = pData.images.map(img => img.startsWith('//') ? 'https:' + img : img);
                }
            }
            
            if (candidateImages.length === 0) {
                // Scraper HTML generico
                candidateImages = await scrapeImages(safeExactUrl);
            }
        } catch(e) {
            console.error('Error extrayendo URL exacta:', e);
        }

        if (candidateImages.length > 0) {
            // Filtrar basura
            candidateImages = candidateImages.filter(src => {
                const low = src.toLowerCase();
                return !low.includes('logo') && !low.includes('tallas') && !low.includes('size') && !low.includes('icon');
            });

            const toDownload = [...new Set(candidateImages)].slice(0, MAX_PROVIDER_IMAGES);
            const uploadedUrls = [];

            for (let i = 0; i < toDownload.length; i++) {
                const storagePath = `ia-scraper/${slug}-${timestamp}-${i+1}.webp`;
                try {
                    const finalUrl = await downloadAndUpload(supabase, toDownload[i], storagePath);
                    uploadedUrls.push(finalUrl);
                } catch (err) {
                    console.warn(`Error subiendo imagen ${i}:`, err.message);
                }
            }

            return res.status(200).json({ 
                source: 'Manual URL',
                productUrl: safeExactUrl,
                images: uploadedUrls,
                debug: process.env.NODE_ENV === 'development' ? debugLogs : undefined
            });
        }
        return res.status(200).json({ images: [], debug: process.env.NODE_ENV === 'development' ? debugLogs : undefined });
    }
    // === FIN MODO HIBRIDO ===

    for (const domain of PROVIDERS) {
        console.log(`Buscando en ${domain}...`);
        let candidateImages = [];
        let productUrl = `https://${domain}`;

        if (domain.includes('panitas')) {
            candidateImages = await searchShopifyApi(query, domain, longName);
        } else if (domain.includes('futboldeprimera')) {
            candidateImages = await searchWooApi(query, domain, longName);
        }

        if (candidateImages.length === 0) {
            // HTML Scraper Fallback
            productUrl = await searchNative(query, domain, longName);
            if (productUrl) {
                console.log(`Encontrado link HTML en ${domain}: ${productUrl}`);
                candidateImages = await scrapeImages(productUrl);
            }
        }

        if (candidateImages.length === 0) continue;

        // Filtrar basura adicional de candidateImages
        candidateImages = candidateImages.filter(src => {
            const low = src.toLowerCase();
            return !low.includes('logo') && !low.includes('tallas') && !low.includes('size') && !low.includes('icon');
        });

        // Limitar a una cantidad revisable de imagenes buenas.
        const toDownload = [...new Set(candidateImages)].slice(0, MAX_PROVIDER_IMAGES);
        const uploadedUrls = [];

        for (let i = 0; i < toDownload.length; i++) {
            const storagePath = `ia-scraper/${slug}-${timestamp}-${i+1}.webp`;
            try {
                const finalUrl = await downloadAndUpload(supabase, toDownload[i], storagePath);
                uploadedUrls.push(finalUrl);
            } catch (err) {
                console.warn(`Error subiendo imagen ${i}:`, err.message);
                debugLogs.push(`Upload err: ${err.message}`);
            }
        }

        if (uploadedUrls.length > 0) {
            // Retornamos TODAS las fotos descargadas, el front decidirá
            return res.status(200).json({ 
                source: domain,
                productUrl,
                images: uploadedUrls,
                debug: process.env.NODE_ENV === 'development' ? debugLogs : undefined
            });
        }
    }

    return res.status(200).json({ images: [], debug: process.env.NODE_ENV === 'development' ? debugLogs : undefined });
};

module.exports._private = {
    MAX_PROVIDER_IMAGES,
    scrapeImages,
};
