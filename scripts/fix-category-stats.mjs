import { readFileSync, writeFileSync } from 'fs';
import { readdirSync } from 'fs';

const BASE = 'C:/Users/PC/Desktop/HERENCIA90';
const dir = `${BASE}/web/categorias`;
const files = readdirSync(dir).filter(f => f.endsWith('.html'));

for (const file of files) {
  let h = readFileSync(`${dir}/${file}`, 'utf8');
  let changed = false;

  // 1. Fix Bogota -> Medellin
  if (h.includes('Bogota') || h.includes('Bogotá')) {
    h = h.replaceAll('Bogota', 'Medellin').replaceAll('Bogotá', 'Medellín');
    changed = true;
  }

  // 2. Remove hardcoded "10 unidades" stat box and "2 x 180" stat box
  // Replace the two hardcoded stat boxes with a single dynamic stock box
  const badStats = `        <div class="stat-box">
          <strong class="stat-number">10</strong>
          <span>unidades visibles en stock</span>
        </div>
        <div class="stat-box">
          <strong class="stat-number">2 x 180</strong>
          <span>promo vigente para impulsar ticket promedio</span>
        </div>`;

  const goodStats = `        <div class="stat-box">
          <strong class="stat-number" id="collectionStock">—</strong>
          <span>unidades en stock</span>
        </div>
        <div class="stat-box">
          <strong class="stat-number">Medellín</strong>
          <span>stock fisico, envio a toda Colombia</span>
        </div>`;

  if (h.includes(badStats)) {
    h = h.replace(badStats, goodStats);
    changed = true;
  }

  // 3. Add stock calculation to renderCollectionProducts JS function
  // Find the line that sets collectionCount and add stock calc after it
  const oldCountLine = `document.getElementById('collectionCount').textContent = safeProducts.length;`;
  const newCountLine = `document.getElementById('collectionCount').textContent = safeProducts.length;
      const totalStock = safeProducts.reduce((sum, p) => {
        return sum + Object.values(p.tallas || {}).reduce((s, q) => s + Number(q || 0), 0);
      }, 0);
      const stockEl = document.getElementById('collectionStock');
      if (stockEl) stockEl.textContent = totalStock > 0 ? totalStock : 'Consultar';`;

  if (h.includes(oldCountLine) && !h.includes('collectionStock')) {
    h = h.replace(oldCountLine, newCountLine);
    changed = true;
  }

  // 4. Also calculate stock from static collection on initial load (before Supabase)
  // Add after the renderCollectionProducts call at the end
  const oldInit = `trackCollectionPage();
    refreshCollectionFromSupabase();`;
  const newInit = `// Mostrar stock estatico inmediatamente mientras carga Supabase
    const initStock = (STATIC_COLLECTION.products || []).reduce((sum, p) => {
      return sum + Object.values(p.tallas || {}).reduce((s, q) => s + Number(q || 0), 0);
    }, 0);
    const initStockEl = document.getElementById('collectionStock');
    if (initStockEl) initStockEl.textContent = initStock > 0 ? initStock : 'Consultar';

    trackCollectionPage();
    refreshCollectionFromSupabase();`;

  if (h.includes(oldInit) && !h.includes('initStock')) {
    h = h.replace(oldInit, newInit);
    changed = true;
  }

  if (changed) {
    writeFileSync(`${dir}/${file}`, h, 'utf8');
    console.log('Fixed:', file);
  } else {
    console.log('Skip:', file);
  }
}
