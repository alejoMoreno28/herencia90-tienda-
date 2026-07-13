# Plan comercial de 90 días para HERENCIA90

Fecha de corte: 13 de julio de 2026
Objetivo: convertir `herencia90.shop` en el centro de venta y medición de la marca, con WhatsApp como soporte, inventario controlado y crecimiento sin comprometer caja ni confianza.

## Decisiones ejecutivas

1. No migrar a Shopify durante este ciclo de 90 días. La web estática, Supabase y el admin ya cubren catálogo, stock, pedidos y contenido. Migrar ahora consumiría tiempo antes de demostrar que la plataforma actual limita ventas.
2. Mantener `herencia90.shop` como llamada principal. WhatsApp como soporte, no como sustituto permanente de la ficha, la talla, el precio o las políticas.
3. No activar Wompi todavía. El código debe permanecer con `WOMPI_ENABLED=false` hasta cerrar identidad del comercio, operación y pruebas de sandbox.
4. No comprar un lote grande por la emoción del Mundial. El impulso puede diluirse después de julio. El siguiente compromiso recomendado es un piloto de 30 unidades y una reserva de 20 únicamente para ganadores.
5. No competir por ser la opción más barata. HERENCIA90 debe vender selección, nostalgia, evidencia de calidad, talla clara y una compra transparente.
6. Tomar fotos propias de todas las referencias con stock y de los productos que concentren pauta. Las fotos del proveedor quedan como apoyo para bajo pedido, identificadas y sujetas a aprobación previa.
7. Publicar dos videos diarios durante 30 días. El contenido debe llevar a la web, medir intención y crear suficiente señal antes de pautar.

## Qué ya queda resuelto en la base local

- Protección de las APIs administrativas, sesiones y cargas remotas.
- Precios y disponibilidad validados contra el catálogo confiable durante checkout.
- Edición de inventario precisa, confirmaciones, bloqueo de sobrescrituras y guardado de cambios reales.
- Consentimiento previo para analítica y eventos normalizados sin datos personales.
- Páginas públicas de privacidad, envíos, cambios, devoluciones y términos.
- SEO técnico con páginas de producto vendible, sitemap, datos estructurados y exclusión de reservas de stock.
- Revisión de pedido accesible y segura por WhatsApp, sin afirmar que un pedido está pagado.
- Preparación aislada de Wompi con firma, webhook, idempotencia, rollback y runbook. No se ejecutó una migración ni se activó producción.

## Necesidades que no se deben inventar

- Needs confirmation: identidad legal, NIT y dirección del responsable de la tienda.
- Needs confirmation: costo puesto en Medellín por referencia, incluyendo TRM, flete, impuestos, empaque, merma y cambios.
- Needs confirmation: tiempos y tarifas reales de envío por ciudad.
- Needs confirmation: relación jurídica con marcas, escudos, nombres, dorsales y parches. No usar `oficial`, `original`, `auténtica` o `licenciada` sin soporte documental.
- Needs confirmation: cuenta Wompi, llaves de sandbox y producción, cuenta bancaria y responsable de conciliación.
- Needs confirmation: historial completo de pedidos pagados, devoluciones y ventas por talla. La muestra local anterior es pequeña.

## Fase 1 - días 1 a 30: medir y demostrar

### Catálogo e inventario

- Ejecutar el piloto de `docs/PILOTO_INVENTARIO.csv` solo después de aprobar las muestras y confirmar el costo puesto en Medellín.
- Comprometer 30 unidades y conservar caja equivalente a 20 unidades. La reserva no se compra por anticipado.
- Mantener como núcleo Colombia 2026, Colombia retro, Colombia mujer, Real Madrid 26/27 y Barcelona 26/27.
- Probar México 2026, Japón 2026 y Atlético Nacional con una sola muestra. No subir ni comprar lote antes de la aprobación visual y física.
- Dejar referencias nicho como bajo pedido hasta registrar al menos tres solicitudes calificadas o dos ventas pagadas.

### Contenido

- Ejecutar las 60 piezas de `docs/CONTENIDO_30_DIAS.csv` a las 3:00 p. m. y 8:00 p. m.
- Reutilizar el mismo material en TikTok e Instagram Reels, adaptando texto y portada sin publicar marcas de agua cruzadas.
- Publicar historias diarias con talla real, preparación de pedido, preguntas y enlaces al producto.
- No medir éxito por seguidores. Medir visitas a producto, selección de talla, inicio de checkout y pedido validado.

### Fotografía

- Fotografiar primero las once referencias del piloto y todo producto con stock.
- Seguir `docs/GUIA_FOTOS_PRODUCTO.md` y conservar color, proporción, textura y defectos reales.
- No editar escudos, costuras o estampados para hacerlos ver mejor de lo que son.

### Tráfico y SEO

- SEO no es publicidad pagada. El SEO mejora la posibilidad de aparecer de forma orgánica; Google Ads compra clics.
- Dar de alta el dominio y sitemap en Google Search Console cuando el usuario autorice acceso a la cuenta.
- Revisar semanalmente páginas indexadas, consultas, clics y productos sin impresiones.
- Publicar una pieza útil por semana: guía de talla, cuidado, historia de una camiseta o cómo funciona bajo pedido.
- No pagar campañas amplias durante los primeros 30 días. Primero se necesita una línea base limpia.

### Meta de salida de fase

- 60 videos publicados.
- Al menos 500 sesiones calificadas en 30 días.
- Al menos 20 eventos `begin_checkout` o diez pedidos validados.
- Tasa de selección de talla superior al 12% de las vistas de producto.
- Costo puesto en Medellín completo para cada SKU del piloto.
- Cero diferencias entre stock físico y stock del admin en el conteo semanal.

Si la meta no se cumple, no se pauta todavía. Se corrigen producto, oferta, fotos, talla y contenido.

## Fase 2 - días 31 a 60: invertir solo donde existe intención

### Reposición

- Liberar la reserva únicamente cuando una referencia alcance el trigger definido en `PILOTO_INVENTARIO.csv` y mantenga el margen objetivo.
- Reponer M y L primero en unisex, sin abandonar XL. Mantener la mezcla piloto como punto de partida, no como verdad permanente.
- Recalcular la mezcla cada 20 ventas pagadas por corte. Las devoluciones por talla cuentan como señal negativa.
- Descontinuar o pasar a bajo pedido cualquier SKU sin venta, sin selección de talla y con menos de tres consultas en 30 días.

### Pauta de Meta

- Iniciar únicamente si hay al menos 500 sesiones calificadas y 20 inicios de checkout en los 30 días anteriores.
- Piloto: COP 20.000 diarios durante 14 días, solo retargeting de visitantes y personas que interactuaron con video.
- Creativos: prueba real de calidad, producto puesto y stock por talla. No usar un descuento falso como primer argumento.
- Detener un anuncio si gasta el margen de contribución de una venta sin generar una compra validada.

### Google Ads

- Iniciar únicamente después de diez pedidos validados y páginas con stock, talla, envío y políticas claras.
- Piloto: COP 20.000 diarios durante 14 días en búsquedas de alta intención y concordancia cerrada.
- Separar campañas de `Colombia 2026`, `camisetas retro Colombia` y marcas o equipos con stock real.
- Excluir búsquedas de `gratis`, `mayorista`, `original oficial` cuando la oferta no corresponda y modelos fuera de catálogo.
- No comprar tráfico para páginas agotadas ni para referencias que aún necesitan muestra.

### Meta de salida de fase

- Conversión de sesión a pedido validado de 1% o más.
- Conversión de `begin_checkout` a pedido validado de 20% o más.
- Margen de contribución positivo después de pasarela, empaque, envío subsidiado y pauta.
- Al menos tres SKUs con reposición justificada y dos SKUs pasados a bajo pedido.

## Fase 3 - días 61 a 90: automatizar y decidir plataforma

### Operación

- Conciliar semanalmente pedidos, pagos, stock y devoluciones.
- Crear un tablero mensual con ventas netas, margen de contribución, rotación por SKU y días de inventario.
- Activar recordatorios de recompra solo con consentimiento y sin incluir datos personales en analítica.
- Preparar Wompi en sandbox cuando todos los controles de la siguiente sección estén cerrados.

### Gate de Wompi

No cambiar `WOMPI_ENABLED=false` hasta demostrar:

1. Identidad legal, NIT, dirección y datos de contacto publicados donde corresponda.
2. Tarifa y plazo de envío conocidos antes de pagar.
3. Pedido persistido en servidor con referencia única, monto y moneda confiables.
4. Reserva de stock atómica y liberación ante expiración o rechazo.
5. Firma de checkout calculada en servidor y secreto fuera del navegador.
6. Webhook validado, idempotente y fuente de verdad del pago.
7. Conciliación, reembolso y atención de contracargos con responsable definido.
8. Pruebas de sandbox aprobada, rechazada, duplicada, monto alterado y webhook tardío.

La tarifa pública usada para modelar el piso es 2,65% + COP 700 + IVA por transacción exitosa. Debe confirmarse de nuevo antes de activar producción.

### Cuándo reconsiderar Shopify

Reabrir la decisión solo si ocurre una de estas condiciones durante dos meses consecutivos:

- Más de 120 pedidos mensuales.
- Más de 500 variantes activas y errores frecuentes de sincronización.
- Más de ocho horas semanales consumidas en tareas manuales de operación que Shopify resolvería.
- Necesidad real de sincronizar tienda, marketplaces y punto físico.
- Pérdida de conversión demostrada en el checkout actual después de activar pagos y corregir confianza, velocidad y móvil.

Si no ocurre una condición, mantener la arquitectura actual y seguir invirtiendo en producto, prueba social y distribución.

## Política de precios

La tabla operativa es `docs/PRECIOS_MARGENES.csv`.

La decisión nunca sale solo de `costo_usd`. Para cada referencia:

```text
costo_puesto_en_medellin = producto_en_COP + flete + impuestos + empaque + merma_esperada + costo_de_cambios
contribucion = precio - costo_puesto_en_medellin - pasarela - subsidio_envio - pauta_atribuida
contribucion_pct = contribucion / precio
```

- Fan core: objetivo inicial de contribución de 45% antes de gastos fijos.
- Especial y retro: objetivo inicial de 45%, respaldado por evidencia de calidad e historia.
- Entrada Colombia a COP 79.000: no pautar ni descontar hasta confirmar que conserva al menos 35% de contribución.
- No ofrecer `2 x` sin calcular la contribución combinada y el costo de envío.
- No cambiar precios públicos automáticamente con datos de competencia. Primero se valida calidad, costo y conversión propia.

## Rutina del admin y las automatizaciones

### Cada día

1. Abrir una sola sesión del admin.
2. Revisar pedidos nuevos y su estado antes de tocar stock.
3. Confirmar pago por la fuente autorizada. Un mensaje o redirección no confirma pago.
4. Reservar o descontar inventario con el flujo del admin.
5. Registrar guía y despacho sin datos sensibles en notas públicas.

### Cada semana

1. Conteo físico por SKU y talla.
2. Resolver diferencias antes de comprar o pautar.
3. Exportar respaldo de pedidos e inventario.
4. Revisar eventos del embudo y páginas con errores.
5. Seleccionar ganadores de contenido y productos para la semana siguiente.

### Cada mes

1. Cerrar ventas netas, devoluciones, costo puesto y contribución.
2. Clasificar A, B y C por margen y rotación.
3. Reponer A, probar B y pasar C a bajo pedido o salida.
4. Revisar accesos administrativos y retirar usuarios que ya no correspondan.

## Tablero mínimo

| Métrica | Fórmula | Decisión |
| --- | --- | --- |
| Vista a talla | `select_size / view_item` | Calidad de ficha, foto y guía |
| Talla a carrito | `add_to_cart / select_size` | Precio y disponibilidad |
| Carrito a checkout | `begin_checkout / add_to_cart` | Fricción del pedido |
| Checkout a pedido | `pedidos_validados / begin_checkout` | Confianza y forma de pago |
| Conversión | `pedidos_validados / sesiones` | Rendimiento total |
| Contribución por pedido | Ingreso menos costos variables | Límite de pauta |
| Rotación por SKU | Unidades vendidas sobre inventario promedio | Reposición |
| Tasa de cambio por talla | Cambios de talla sobre unidades vendidas | Ajustar guía y mezcla |

## Fuentes operativas relacionadas

- `docs/PILOTO_INVENTARIO.csv`
- `docs/PRECIOS_MARGENES.csv`
- `docs/CONTENIDO_30_DIAS.csv`
- `docs/GUIA_FOTOS_PRODUCTO.md`
- `docs/COMPETENCIA_COLOMBIA_2026-07-13.md`
- `docs/PAGOS_WOMPI_RUNBOOK.md`
