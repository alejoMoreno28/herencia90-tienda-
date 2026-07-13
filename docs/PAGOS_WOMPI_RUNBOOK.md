# HERENCIA90 — preparación de pagos con Wompi

Estado: preparado localmente, desactivado y sin cambios en Supabase.

Decisión: sí conviene ofrecer una pasarela cuando HERENCIA90 pueda confirmar automáticamente inventario, envío y responsable legal del comercio. Hoy debe seguir funcionando el cierre por WhatsApp; no activar producción todavía.

## Por qué Wompi es una opción razonable

- Tiene Sandbox separado de producción y llaves distintas por ambiente.
- El Web Checkout evita que HERENCIA90 reciba o almacene datos de tarjeta.
- La referencia y el monto se protegen con una firma SHA-256 generada en servidor.
- El pago solo se considera definitivo después de validar el webhook; la redirección del navegador es informativa.
- La tarifa pública consultada el 13 de julio de 2026 para el Plan Avanzado es `2,65% + $700 + IVA` por transacción exitosa.

Fuentes oficiales: [ambientes y llaves](https://docs.wompi.co/docs/colombia/ambientes-y-llaves/), [Widget y Web Checkout](https://docs.wompi.co/docs/colombia/widget-checkout-web/), [eventos y firma](https://docs.wompi.co/docs/colombia/eventos/) y [planes y tarifas](https://wompi.co/es/co/planes-tarifas/).

## Impacto aproximado de la tarifa

Se asumió IVA del 19% sobre la comisión publicada. Confirmar la liquidación contractual final con Wompi.

| Precio | Comisión antes de IVA | Costo estimado total | Neto estimado |
|---:|---:|---:|---:|
| $99.000 | $3.324 | $3.955 | $95.045 |
| $110.000 | $3.615 | $4.302 | $105.698 |
| $120.000 | $3.880 | $4.617 | $115.383 |

La pasarela no exige subir todos los precios automáticamente. Primero se debe medir si la mejora de conversión supera aproximadamente cuatro puntos porcentuales del valor vendido y separar la comisión en el cálculo de margen.

## Lo que ya queda listo en el repositorio

- Generación de firma de integridad y validación de firma de eventos con comparación segura.
- Validación que impide mezclar credenciales Sandbox y producción.
- Endpoint `/api/wompi-event` apagado por defecto y sin CORS público.
- Rechazo de eventos falsificados antes de acceder a Supabase.
- Persistencia mediante una sola función SQL idempotente.
- Tablas aisladas con RLS y sin permisos para `anon` o `authenticated`.
- Migración y rollback que no modifican `productos`, `pedidos` ni `transacciones`.

## Needs confirmation antes de Sandbox

- Nombre o razón social, NIT, domicilio y correo oficial que deben mostrarse al comprador.
- Cuenta Wompi aprobada y titular de la cuenta bancaria receptora.
- Política definitiva de costo de envío por ciudad.
- Si una unidad se reserva al iniciar el pago o solo al recibir `APPROVED`.
- Tiempo de expiración de una reserva de stock y proceso de liberación.
- Tratamiento contable de la comisión, IVA y retenciones.
- Responsable de revisar pagos `DECLINED`, `VOIDED` y `ERROR`.

No se creó todavía un endpoint público para iniciar cobros. Hacerlo sin resolver reserva de stock y control antiabuso permitiría bloquear inventario o vender una misma talla dos veces.

## Variables de entorno

Mantener el interruptor apagado hasta aprobar todos los controles:

```text
WOMPI_ENABLED=false
WOMPI_ENVIRONMENT=sandbox
WOMPI_PUBLIC_KEY=<configurar solo en Vercel>
WOMPI_INTEGRITY_SECRET=<configurar solo en Vercel>
WOMPI_EVENTS_SECRET=<configurar solo en Vercel>
SUPABASE_URL=<ya administrado en Vercel>
SUPABASE_SERVICE_KEY=<ya administrado en Vercel>
```

Nunca copiar secretos a HTML, JavaScript público, documentación, capturas o commits. Para Sandbox los prefijos esperados son `pub_test_`, `test_integrity_` y `test_events_`; producción usa los prefijos equivalentes `prod`.

## Activación segura por etapas

1. Hacer backup de Supabase y revisar `payments-wompi-migration.sql`.
2. Ejecutar la migración únicamente en el proyecto de prueba aprobado.
3. Configurar una Preview de Vercel con llaves Sandbox y `WOMPI_ENABLED=true`.
4. Configurar en Wompi Sandbox la URL HTTPS `https://<preview>/api/wompi-event`.
5. Crear el servicio atómico de orden y reserva de stock. No exponer el botón antes de esta etapa.
6. Probar: aprobado, declinado, error, evento duplicado, firma falsa, monto alterado y referencia desconocida.
7. Conciliar cada prueba entre Wompi y `wompi_orders`/`wompi_events`.
8. Probar vencimiento y liberación de inventario.
9. Hacer revisión legal, contable y operativa.
10. Solo después, repetir la configuración con secretos de producción y una URL de eventos distinta.

## Gates obligatorios

- Cero secretos en el cliente o Git.
- Cero eventos sin firma válida.
- Cero actualización de pedido cuando monto o moneda no coinciden.
- Un evento repetido no produce una segunda transición.
- Una transacción aprobada no puede degradarse por un evento contradictorio.
- El comprador ve envío, total y plazo antes de pagar.
- La confirmación de pago proviene del webhook, nunca del parámetro de redirección.
- El flujo de reembolso y reversión está ensayado.

Si cualquiera falla, dejar `WOMPI_ENABLED=false` y continuar con la confirmación por WhatsApp.

## Rollback

1. Cambiar inmediatamente `WOMPI_ENABLED=false`.
2. Retirar la URL de eventos del ambiente correspondiente en Wompi.
3. Conservar exportación de órdenes/eventos para conciliación.
4. Si se decide retirar la preparación por completo, ejecutar `payments-wompi-rollback.sql` después de confirmar que no hay pagos pendientes.

El rollback solo elimina los objetos aislados de Wompi. No toca inventario, pedidos actuales ni finanzas.
