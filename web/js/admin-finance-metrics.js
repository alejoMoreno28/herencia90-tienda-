(function () {
    const INVENTORY_PURCHASE = 'compra inventario';
    const SALE = 'venta';

    function normalizeText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }

    function toNumber(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : 0;
    }

    function getMonth(fecha) {
        return String(fecha || '').slice(0, 7) || 'Sin fecha';
    }

    function isSale(transaction) {
        return transaction && transaction.tipo === 'ingreso' && normalizeText(transaction.categoria).includes(SALE);
    }

    function isInventoryPurchase(transaction) {
        return transaction && transaction.tipo === 'gasto' && normalizeText(transaction.categoria).includes(INVENTORY_PURCHASE);
    }

    function productCostCOP(transaction, globalTrm) {
        const costUsd = toNumber(transaction.costo_usd_asociado);
        const trm = toNumber(transaction.trm) || toNumber(globalTrm);
        return costUsd * trm;
    }

    function filterByPeriod(transactions, period) {
        if (!period || period === 'all') return transactions.slice();
        return transactions.filter(transaction => getMonth(transaction.fecha) === period);
    }

    function computeFinanceMetrics(transactions, options) {
        const opts = options || {};
        const globalTrm = toNumber(opts.globalTrm);
        const scopedTransactions = filterByPeriod(Array.isArray(transactions) ? transactions : [], opts.period);

        const metrics = {
            cashInTotal: 0,
            cashOutTotal: 0,
            cashAvailable: 0,
            salesRevenue: 0,
            otherIncome: 0,
            cogs: 0,
            grossProfit: 0,
            profitExpenses: 0,
            inventoryPurchases: 0,
            netProfitRealized: 0,
            grossMarginPct: 0,
            netMarginPct: 0,
            uncostedSalesCount: 0,
            salesCount: 0,
            transactionCount: scopedTransactions.length,
            monthly: { labels: [], salesRevenue: [], cashIn: [], cashOut: [], netProfitRealized: [] }
        };

        scopedTransactions.forEach(transaction => {
            const amount = toNumber(transaction.monto);
            if (transaction.tipo === 'ingreso') {
                metrics.cashInTotal += amount;
                if (isSale(transaction)) {
                    metrics.salesCount += 1;
                    metrics.salesRevenue += amount;
                    const cost = productCostCOP(transaction, globalTrm);
                    metrics.cogs += cost;
                    if (toNumber(transaction.costo_usd_asociado) <= 0) metrics.uncostedSalesCount += 1;
                } else {
                    metrics.otherIncome += amount;
                }
                return;
            }

            if (transaction.tipo === 'gasto') {
                metrics.cashOutTotal += amount;
                if (isInventoryPurchase(transaction)) {
                    metrics.inventoryPurchases += amount;
                } else {
                    metrics.profitExpenses += amount;
                }
            }
        });

        metrics.cashAvailable = metrics.cashInTotal - metrics.cashOutTotal;
        metrics.grossProfit = metrics.salesRevenue - metrics.cogs;
        metrics.netProfitRealized = metrics.grossProfit - metrics.profitExpenses;
        metrics.grossMarginPct = metrics.salesRevenue ? (metrics.grossProfit / metrics.salesRevenue) * 100 : 0;
        metrics.netMarginPct = metrics.salesRevenue ? (metrics.netProfitRealized / metrics.salesRevenue) * 100 : 0;

        if (opts.includeMonthly !== false) {
            metrics.monthly = buildMonthlySeries(scopedTransactions, globalTrm);
        }

        return metrics;
    }

    function buildMonthlySeries(transactions, globalTrm) {
        const groups = {};
        transactions.forEach(transaction => {
            const month = getMonth(transaction.fecha);
            if (!groups[month]) groups[month] = [];
            groups[month].push(transaction);
        });

        const labels = Object.keys(groups).filter(Boolean).sort();
        const series = { labels, salesRevenue: [], cashIn: [], cashOut: [], netProfitRealized: [] };
        labels.forEach(month => {
            const metrics = computeFinanceMetrics(groups[month], { globalTrm, includeMonthly: false });
            series.salesRevenue.push(metrics.salesRevenue);
            series.cashIn.push(metrics.cashInTotal);
            series.cashOut.push(metrics.cashOutTotal);
            series.netProfitRealized.push(metrics.netProfitRealized);
        });
        return series;
    }

    function buildProfitWaterfall(metrics) {
        const sales = toNumber(metrics.salesRevenue);
        const cogs = toNumber(metrics.cogs);
        const gross = toNumber(metrics.grossProfit);
        const expenses = toNumber(metrics.profitExpenses);
        const net = toNumber(metrics.netProfitRealized);

        return {
            labels: ['Ventas', ['Costo', 'producto'], ['Ganancia', 'bruta'], ['Gastos', 'venta'], ['Ganancia', 'neta']],
            ranges: [
                [0, sales],
                [sales, sales - cogs],
                [0, gross],
                [gross, gross - expenses],
                [0, net]
            ],
            values: [sales, -cogs, gross, -expenses, net],
            kinds: ['positive', 'negative', 'total', 'negative', net >= 0 ? 'total' : 'negative-total']
        };
    }

    window.AdminFinance = {
        computeFinanceMetrics,
        buildProfitWaterfall,
        filterByPeriod,
        isInventoryPurchase,
        isSale,
        normalizeText
    };
}());
