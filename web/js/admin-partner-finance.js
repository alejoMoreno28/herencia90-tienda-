(function () {
    function toNumber(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : 0;
    }

    function activeCuts(cuts) {
        return (Array.isArray(cuts) ? cuts : []).filter(cut => cut && cut.estado !== 'anulado');
    }

    function activeMovements(movements) {
        return (Array.isArray(movements) ? movements : []).filter(movement => movement && movement.estado !== 'anulado');
    }

    function suggestedEvenAmount(value) {
        const whole = Math.max(0, Math.floor(toNumber(value)));
        return whole - (whole % 2);
    }

    function netPartnerMovements(movements) {
        return activeMovements(movements).reduce((totals, movement) => {
            const participation = toNumber(movement.valor_participacion_cop);
            const cash = toNumber(movement.efecto_caja_cop);
            totals.participation += participation;
            totals.cash += cash;
            return totals;
        }, { participation: 0, cash: 0 });
    }

    function buildPartnerBalances(partners, cuts, movements) {
        const balances = {};
        const activePartners = (Array.isArray(partners) ? partners : []).filter(partner => partner && partner.activo !== false);

        activePartners.forEach(partner => {
            balances[partner.id] = {
                id: partner.id,
                name: partner.nombre || `Socio ${partner.id}`,
                percentage: toNumber(partner.porcentaje),
                allocated: 0,
                withdrawn: 0,
                cashWithdrawn: 0,
                productWithdrawn: 0,
                balance: 0
            };
        });

        activeCuts(cuts).forEach(cut => {
            const total = toNumber(cut.monto_aprobado);
            activePartners.forEach(partner => {
                const snapshotKey = `monto_socio_${partner.id}`;
                const explicitAllocation = toNumber(cut[snapshotKey]);
                const fallbackAllocation = total * (toNumber(partner.porcentaje) / 100);
                balances[partner.id].allocated += explicitAllocation || fallbackAllocation;
            });
        });

        activeMovements(movements).forEach(movement => {
            const partnerBalance = balances[movement.socio_id];
            if (!partnerBalance) return;
            const participation = toNumber(movement.valor_participacion_cop);
            partnerBalance.withdrawn += participation;
            if (movement.tipo === 'retiro_efectivo' || movement.tipo === 'reversion') {
                partnerBalance.cashWithdrawn += toNumber(movement.efecto_caja_cop);
            }
            if (movement.tipo === 'retiro_producto') {
                partnerBalance.productWithdrawn += participation;
            }
        });

        Object.values(balances).forEach(partner => {
            partner.balance = partner.allocated - partner.withdrawn;
        });

        return balances;
    }

    function computePartnerFinance(input) {
        const options = input || {};
        const operationalCash = toNumber(options.operationalCash);
        const creditCardDebt = Math.max(0, toNumber(options.creditCardDebt));
        const cuts = activeCuts(options.cuts);
        const movements = activeMovements(options.movements);
        const movementTotals = netPartnerMovements(movements);
        const netCashWithdrawals = movementTotals.cash;
        const currentPhysicalCash = operationalCash - netCashWithdrawals;
        const cashBeforePartnerWithdrawals = currentPhysicalCash + netCashWithdrawals;
        const distributionBasis = Math.max(0, cashBeforePartnerWithdrawals - creditCardDebt);
        const approvedCutsTotal = cuts.reduce((sum, cut) => sum + toNumber(cut.monto_aprobado), 0);
        const newCutAvailable = Math.max(0, distributionBasis - approvedCutsTotal);

        return {
            operationalCash,
            netCashWithdrawals,
            currentPhysicalCash,
            cashBeforePartnerWithdrawals,
            creditCardDebt,
            distributionBasis,
            approvedCutsTotal,
            newCutAvailable,
            suggestedEvenCut: suggestedEvenAmount(newCutAvailable),
            partnerBalances: buildPartnerBalances(options.partners, cuts, movements)
        };
    }

    window.AdminPartnerFinance = {
        computePartnerFinance,
        activeCuts,
        netPartnerMovements,
        suggestedEvenAmount
    };
}());
