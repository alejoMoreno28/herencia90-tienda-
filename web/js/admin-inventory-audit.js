(function () {
    'use strict';

    const SUPABASE_URL = 'https://nlnrdtcgbdkzfzwnsffp.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sbnJkdGNnYmRremZ6d25zZmZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDUyNTcsImV4cCI6MjA5MTQyMTI1N30.T51eC1fJFc5Wn79JcA5l4m9CIYSYVhE7B7YU19CPQ00';
    const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const core = window.AdminInventoryAuditCore;
    const state = { audit: null, items: [], index: 0, busy: false };

    const element = id => document.getElementById(id);
    const show = id => element(id).classList.remove('hidden');
    const hide = id => element(id).classList.add('hidden');

    function setStatus(text) { element('save-status').textContent = text; }
    function setBusy(busy) {
        state.busy = busy;
        ['match-button', 'save-next-button', 'previous-button'].forEach(id => { element(id).disabled = busy; });
    }
    function fail(message) {
        hide('loading-view'); hide('audit-view'); hide('summary-view');
        element('error-message').textContent = message || 'Revisa tu conexión e inténtalo de nuevo.';
        show('error-view');
    }

    async function loadProductsReadOnly() {
        const { data, error } = await db.from('productos')
            .select('id,equipo,descripcion,imagenes,tallas')
            .order('id');
        if (error) throw error;
        return data || [];
    }

    function fromDatabaseItem(item) {
        return {
            id: item.id,
            auditId: item.audit_id,
            productId: item.product_id,
            product: item.equipo,
            description: item.descripcion || '',
            image: item.imagen || '',
            expectedCounts: item.expected_counts || {},
            physicalCounts: item.physical_counts || {},
            issue: item.issue || '',
            note: item.note || '',
            reviewed: Boolean(item.reviewed)
        };
    }

    async function loadAuditItems(auditId) {
        const { data, error } = await db.from('inventario_auditoria_items')
            .select('*')
            .eq('audit_id', auditId)
            .order('product_id');
        if (error) throw error;
        return (data || []).map(fromDatabaseItem);
    }

    async function loadOrCreateActiveAudit(ownerId, products) {
        const { data: active, error: activeError } = await db.from('inventario_auditorias')
            .select('*')
            .eq('owner_id', ownerId)
            .eq('estado', 'activa')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (activeError) throw activeError;
        if (active) return { audit: active, items: await loadAuditItems(active.id) };

        const rows = core.auditRowsFromProducts(products);
        const { data: audit, error: auditError } = await db.from('inventario_auditorias')
            .insert({ owner_id: ownerId, total_referencias: rows.length })
            .select('*')
            .single();
        if (auditError) throw auditError;

        if (rows.length) {
            const payload = rows.map(row => ({
                audit_id: audit.id,
                product_id: row.productId,
                equipo: row.product,
                descripcion: row.description,
                imagen: row.image,
                expected_counts: row.expectedCounts
            }));
            const { error: itemError } = await db.from('inventario_auditoria_items').insert(payload);
            if (itemError) throw itemError;
        }
        return { audit, items: await loadAuditItems(audit.id) };
    }

    function currentItem() { return state.items[state.index]; }

    function updateProgress() {
        const result = core.progress(state.items);
        element('progress-label').textContent = `${result.reviewed} de ${result.total} referencias`;
        element('audit-progress').style.width = `${result.percent}%`;
    }

    function countInputs() {
        return Array.from(document.querySelectorAll('.physical-count')).reduce((counts, input) => {
            counts[input.dataset.size] = Math.max(0, Number.parseInt(input.value, 10) || 0);
            return counts;
        }, {});
    }

    function updateDifference() {
        const item = currentItem();
        if (!item) return;
        const result = core.compareCounts(item.expectedCounts, countInputs());
        const message = element('difference-message');
        message.className = 'difference-message';
        if (result.status === 'match') {
            message.textContent = 'Todo coincide'; message.classList.add('match');
        } else if (result.difference < 0) {
            message.textContent = `Faltan ${result.missing} unidad${result.missing === 1 ? '' : 'es'}`; message.classList.add('missing');
        } else {
            message.textContent = `Hay ${result.extra} unidad${result.extra === 1 ? '' : 'es'} de más`; message.classList.add('extra');
        }
    }

    function renderCurrent() {
        const item = currentItem();
        if (!item) { renderSummary(); return; }
        element('product-id').textContent = `ID ${item.productId}`;
        element('product-name').textContent = item.product;
        element('product-description').textContent = item.description;
        const image = element('product-image');
        image.src = item.image || '/img/logo-ui.webp';
        image.alt = item.image ? `Foto de ${item.product}` : '';
        image.onerror = () => { image.src = '/img/logo-ui.webp'; image.onerror = null; };

        element('size-rows').innerHTML = core.stockSizes(item.expectedCounts).map(size => `
            <label class="size-row">
                <strong>${escapeHtml(size)}</strong>
                <span class="expected-count">${item.expectedCounts[size] || 0}</span>
                <input class="physical-count" data-size="${escapeHtml(size)}" type="number" min="0" inputmode="numeric" value="${item.physicalCounts[size] ?? ''}" aria-label="Cantidad física talla ${escapeHtml(size)}">
            </label>`).join('');
        document.querySelectorAll('.physical-count').forEach(input => input.addEventListener('input', updateDifference));
        element('issue-select').value = item.issue;
        element('issue-note').value = item.note;
        const hasIssue = Boolean(item.issue || item.note);
        element('issue-fields').classList.toggle('hidden', !hasIssue);
        element('show-issue-button').setAttribute('aria-expanded', String(hasIssue));
        element('previous-button').disabled = state.index === 0;
        updateProgress(); updateDifference();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
    }

    async function saveCurrent(options) {
        if (state.busy || !currentItem()) return;
        const item = currentItem();
        const physicalCounts = options?.match ? { ...item.expectedCounts } : countInputs();
        if (options?.match) {
            document.querySelectorAll('.physical-count').forEach(input => { input.value = physicalCounts[input.dataset.size] || 0; });
        }
        setBusy(true); setStatus('Guardando…');
        const payload = {
            audit_id: state.audit.id,
            product_id: item.productId,
            equipo: item.product,
            descripcion: item.description,
            imagen: item.image,
            expected_counts: item.expectedCounts,
            physical_counts: physicalCounts,
            issue: element('issue-select').value,
            note: element('issue-note').value.trim(),
            reviewed: true,
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        const { data, error } = await db.from('inventario_auditoria_items')
            .upsert(payload, { onConflict: 'audit_id,product_id' })
            .select('*')
            .single();
        if (error) {
            setBusy(false); setStatus('No guardado');
            element('difference-message').textContent = 'Falló el guardado. Revisa tu conexión y vuelve a intentar.';
            element('difference-message').className = 'difference-message missing';
            return;
        }
        state.items[state.index] = fromDatabaseItem(data);
        setBusy(false); setStatus('Guardado'); updateProgress();
        if (options?.advance !== false) {
            const pending = state.items.findIndex((candidate, index) => index > state.index && !candidate.reviewed);
            state.index = pending >= 0 ? pending : Math.min(state.index + 1, state.items.length - 1);
            if (core.progress(state.items).reviewed === state.items.length) renderSummary();
            else renderCurrent();
        } else updateDifference();
    }

    function summaryRows() {
        return state.items.flatMap(item => core.stockSizes(item.expectedCounts).map(size => ({
            productId: item.productId,
            product: item.product,
            size,
            expected: item.expectedCounts[size] || 0,
            physical: item.physicalCounts[size] || 0,
            issue: item.issue,
            note: item.note,
            reviewed: item.reviewed
        }))).filter(row => row.reviewed && (row.expected !== row.physical || row.issue || row.note));
    }

    function renderSummary() {
        hide('audit-view'); show('summary-view');
        const progress = core.progress(state.items);
        const differences = summaryRows();
        const matching = state.items.filter(item => item.reviewed && core.compareCounts(item.expectedCounts, item.physicalCounts).status === 'match' && !item.issue).length;
        element('summary-totals').innerHTML = `
            <div class="summary-total"><strong>${progress.reviewed}</strong><span>Revisadas</span></div>
            <div class="summary-total"><strong>${matching}</strong><span>Coinciden</span></div>
            <div class="summary-total"><strong>${differences.length}</strong><span>Diferencias</span></div>`;
        element('summary-list').innerHTML = differences.length ? differences.map(row => `
            <div class="summary-item"><strong>${escapeHtml(row.product)} · ${escapeHtml(row.size)}</strong>
            <span>Página ${row.expected} · Físico ${row.physical} · Diferencia ${row.physical - row.expected}</span>
            ${row.issue ? `<span>Novedad: ${escapeHtml(row.issue.replaceAll('_', ' '))}</span>` : ''}
            ${row.note ? `<span>Nota: ${escapeHtml(row.note)}</span>` : ''}</div>`).join('')
            : '<div class="empty-summary">No hay diferencias registradas.</div>';
    }

    function downloadCsv() {
        const blob = new Blob([core.toCsv(summaryRows())], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = `inventario-fisico-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click(); URL.revokeObjectURL(url);
    }

    function searchProduct(query) {
        const normalized = String(query || '').trim().toLowerCase();
        if (!normalized) return;
        const found = state.items.findIndex(item => `${item.productId} ${item.product} ${item.description}`.toLowerCase().includes(normalized));
        if (found >= 0) { state.index = found; renderCurrent(); }
    }

    function bindEvents() {
        element('retry-button').addEventListener('click', () => location.reload());
        element('logout-button').addEventListener('click', async () => { await db.auth.signOut(); location.assign('/login'); });
        element('match-button').addEventListener('click', () => saveCurrent({ match: true }));
        element('save-next-button').addEventListener('click', () => saveCurrent({ advance: true }));
        element('previous-button').addEventListener('click', () => { if (state.index > 0) { state.index -= 1; renderCurrent(); } });
        element('show-issue-button').addEventListener('click', () => {
            const fields = element('issue-fields'); const opening = fields.classList.contains('hidden');
            fields.classList.toggle('hidden', !opening); element('show-issue-button').setAttribute('aria-expanded', String(opening));
        });
        element('product-search').addEventListener('change', event => searchProduct(event.target.value));
        element('product-search').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); searchProduct(event.target.value); } });
        element('show-summary-button').addEventListener('click', renderSummary);
        element('close-summary-button').addEventListener('click', () => { hide('summary-view'); show('audit-view'); renderCurrent(); });
        element('download-csv-button').addEventListener('click', downloadCsv);
    }

    async function init() {
        bindEvents();
        try {
            const { data: { session } } = await db.auth.getSession();
            if (!session) return location.assign('/login?next=/admin-inventario-fisico');
            const products = await loadProductsReadOnly();
            const result = await loadOrCreateActiveAudit(session.user.id, products);
            state.audit = result.audit; state.items = result.items;
            const firstPending = state.items.findIndex(item => !item.reviewed);
            state.index = firstPending >= 0 ? firstPending : 0;
            hide('loading-view'); hide('error-view'); show('audit-view');
            if (!state.items.length) fail('No encontramos referencias para contar.');
            else renderCurrent();
        } catch (error) {
            console.error('Inventory audit init failed', error);
            fail('No pudimos abrir el checklist. Revisa tu conexión y vuelve a intentar.');
        }
    }

    init();
}());
