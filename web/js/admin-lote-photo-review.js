(function () {
    function normalizeReferenceKey(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/\[[^\]]+\]/g, ' ')
            .replace(/\(\+\s*[^)]+\)/g, ' ')
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function requiresPhotoReview(item) {
        if (!item) return false;
        const hasUnresolvedCandidates = !item.prodId
            && !item.forceNewReference
            && Array.isArray(item.duplicateCandidates)
            && item.duplicateCandidates.length > 0;
        return !hasUnresolvedCandidates && (item.forcePhotoReview || !item.prodId);
    }

    function summarizeSizes(rows) {
        const counts = new Map();
        rows.forEach((row) => {
            const size = String(row.size || '').trim() || 'Sin talla';
            counts.set(size, (counts.get(size) || 0) + (parseInt(row.qty, 10) || 0));
        });
        return Array.from(counts.entries()).map(([size, qty]) => `${size} x${qty}`);
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

    function itemExtractedImages(item) {
        return normalizeImageList(item && item.aiData && item.aiData.imagenes_extraidas);
    }

    function buildPhotoReferenceGroups(items, previousGroups) {
        const previousByKey = new Map((previousGroups || []).map((group) => [group.key, group]));
        const grouped = new Map();

        (items || []).forEach((item, index) => {
            if (!requiresPhotoReview(item)) return;
            const key = normalizeReferenceKey(item.queryStr);
            if (!key) return;

            if (!grouped.has(key)) {
                const previous = previousByKey.get(key) || {};
                const extractedImages = itemExtractedImages(item);
                grouped.set(key, {
                    key,
                    title: item.queryStr || 'Referencia nueva',
                    // Texto crudo del excel: sirve mejor que el nombre ya
                    // procesado para traducir el equipo al chino y buscar
                    // en el proveedor.
                    rawDescription: item.rawDescription || item.queryStr || '',
                    extrasText: item.extrasText || '',
                    candidates: Array.isArray(previous.candidates) ? previous.candidates : [],
                    searchInfo: previous.searchInfo || null,
                    itemIndexes: [],
                    rows: [],
                    providerUrl: previous.providerUrl || item.providerPhotoUrl || '',
                    images: normalizeImageList(previous.images).length
                        ? normalizeImageList(previous.images)
                        : extractedImages,
                    selectedImages: Array.isArray(previous.selectedImages) ? previous.selectedImages.slice() : [],
                    approved: !!previous.approved,
                    extracting: false,
                    error: '',
                });
            }

            const group = grouped.get(key);
            group.itemIndexes.push(index);
            group.rows.push({
                size: item.size,
                qty: item.qty,
                destino: item.destino,
                cliente: item.cliente,
            });
        });

        return Array.from(grouped.values()).map((group) => {
            const destinations = Array.from(new Set(group.rows.map((row) => row.destino).filter(Boolean)));
            const images = normalizeImageList(group.images);
            const selectedImages = group.selectedImages.length
                ? group.selectedImages.filter((index) => images[index])
                : images.map((_, index) => index);

            return {
                ...group,
                totalQty: group.rows.reduce((sum, row) => sum + (parseInt(row.qty, 10) || 0), 0),
                destinations,
                sizes: summarizeSizes(group.rows),
                selectedImages,
                approved: !!group.approved && images.length > 0,
            };
        });
    }

    function validatePhotoReferenceGroups(groups) {
        const activeGroups = groups || [];
        const missingLinks = activeGroups.filter((group) => {
            const images = normalizeImageList(group.images);
            return !String(group.providerUrl || '').trim() && images.length === 0;
        }).length;
        const missingApprovals = activeGroups.filter((group) => !group.approved || !group.images || !group.images.length).length;

        return {
            ok: missingLinks === 0 && missingApprovals === 0,
            missingLinks,
            missingApprovals,
        };
    }

    function approvedImagesForGroup(group) {
        const images = normalizeImageList(group.images);
        const selected = Array.isArray(group.selectedImages) && group.selectedImages.length
            ? group.selectedImages
            : images.map((_, index) => index);
        return selected.map((index) => images[index]).filter(Boolean);
    }

    function applyApprovedPhotosToItems(items, groups) {
        (groups || []).forEach((group) => {
            if (!group.approved) return;
            const approvedImages = approvedImagesForGroup(group);
            if (!approvedImages.length) return;

            (group.itemIndexes || []).forEach((index) => {
                const item = items[index];
                if (!item) return;
                item.aiData = item.aiData || {};
                item.aiData.imagenes_extraidas = approvedImages.slice();
                item.aiData.fuente_imagenes = group.providerUrl || 'Manual';
                item.aiData.imagenes_aprobadas = true;
                item.selectedImageIndex = 0;
                item.providerPhotoUrl = group.providerUrl || 'Manual';
            });
        });
    }

    function buildCatalogProductFromLoteItem(item, id) {
        const aiData = (item && item.aiData) || {};
        return {
            id,
            categoria: aiData.categoria || (item && item.generatedCategory) || 'Nueva Coleccion',
            equipo: aiData.nombre_oficial || (item && item.generatedName) || (item && item.queryStr) || 'Nueva referencia',
            descripcion: aiData.descripcion || (item && item.generatedDescription) || '',
            precio: (item && item.precioVenta) || 99000,
            costo_usd: (item && item.costUsd) || 0,
            tallas: { S: 0, M: 0, L: 0, XL: 0 },
            imagenes: normalizeImageList(aiData.imagenes_extraidas),
        };
    }

    function groupIndexSet(group) {
        return new Set((group && group.itemIndexes) || []);
    }

    function itemsForPhotoGroup(items, group) {
        const indexes = groupIndexSet(group);
        return (items || []).filter((_, index) => indexes.has(index));
    }

    function removePhotoGroupItems(items, group) {
        const indexes = groupIndexSet(group);
        return (items || []).filter((_, index) => !indexes.has(index));
    }

    window.AdminLotePhotoReview = {
        normalizeReferenceKey,
        buildPhotoReferenceGroups,
        validatePhotoReferenceGroups,
        applyApprovedPhotosToItems,
        approvedImagesForGroup,
        normalizeImageList,
        buildCatalogProductFromLoteItem,
        itemsForPhotoGroup,
        removePhotoGroupItems,
    };
}());
