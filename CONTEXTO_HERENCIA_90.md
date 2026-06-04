# 📖 Documentación de Lotes, Preventas y Stock (Contexto Actualizado)

> **Fecha de la última actualización:** 30 de Mayo de 2026.
> **Propósito de este archivo:** Este documento sirve como punto de partida para que cualquier IA (Codex, Gemini, Claude) entienda el estado actual del sistema, cómo funciona la herramienta de importar lotes y cómo se solucionaron los errores históricos de duplicación de stock.

## 🛠️ Modificaciones Recientes al Código
1. **Fuzzy Matching Corregido:** Se arregló la función `findBestProductMatch` en `admin.html`. Antes era demasiado agresiva y emparejaba camisetas erróneas solo porque compartían palabras comunes (ej. "Mundial"). Ahora exige una coincidencia estricta y limpia, respetando nombres exactos como "España Mundial" o "Colombia Mujer".
2. **Llave Maestra de Base de Datos:** Se descubrió que para realizar tareas administrativas profundas (como restaurar backups masivos de stock), los scripts de Node.js deben usar el `SUPABASE_SERVICE_KEY` en lugar del `SUPABASE_ANON_KEY`, ya que el sistema cuenta con políticas RLS (Row Level Security) que bloqueaban escrituras anónimas silenciosamente.

## 📦 Reglas de Oro para Importar Lotes (El "Truco del Catálogo")

La pantalla de **Ingresar Nuevo Lote** está diseñada financieramente para registrar GASTOS REALES e INVENTARIO FÍSICO. Si se usa mal, inflará el stock virtualmente y registrará millones en gastos falsos.

### Escenario A: Subir "Solo Catálogo" (Camisetas que NO has comprado, solo para mostrar en la web)
1. Pega tu Excel.
2. Haz clic en Procesar.
3. **Pregunta 1:** *"¿Deseas agregar X camisetas nuevas al catálogo?"* -> Haz clic en **SÍ** (esto crea las fotos y títulos en la base de datos).
4. **Pregunta 2:** *"¿Procesar y guardar el lote completo?"* -> Haz clic en **CANCELAR (X)**.
> *Al cancelar, evitas que el sistema sume unidades a tu inventario físico y registre un gasto falso en finanzas.*

### Escenario B: Subir Pedido Real Comprado (Mix de Stock Físico y Preventas reservadas)
1. Pega tu Excel.
2. Haz clic en Procesar.
3. **Pregunta 1:** *"¿Deseas agregar X camisetas nuevas al catálogo?"* -> Haz clic en **SÍ**.
4. **Pregunta 2:** *"¿Procesar y guardar el lote completo?"* -> Haz clic en **SÍ**.
> *El sistema sumará tu stock, descontará las preventas a la lista de pedidos pendientes por cobrar, y registrará el gasto financiero (costo) 1 sola vez.*

## ⚠️ Cómo manejar Cancelaciones de Preventas
Si por accidente se duplica un pedido de preventa, o un amigo cancela su reserva:
- **No borres la fila del Excel ni te compliques.**
- Ve a la pestaña de "Pedidos y Clientes" en el administrador.
- Cancela el pedido desde allí.
- El sistema es inteligente y te preguntará: *"¿Deseas devolver esta unidad al inventario disponible de la web?"*. Al darle "Aceptar", esa unidad pasa a ser Stock libre que cualquiera puede comprar, solucionando el cuadro de caja automáticamente.

## 💾 Backups
- Contamos con un script `backup.js` en `.codex-scratch/` que descarga un JSON completo de la tabla `productos` y `transacciones` y funciona perfectamente.
- **Dato clave para futuras IAs:** Siempre que vayas a tocar el inventario o hacer pruebas masivas de finanzas, ejecuta este script primero. Si necesitas restaurarlo, asegúrate de utilizar el Supabase Service Key desde el `.env`.

---
*Si eres una IA leyendo esto en el futuro, ya tienes todo el contexto necesario. ¡Ayuda a Alejo a seguir expandiendo Herencia 90 sin romper el stock!*
