-- ============================================================
-- HERENCIA 90 — Tabla de Pedidos y Clientes de Confianza
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Proyecto: nlnrdtcgbdkzfzwnsffp
-- ============================================================

-- 1. CREACIÓN DE LA TABLA pedidos
-- ============================================================
CREATE TABLE IF NOT EXISTS pedidos (
  id              BIGSERIAL   PRIMARY KEY,
  cliente         TEXT        NOT NULL, -- Nombre del amigo o cliente de confianza
  canal           TEXT        NOT NULL CHECK (canal IN ('WhatsApp', 'Facebook', 'Instagram', 'Amigos/Confianza', 'Otro')),
  producto_id     INTEGER     REFERENCES productos(id) ON DELETE SET NULL, -- Enlace físico al catálogo de productos
  equipo          TEXT        NOT NULL, -- Nombre de respaldo de la camiseta (ej: "Camiseta Alemania 2026")
  talla           TEXT        NOT NULL,
  cantidad        INTEGER     NOT NULL DEFAULT 1,
  precio_venta    NUMERIC     NOT NULL DEFAULT 99000, -- Lo que el cliente va a pagar
  costo_usd       NUMERIC     NOT NULL DEFAULT 10.44, -- Costo unitario FOB
  costo_landed_cop NUMERIC    NOT NULL, -- Costo final en pesos (costo_usd * TRM)
  trm             NUMERIC     NOT NULL DEFAULT 3714, -- TRM del lote de compra
  estado_pago     TEXT        NOT NULL DEFAULT 'Pendiente' CHECK (estado_pago IN ('Pendiente', 'Pagado', 'Abonado')),
  abono           NUMERIC     NOT NULL DEFAULT 0, -- Por si dejan adelanto
  estado_entrega  TEXT        NOT NULL DEFAULT 'Pendiente' CHECK (estado_entrega IN ('Pendiente', 'Entregado')),
  fecha_pedido    DATE        NOT NULL DEFAULT CURRENT_DATE,
  fecha_entrega   DATE,
  nota            TEXT        DEFAULT '',
  lote_codigo     TEXT        -- Identificador del lote de compra (ej: "Lote Mayo 2026")
);

-- Índices para optimizar consultas del panel CRM
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos (cliente);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos (estado_pago, estado_entrega);
CREATE INDEX IF NOT EXISTS idx_pedidos_lote ON pedidos (lote_codigo);

-- 2. HABILITAR SEGURIDAD A NIVEL DE FILA (RLS)
-- ============================================================
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

-- Drop de políticas previas si existen (idempotente)
DROP POLICY IF EXISTS "auth_full_pedidos" ON pedidos;

-- El administrador autenticado tiene control total sobre esta tabla
CREATE POLICY "auth_full_pedidos" 
  ON pedidos FOR ALL 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- ============================================================
-- VERIFICACIÓN:
-- Correr esto en el SQL Editor para comprobar que la tabla existe:
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'pedidos';
-- ============================================================
