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

async function searchDDG(query, domain) {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent('site:' + domain + ' ' + query)}`;
    try {
        const res = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        if (!res.ok) return null;
        const html = await res.text();
        const $ = cheerioLoad(html);
        
        let foundLink = null;
        $('.result__url').each((i, el) => {
            if (foundLink) return;
            const link = $(el).text().trim();
            // Asegurar que el link pertenezca al dominio buscado y no sea un anuncio
            if (link.includes(domain)) {
                if (link.includes('/productos/') || link.includes('/producto/') || link.includes('/products/') || link.includes('/product/') || link.includes('/collections/') || link.includes('/tienda/')) {
                    foundLink = 'https://' + link;
                } else if (!foundLink) {
                    foundLink = 'https://' + link;
                }
            }
        });
        if (foundLink && foundLink !== 'https://') return foundLink;
        return null;
    } catch (e) {
        console.error('Error DDG:', e);
        return null;
    }
}

async function scrapeImages(url) {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        if (!res.ok) return [];
        const html = await res.text();
        const $ = cheerioLoad(html);
        
        const images = new Set();
        $('img').each((i, el) => {
            let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-origin-src');
            if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('.svg') && !src.includes('placeholder')) {
                if (src.startsWith('//')) src = 'https:' + src;
                if (src.startsWith('http')) {
                    // Limpiar params de CDN si es necesario
                    images.add(src.split('?')[0]); 
                }
            }
        });
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

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    
    const debugLogs = [];
    const { query } = req.body || {};
    if (!query) return res.status(400).json({ error: 'query requerido' });

    console.log(`Buscando imagenes para: ${query}`);
    const supabase = getSupabase();
    const slug = slugify(query) || crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();

    for (const domain of PROVIDERS) {
        console.log(`Buscando en ${domain}...`);
        const productUrl = await searchDDG(query, domain);
        if (!productUrl) continue;
        
        console.log(`Encontrado link en ${domain}: ${productUrl}`);
        const candidateImages = await scrapeImages(productUrl);
        if (candidateImages.length === 0) continue;

        // Limitar a las primeras 4 imagenes buenas
        const toDownload = candidateImages.slice(0, 4);
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
            // Se encontraron fotos, retornamos y rompemos el loop
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
