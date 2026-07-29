(function () {
    const state = {
        db: null,
        root: null,
        getTransactions: () => [],
        getProducts: () => [],
        getTrm: () => 0,
        onChanged: () => {},
        showToast: () => {},
        formatter: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }),
        partners: [],
        cuts: [],
        movements: [],
        ready: false,
        error: null
    };

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function toNumber(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : 0;
    }

    function money(value) {
        return state.formatter.format(toNumber(value));
    }

    function today() {
        return new Date().toISOString().slice(0, 10);
    }

    function activeCuts() {
        return state.cuts.filter(cut => cut.estado !== 'anulado');
    }

    function partnerName(id) {
        return state.partners.find(partner => Number(partner.id) === Number(id))?.nombre || `Socio ${id}`;
    }

    function productName(id) {
        const product = state.getProducts().find(item => Number(item.id) === Number(id));
        return product ? `${product.equipo || product.categoria || 'Producto'} · ${product.descripcion || `#${product.id}`}` : '';
    }

    function movementTypeLabel(movement) {
        if (movement.tipo === 'retiro_efectivo') return 'Efectivo';
        if (movement.tipo === 'retiro_producto') return movement.transaccion_origen_id ? 'Camiseta histórica' : 'Camiseta';
        return 'Reversión';
    }

    function financeSnapshot() {
        const transactions = state.getTransactions();
        const operational = window.AdminFinance.computeFinanceMetrics(transactions, {
            globalTrm: state.getTrm(),
            includeMonthly: false
        });

        return window.AdminPartnerFinance.computePartnerFinance({
            operationalCash: operational.cashAvailable,
            creditCardDebt: operational.creditCardDebt,
            cuts: state.cuts,
            movements: state.movements,
            partners: state.partners
        });
    }

    function cutPartnerBalance(cutId, partnerId) {
        const cut = state.cuts.find(item => Number(item.id) === Number(cutId) && item.estado !== 'anulado');
        if (!cut) return 0;
        const allocated = toNumber(cut[`monto_socio_${partnerId}`]) || toNumber(cut.monto_aprobado) / 2;
        const used = state.movements
            .filter(item => Number(item.corte_id) === Number(cutId) && Number(item.socio_id) === Number(partnerId))
            .reduce((sum, item) => sum + toNumber(item.valor_participacion_cop), 0);
        return allocated - used;
    }

    function availableCutOptions(partnerId) {
        return activeCuts()
            .map(cut => ({ cut, balance: cutPartnerBalance(cut.id, partnerId) }))
            .filter(item => item.balance > 0);
    }

    function legacyWithdrawals() {
        const linkedIds = new Set(state.movements.map(item => String(item.transaccion_origen_id || '')).filter(Boolean));
        return state.getTransactions().filter(transaction => (
            String(transaction.categoria || '').toLowerCase().includes('retiro personal')
            && !linkedIds.has(String(transaction.id))
        ));
    }

    function init(options) {
        const opts = options || {};
        state.db = opts.db;
        state.root = document.getElementById(opts.rootId || 'partner-ledger-root');
        state.getTransactions = opts.getTransactions || state.getTransactions;
        state.getProducts = opts.getProducts || state.getProducts;
        state.getTrm = opts.getTrm || state.getTrm;
        state.onChanged = opts.onChanged || state.onChanged;
        state.showToast = opts.showToast || state.showToast;
        state.formatter = opts.formatter || state.formatter;

        if (!state.db || !state.root) return Promise.resolve();
        state.root.innerHTML = '<div class="partner-empty">Cargando organización de socios…</div>';
        return reload();
    }

    async function reload() {
        try {
            const [partnersResult, cutsResult, movementsResult] = await Promise.all([
                state.db.from('socios').select('*').order('id'),
                state.db.from('cortes_ganancias').select('*').order('fecha', { ascending: false }).order('id', { ascending: false }),
                state.db.from('movimientos_socios').select('*').order('fecha', { ascending: false }).order('id', { ascending: false })
            ]);
            const firstError = partnersResult.error || cutsResult.error || movementsResult.error;
            if (firstError) throw firstError;

            state.partners = partnersResult.data || [];
            state.cuts = cutsResult.data || [];
            state.movements = movementsResult.data || [];
            state.ready = true;
            state.error = null;
            render();
            state.onChanged();
        } catch (error) {
            state.ready = false;
            state.error = error;
            renderSetupError();
            console.error('Partner ledger:', error);
        }
    }

    function renderSetupError() {
        if (!state.root) return;
        state.root.innerHTML = `
            <div class="partner-setup-error">
                <strong>Organización de socios pendiente de activar</strong>
                El panel financiero sigue funcionando, pero la base de datos todavía no reconoce cortes y retiros de socios.
                Aplica la migración <code>20260728_socios_ganancias.sql</code> y vuelve a cargar Admin.
            </div>`;
    }

    function render() {
        if (!state.root || !state.ready) return;
        const snapshot = financeSnapshot();
        const partnerCards = state.partners.map(partner => renderPartnerCard(partner, snapshot.partnerBalances[partner.id])).join('');
        const movements = state.movements.slice(0, 80);
        const cuts = state.cuts.slice(0, 30);
        const historical = legacyWithdrawals();

        state.root.innerHTML = `
            <section class="partner-ledger" aria-label="Ganancias y retiros de socios">
                <div class="partner-hero">
                    <div class="partner-hero-head">
                        <div>
                            <div class="partner-kicker">Socios · regla 50 / 50</div>
                            <h2>Primero la tarjeta. Después, la ganancia.</h2>
                            <p class="partner-hero-copy">El corte reserva toda la deuda de tarjeta y divide únicamente el excedente aprobado. Sacar efectivo o una camiseta descuenta el saldo del socio, pero no cambia la utilidad del negocio.</p>
                        </div>
                        <div class="partner-actions">
                            <button class="partner-btn primary" type="button" onclick="AdminPartnerLedger.openCut()">Cerrar ganancias</button>
                            <button class="partner-btn" type="button" onclick="AdminPartnerLedger.openCashWithdrawal()">Sacar efectivo</button>
                            <button class="partner-btn" type="button" onclick="AdminPartnerLedger.openProductWithdrawal()">Sacar camiseta</button>
                            <button class="partner-btn" type="button" onclick="AdminPartnerLedger.exportCsv()">Exportar historial</button>
                        </div>
                    </div>
                    <div class="partner-waterline" aria-label="Cálculo del corte">
                        <div class="partner-waterline-item">
                            <span class="partner-waterline-label">Caja antes de socios</span>
                            <span class="partner-waterline-value">${money(snapshot.cashBeforePartnerWithdrawals)}</span>
                        </div>
                        <div class="partner-waterline-item debt">
                            <span class="partner-waterline-label">Deuda de tarjeta</span>
                            <span class="partner-waterline-value">− ${money(snapshot.creditCardDebt)}</span>
                        </div>
                        <div class="partner-waterline-item">
                            <span class="partner-waterline-label">Cortes ya aprobados</span>
                            <span class="partner-waterline-value">− ${money(snapshot.approvedCutsTotal)}</span>
                        </div>
                        <div class="partner-waterline-item available">
                            <span class="partner-waterline-label">Disponible para nuevo corte</span>
                            <span class="partner-waterline-value">${money(snapshot.newCutAvailable)}</span>
                        </div>
                    </div>
                </div>

                <div class="partner-body">
                    <div class="partner-cards">${partnerCards}</div>

                    <details class="partner-details">
                        <summary>Historial de socios y control interno</summary>
                        <div class="partner-detail-content">
                            <div class="partner-help">
                                <div><b>1. Paga o registra la tarjeta</b>La deuda completa queda reservada antes de calcular ganancias.</div>
                                <div><b>2. Cierra la ganancia</b>Aprueben juntos el corte. El sistema guarda la foto financiera y asigna 50% a cada socio.</div>
                                <div><b>3. Registra cada salida</b>Efectivo baja la caja. Camiseta baja inventario y se cobra al costo al socio.</div>
                            </div>

                            ${historical.length ? `
                                <div class="partner-section-head">
                                    <h3>Retiros antiguos por organizar</h3>
                                    <span class="partner-count">${historical.length} pendiente(s)</span>
                                </div>
                                <div class="partner-empty">
                                    Hay movimientos antiguos “Retiro Personal Socio”. Vincúlalos a un socio y a un corte sin volver a descontar inventario.
                                    <button class="partner-btn small primary" type="button" onclick="AdminPartnerLedger.openHistorical()">Organizar ahora</button>
                                </div>` : ''}

                            <div class="partner-section-head">
                                <h3>Cortes de ganancia</h3>
                                <span class="partner-count">${cuts.length} registro(s)</span>
                            </div>
                            ${renderCutsTable(cuts)}

                            <div class="partner-section-head">
                                <h3>Historial de socios</h3>
                                <span class="partner-count">${movements.length} movimiento(s)</span>
                            </div>
                            ${renderMovementsTable(movements)}
                        </div>
                    </details>
                </div>

                ${renderDialogs(snapshot)}
            </section>`;
        syncCashCutOptions();
        syncProductCutOptions();
    }

    function renderPartnerCard(partner, balance) {
        const data = balance || { allocated: 0, withdrawn: 0, cashWithdrawn: 0, productWithdrawn: 0, balance: 0 };
        return `
            <article class="partner-card">
                <div>
                    <div class="partner-card-name">
                        ${escapeHtml(partner.nombre)}
                        <button class="partner-btn small" type="button" style="color:#5b513e;border-color:#d8cdb7" onclick="AdminPartnerLedger.renamePartner(${Number(partner.id)})">Editar</button>
                    </div>
                    <div class="partner-balance-label">Saldo disponible del socio</div>
                    <div class="partner-balance">${money(data.balance)}</div>
                </div>
                <span class="partner-share">${toNumber(partner.porcentaje)}%</span>
                <div class="partner-card-meta">
                    <span>Asignado<b>${money(data.allocated)}</b></span>
                    <span>Retirado en efectivo<b>${money(data.cashWithdrawn)}</b></span>
                    <span>Tomado en camisetas<b>${money(data.productWithdrawn)}</b></span>
                </div>
            </article>`;
    }

    function renderCutsTable(cuts) {
        if (!cuts.length) return '<div class="partner-empty">Todavía no hay cortes aprobados. Cuando la deuda esté registrada, usa “Cerrar ganancias”.</div>';
        const rows = cuts.map(cut => {
            const canAnnul = cut.estado !== 'anulado';
            return `
                <tr>
                    <td>${escapeHtml(cut.fecha)}</td>
                    <td>#${cut.id}</td>
                    <td class="money">${money(cut.monto_aprobado)}</td>
                    <td class="money">${money(cut.monto_socio_1)}</td>
                    <td class="money">${money(cut.monto_socio_2)}</td>
                    <td><span class="partner-status ${cut.estado === 'anulado' ? 'annulled' : 'active'}">${cut.estado === 'anulado' ? 'Anulado' : 'Activo'}</span></td>
                    <td class="note" title="${escapeHtml(cut.nota || cut.motivo_anulacion || '')}">${escapeHtml(cut.nota || cut.motivo_anulacion || '—')}</td>
                    <td>${canAnnul ? `<button class="partner-btn small danger" type="button" onclick="AdminPartnerLedger.annulCut(${cut.id})">Anular</button>` : ''}</td>
                </tr>`;
        }).join('');
        return `
            <div class="partner-table-wrap">
                <table class="partner-table">
                    <thead><tr><th>Fecha</th><th>Corte</th><th>Total</th><th>Socio 1</th><th>Socio 2</th><th>Estado</th><th>Nota</th><th></th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
    }

    function renderMovementsTable(movements) {
        if (!movements.length) return '<div class="partner-empty">No hay retiros registrados. El saldo permanece asignado a cada socio.</div>';
        const rows = movements.map(movement => {
            const productDetail = movement.producto_id
                ? `${productName(movement.producto_id)} · ${escapeHtml(movement.talla || '')} × ${movement.cantidad || 1}`
                : (movement.transaccion_origen_id ? `Transacción #${movement.transaccion_origen_id}` : '');
            const canReverse = movement.tipo !== 'reversion' && movement.estado !== 'revertido';
            const taxControl = movement.tipo === 'retiro_producto' && movement.estado !== 'revertido'
                ? `<select aria-label="Revisión tributaria" onchange="AdminPartnerLedger.updateTaxReview(${movement.id}, this.value)">
                    <option value="pendiente" ${movement.revision_tributaria === 'pendiente' ? 'selected' : ''}>Tributario pendiente</option>
                    <option value="revisado" ${movement.revision_tributaria === 'revisado' ? 'selected' : ''}>Revisado</option>
                    <option value="no_aplica" ${movement.revision_tributaria === 'no_aplica' ? 'selected' : ''}>No aplica</option>
                </select>`
                : `<span class="partner-status ${movement.revision_tributaria === 'pendiente' ? 'pending' : ''}">${escapeHtml(movement.revision_tributaria || 'no_aplica')}</span>`;
            return `
                <tr class="${movement.estado === 'revertido' || movement.tipo === 'reversion' ? 'reverted' : ''}">
                    <td>${escapeHtml(movement.fecha)}</td>
                    <td>${escapeHtml(partnerName(movement.socio_id))}</td>
                    <td>${movementTypeLabel(movement)}</td>
                    <td class="note" title="${escapeHtml(productDetail || movement.nota || '')}">${escapeHtml(productDetail || movement.nota || '—')}</td>
                    <td class="money">${money(movement.valor_participacion_cop)}</td>
                    <td class="money">${money(movement.efecto_caja_cop)}</td>
                    <td>${taxControl}</td>
                    <td>${canReverse ? `<button class="partner-btn small danger" type="button" onclick="AdminPartnerLedger.reverseMovement(${movement.id})">Revertir</button>` : ''}</td>
                </tr>`;
        }).join('');
        return `
            <div class="partner-table-wrap">
                <table class="partner-table">
                    <thead><tr><th>Fecha</th><th>Socio</th><th>Tipo</th><th>Detalle</th><th>Descuenta saldo</th><th>Sale de caja</th><th>Control</th><th></th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
    }

    function partnerOptions() {
        return state.partners.map(partner => `<option value="${partner.id}">${escapeHtml(partner.nombre)} · 50%</option>`).join('');
    }

    function productOptions() {
        return state.getProducts()
            .filter(product => Object.values(product.tallas || {}).some(quantity => toNumber(quantity) > 0))
            .map(product => `<option value="${product.id}">${escapeHtml(productName(product.id))}</option>`)
            .join('');
    }

    function historicalOptions() {
        return legacyWithdrawals().map(transaction => (
            `<option value="${transaction.id}">#${transaction.id} · ${escapeHtml(transaction.fecha)} · ${escapeHtml(transaction.descripcion || 'Retiro personal')} · costo ${money(toNumber(transaction.costo_usd_asociado) * (toNumber(transaction.trm) || state.getTrm()))}</option>`
        )).join('');
    }

    function renderDialogs(snapshot) {
        return `
            <dialog class="partner-dialog" id="partner-cut-dialog">
                <div class="partner-dialog-head">
                    <h3>Cerrar ganancias 50 / 50</h3>
                    <p>Este acto aprueba el excedente. No mueve efectivo todavía.</p>
                </div>
                <form class="partner-dialog-form" onsubmit="AdminPartnerLedger.submitCut(event)">
                    <p class="partner-dialog-hint">Caja antes de socios ${money(snapshot.cashBeforePartnerWithdrawals)} − deuda ${money(snapshot.creditCardDebt)} − cortes activos ${money(snapshot.approvedCutsTotal)} = <b>${money(snapshot.newCutAvailable)} disponible</b>.</p>
                    <div class="partner-dialog-grid">
                        <div class="partner-dialog-field">
                            <label>Monto total aprobado (COP, número par)</label>
                            <input id="partner-cut-amount" type="number" min="2" max="${Math.floor(snapshot.newCutAvailable)}" step="2" value="${snapshot.suggestedEvenCut || ''}" required>
                        </div>
                        <div class="partner-dialog-field">
                            <label>Fecha</label>
                            <input id="partner-cut-date" type="date" value="${today()}" required>
                        </div>
                        <div class="partner-dialog-field full">
                            <label>Nota del acuerdo</label>
                            <textarea id="partner-cut-note" rows="2" placeholder="Ej: Corte aprobado por ambos socios después de reservar la tarjeta"></textarea>
                        </div>
                    </div>
                    <div class="partner-dialog-actions">
                        <button class="partner-btn" type="button" onclick="this.closest('dialog').close()">Cancelar</button>
                        <button class="partner-btn primary" type="submit">Aprobar corte</button>
                    </div>
                </form>
            </dialog>

            <dialog class="partner-dialog" id="partner-cash-dialog">
                <div class="partner-dialog-head">
                    <h3>Sacar efectivo</h3>
                    <p>Baja la caja física y el saldo del socio. No se registra como gasto del negocio.</p>
                </div>
                <form class="partner-dialog-form" onsubmit="AdminPartnerLedger.submitCashWithdrawal(event)">
                    <div class="partner-dialog-grid">
                        <div class="partner-dialog-field">
                            <label>Socio</label>
                            <select id="partner-cash-partner" onchange="AdminPartnerLedger.syncCashCutOptions()" required>${partnerOptions()}</select>
                        </div>
                        <div class="partner-dialog-field">
                            <label>Corte que paga el retiro</label>
                            <select id="partner-cash-cut" required></select>
                        </div>
                        <div class="partner-dialog-field">
                            <label>Monto COP</label>
                            <input id="partner-cash-amount" type="number" min="1" step="1" required>
                        </div>
                        <div class="partner-dialog-field">
                            <label>Fecha</label>
                            <input id="partner-cash-date" type="date" value="${today()}" required>
                        </div>
                        <div class="partner-dialog-field full">
                            <label>Nota</label>
                            <textarea id="partner-cash-note" rows="2" placeholder="Ej: transferencia a cuenta personal"></textarea>
                        </div>
                    </div>
                    <div class="partner-dialog-actions">
                        <button class="partner-btn" type="button" onclick="this.closest('dialog').close()">Cancelar</button>
                        <button class="partner-btn primary" type="submit">Registrar retiro</button>
                    </div>
                </form>
            </dialog>

            <dialog class="partner-dialog" id="partner-product-dialog">
                <div class="partner-dialog-head">
                    <h3>Sacar camiseta</h3>
                    <p>Descuenta inventario y cobra al socio el costo real USD × TRM. La venta y la utilidad no cambian.</p>
                </div>
                <form class="partner-dialog-form" onsubmit="AdminPartnerLedger.submitProductWithdrawal(event)">
                    <div class="partner-dialog-grid">
                        <div class="partner-dialog-field">
                            <label>Socio</label>
                            <select id="partner-product-partner" onchange="AdminPartnerLedger.syncProductCutOptions()" required>${partnerOptions()}</select>
                        </div>
                        <div class="partner-dialog-field">
                            <label>Corte que paga la camiseta</label>
                            <select id="partner-product-cut" required></select>
                        </div>
                        <div class="partner-dialog-field full">
                            <label>Producto</label>
                            <select id="partner-product-id" onchange="AdminPartnerLedger.syncProductSizes()" required>
                                <option value="">Selecciona una camiseta</option>${productOptions()}
                            </select>
                        </div>
                        <div class="partner-dialog-field">
                            <label>Talla disponible</label>
                            <select id="partner-product-size" required><option value="">Elige producto</option></select>
                        </div>
                        <div class="partner-dialog-field">
                            <label>Cantidad</label>
                            <input id="partner-product-qty" type="number" min="1" step="1" value="1" required>
                        </div>
                        <div class="partner-dialog-field">
                            <label>TRM aplicada</label>
                            <input id="partner-product-trm" type="number" min="1" step="1" value="${Math.round(state.getTrm())}" required>
                        </div>
                        <div class="partner-dialog-field">
                            <label>Fecha</label>
                            <input id="partner-product-date" type="date" value="${today()}" required>
                        </div>
                        <div class="partner-dialog-field full">
                            <label>Nota</label>
                            <textarea id="partner-product-note" rows="2" placeholder="Opcional"></textarea>
                        </div>
                    </div>
                    <p class="partner-dialog-hint">La revisión tributaria quedará <b>pendiente</b> hasta que el contador confirme el tratamiento de IVA/factura.</p>
                    <div class="partner-dialog-actions">
                        <button class="partner-btn" type="button" onclick="this.closest('dialog').close()">Cancelar</button>
                        <button class="partner-btn primary" type="submit">Registrar camiseta</button>
                    </div>
                </form>
            </dialog>

            <dialog class="partner-dialog" id="partner-historical-dialog">
                <div class="partner-dialog-head">
                    <h3>Organizar retiro antiguo</h3>
                    <p>Solo crea el vínculo contable. No vuelve a descontar la camiseta del inventario.</p>
                </div>
                <form class="partner-dialog-form" onsubmit="AdminPartnerLedger.submitHistorical(event)">
                    <div class="partner-dialog-field">
                        <label>Movimiento anterior</label>
                        <select id="partner-historical-transaction" required>${historicalOptions()}</select>
                    </div>
                    <div class="partner-dialog-grid">
                        <div class="partner-dialog-field">
                            <label>Socio</label>
                            <select id="partner-historical-partner" required>${partnerOptions()}</select>
                        </div>
                        <div class="partner-dialog-field">
                            <label>Corte</label>
                            <select id="partner-historical-cut" required>${activeCuts().map(cut => `<option value="${cut.id}">Corte #${cut.id} · ${escapeHtml(cut.fecha)}</option>`).join('')}</select>
                        </div>
                        <div class="partner-dialog-field full">
                            <label>Valor al costo que descuenta del socio (COP)</label>
                            <input id="partner-historical-value" type="number" min="1" step="1" required>
                        </div>
                        <div class="partner-dialog-field full">
                            <label>Nota</label>
                            <textarea id="partner-historical-note" rows="2" placeholder="Contexto del retiro anterior"></textarea>
                        </div>
                    </div>
                    <div class="partner-dialog-actions">
                        <button class="partner-btn" type="button" onclick="this.closest('dialog').close()">Cancelar</button>
                        <button class="partner-btn primary" type="submit">Vincular sin descontar stock</button>
                    </div>
                </form>
            </dialog>`;
    }

    function showDialog(id) {
        const dialog = document.getElementById(id);
        if (!dialog) return;
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
    }

    function openCut() {
        const snapshot = financeSnapshot();
        if (snapshot.suggestedEvenCut <= 0) {
            alert('No hay un excedente nuevo para aprobar. Primero registra el pago de la tarjeta o genera más caja.');
            return;
        }
        showDialog('partner-cut-dialog');
    }

    function openCashWithdrawal() {
        if (!activeCuts().length) {
            alert('Primero debes aprobar un corte de ganancias.');
            return;
        }
        syncCashCutOptions();
        showDialog('partner-cash-dialog');
    }

    function openProductWithdrawal() {
        if (!activeCuts().length) {
            alert('Primero debes aprobar un corte de ganancias.');
            return;
        }
        syncProductCutOptions();
        showDialog('partner-product-dialog');
    }

    function openHistorical() {
        if (!activeCuts().length) {
            alert('Primero debes aprobar un corte al cual vincular el retiro antiguo.');
            return;
        }
        showDialog('partner-historical-dialog');
    }

    function syncCutSelect(partnerSelectId, cutSelectId) {
        const partnerId = Number(document.getElementById(partnerSelectId)?.value || state.partners[0]?.id);
        const cutSelect = document.getElementById(cutSelectId);
        if (!cutSelect) return;
        const options = availableCutOptions(partnerId);
        cutSelect.innerHTML = options.length
            ? options.map(({ cut, balance }) => `<option value="${cut.id}">Corte #${cut.id} · saldo ${money(balance)}</option>`).join('')
            : '<option value="">Sin saldo disponible</option>';
    }

    function syncCashCutOptions() {
        syncCutSelect('partner-cash-partner', 'partner-cash-cut');
    }

    function syncProductCutOptions() {
        syncCutSelect('partner-product-partner', 'partner-product-cut');
    }

    function syncProductSizes() {
        const productId = Number(document.getElementById('partner-product-id')?.value);
        const sizeSelect = document.getElementById('partner-product-size');
        if (!sizeSelect) return;
        const product = state.getProducts().find(item => Number(item.id) === productId);
        const sizes = Object.entries(product?.tallas || {}).filter(([, quantity]) => toNumber(quantity) > 0);
        sizeSelect.innerHTML = sizes.length
            ? sizes.map(([size, quantity]) => `<option value="${escapeHtml(size)}">${escapeHtml(size)} · ${quantity} disponible(s)</option>`).join('')
            : '<option value="">Sin stock</option>';
    }

    async function rpc(name, args, successMessage) {
        const result = await state.db.rpc(name, args);
        if (result.error) throw result.error;
        state.showToast(successMessage);
        await reload();
        return result.data;
    }

    async function runForm(event, action) {
        event.preventDefault();
        const button = event.submitter;
        if (button) button.disabled = true;
        try {
            await action();
        } catch (error) {
            alert(`No se pudo guardar: ${error.message || error}`);
            console.error(error);
        } finally {
            if (button) button.disabled = false;
        }
    }

    function submitCut(event) {
        return runForm(event, () => rpc('crear_corte_ganancias', {
            p_monto_aprobado: Number(document.getElementById('partner-cut-amount').value),
            p_fecha: document.getElementById('partner-cut-date').value,
            p_nota: document.getElementById('partner-cut-note').value.trim()
        }, 'Corte 50/50 aprobado'));
    }

    function submitCashWithdrawal(event) {
        return runForm(event, () => rpc('registrar_retiro_efectivo_socio', {
            p_corte_id: Number(document.getElementById('partner-cash-cut').value),
            p_socio_id: Number(document.getElementById('partner-cash-partner').value),
            p_monto: Number(document.getElementById('partner-cash-amount').value),
            p_fecha: document.getElementById('partner-cash-date').value,
            p_nota: document.getElementById('partner-cash-note').value.trim()
        }, 'Retiro de efectivo registrado'));
    }

    function submitProductWithdrawal(event) {
        return runForm(event, async () => {
            const productId = Number(document.getElementById('partner-product-id').value);
            const quantity = Number(document.getElementById('partner-product-qty').value);
            const size = document.getElementById('partner-product-size').value;
            const product = state.getProducts().find(item => Number(item.id) === productId);
            const available = toNumber(product?.tallas?.[size]);
            if (!product || !size || quantity < 1 || quantity > available) {
                throw new Error(`Revisa producto, talla y cantidad. Stock actual: ${available}.`);
            }
            await rpc('registrar_retiro_producto_socio', {
                p_corte_id: Number(document.getElementById('partner-product-cut').value),
                p_socio_id: Number(document.getElementById('partner-product-partner').value),
                p_producto_id: productId,
                p_talla: size,
                p_cantidad: quantity,
                p_trm_snapshot: Number(document.getElementById('partner-product-trm').value),
                p_fecha: document.getElementById('partner-product-date').value,
                p_nota: document.getElementById('partner-product-note').value.trim()
            }, 'Camiseta cargada al socio al costo');
        });
    }

    function submitHistorical(event) {
        return runForm(event, () => rpc('vincular_retiro_producto_historico', {
            p_transaccion_id: Number(document.getElementById('partner-historical-transaction').value),
            p_corte_id: Number(document.getElementById('partner-historical-cut').value),
            p_socio_id: Number(document.getElementById('partner-historical-partner').value),
            p_valor_participacion_cop: Number(document.getElementById('partner-historical-value').value),
            p_nota: document.getElementById('partner-historical-note').value.trim()
        }, 'Retiro antiguo organizado'));
    }

    async function reverseMovement(id) {
        const reason = prompt('Motivo de la reversión (queda en el historial):');
        if (!reason || reason.trim().length < 3) return;
        if (!confirm('¿Confirmas la reversión? Si fue una camiseta, el stock será restaurado.')) return;
        try {
            await rpc('revertir_movimiento_socio', {
                p_movimiento_id: Number(id),
                p_fecha: today(),
                p_nota: reason.trim()
            }, 'Movimiento revertido');
        } catch (error) {
            alert(`No se pudo revertir: ${error.message || error}`);
        }
    }

    async function annulCut(id) {
        const reason = prompt('Motivo de anulación del corte:');
        if (!reason || reason.trim().length < 3) return;
        if (!confirm('Solo se podrá anular si todos sus retiros están revertidos. ¿Continuar?')) return;
        try {
            await rpc('anular_corte_ganancias', {
                p_corte_id: Number(id),
                p_motivo: reason.trim()
            }, 'Corte anulado');
        } catch (error) {
            alert(`No se pudo anular: ${error.message || error}`);
        }
    }

    async function renamePartner(id) {
        const partner = state.partners.find(item => Number(item.id) === Number(id));
        const name = prompt('Nombre que aparecerá en el control de socios:', partner?.nombre || '');
        if (!name || name.trim().length < 1) return;
        try {
            await rpc('actualizar_nombre_socio', {
                p_socio_id: Number(id),
                p_nombre: name.trim()
            }, 'Nombre actualizado');
        } catch (error) {
            alert(`No se pudo actualizar: ${error.message || error}`);
        }
    }

    async function updateTaxReview(id, value) {
        try {
            await rpc('actualizar_revision_tributaria_movimiento', {
                p_movimiento_id: Number(id),
                p_estado: value
            }, 'Revisión tributaria actualizada');
        } catch (error) {
            alert(`No se pudo actualizar: ${error.message || error}`);
        }
    }

    function exportCsv() {
        const header = [
            'ID', 'Fecha', 'Corte', 'Socio', 'Tipo', 'Descuenta saldo COP', 'Efecto caja COP',
            'Producto', 'Talla', 'Cantidad', 'Costo unitario USD', 'TRM', 'Revision tributaria',
            'Estado', 'Nota', 'Transaccion origen'
        ];
        const rows = state.movements.map(item => [
            item.id,
            item.fecha,
            item.corte_id,
            partnerName(item.socio_id),
            movementTypeLabel(item),
            item.valor_participacion_cop,
            item.efecto_caja_cop,
            productName(item.producto_id),
            item.talla || '',
            item.cantidad || '',
            item.costo_unitario_usd || '',
            item.trm_snapshot || '',
            item.revision_tributaria || '',
            item.estado || '',
            item.nota || '',
            item.transaccion_origen_id || ''
        ]);
        const csv = [header, ...rows]
            .map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
            .join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Socios_Herencia90_${today()}.csv`;
        document.body.appendChild(link);
        link.click();
        URL.revokeObjectURL(link.href);
        link.remove();
    }

    function getMovements() {
        return state.movements.slice();
    }

    window.AdminPartnerLedger = {
        init,
        reload,
        render,
        getMovements,
        openCut,
        openCashWithdrawal,
        openProductWithdrawal,
        openHistorical,
        syncCashCutOptions,
        syncProductCutOptions,
        syncProductSizes,
        submitCut,
        submitCashWithdrawal,
        submitProductWithdrawal,
        submitHistorical,
        reverseMovement,
        annulCut,
        renamePartner,
        updateTaxReview,
        exportCsv
    };
}());
