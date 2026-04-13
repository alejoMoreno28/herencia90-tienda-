-- ============================================================
-- HERENCIA 90 — Nuevas tablas
-- Correr en Supabase > SQL Editor
-- ============================================================

-- 1. Sesiones del bot de Telegram (flujo conversacional)
CREATE TABLE IF NOT EXISTS bot_sessions (
  chat_id    BIGINT PRIMARY KEY,
  state      TEXT    NOT NULL DEFAULT 'idle',
  data       JSONB   NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Limpiar sesiones viejas de más de 24 horas automáticamente
-- (opcional, correr como cron en Supabase Edge Functions si se quiere)
-- DELETE FROM bot_sessions WHERE updated_at < NOW() - INTERVAL '24 hours';


-- 2. Configuración global (TRM, etc.)
CREATE TABLE IF NOT EXISTS configuracion (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

-- Valor inicial de TRM (actualizar manualmente cuando cambie)
INSERT INTO configuracion (clave, valor)
VALUES ('trm', '4000')
ON CONFLICT (clave) DO NOTHING;


-- 3. Analytics de la página web
CREATE TABLE IF NOT EXISTS analytics_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   TEXT        NOT NULL,
  -- 'page_view' | 'modal_open' | 'whatsapp_click' | 'cart_add' | 'checkout'
  product_id   INTEGER,
  product_name TEXT,
  category     TEXT,
  extra        JSONB       DEFAULT '{}',  -- datos adicionales (talla, total, etc.)
  referrer     TEXT,
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para queries del dashboard
CREATE INDEX IF NOT EXISTS idx_analytics_ts      ON analytics_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_type    ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_product ON analytics_events(product_id);

-- RLS: cualquiera puede insertar (web pública), solo autenticados pueden leer
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insert_anon" ON analytics_events
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "select_auth" ON analytics_events
  FOR SELECT TO authenticated USING (true);

-- RLS bot_sessions (solo service_role del bot escribe)
ALTER TABLE bot_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all" ON bot_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- RLS configuracion (service_role escribe, authenticated lee)
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_write_config" ON configuracion
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "auth_read_config" ON configuracion
  FOR SELECT TO authenticated USING (true);
