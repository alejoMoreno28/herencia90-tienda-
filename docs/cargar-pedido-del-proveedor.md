# Cargar un pedido del proveedor al catalogo

Guia del flujo automatizado que reemplaza el trabajo manual de buscar cada
camiseta en yupoo, traducir el equipo al chino, bajar las fotos, quitarles el
fondo en Canva y crearlas una por una en el admin.

Ultima corrida real: **PEDIDO5, el 26 de julio de 2026** (15 referencias
nuevas, 4 sumas de stock, 51 unidades).

---

## Idea central

**La foto pegada en el excel es la verdad.** La descripcion escrita a mano
sirve para acotar la busqueda (equipo, temporada, manga, color), pero quien
decide cual de los candidatos del proveedor es el correcto es la comparacion
visual contra esa foto. Asi una errata en la descripcion no termina bajando
las fotos de otra camiseta.

## La forma facil: la pantalla del cargador

Doble clic a **`CARGAR-PEDIDO.bat`** en la carpeta del proyecto. Arranca el
robot y abre el navegador solo (la primera vez tarda porque carga los modelos
en la tarjeta grafica). No cerrar esa ventana negra mientras se trabaja.

En la pantalla:

1. Soltar el `.xlsx` del pedido.
2. Esperar. Va mostrando el avance, unos 10 a 20 segundos por camiseta.
3. Revisar. Cada referencia sale con la foto del excel al lado de lo que
   encontro, y el elegido marcado en verde. Las que necesitan ojo salen
   resaltadas y hay una casilla para ver solo esas.
   - Para cambiar de camiseta, clic en otra de las miniaturas.
   - Donde pregunta *"¿esta camiseta ya la tienes en el catalogo?"*, elegir el
     producto o dejar "es una referencia NUEVA".
4. **Cargar al catalogo**. Antes de escribir muestra el resumen exacto.
5. Publicar para SEO (ver el paso 8 mas abajo). Eso sigue siendo por consola.

Si el mismo archivo ya se cargo antes, la pantalla lo dice y salta lo que ya
esta guardado: no se puede duplicar el inventario por volver a subirlo.

El resto de esta guia es el mismo flujo por linea de comandos, util para
depurar o para correr solo un paso.

## Paso a paso (por consola)

### 1. Levantar el robot

```bash
node robot-fotos.mjs
```

Arranca en el puerto 3001 y levanta solo el servicio de Python (CLIP para
comparar + BiRefNet para quitar fondo, ambos en GPU). Verificar:

```bash
curl -s http://127.0.0.1:3001/health
# {"ok":true,"photoService":true}
```

Si `photoService` sale en false, el servicio de Python no arranco: revisar la
salida del robot.

### 2. Respaldar y tomar la foto de los numeros

**Siempre antes de escribir nada.**

```bash
node --env-file=.env scripts/snapshot-finanzas.mjs backups/finanzas-antes.json
```

Guarda productos, unidades en stock, pedidos, transacciones y montos. Al final
se compara para confirmar que solo se movio lo esperado.

### 3. Buscar cada referencia en el proveedor

```bash
node scripts/pedido-con-fotos.mjs "PEDIDO5HERENCIA 90.xlsx" --json _p5_match.json
```

Por cada referencia: saca la foto del excel, traduce el equipo al chino, busca
en la tienda que corresponde segun el TYPE (FAN / PLAYER / RETRO), filtra los
candidatos y los ordena por parecido visual a la foto.

Termina diciendo cuantas quedaron `auto` (el sistema esta seguro) y cuantas
`confirm` (hay que mirarlas).

### 4. Revisar a ojo

```bash
node scripts/revisar-pedido.mjs "PEDIDO5HERENCIA 90.xlsx" _p5_match.json revision.html
# solo las dudosas:
node scripts/revisar-pedido.mjs "PEDIDO5HERENCIA 90.xlsx" _p5_match.json dudosas.html --solo-dudosas
```

Abre una pagina con la foto del excel al lado de los candidatos, tres fotos
por candidato, y el elegido resaltado. **Hay que mirarla siempre**, aunque
todas salgan en `auto`.

### 5. Simular la carga

```bash
node --env-file=.env scripts/cargar-lote.mjs _p5_match.json
```

Sin `--confirmar` no escribe nada: imprime que productos crearia y como
quedarian las tallas de los que ya existen, con el antes y el despues.

Tres decisiones se corrigen a mano cuando hace falta (el sistema no las
adivina a proposito, porque equivocarse mezcla el stock de dos camisetas):

```bash
--existente "real madrid 26 27=60"   # va al producto 60 que ya existe
--nueva     "real madrid 26 27 rosa" # se crea aparte
--album     "camiseta ...=2"         # usa el 2do candidato, no el 1ro
```

### 6. Cargar

```bash
node --env-file=.env scripts/cargar-lote.mjs _p5_match.json \
  --existente "real madrid 26 27=60" --confirmar
```

**Si falla a mitad de camino, NO se vuelve a correr igual.** Sumar stock no es
repetible: hacerlo dos veces duplica las unidades. Se revisa que alcanzo a
pasar y se retoma con `--solo-nuevos`, que crea los productos que faltan sin
volver a sumar.

### 7. Comprobar que no se daño nada

```bash
node --env-file=.env scripts/snapshot-finanzas.mjs backups/finanzas-antes.json --comparar
```

Lo unico que debe cambiar es `productos` y `unidadesEnStock`. Si aparece
cualquier movimiento en transacciones, pedidos o montos, algo se salio de
control.

### 8. Publicar

```bash
node scripts/generate-product-pages.mjs
git add web/ && git commit && git push origin main
```

Los productos ya se ven en la tienda apenas se guardan (la pagina refresca
desde Supabase al cargar), pero las paginas estaticas y el sitemap, que es lo
que importa para SEO, salen de este generador.

---

## Que hace el cargador y que NO hace

Hace exactamente lo mismo que el admin al guardar un lote:

1. crea un producto por cada referencia nueva, con el stock en cero
2. le **suma** a las tallas las unidades de cada fila del excel

**No escribe en `transacciones` ni en `pedidos`.** Ventas, saldos, historial y
margenes quedan intactos. Si el pedido trae filas de PREVENTA se niega a
correr: esas generan pedidos y movimientos de plata, y van por el admin.

---

## Cosas que costaron encontrar

Casi todas salieron probando con pedidos reales, no razonando en abstracto.

**El stock se contaba doble.** El producto se crea con las tallas en cero y
`persistLoteItems()` se las suma despues. Al ver el cero era facil concluir
que el stock nunca se cargaba y "arreglarlo" precargandolo; eso hacia que se
contara dos veces. Tiene un comentario en el codigo para que no se repita.

**El equipo se detectaba mal.** El diccionario se quedaba con el alias mas
largo del texto, asi que "brasil 1998 amarilla mundial **francia** 98" se
buscaba como Francia. Ahora gana el que aparece antes: el equipo siempre va de
primero en las descripciones.

**La busqueda de yupoo es floja.** Al buscar "法国 1998" tambien devuelve
1998摩洛哥主场 y 1998西班牙客场, que coinciden en el año pero son de otro
equipo. Se filtran los que no nombran al equipo.

**El proveedor escribe Barcelona de dos formas**, 巴塞 y 巴萨, a veces en la
misma tienda. Con una sola se perdian las finales de champions.

**CLIP es flojo con el color.** Entre la Real Madrid 2011-12 blanca y la negra
de la misma temporada, las dos colgadas en la misma pared, daba 95.0% y 94.7%.
Se agrego un histograma de color que **solo** entra a desempatar cuando CLIP
dejo a varios candidatos practicamente iguales.

**Los albumes ponen la camiseta completa al final.** Muchos arrancan con
primeros planos de la etiqueta. Con un tope de 6 fotos la de cuerpo entero no
se llegaba a comparar. Ahora se bajan hasta 12 y se publican las 6 que mas se
parecen a la foto del excel, o sea las de la camiseta completa.

**Version liga y version champions.** La misma camiseta se vende con parches
distintos (联赛板 y 欧冠板). La descripcion del excel lo dice ("final champions
league") y ahora se usa.

**La tabla `productos` no genera el id.** Lo asigna el admin tomando el mayor
que exista y sumando uno. El cargador hace lo mismo.

**Cargar dos veces el mismo pedido duplicaba el inventario.** La proteccion
contra reintentos anotaba por separado lo "creado" y lo "sumado". El problema
es que la rama cambia entre corridas: la primera vez una referencia se crea,
pero en la segunda esa misma referencia ya existe en el catalogo y por lo tanto
le toca sumar stock, y la anotacion de "creada" no la protegia ahi. Se detecto
probando la pantalla con el PEDIDO5 ya cargado: creo 2 productos repetidos y
duplico el stock de 15. Ahora se anota **una entrada por referencia** y se
consulta **antes** de decidir si crear o sumar. Hay pruebas en
`scripts/lote-carga.test.mjs`.

**Las formulas del excel estaban rotas.** El total de unidades se sumaba a si
mismo y daba el doble: el PEDIDO5 decia 102 unidades cuando son 51. Ya esta
arreglado en `scripts/crear-pedido.mjs`.

---

## Piezas

| Archivo | Que hace |
|---|---|
| `robot-fotos.mjs` | servidor local, puerto 3001 |
| `scripts/python/photo_service.py` | CLIP + BiRefNet en GPU, puerto 5055 |
| `scripts/lib/excel-photos.mjs` | saca las fotos pegadas en el excel |
| `scripts/lib/team-translator.mjs` | equipo a chino + temporada, color, manga, competicion |
| `scripts/lib/yupoo-search.mjs` | busca albumes y baja fotos |
| `api/match-provider-photo.mjs` | busca, filtra y compara contra la foto del excel |
| `api/process-photo.mjs` | quita fondo y deja las fotos en formato catalogo |
| `scripts/pedido-con-fotos.mjs` | pasa un excel entero por el flujo |
| `scripts/revisar-pedido.mjs` | pagina para revisar a ojo |
| `scripts/cargar-lote.mjs` | escribe en el catalogo |
| `scripts/snapshot-finanzas.mjs` | foto de los numeros, antes y despues |
| `scripts/simular-lote.mjs` | replica el flujo del admin sin guardar nada |
| `CARGAR-PEDIDO.bat` | abre la pantalla del cargador |
| `scripts/lote-studio/` | la pantalla y sus endpoints |
| `scripts/lib/lote-analisis.mjs` | excel a referencias listas para revisar |
| `scripts/lib/lote-carga.mjs` | escritura al catalogo y proteccion de reintentos |
| `scripts/lote-carga.test.mjs` | pruebas de esa proteccion |

Las tiendas del proveedor por seccion estan en `PROVIDER_STORES` dentro de
`scripts/lib/yupoo-search.mjs`.

---

## Pendiente

- **PEDIDO6** (6 unidades) sin cargar.
- **Descuento por volumen**: el PEDIDO5 tiene 51 unidades, o sea paso de 50.
  Deberian ser 51 USD menos. Falta confirmarlo con Snake.
- Dos productos quedaron con una sola foto (Argentina 2006 id 69, Korea id 78)
  porque esos albumes del proveedor solo tienen una.
- El excel del PEDIDO5 dice "KOREA 27 27"; deberia ser 26 27.
