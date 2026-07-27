const fs = require('fs');
const productData = JSON.parse(fs.readFileSync('web/productos.json', 'utf8'));

function findBestProductMatch(desc) {
    if (!desc) return null;
    const rawQuery = String(desc).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    
    // 1. Coincidencia exacta o contiene completo
    let best = productData.find(p => {
        const pName = (p.equipo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        return pName === rawQuery || pName.includes(rawQuery) || rawQuery.includes(pName);
    });
    if (best) { console.log('Exact Match'); return best; }

    // 2. Coincidencia inteligente por palabras (Fuzzy Match / Jaccard Similarity)
    const tokenize = (str) => {
        let s = str.replace(/\[[^\]]+\]/g, ' ').replace(/\(\+\s*[^)]+\)/g, ' ').replace(/[^a-z0-9]+/g, ' ');
        s = s.replace(/\b20(\d{2})\b/g, '$1'); // 2025 -> 25
        s = s.replace(/\b19(\d{2})\b/g, '$1'); // 1999 -> 99
        s = s.replace(/\b(camiseta|camisa|jersey|retro|edicion|edición|version|fan|player|importada|original)\b/g, '');
        return s.split(' ').filter(Boolean);
    };

    const queryTokens = tokenize(rawQuery);
    if (queryTokens.length === 0) return null;

    let bestMatch = null;
    let highestScore = 0;

    for (const p of productData) {
        const pNameTokens = tokenize((p.equipo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
        if (pNameTokens.length === 0) continue;

        let matches = 0;
        for (const qt of queryTokens) {
            if (pNameTokens.includes(qt)) matches++;
        }

        const intersection = matches;
        const union = new Set([...queryTokens, ...pNameTokens]).size;
        const score = intersection / union;

        if (score > highestScore) {
            highestScore = score;
            bestMatch = p;
        }
    }

    if (highestScore >= 0.60) {
        console.log('Fuzzy Match Score: ' + highestScore + ' with ' + bestMatch.equipo);
        return bestMatch;
    }

    console.log('Highest Score: ' + highestScore + (bestMatch ? ' with ' + bestMatch.equipo : ''));
    return null;
}

findBestProductMatch('[FAN] CAMISETA ARSENAL LOCAL 2025/26');
findBestProductMatch('CAMISETA ARSENAL LOCAL 2025/26');
