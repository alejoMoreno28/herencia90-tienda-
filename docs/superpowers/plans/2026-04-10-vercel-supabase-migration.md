# Herencia 90 — Migración Vercel + Supabase

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar la app de Python server + JSON files a Vercel (hosting estático) + Supabase (base de datos), sin cambiar nada del aspecto visual ni la funcionalidad.

**Architecture:** El servidor Python se elimina completamente. Los HTML/CSS/JS se sirven desde Vercel como archivos estáticos. Las transacciones y el inventario se guardan en tablas de Supabase PostgreSQL via el SDK JS cargado desde CDN. Las imágenes de productos se guardan en Supabase Storage.

**Tech Stack:** Vercel (static hosting), Supabase JS SDK v2 (CDN), PostgreSQL (Supabase), Supabase Storage (imágenes), Supabase Auth (login)

---

## Pre-requisitos manuales (el usuario hace esto una vez antes de ejecutar el plan)

1. Crear cuenta en https://supabase.com (gratis)
2. Crear nuevo proyecto → anotar:
   - `Project URL` (ej: `https://xxxx.supabase.co`)
   - `anon public key` (en Settings → API)
3. Ejecutar el siguiente SQL en el SQL Editor de Supabase:

```sql
-- Tabla de transacciones financieras
CREATE TABLE transacciones (
  id BIGINT PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'gasto')),
  categoria TEXT NOT NULL,
  fecha DATE NOT NULL,
  monto NUMERIC NOT NULL,
  usd_amount NUMERIC DEFAULT 0,
  trm NUMERIC DEFAULT 3714,
  descripcion TEXT DEFAULT '',
  costo_usd_asociado NUMERIC DEFAULT 0
);

-- Tabla de productos/inventario
CREATE TABLE productos (
  id INTEGER PRIMARY KEY,
  categoria TEXT NOT NULL DEFAULT 'Colección 2026',
  equipo TEXT NOT NULL DEFAULT 'Nuevo',
  descripcion TEXT DEFAULT '',
  precio NUMERIC NOT NULL DEFAULT 99000,
  costo_usd NUMERIC DEFAULT 10.44,
  tallas JSONB DEFAULT '{"S":0,"M":0,"L":0,"XL":0}',
  imagenes TEXT[] DEFAULT '{}'
);

-- RLS: transacciones solo para usuario autenticado
ALTER TABLE transacciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_full" ON transacciones FOR ALL USING (auth.role() = 'authenticated');

-- RLS: productos — lectura pública, escritura solo autenticado
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON productos FOR SELECT USING (true);
CREATE POLICY "auth_write" ON productos FOR ALL USING (auth.role() = 'authenticated');
```

4. Crear bucket de imágenes en Supabase Storage:
   - Storage → New bucket → nombre: `product-images` → marcar "Public bucket"

5. Crear usuario admin en Supabase Auth:
   - Authentication → Users → Add user
   - Email: `admin@herencia90.co` (o cualquier email tuyo)
   - Password: `herencia2026` (o la que quieras)

6. Migrar datos existentes — ejecutar en SQL Editor (ajustar según el finanzas.json actual):
```sql
INSERT INTO transacciones (id, tipo, categoria, fecha, monto, usd_amount, trm, descripcion, costo_usd_asociado)
VALUES
  (1774968510952, 'ingreso', 'Inversión Inicial de Socios', '2026-03-31', 2197201, 591.6, 3714.0, 'Fondo común base para arrancar la marca.', 0),
  (1774968510953, 'gasto', 'Compra Inventario (Camisetas)', '2026-03-31', 2197201, 591.6, 3714.0, 'Factura Inicial Proveedor (USD $591.6 a TRM exacto de 3714.0 COP).', 0);
```

7. Crear cuenta en https://vercel.com (gratis), conectar con GitHub

---

## Archivos que se tocan

| Archivo | Acción | Qué cambia |
|---|---|---|
| `web/login.html` | Modificar | Reemplaza `/api/login` con Supabase Auth |
| `web/admin.html` | Modificar | Reemplaza todos los `fetch('/api/...')` con SDK Supabase |
| `web/js/app.js` | Modificar | Reemplaza `fetch('productos.json')` con Supabase query |
| `vercel.json` | Crear | Configura routing de Vercel |
| `scripts/server.py` | NO tocar | Se deja como está (ya no se usa en producción) |
| `web/css/`, `web/img/` | NO tocar | Sin cambios |
| `web/index.html` | NO tocar | Sin cambios (app.js lo maneja) |

---

## Task 1: Crear vercel.json

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Crear vercel.json en la raíz del proyecto**

```json
{
  "version": 2,
  "builds": [
    {
      "src": "web/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    { "src": "/", "dest": "/web/index.html" },
    { "src": "/admin", "dest": "/web/admin.html" },
    { "src": "/admin.html", "dest": "/web/admin.html" },
    { "src": "/login", "dest": "/web/login.html" },
    { "src": "/login.html", "dest": "/web/login.html" },
    { "src": "/(.*)", "dest": "/web/$1" }
  ]
}
```

- [ ] **Step 2: Commit**
```bash
git add vercel.json
git commit -m "feat: agregar vercel.json para hosting estático"
```

---

## Task 2: Actualizar login.html — Supabase Auth

**Files:**
- Modify: `web/login.html`

El login actual llama a `/api/login` (Python server). Lo reemplazamos por `supabase.auth.signInWithPassword()`. El diseño visual no cambia en absoluto — solo cambia el script.

- [ ] **Step 1: Agregar SDK de Supabase antes del `</head>` en login.html**

Agregar justo antes de `</head>`:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

- [ ] **Step 2: Reemplazar el bloque `<script>` al final de login.html**

Reemplazar todo el `<script>` existente (desde `// Si ya hay token...` hasta el cierre) con:

```html
<script>
    const SUPABASE_URL = 'TU_PROJECT_URL_AQUI';
    const SUPABASE_ANON_KEY = 'TU_ANON_KEY_AQUI';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Si ya hay sesión activa, redirigir directo al admin
    supabase.auth.getSession().then(({ data }) => {
        if (data.session) window.location.href = '/admin.html';
    });

    const form = document.getElementById('loginForm');
    const errorMsg = document.getElementById('error-msg');
    const submitBtn = document.getElementById('submitBtn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMsg.style.display = 'none';
        submitBtn.innerText = 'Verificando...';

        const email = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const remember = document.getElementById('remember').checked;

        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (!error) {
            window.location.href = '/admin.html';
        } else {
            errorMsg.innerText = 'Credenciales incorrectas.';
            errorMsg.style.display = 'block';
            submitBtn.innerText = 'Ingresar al Panel';
        }
    });
</script>
```

Nota: El campo "Usuario" ahora espera un email (ej: `admin@herencia90.co`). El label en HTML dice "Usuario" — cambiar solo el label a "Email" para claridad:
- Línea `<label for="username">Usuario</label>` → `<label for="username">Email</label>`

- [ ] **Step 3: Commit**
```bash
git add web/login.html
git commit -m "feat: login via Supabase Auth reemplaza /api/login"
```

---

## Task 3: Actualizar admin.html — Supabase Auth check

**Files:**
- Modify: `web/admin.html`

- [ ] **Step 1: Agregar SDK de Supabase antes de `</head>` en admin.html**

Agregar justo antes del cierre `</head>`:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

- [ ] **Step 2: Reemplazar el bloque `<script>` de auth al inicio del `<body>` en admin.html**

El bloque actual (líneas 110-116):
```html
<script>
    const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
    if (!token) { window.location.href = '/login.html'; }
    const authHeaders = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
    
    let GLOBAL_TRM = 3714.0;
</script>
```

Reemplazar con:
```html
<script>
    const SUPABASE_URL = 'TU_PROJECT_URL_AQUI';
    const SUPABASE_ANON_KEY = 'TU_ANON_KEY_AQUI';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Verificar sesión — redirigir si no está autenticado
    supabase.auth.getSession().then(({ data }) => {
        if (!data.session) window.location.href = '/login.html';
    });

    let GLOBAL_TRM = 3714.0;
</script>
```

- [ ] **Step 3: Actualizar función `logout()` en admin.html**

Encontrar:
```javascript
function logout() { localStorage.clear(); sessionStorage.clear(); window.location.href='/login.html'; }
```

Reemplazar con:
```javascript
async function logout() { await supabase.auth.signOut(); window.location.href='/login.html'; }
```

- [ ] **Step 4: Commit**
```bash
git add web/admin.html
git commit -m "feat: auth admin via Supabase Session reemplaza localStorage token"
```

---

## Task 4: Actualizar admin.html — Finanzas con Supabase

**Files:**
- Modify: `web/admin.html`

- [ ] **Step 1: Reemplazar función `init()` — carga de datos desde Supabase**

Encontrar la función `init()` actual:
```javascript
async function init() {
    await fetchTRM();
    try {
        const r1 = await fetch('/productos.json?v=' + Date.now());
        if(r1.ok) productData = await r1.json();
        
        const r2 = await fetch('/finanzas.json?v=' + Date.now());
        if(r2.ok) financeData = await r2.json();

        renderInventory();
        renderFinance();
        calculateInventoryValuation();
    } catch(e) { console.error(e); }
}
```

Reemplazar con:
```javascript
async function init() {
    await fetchTRM();
    try {
        const { data: prods } = await supabase.from('productos').select('*').order('id');
        if (prods) productData = prods;

        const { data: trans } = await supabase.from('transacciones').select('*').order('fecha', { ascending: false });
        if (trans) financeData.transacciones = trans;

        renderInventory();
        renderFinance();
        calculateInventoryValuation();
    } catch(e) { console.error(e); }
}
```

- [ ] **Step 2: Reemplazar función `saveFinance()`**

Encontrar:
```javascript
async function saveFinance() {
    try {
        const res = await fetch('/api/finance/save', { method: 'POST', headers: authHeaders, body: JSON.stringify(financeData) });
        if((await res.json()).status === 'success') showToast("Finanzas guardadas");
    } catch(e) { alert("Error de red"); }
}
```

Reemplazar con:
```javascript
async function saveFinance(newTrans) {
    try {
        const { error } = await supabase.from('transacciones').upsert(newTrans);
        if (!error) showToast("Finanzas guardadas");
        else { console.error(error); alert("Error guardando transacción"); }
    } catch(e) { alert("Error de red"); }
}
```

- [ ] **Step 3: Actualizar función `addTransaction()` para pasar la transacción a `saveFinance`**

Encontrar al final de `addTransaction()`:
```javascript
financeData.transacciones.push(trans);
financeData.transacciones.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
await saveFinance();
```

Reemplazar con:
```javascript
const { data: saved, error } = await supabase.from('transacciones').insert(trans).select().single();
if (error) { alert("Error guardando: " + error.message); return; }
financeData.transacciones.push(saved);
financeData.transacciones.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
showToast("Finanzas guardadas");
```

- [ ] **Step 4: Actualizar función `delTrans()`**

Encontrar:
```javascript
async function delTrans(id) {
    if(!confirm("¿Borrar transacción?")) return;
    financeData.transacciones = financeData.transacciones.filter(t => t.id !== id);
    await saveFinance(); renderFinance();
}
```

Reemplazar con:
```javascript
async function delTrans(id) {
    if(!confirm("¿Borrar transacción?")) return;
    const { error } = await supabase.from('transacciones').delete().eq('id', id);
    if (error) { alert("Error borrando"); return; }
    financeData.transacciones = financeData.transacciones.filter(t => t.id !== id);
    renderFinance();
    showToast("Transacción eliminada");
}
```

- [ ] **Step 5: Commit**
```bash
git add web/admin.html
git commit -m "feat: finanzas — leer/escribir transacciones en Supabase"
```

---

## Task 5: Actualizar admin.html — Inventario con Supabase

**Files:**
- Modify: `web/admin.html`

- [ ] **Step 1: Reemplazar función `saveInventory()`**

Encontrar:
```javascript
async function saveInventory(s=false) {
    const b=document.getElementById('globalSaveBtn'); if(!s) b.innerText='...';
    const res = await fetch('/api/save', { method:'POST', headers:authHeaders, body:JSON.stringify(productData) });
    if(!s) { b.innerText='Guardar Inventario Completo'; if((await res.json()).status==='success') showToast('Inventario Editado'); }
}
```

Reemplazar con:
```javascript
async function saveInventory(silent=false) {
    const b = document.getElementById('globalSaveBtn');
    if (!silent) b.innerText = '...';
    const { error } = await supabase.from('productos').upsert(productData);
    if (!silent) {
        b.innerText = 'Guardar Inventario Completo';
        if (!error) showToast('Inventario Editado');
        else { console.error(error); alert("Error guardando inventario"); }
    }
}
```

- [ ] **Step 2: Actualizar función `addProduct()` para usar Supabase insert**

Encontrar:
```javascript
function addProduct() {
    const mx = productData.length ? Math.max(...productData.map(p=>p.id)) : 0;
    productData.unshift({ id:mx+1, categoria:CATEGORIAS_INV[0]||'Nueva', equipo:'Nuevo', descripcion:'', precio:99000, costo_usd:10.44, tallas:{S:0,M:0,L:0,XL:0}, imagenes:[] });
    renderInventory(); saveInventory(true);
}
```

Reemplazar con:
```javascript
async function addProduct() {
    const mx = productData.length ? Math.max(...productData.map(p=>p.id)) : 0;
    const newP = { id:mx+1, categoria:CATEGORIAS_INV[0]||'Nueva', equipo:'Nuevo', descripcion:'', precio:99000, costo_usd:10.44, tallas:{S:0,M:0,L:0,XL:0}, imagenes:[] };
    const { error } = await supabase.from('productos').insert(newP);
    if (error) { alert("Error creando producto"); return; }
    productData.unshift(newP);
    renderInventory();
}
```

- [ ] **Step 3: Actualizar función `delP()` para usar Supabase delete**

Encontrar:
```javascript
function delP(i) { if(confirm('Borrar?')){ productData.splice(i,1); renderInventory(); saveInventory(true); } }
```

Reemplazar con:
```javascript
async function delP(i) {
    if (!confirm('Borrar?')) return;
    const id = productData[i].id;
    const { error } = await supabase.from('productos').delete().eq('id', id);
    if (error) { alert("Error borrando producto"); return; }
    productData.splice(i,1);
    renderInventory();
}
```

- [ ] **Step 4: Commit**
```bash
git add web/admin.html
git commit -m "feat: inventario — leer/escribir productos en Supabase"
```

---

## Task 6: Actualizar admin.html — Imágenes con Supabase Storage

**Files:**
- Modify: `web/admin.html`

Las imágenes actualmente se guardan en `/web/img/` via `/api/upload`. Con Supabase Storage, se suben al bucket `product-images` y se guarda la URL pública.

- [ ] **Step 1: Reemplazar función `addImg()`**

Encontrar:
```javascript
async function addImg(e, pI) {
    const f = e.target.files[0]; if(!f)return;
    const r = new FileReader();
    r.onload = async(ev) => {
        const res = await fetch('/api/upload', { method:'POST', headers:authHeaders, body:JSON.stringify({filename:f.name.replace(/\s+/g,'_'), data:ev.target.result}) });
        const d = await res.json();
        if(d.status==='success') { productData[pI].imagenes.push(d.filepath); renderInventory(); saveInventory(true); }
    }; r.readAsDataURL(f);
}
```

Reemplazar con:
```javascript
async function addImg(e, pI) {
    const f = e.target.files[0]; if (!f) return;
    const filename = `${Date.now()}_${f.name.replace(/\s+/g,'_')}`;
    const { data, error } = await supabase.storage.from('product-images').upload(filename, f, { upsert: true });
    if (error) { alert("Error subiendo imagen: " + error.message); return; }
    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(filename);
    productData[pI].imagenes.push(urlData.publicUrl);
    renderInventory();
    await saveInventory(true);
}
```

- [ ] **Step 2: Actualizar función `rmImg()` — también borrar del storage**

Encontrar:
```javascript
function rmImg(pI, iI) { productData[pI].imagenes.splice(iI,1); renderInventory(); saveInventory(true); }
```

Reemplazar con:
```javascript
async function rmImg(pI, iI) {
    const url = productData[pI].imagenes[iI];
    // Extraer filename del URL de Supabase para borrar del storage
    const filename = url.split('/product-images/')[1];
    if (filename) await supabase.storage.from('product-images').remove([filename]);
    productData[pI].imagenes.splice(iI,1);
    renderInventory();
    await saveInventory(true);
}
```

Nota: La función ahora es `async`, actualizar el onclick en el template HTML del inventario también. Buscar:
```javascript
`<span class="remove-img" onclick="rmImg(${i},${ix})">x</span>`
```
No necesita cambio en la llamada, solo la función ya es async — funciona igual.

- [ ] **Step 3: Commit**
```bash
git add web/admin.html
git commit -m "feat: imágenes via Supabase Storage reemplaza /api/upload"
```

---

## Task 7: Actualizar app.js — Catálogo público desde Supabase

**Files:**
- Modify: `web/js/app.js`
- Modify: `web/index.html` (solo agregar el SDK script)

- [ ] **Step 1: Agregar SDK de Supabase en index.html**

En `web/index.html`, agregar antes del `<script src="js/app.js">`:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

- [ ] **Step 2: Agregar constantes de Supabase al inicio de app.js**

Al inicio del archivo `web/js/app.js`, antes de cualquier otra línea, agregar:
```javascript
const SUPABASE_URL = 'TU_PROJECT_URL_AQUI';
const SUPABASE_ANON_KEY = 'TU_ANON_KEY_AQUI';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

- [ ] **Step 3: Buscar la carga de productos en app.js y reemplazarla**

Encontrar el `fetch('productos.json')` en app.js (línea ~176):
```javascript
fetch('productos.json')
```

Ver el contexto exacto con Read y reemplazar esa llamada con:
```javascript
supabase.from('productos').select('*').order('id')
  .then(({ data }) => {
    if (data) {
      // aquí va el mismo código que procesaba los datos del fetch original
    }
  });
```

El procesamiento interno no cambia — solo la fuente de datos pasa de `fetch` a `supabase.from`.

- [ ] **Step 4: Commit**
```bash
git add web/index.html web/js/app.js
git commit -m "feat: catálogo público carga productos desde Supabase"
```

---

## Task 8: Sembrar productos en Supabase (migración de datos)

**Files:**
- Solo ejecutar SQL en Supabase

- [ ] **Step 1: Exportar productos actuales a SQL**

Leer `web/productos.json` completo y generar el INSERT SQL para pegarlo en el SQL Editor de Supabase. Cada producto del JSON se convierte en una fila.

Formato:
```sql
INSERT INTO productos (id, categoria, equipo, descripcion, precio, costo_usd, tallas, imagenes)
VALUES
  (1, 'Colección 2026', 'Camiseta local Alemania 26', 'descripcion...', 99000, 10.44, '{"S":0,"M":1,"L":0,"XL":0}', ARRAY['img/camiseta1.webp']),
  -- ... resto de productos
;
```

- [ ] **Step 2: Ejecutar el SQL en Supabase Dashboard → SQL Editor**

- [ ] **Step 3: Verificar en Table Editor que todos los productos aparecen**

---

## Task 9: Deploy a Vercel

- [ ] **Step 1: Instalar Vercel CLI (si no está instalado)**
```bash
npm i -g vercel
```

- [ ] **Step 2: Conectar el proyecto**
```bash
cd c:/Users/PC/Desktop/HERENCIA90
vercel
```
Seguir el wizard: link to existing project o crear nuevo. Root directory: `.` (la raíz).

- [ ] **Step 3: Verificar que el sitio carga en la URL de preview**

- [ ] **Step 4: Deploy a producción**
```bash
vercel --prod
```

- [ ] **Step 5: Verificar las 4 rutas principales**
- `/` → catálogo de camisetas
- `/login.html` → login funciona con el email de Supabase Auth
- `/admin.html` → redirige al login si no hay sesión
- Admin → Finanzas: agregar transacción, verificar que aparece después de recargar
- Admin → Inventario: editar stock, guardar, verificar después de recargar

---

## Notas de Seguridad

- La `anon key` de Supabase es segura para exponer en el frontend — está diseñada para eso.
- Las políticas RLS (Row Level Security) garantizan que el catálogo público solo puede leer productos, no escribir.
- Las transacciones solo son accesibles para usuarios autenticados via Supabase Auth.
- El servidor Python (`scripts/server.py`) queda en el repositorio como respaldo local pero no se usa en producción.
