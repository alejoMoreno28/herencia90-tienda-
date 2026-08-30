# Checklist móvil de inventario físico

## Objetivo

Crear una ruta privada y rápida para comparar desde el celular el inventario físico de HERENCIA90 con el inventario registrado en la página. La herramienta es únicamente de auditoría: nunca actualiza la tabla `productos` ni el stock público.

## Acceso

- Ruta independiente optimizada para celular: `/admin-inventario-fisico`.
- Reutiliza la autenticación actual de Supabase.
- Si no existe una sesión válida, redirige al login.
- Solo el usuario autenticado puede consultar y guardar conteos.

## Flujo principal

1. Al iniciar una auditoría, la herramienta toma una copia fija de las referencias y cantidades actuales de `productos`.
2. Muestra una referencia por pantalla con foto, ID, equipo, descripción y cantidades registradas por talla.
3. El usuario puede pulsar `Todo coincide` o escribir la cantidad física de cada talla.
4. Si hay una diferencia, puede seleccionar una novedad: `No aparece`, `Talla diferente`, `Defectuosa` u `Otra`. La nota es opcional.
5. `Guardar y siguiente` persiste el conteo y avanza a la próxima referencia pendiente.
6. El progreso se recupera automáticamente al volver a abrir el enlace.
7. El resumen final separa coincidencias, faltantes, sobrantes y novedades.

## Interfaz mínima

- Barra de progreso y contador de referencias.
- Buscador sencillo.
- Una tarjeta de producto por pantalla.
- Filas de talla con cantidad de página y cantidad física.
- Botón destacado `Todo coincide` para acelerar la mayoría de casos.
- Campo de novedad y nota ocultos hasta que el usuario indique un problema.
- Botones `Anterior` y `Guardar y siguiente`.
- Resumen final con opción de descargar un archivo CSV.

No habrá gráficas, edición masiva, múltiples modos, escáner, actualización automática del catálogo ni controles contables.

## Datos

Se crearán entidades separadas para la auditoría:

- Una cabecera con propietario, fecha, estado y copia del total esperado.
- Filas por producto y talla con cantidad esperada, cantidad física, novedad, nota y fecha de revisión.

La cantidad esperada se congela al iniciar la auditoría para que cambios posteriores del catálogo no alteren el cruce ya empezado. Las claves de reserva `R_*` se muestran por separado o se excluyen del stock físico disponible; no se suman como unidades disponibles.

## Seguridad y protección del catálogo

- La pantalla no ejecuta `insert`, `update`, `upsert` ni `delete` sobre `productos`.
- Las tablas de auditoría tendrán políticas RLS para el usuario autenticado.
- No se expondrán credenciales nuevas en el navegador.
- Reiniciar o eliminar una auditoría requerirá confirmación explícita.

## Errores y recuperación

- Cada avance se guarda antes de mostrar el siguiente producto.
- Si falla la red, la pantalla conserva los valores y permite reintentar sin avanzar.
- Un indicador breve confirma `Guardado`.
- Si el catálogo está vacío o la sesión caduca, se muestra una explicación clara y no se pierden los conteos ya guardados.

## Verificación

- Pruebas unitarias para cálculo de faltantes, sobrantes, coincidencias y exclusión de reservas.
- Prueba de que el módulo no contiene escrituras a `productos`.
- Prueba del enlace y la protección por sesión.
- Revisión móvil a 390 px sin desplazamiento horizontal.
- Prueba de reanudación después de cerrar y volver a abrir.
- Prueba de descarga CSV con todas las diferencias y notas.

## Criterios de aceptación

- Se puede completar el conteo desde un celular con una referencia a la vez.
- `Todo coincide` permite avanzar con un solo toque.
- El progreso sobrevive al cierre del navegador.
- El resumen identifica correctamente cada diferencia por producto y talla.
- La auditoría no cambia ningún dato del catálogo ni del inventario publicado.
