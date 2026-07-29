# Admin: ganancias y retiros de socios

Este módulo organiza a dos socios con participación fija de 50% / 50%.

## Regla financiera

El Admin calcula:

`caja antes de retiros de socios - deuda de tarjeta - cortes ya aprobados = disponible para nuevo corte`

- La deuda de tarjeta se reserva completa antes de repartir.
- Un corte aprobado asigna exactamente la mitad a cada socio.
- Aprobar un corte no mueve efectivo.
- Un retiro de efectivo baja la caja física y el saldo del socio, pero no la utilidad.
- Una camiseta baja inventario y el saldo del socio por `costo USD × TRM`, pero no registra una venta.

## Uso normal

1. Registra las compras hechas con tarjeta en `Compra Inventario (con Tarjeta)`.
2. Registra cada abono en `Pago Deuda Tarjeta/Socio`.
3. En `Inicio Finanzas`, revisa el bloque `Socios · regla 50 / 50`.
4. Cuando ambos estén de acuerdo, pulsa `Cerrar ganancias`.
5. Para entregar dinero, pulsa `Sacar efectivo`.
6. Para que un socio tome una camiseta, pulsa `Sacar camiseta` y elige producto, talla y cantidad.
7. Abre `Historial de socios y control interno` para revisar, exportar, revertir o anular.

## Correcciones

- No se borran retiros: se usa `Revertir`.
- Una camiseta revertida devuelve automáticamente la cantidad al inventario.
- Un corte solo se puede anular cuando todos sus retiros hayan sido revertidos.
- Los movimientos antiguos `Retiro Personal Socio` se vinculan desde `Organizar ahora`; este proceso no vuelve a descontar inventario.

## Control tributario

Cada camiseta retirada queda inicialmente como `Tributario pendiente`. El contador debe confirmar si corresponde factura, IVA u otro soporte y después cambiarla a `Revisado` o `No aplica`.

## Instalación de base de datos

Antes de publicar el panel se debe aplicar una sola vez:

`docs/supabase/migrations/20260728_socios_ganancias.sql`

La migración crea el historial, las reglas 50/50, las validaciones de saldo/stock y las operaciones autenticadas. No crea movimientos financieros de prueba.
