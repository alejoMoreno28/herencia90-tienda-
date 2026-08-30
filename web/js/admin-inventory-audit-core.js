(function () {
    'use strict';

    const DEFAULT_SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];

    function toCount(value) {
        const count = Number.parseInt(value, 10);
        return Number.isFinite(count) && count >= 0 ? count : 0;
    }

    function stockSizes(counts) {
        const keys = Object.keys(counts || {}).filter(key => !key.startsWith('R_'));
        return keys.sort((left, right) => {
            const leftIndex = DEFAULT_SIZE_ORDER.indexOf(left);
            const rightIndex = DEFAULT_SIZE_ORDER.indexOf(right);
            if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
            if (leftIndex === -1) return 1;
            if (rightIndex === -1) return -1;
            return leftIndex - rightIndex;
        });
    }

    function normalizeExpected(counts) {
        return stockSizes(counts).reduce((result, size) => {
            result[size] = toCount(counts[size]);
            return result;
        }, {});
    }

    function compareCounts(expectedCounts, physicalCounts) {
        const expected = normalizeExpected(expectedCounts);
        const sizes = Array.from(new Set([...stockSizes(expected), ...stockSizes(physicalCounts)]));
        let expectedTotal = 0;
        let physicalTotal = 0;

        sizes.forEach(size => {
            expectedTotal += toCount(expected[size]);
            physicalTotal += toCount((physicalCounts || {})[size]);
        });

        const difference = physicalTotal - expectedTotal;
        return {
            status: difference === 0 && sizes.every(size => toCount(expected[size]) === toCount((physicalCounts || {})[size]))
                ? 'match'
                : 'difference',
            missing: Math.max(0, -difference),
            extra: Math.max(0, difference),
            difference
        };
    }

    function progress(items) {
        const total = (items || []).length;
        const reviewed = (items || []).filter(item => item.reviewed).length;
        return {
            total,
            reviewed,
            percent: total ? Math.round((reviewed / total) * 100) : 0
        };
    }

    function auditRowsFromProducts(products) {
        return (products || []).map(product => ({
            productId: product.id,
            product: product.equipo || `Producto ${product.id}`,
            description: product.descripcion || '',
            image: Array.isArray(product.imagenes) ? (product.imagenes[0] || '') : (product.imagen || ''),
            expectedCounts: normalizeExpected(product.tallas),
            physicalCounts: {},
            issue: '',
            note: '',
            reviewed: false
        }));
    }

    function csvCell(value) {
        const text = String(value ?? '');
        return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }

    function toCsv(rows) {
        const header = ['ID', 'Producto', 'Talla', 'Página', 'Físico', 'Diferencia', 'Novedad', 'Nota'];
        const lines = [header.map(csvCell).join(',')];
        (rows || []).forEach(row => {
            const difference = toCount(row.physical) - toCount(row.expected);
            lines.push([
                row.productId,
                row.product,
                row.size,
                toCount(row.expected),
                toCount(row.physical),
                difference,
                row.issue,
                row.note
            ].map(csvCell).join(','));
        });
        return `\uFEFF${lines.join('\r\n')}`;
    }

    window.AdminInventoryAuditCore = {
        stockSizes,
        normalizeExpected,
        compareCounts,
        progress,
        auditRowsFromProducts,
        toCsv
    };
}());
