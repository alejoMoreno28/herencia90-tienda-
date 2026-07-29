from pathlib import Path
from playwright.sync_api import sync_playwright, expect


BASE_URL = "http://127.0.0.1:4173/admin.html"
SCREENSHOT_DIR = Path(".codex-scratch/partner-ledger")
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

FIXTURE_SCRIPT = r"""
(() => {
  const fixture = {
    productos: [
      { id: 1, categoria: 'Selecciones', equipo: 'Argentina', descripcion: 'Local 2026', precio: 90000, costo_usd: 11, tallas: { S: 2, M: 3, L: 1 }, imagenes: [] },
      { id: 2, categoria: 'Clubes', equipo: 'Real Madrid', descripcion: 'Local 2026', precio: 92000, costo_usd: 12, tallas: { M: 1, XL: 2 }, imagenes: [] }
    ],
    transacciones: [
      { id: 1, tipo: 'ingreso', categoria: 'Venta de Producto', fecha: '2026-07-28', monto: 10890000, trm: 3714, costo_usd_asociado: 11, descripcion: 'Ventas acumuladas' },
      { id: 2, tipo: 'gasto', categoria: 'Varios', fecha: '2026-07-28', monto: 5277000, trm: 3714, costo_usd_asociado: 0, descripcion: 'Salidas operativas acumuladas' },
      { id: 3, tipo: 'gasto', categoria: 'Compra Inventario (con Tarjeta)', fecha: '2026-07-28', monto: 2521689, trm: 3714, costo_usd_asociado: 0, descripcion: 'Deuda tarjeta socios' }
    ],
    socios: [
      { id: 1, nombre: 'Camilo', porcentaje: 50, activo: true },
      { id: 2, nombre: 'Alejandro', porcentaje: 50, activo: true }
    ],
    cortes_ganancias: [],
    movimientos_socios: []
  };

  const clone = value => JSON.parse(JSON.stringify(value));
  const builder = table => {
    const result = { data: clone(fixture[table] || []), error: null };
    const chain = {
      select() { return chain; },
      order() { return chain; },
      limit() { return chain; },
      eq() { return chain; },
      gte() { return chain; },
      then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); }
    };
    return chain;
  };

  window.supabase = {
    createClient() {
      return {
        auth: {
          getSession: async () => ({ data: { session: { user: { id: 'fixture-user' } } } }),
          signOut: async () => ({ error: null })
        },
        from: builder,
        rpc: async (name, args) => {
          if (name === 'crear_corte_ganancias') {
            fixture.cortes_ganancias.push({
              id: 10,
              fecha: args.p_fecha,
              monto_aprobado: args.p_monto_aprobado,
              monto_socio_1: args.p_monto_aprobado / 2,
              monto_socio_2: args.p_monto_aprobado / 2,
              estado: 'activo',
              nota: args.p_nota || ''
            });
          }
          return { data: {}, error: null };
        }
      };
    }
  };

  window.Chart = class {
    constructor() {}
    destroy() {}
  };
})();
"""


def block_external(route):
    route.fulfill(status=200, content_type="text/plain", body="")


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
    console_errors = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: console_errors.append(str(error)))
    page.add_init_script(FIXTURE_SCRIPT)
    for pattern in [
        "**/supabase-js@2/**",
        "**/npm/chart.js",
        "**/fonts.googleapis.com/**",
        "**/fonts.gstatic.com/**",
        "**/googletagmanager.com/**",
        "**/google-analytics.com/**",
        "**/datos.gov.co/**"
    ]:
        page.route(pattern, block_external)

    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    expect(page.locator(".partner-hero")).to_be_visible()
    expect(page.get_by_role("heading", name="Primero la tarjeta. Después, la ganancia.")).to_be_visible()
    expect(page.get_by_text("$ 3.091.311", exact=True)).to_be_visible()
    expect(page.locator(".partner-card-name").filter(has_text="Camilo")).to_be_visible()
    expect(page.locator(".partner-card-name").filter(has_text="Alejandro")).to_be_visible()

    page.get_by_role("button", name="Cerrar ganancias").click()
    expect(page.locator("#partner-cut-dialog")).to_be_visible()
    assert page.locator("#partner-cut-amount").input_value() == "3091310"
    page.locator("#partner-cut-dialog").get_by_role("button", name="Aprobar corte").click()
    expect(page.get_by_text("Corte 50/50 aprobado", exact=True)).to_be_visible()

    page.get_by_role("button", name="Sacar camiseta").click()
    expect(page.locator("#partner-product-dialog")).to_be_visible()
    page.locator("#partner-product-id").select_option("1")
    expect(page.locator("#partner-product-size").locator("option")).to_have_count(3)
    page.locator("#partner-product-dialog").get_by_role("button", name="Cancelar").click()

    page.screenshot(path=str(SCREENSHOT_DIR / "desktop.png"), full_page=True)

    page.set_viewport_size({"width": 390, "height": 844})
    page.locator("#partner-ledger-root").scroll_into_view_if_needed()
    page.wait_for_timeout(150)
    overflow = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
    assert not overflow, "The admin page has horizontal overflow on a 390px viewport"
    page.screenshot(path=str(SCREENSHOT_DIR / "mobile.png"), full_page=True)

    unexpected = [
        error for error in console_errors
        if "favicon" not in error.lower() and "analytics" not in error.lower()
    ]
    assert not unexpected, "Browser console errors: " + " | ".join(unexpected)
    browser.close()

print("partner-ledger-browser-ok")
