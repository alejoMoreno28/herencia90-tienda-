(function () {
    // Estas listas deciden la categoria del producto. Lo que no cae en ninguna
    // termina en "Nueva Coleccion", que no le dice nada al cliente ni sirve para
    // navegar el catalogo, asi que conviene mantenerlas al dia.
    const NATIONAL_TEAMS = [
        'alemania', 'argentina', 'brasil', 'colombia', 'corea', 'croacia', 'espana',
        'estados unidos', 'francia', 'holanda', 'inglaterra', 'italia', 'japon',
        'korea', 'mexico', 'paises bajos', 'portugal', 'uruguay'
    ];
    const SOUTH_AMERICAN_CLUBS = ['boca juniors', 'river plate', 'santos'];
    const EUROPEAN_CLUBS = [
        'ac milan', 'arsenal', 'barcelona', 'bayern munich', 'benfica', 'chelsea',
        'fiorentina', 'inter', 'juventus', 'liverpool', 'manchester city',
        'manchester united', 'napoli', 'porto', 'psg', 'real madrid', 'roma',
        // "city" y "united" a secas: asi los escribe el excel a veces.
        'city', 'united'
    ];

    function stripAccents(value) {
        return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function cleanNumber(value) {
        if (value === null || value === undefined) return 0;
        let text = String(value).replace(/[^\d,.\-]/g, '').trim();
        if (!text) return 0;
        const lastComma = text.lastIndexOf(',');
        const lastDot = text.lastIndexOf('.');
        if (lastComma > -1 && (lastDot === -1 || lastComma > lastDot)) {
            text = text.replace(/\./g, '').replace(',', '.');
        } else {
            text = text.replace(/,/g, '');
        }
        const parsed = parseFloat(text);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function expandTwoDigitYear(yearText) {
        const n = parseInt(yearText, 10);
        if (!Number.isFinite(n)) return yearText;
        return String(n >= 70 ? 1900 + n : 2000 + n);
    }

    function normalizeAliases(value) {
        return String(value || '')
            .replace(/\bman\s*ud\b/ig, 'Manchester United')
            .replace(/\bman\s*utd\b/ig, 'Manchester United')
            .replace(/\bman\s*united\b/ig, 'Manchester United')
            .replace(/\bmanchester\s+u\b/ig, 'Manchester United')
            .replace(/\bbarca\b/ig, 'Barcelona')
            .replace(/\bbayern\b/ig, 'Bayern Munich')
            .replace(/\bac\s+milan\b/ig, 'AC Milan')
            .replace(/\binter\s+milan\b/ig, 'Inter')
            .replace(/\bman\s+city\b/ig, 'Manchester City')
            .replace(/\br\.?\s*madrid\b/ig, 'Real Madrid');
    }

    // Una temporada son dos años seguidos. Solo se expande cuando el segundo es
    // el siguiente del primero, para no confundir con cualquier par de numeros.
    function esTemporada(start, end) {
        const a = parseInt(start, 10);
        const b = parseInt(end, 10);
        return b === a + 1 || (a === 99 && b === 0);
    }

    function normalizeYearsForSearch(value) {
        return String(value || '')
            .replace(/\b(19|20)(\d{2})\s*[/-]\s*(\d{2})\b/g, (_, century, start, end) => {
                return `${century}${start} ${century}${end}`;
            })
            .replace(/\b(\d{2})\s*[/-]\s*(\d{2})\b/g, (_, start, end) => {
                return `${expandTwoDigitYear(start)} ${expandTwoDigitYear(end)}`;
            })
            // El excel escribe la temporada separada por espacio ("26 27") y el
            // catalogo con barra ("26/27"). Sin esto no se reconocian como la
            // misma camiseta y se creaba un producto repetido con el stock
            // partido en dos. Paso con la Barcelona 26/27.
            .replace(/\b(\d{2})\s+(\d{2})\b/g, (texto, start, end) => (esTemporada(start, end)
                ? `${expandTwoDigitYear(start)} ${expandTwoDigitYear(end)}`
                : texto));
    }

    function normalizeYearsForDisplay(value) {
        return String(value || '')
            .replace(/\b(19|20)(\d{2})\s*[/-]\s*(\d{2})\b/g, (_, century, start, end) => {
                return `${century}${start}/${end}`;
            })
            .replace(/\b(\d{2})\s*[/-]\s*(\d{2})\b/g, (_, start, end) => {
                return `${expandTwoDigitYear(start)}/${end}`;
            });
    }

    function titleCase(value) {
        const keepUpper = new Set(['AC', 'AS', 'FC', 'PSG', 'UD']);
        return String(value || '')
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean)
            .map((part) => {
                const upper = part.toUpperCase();
                if (keepUpper.has(upper)) return upper;
                if (/^\d{4}\/\d{2}$/.test(part)) return part;
                return part.charAt(0).toUpperCase() + part.slice(1);
            })
            .join(' ');
    }

    function removeCommercialExtras(value) {
        return String(value || '')
            .replace(/\([^)]*(dorsal|personal|patch|parche)[^)]*\)/ig, ' ')
            .replace(/\b(dorsal|personalization|personalizacion|nombre)\b.*$/ig, ' ')
            .replace(/\bpatchs?\s+world\b/ig, ' ')
            .replace(/\bparches?\b/ig, ' ')
            .replace(/\bl[ñn]ayer\b/ig, ' ')
            .replace(/\bplayer\b/ig, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function displayNameFromRaw(desc, type, extrasInfo) {
        let clean = normalizeAliases(desc);
        clean = normalizeYearsForDisplay(clean);
        clean = removeCommercialExtras(clean);
        clean = clean.replace(/\b(local|visitante|tercera|negra|roja|blanca|azul|amarilla|verde|morada)\b/ig, (m) => m);
        clean = clean.replace(/\s+/g, ' ').trim();
        if (!clean) clean = 'Nueva referencia';

        let name = /^camiseta\b/i.test(clean) ? clean : `Camiseta ${clean}`;
        const typeUpper = String(type || '').trim().toUpperCase();
        if (typeUpper === 'PLAYER' && !/\bplayer\b/i.test(name)) name += ' Version Player';
        if (typeUpper === 'RETRO' && !/\bretro\b/i.test(name)) name += ' Retro';
        if (extrasInfo.sleeve === 'Manga larga' && !/\bmanga\s+larga\b/i.test(name)) name += ' Manga Larga';
        return titleCase(name);
    }

    function normalizeReferenceKey(value) {
        let text = stripAccents(normalizeAliases(value));
        text = normalizeYearsForSearch(text).toLowerCase();
        text = removeCommercialExtras(text);
        return text
            .replace(/\[[^\]]+\]/g, ' ')
            .replace(/\(\+\s*[^)]+\)/g, ' ')
            .replace(/\b(camiseta|camisa|jersey|retro|edicion|edicion|version|fan|player|importada|original|manga|larga|dorsal|personalizacion|personalization|patchs?|world|parche|parches|lnayer)\b/g, ' ')
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function tokensFor(value) {
        const key = normalizeReferenceKey(value);
        return key ? key.split(' ').filter(Boolean) : [];
    }

    function scoreCandidate(query, product) {
        const queryTokens = tokensFor(query);
        const productTokens = tokensFor(`${product.equipo || ''} ${product.descripcion || ''}`);
        if (!queryTokens.length || !productTokens.length) return 0;
        const q = new Set(queryTokens);
        const p = new Set(productTokens);
        let intersection = 0;
        q.forEach((token) => {
            if (p.has(token)) intersection++;
        });
        const union = new Set([...q, ...p]).size || 1;
        const jaccard = intersection / union;
        const coverage = intersection / q.size;
        const queryKey = queryTokens.join(' ');
        const productKey = productTokens.join(' ');
        const containsBoost = productKey.includes(queryKey) || queryKey.includes(productKey) ? 0.18 : 0;
        return Math.min(1, Math.max(jaccard, coverage * 0.85) + containsBoost);
    }

    function findProductCandidates(query, products, limit = 4) {
        return (Array.isArray(products) ? products : [])
            .map((product) => ({
                id: product.id,
                equipo: product.equipo || 'Referencia sin nombre',
                precio: product.precio || 0,
                score: scoreCandidate(query, product),
            }))
            .filter((candidate) => candidate.score >= 0.48)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    function chooseSafeCandidate(candidates) {
        const first = candidates && candidates[0];
        if (!first || first.score < 0.82) return null;
        const second = candidates[1];
        if (second && (first.score - second.score) < 0.08) return null;
        return first;
    }

    function inferExtras(extrasText, extraUsd, descText) {
        const haystack = stripAccents(`${extrasText || ''} ${descText || ''}`).toLowerCase();
        const sleeve = /\bmanga\s+larga\b|\blong\s+sleeve\b/.test(haystack) ? 'Manga larga' : 'Manga corta';
        const hasCustomizationText = /\bdorsal\b|\bpersonalization\b|\bpersonalizacion\b|\bnombre\b/.test(haystack);
        const hasPatchText = /\bpatch|\bparche/.test(haystack);
        const roundedExtra = Math.round((parseFloat(extraUsd) || 0) * 100) / 100;
        let patchCount = 0;
        if (roundedExtra >= 4) patchCount = Math.max(1, Math.round(roundedExtra - 3));
        else if (hasPatchText) patchCount = 1;
        const hasCustomization = roundedExtra >= 3 && (hasCustomizationText || sleeve !== 'Manga larga' || patchCount > 0);

        const labels = [];
        if (hasCustomization) labels.push('Dorsal / personalizacion');
        if (patchCount > 0) labels.push(`${patchCount} parche${patchCount === 1 ? '' : 's'}`);
        if (sleeve === 'Manga larga') labels.push('Manga larga');

        return {
            sleeve,
            patchCount,
            hasCustomization,
            labels,
            label: labels.length ? labels.join(' + ') : 'Sin extras',
        };
    }

    function suggestRetailPrice(type, unitCostUsd, finalCostUsd, extraUsd, extrasInfo) {
        const typeUpper = String(type || '').trim().toUpperCase();
        let base = 99000;
        const baseCost = parseFloat(unitCostUsd) || parseFloat(finalCostUsd) || 0;
        if (typeUpper === 'PLAYER' || baseCost === 14) base = 110000;
        else if (typeUpper === 'RETRO' || baseCost >= 15) base = 130000;
        else if (baseCost <= 11) base = 99000;

        const extra = extrasInfo && extrasInfo.hasCustomization ? (parseFloat(extraUsd) || 0) : 0;
        let suggested = base;
        if (extra >= 5) suggested = Math.max(base + 30000, 150000);
        else if (extra >= 4) suggested = Math.max(base + 20000, 140000);
        else if (extra >= 3) suggested = Math.max(base + 10000, 110000);
        if (extrasInfo && extrasInfo.sleeve === 'Manga larga') suggested += 10000;
        return suggested;
    }

    function inferCategory(name, type) {
        const key = normalizeReferenceKey(name);
        if (String(type || '').toUpperCase() === 'RETRO' || /\b(197|198|199|200[0-9]|201[0-9])/.test(key)) {
            return 'Retro';
        }
        if (NATIONAL_TEAMS.some((term) => key.includes(term))) return 'Selecciones Nacionales';
        if (SOUTH_AMERICAN_CLUBS.some((term) => key.includes(term))) return 'Equipos Sudamericanos';
        if (EUROPEAN_CLUBS.some((term) => key.includes(term))) return 'Equipos Europeos';
        return 'Nueva Coleccion';
    }

    // Esta descripcion la LEE EL CLIENTE en la ficha del producto, asi que no
    // puede llevar lenguaje interno. La version anterior hablaba de "carga
    // manual aprobada", "extras detectados" y de cotizar adicionales, y eso
    // estaba publicado en la tienda.
    function buildDescription(name, type, extrasInfo, extrasText) {
        const tipo = String(type || '').trim().toUpperCase();
        const version = tipo === 'RETRO' ? 'Versión retro'
            : tipo === 'PLAYER' ? 'Versión Player, de corte más ajustado y tela más ligera'
                : 'Versión Fan, de corte cómodo y tela transpirable';

        const partes = [`${name}. ${version}.`];

        // El nombre y numero impresos son de lo primero que pregunta quien
        // compra retro, asi que van en la descripcion cuando el pedido los trae.
        const dorsal = extraerDorsal(extrasText);
        if (dorsal) partes.push(`Llega estampada con el dorsal de ${dorsal}.`);
        else if (extrasInfo.hasCustomization) partes.push('Incluye dorsal personalizado.');

        if (extrasInfo.patchCount > 0) {
            partes.push(`Incluye ${extrasInfo.patchCount} parche${extrasInfo.patchCount === 1 ? '' : 's'}.`);
        }
        partes.push(`${extrasInfo.sleeve}.`);
        return partes.join(' ');
    }

    /** "NAME:RONALDINHO,NUMBER;10" -> "Ronaldinho #10" */
    function extraerDorsal(extrasText) {
        const texto = String(extrasText || '');
        const nombre = texto.match(/NAME\s*[:;]\s*([^,;]+)/i);
        const numero = texto.match(/NUMBER\s*[:;]\s*(\d+)/i);
        if (!nombre) return '';
        const limpio = nombre[1].trim().replace(/\s+/g, ' ');
        if (!limpio) return '';
        const capitalizado = limpio.split(' ')
            .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
            .join(' ');
        return numero ? `${capitalizado} #${numero[1]}` : capitalizado;
    }

    function getDestino(cols) {
        for (let i = cols.length - 1; i >= 0; i--) {
            const text = stripAccents(cols[i]).toUpperCase();
            if (text.includes('PREVENTA') || text.includes('PEDIDO')) return 'PREVENTA';
            if (text.includes('STOCK')) return 'STOCK';
        }
        return 'STOCK';
    }

    function normalizeImageList(images) {
        return (Array.isArray(images) ? images : [])
            .map((image) => {
                if (typeof image === 'string') return image;
                if (!image || typeof image !== 'object') return '';
                return image.url || image.publicUrl || image.src || image.path || '';
            })
            .map((image) => String(image || '').trim())
            .filter(Boolean);
    }

    function buildCatalogProductPayload(item, id) {
        const aiData = (item && item.aiData) || {};
        const name = aiData.nombre_oficial || item.generatedName || item.queryStr || 'Nueva referencia';
        return {
            id,
            categoria: aiData.categoria || item.generatedCategory || 'Nueva Coleccion',
            equipo: name,
            descripcion: aiData.descripcion || item.generatedDescription || '',
            precio: (item && item.precioVenta) || 99000,
            costo_usd: (item && item.costUsd) || 0,
            tallas: { S: 0, M: 0, L: 0, XL: 0 },
            imagenes: normalizeImageList(aiData.imagenes_extraidas),
        };
    }

    function buildPedidoProductName(productName, item) {
        const extras = [];
        const label = item && item.extrasLabel && item.extrasLabel !== 'Sin extras' ? item.extrasLabel : '';
        if (label) extras.push(...label.split(' + ').filter(Boolean));
        if (item && item.sleeve === 'Manga larga' && !extras.some(extra => /manga larga/i.test(extra))) {
            extras.push('Manga larga');
        }
        return extras.length ? `${productName} (${extras.join(' + ')})` : productName;
    }

    function buildLoteItemFromColumns(cols, products) {
        const sizeVal = cols[0] ? String(cols[0]).trim() : 'M';
        const typeVal = cols[1] ? String(cols[1]).trim() : 'FAN';
        const descVal = cols[2] ? String(cols[2]).trim() : '';
        const extrasVal = cols[3] ? String(cols[3]).trim() : '';
        const extraUsd = cleanNumber(cols[4]);
        const qtyVal = parseInt(cols[5], 10) || 1;
        const unitCostUsd = cleanNumber(cols[6]) || 10.44;
        const subtotal = cleanNumber(cols[7]);
        const finalCostUsd = subtotal > 0 && qtyVal > 0 ? subtotal / qtyVal : unitCostUsd + extraUsd;
        const destinoVal = getDestino(cols);
        const extrasInfo = inferExtras(extrasVal, extraUsd, descVal);
        const generatedName = displayNameFromRaw(descVal, typeVal, extrasInfo);
        const generatedCategory = inferCategory(generatedName, typeVal);
        const generatedDescription = buildDescription(generatedName, typeVal, extrasInfo, extrasVal);
        const duplicateCandidates = findProductCandidates(generatedName, products);
        const safeCandidate = chooseSafeCandidate(duplicateCandidates);
        const precioVenta = safeCandidate && safeCandidate.precio
            ? safeCandidate.precio
            : suggestRetailPrice(typeVal, unitCostUsd, finalCostUsd, extraUsd, extrasInfo);

        return {
            id: Date.now() + Math.random(),
            prodId: safeCandidate ? safeCandidate.id : null,
            queryStr: safeCandidate ? safeCandidate.equipo : generatedName,
            rawDescription: descVal,
            type: typeVal,
            extrasText: extrasVal,
            extrasLabel: extrasInfo.label,
            extraUsd,
            sleeve: extrasInfo.sleeve,
            size: sizeVal,
            qty: qtyVal,
            costUsd: finalCostUsd,
            unitCostUsd,
            destino: destinoVal,
            cliente: '',
            canal: 'Amigos/Confianza',
            precioVenta,
            abono: 0,
            generatedName,
            generatedDescription,
            generatedCategory,
            duplicateCandidates,
            forceNewReference: false,
            matchStatus: safeCandidate ? 'matched' : duplicateCandidates.length ? 'candidate' : 'new',
            aiData: {
                nombre_oficial: generatedName,
                descripcion: generatedDescription,
                categoria: generatedCategory,
                termino_busqueda: generatedName.replace(/^Camiseta\s+/i, '').split(/\s+/).slice(0, 3).join(' '),
                extras_detectados: extrasInfo.label,
                manga: extrasInfo.sleeve,
            },
        };
    }

    function findUnresolvedDuplicateItems(items) {
        return (Array.isArray(items) ? items : []).filter((item) => {
            return !item.prodId && !item.forceNewReference && Array.isArray(item.duplicateCandidates) && item.duplicateCandidates.length > 0;
        });
    }

    window.AdminLoteWorkflow = {
        cleanNumber,
        normalizeReferenceKey,
        findProductCandidates,
        chooseSafeCandidate,
        inferExtras,
        suggestRetailPrice,
        buildLoteItemFromColumns,
        findUnresolvedDuplicateItems,
        buildCatalogProductPayload,
        buildPedidoProductName,
        normalizeImageList,
    };
}());
