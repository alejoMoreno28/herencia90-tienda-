'use strict';

const { createClient } = require('@supabase/supabase-js');
const { load: cheerioLoad } = require('cheerio');
const sharp = require('sharp');
const crypto = require('crypto');

const BUCKET = 'preventa-images'; // Reutilizamos el bucket existente
const PROVIDERS = [
    'futboldeprimera.com.co',
    'sportshirts.co',
    'panitastienda.com',
    'leyendasdelfutbol.com'
];

function getSupabase() {
    return createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );
}

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
        const res = await fetch(searchUrl, {
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

async function scrapeImages(url) {
    try {
        const baseUrl = new URL(url);
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        if (!res.ok) return [];
        const html = await res.text();
        const $ = cheerioLoad(html);
        
        const images = new Set();

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
                    images.add(cleanSrc);
                }
            }
        }
        
        // Enfoque en contenedores de producto para ignorar logos, banners y footers
        let container = $('.woocommerce-product-gallery, .product__media-wrapper, .product-single__media-group, #product-photos, .product-gallery, .product-info, .product-images, .product-image, #content');
        if (container.length === 0) container = $('main, #main, .site-main, .product');
        if (container.length === 0) container = $('body');

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

        container.find('[style]').each((i, el) => {
            const style = $(el).attr('style') || '';
            const matches = style.match(/url\((['"]?)(.*?)\1\)/gi) || [];
            matches.forEach(match => addImageCandidate(match.replace(/^url\((['"]?)/i, '').replace(/(['"]?)\)$/i, '')));
        });

        container.find('meta[property="og:image"], meta[name="twitter:image"], link[rel="image_src"]').each((i, el) => {
            addImageCandidate($(el).attr('content') || $(el).attr('href'));
        });
        
        // Fallback: si no encontro nada en el contenedor, buscar links directos a imagenes (suele pasar en galerias Lightbox)
        if (images.size === 0) {
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
    const res = await fetch(imgUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    if (!res.ok) throw new Error('Error descarga img');
    const rawBuffer = Buffer.from(await res.arrayBuffer());
    
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
        .upload(storagePath, buffer, { contentType, upsert: true });
    
    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    return data.publicUrl;
}

async function searchShopifyApi(query, domain, longName) {
    try {
        const url = `https://${domain}/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product`;
        const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
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
        const pReq = await fetch(jsonUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!pReq.ok) return [];
        const pData = await pReq.json();
        return pData.images.map(img => img.startsWith('//') ? 'https:' + img : img);
    } catch(e) { return []; }
}

async function searchWooApi(query, domain, longName) {
    try {
        const url = `https://${domain}/wp-json/wc/store/products?search=${encodeURIComponent(query)}`;
        const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
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
    if (req.method !== 'POST') return res.status(405).end();
    
    const debugLogs = [];
    const { query, longName, exactUrl } = req.body || {};
    
    // Si se pasa exactUrl, el query puede ser usado solo para el slug de guardado
    if (!query && !exactUrl) return res.status(400).json({ error: 'query o exactUrl requerido' });

    console.log(`Buscando imagenes para: ${query || exactUrl} (longName: ${longName})`);
    const supabase = getSupabase();
    const slug = slugify(query || 'manual') || crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();

    // === MODO HIBRIDO: EXTRACCION POR URL DIRECTA ===
    if (exactUrl) {
        console.log(`Extrayendo directamente de URL: ${exactUrl}`);
        let candidateImages = [];
        
        try {
            if (exactUrl.includes('panitastienda.com')) {
                // Tratar como shopify
                const jsonUrl = exactUrl.split('?')[0] + '.js';
                const pReq = await fetch(jsonUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                if (pReq.ok) {
                    const pData = await pReq.json();
                    candidateImages = pData.images.map(img => img.startsWith('//') ? 'https:' + img : img);
                }
            }
            
            if (candidateImages.length === 0) {
                // Scraper HTML generico
                candidateImages = await scrapeImages(exactUrl);
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

            const toDownload = [...new Set(candidateImages)].slice(0, 4);
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
                productUrl: exactUrl,
                images: uploadedUrls,
                debug: debugLogs 
            });
        }
        return res.status(200).json({ images: [], debug: debugLogs });
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

        // Limitar a las primeras 4 imagenes buenas
        const toDownload = [...new Set(candidateImages)].slice(0, 4);
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
                debug: debugLogs 
            });
        }
    }

    return res.status(200).json({ images: [], debug: debugLogs });
};

module.exports._private = {
    scrapeImages,
};
