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
        return !!item && (item.forcePhotoReview || !item.prodId);
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
        const missingLinks = activeGroups.filter((group) => !String(group.providerUrl || '').trim()).length;
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
                item.aiData.fuente_imagenes = group.providerUrl || '';
                item.aiData.imagenes_aprobadas = true;
                item.selectedImageIndex = 0;
                item.providerPhotoUrl = group.providerUrl || '';
            });
        });
    }

    window.AdminLotePhotoReview = {
        normalizeReferenceKey,
        buildPhotoReferenceGroups,
        validatePhotoReferenceGroups,
        applyApprovedPhotosToItems,
        approvedImagesForGroup,
        normalizeImageList,
    };
}());
