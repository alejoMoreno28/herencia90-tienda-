# Cargar un pedido del proveedor al catalogo

Guia del flujo automatizado que reemplaza el trabajo manual de buscar cada
camiseta en yupoo, traducir el equipo al chino, bajar las fotos, quitarles el
fondo en Canva y crearlas una por una en el admin.

Ultima corrida real: **PEDIDO5, el 26 de julio de 2026** (14 referencias
nuevas, 5 sumas de stock, 51 unidades).

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
5. **Publicar**. Es un boton en la misma pantalla: regenera las paginas
   estaticas y las sube a GitHub, que es lo que dispara el despliegue. Ya no
   hace falta la consola para esto.

Si el mismo archivo ya se cargo antes, la pantalla lo dice y salta lo que ya
esta guardado: no se puede duplicar el inventario por volver a subirlo.

### Corregir las fotos de un producto ya publicado

Seccion *"¿Una camiseta quedó con las fotos equivocadas?"*. Se busca el
producto, se revisa el texto de busqueda, se elige el album y **sale una vista
previa**: la portada marcada, si a cada foto se le quito el fondo o lleva el
del proveedor, flechas para reordenar y una equis para quitar. El producto no
cambia hasta darle a **Guardar estas fotos**.

Sobre el texto de busqueda: **conviene dejar el que viene puesto** (el titulo
del producto). Cuanto mas corto se escriba, mas candidatos irrelevantes salen y
mas abajo queda el correcto. Con "Camiseta Retro Barcelona 2008-2009 Local
Final Champions League" el album correcto sale de primero; con "barcelona retro
08" sale de cuarto.

### Revisar las fotos de toda la tienda

Seccion *"Revisar las fotos de toda la tienda"*. Saca las fotos publicadas de
todos los productos en una sola hoja, se marcan las malas con un clic y se
quitan de una vez. Antes de escribir revisa todas las marcas: si una sola
dejaria un producto sin ninguna foto, no toca ninguno.

**Por que se revisan a ojo y no las detecta el programa.** Se midieron las 333
fotos publicadas buscando una señal que delatara a las que el borrador de
fondos rompio. No la hay: una vez publicada, la foto se recorta a su contenido
y se centra en el cuadro, y eso borra justo lo que serviria. El escudo suelto
de la Barcelona 08/09 daba ocupacion 0.69 y proporcion 0.99, practicamente lo
mismo que una camiseta sana (0.62 y 1.00 de mediana). Un umbral fallaria en las
dos direcciones. `scripts/revisar-fotos-catalogo.mjs` solo pilla el caso
extremo (menos del 18% opaco).

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

1. crea un producto por cada referencia nueva
2. le **suma** al stock las unidades con destino STOCK
3. crea un registro en `pedidos` por cada unidad de **PREVENTA**
4. registra en `transacciones` el **gasto** de lo que costo el lote

Sobre la preventa: son unidades que ya estan vendidas a un cliente y solo hay
que esperarlas para entregarlas. Por eso **no cuentan como inventario
disponible** y viven en `pedidos`, no en las tallas del producto. Una misma
referencia puede venir partida entre stock y preventa, y cada parte va a su
sitio. El cliente se escribe en la pantalla; si se deja vacio queda "Pendiente
por Asignar" y se le asigna despues desde el admin.

Lo unico que **NO** hace es registrar cobros a clientes. Los de preventa no
pagan al encargar, se les cobra al entregar, asi que cargar un pedido no genera
ningun ingreso: ventas, abonos y saldos quedan intactos.

Para el gasto hacen falta dos datos que el excel no trae, el **nombre del lote**
y la **TRM de compra**, y la pantalla los pide antes de dejar cargar.

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

**Se creo un producto duplicado.** El excel escribe la temporada separada por
espacio ("26 27") y el catalogo con barra ("26/27"), asi que al comparar
nombres la Barcelona 26/27 del pedido nuevo no se reconocia como la que ya
estaba y se creo aparte, con el stock partido entre dos fichas. Ahora tambien
se entiende la forma con espacio.

**Las descripciones llevaban lenguaje interno.** El texto que genera el admin
al crear una referencia hablaba de "carga manual aprobada" y "extras
detectados", y eso lo estaba leyendo el cliente en la ficha del producto. Ahora
se escribe para quien compra, e incluye el dorsal impreso cuando el pedido lo
trae.

**El gasto de la compra no quedaba registrado.** El admin lo crea al guardar un
lote; el cargador no lo hacia, asi que las camisetas entraban al catalogo pero
lo que costaron no quedaba en las cuentas y el margen salia inflado.

**Las formulas del excel estaban rotas.** El total de unidades se sumaba a si
mismo y daba el doble: el PEDIDO5 decia 102 unidades cuando son 51. Ya esta
arreglado en `scripts/crear-pedido.mjs`.

**El borrador de fondos rompia los acercamientos.** A todas las fotos del album
se les quitaba el fondo. En un primer plano (el escudo, el cuello, la etiqueta)
la tela llena el encuadre y no hay fondo que quitar, asi que el modelo recortaba
la prenda misma: quedaban el swoosh y el escudo flotando en el vacio, y esas
fotos rotas se publicaban. Ahora la decision se toma **antes de usar** el
recorte: si la foto muestra la camiseta entera se publica sin fondo, y si es un
acercamiento se publica la original del proveedor, intacta. Lo que las separa es
el **borde** de la imagen, no la proporcion total: el recorte del cuello de la
Barcelona 08/09 dejaba 0.54 opaco, igual que una camiseta entera, pero su borde
daba 0.402 contra 0.001 de la completa.

**El frente y la espalda se distinguen contando colores en el pecho.** Adelante
van el escudo, el patrocinador y la marca; atras la tela es lisa. En la
Barcelona 08/09: 80 colores contra 11. Hizo falta porque CLIP no separa una cara
de la otra ni con la foto del excel como referencia.

**Solo se bajaban las fotos servidas en `.jpeg`.** El proveedor usa las dos
extensiones. El filtro pedia `big.jpeg`, asi que en un album servido en `.jpg`
se caian TODAS las fotos grandes: la Liverpool 95/96 visitante se publico con
una sola foto teniendo su album 9. Medido, el album 160694828 paso de 1 a 9.
Pruebas en `scripts/tests/fotos-album.test.mjs`.

**No escribir "champions" descartaba el album de Champions.**
`filterByCompetition` tenia dos ramas: si se pedia champions filtraba a esos
albumes, y si no se pedia **los excluia todos**. Por eso el album correcto de la
Barcelona 08/09 (欧冠版) solo aparecia escribiendo el titulo completo del
producto; buscando "barcelona retro 08" salian la 97-98, la 2002-03 y la
2006-07. Se rastreo filtro por filtro sobre 114 albumes y el correcto sobrevivia
hasta el de competicion. Ahora esos albumes van al final en vez de desaparecer.

**"08" no se leia como año.** `extractSeasonPattern("barcelona retro 08")`
devolvia null, asi que la busqueda iba sin filtro de temporada. Ahora un año
suelto de dos cifras cuenta, pero **solo cuando el texto dice retro**: sin esa
palabra un numero de dos cifras es casi siempre un dorsal ("messi 10") y
filtrar por "10-11" dejaria la busqueda vacia.

**Tres servicios de fotos peleandose la GPU.** `robot-fotos.mjs` arrancaba un
`photo_service.py` nuevo sin mirar si ya habia uno, y no lo mataba al cerrarse.
Cada instancia carga CLIP y BiRefNet y reserva 8 GB. Con tres corriendo la
tarjeta quedo al 100% con 11.6 de 12.2 GB y quitarle el fondo a UNA foto pasaba
de medio segundo a **dos minutos**. Parecia que la pantalla estaba colgada.
Medido antes y despues de limpiarlos: 124 s -> 0.5 s. Ahora se reutiliza el que
ya responda y el robot se lleva el suyo al cerrarse.

**Carreras en la pantalla.** Tres formas de terminar viendo el album
equivocado, todas del mismo tipo: el enlace "ver en el proveedor" va dentro de
la tarjeta y abrirlo tambien contaba como elegir ese album; se podian lanzar
varios procesados a la vez y pintaba el que terminara de ultimo; y abrir un
producto lanza una busqueda sola, asi que cambiar el texto y darle a Buscar
antes de que volviera dejaba dos en el aire. Ahora el enlace no dispara la
tarjeta, solo se procesa uno a la vez, y el boton de buscar se bloquea mientras
busca.

**La pantalla del cargador se sirve sin cache** (`Cache-Control: no-store`). Se
arregla a menudo, y una copia vieja guardada en el navegador hace perder mucho
tiempo buscando fallos que ya estaban corregidos.

**La grilla de la tienda cargaba la foto de 1200 px.** `toCardImage` se saltaba
las URLs que empiezan por http, o sea las de Supabase, que son la mayoria del
catalogo. Ademas solo 68 de las 333 fotos tenian generada su version de 640.
Medido sobre las portadas de los 72 productos: 7.7 MB antes, 2.5 MB ahora.
Las fotos grandes **no** se recomprimen: probado con las tres mas pesadas,
volver a codificarlas a calidad 88 o 92 las deja mas pesadas (554 KB -> 625 KB).

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
| `scripts/validar-lote-cargado.mjs` | compara un pedido cargado contra su excel |
| `scripts/descripciones-catalogo.mjs` | descripciones escritas a mano |
| `scripts/crear-excel-prueba.mjs` | arma un excel pequeño para probar el flujo |
| `scripts/probar-flujo-fotos.mjs` | prueba el flujo entero sin escribir nada |
| `scripts/revisar-fotos-catalogo.mjs` | busca fotos rotas por id (ver limite abajo) |
| `scripts/generar-fotos-card.mjs` | genera las versiones de 640 px que falten |

Para probar el flujo de fotos sin tocar la base ni subir nada:

```bash
node --env-file=.env scripts/probar-flujo-fotos.mjs 71 66 15
```

Por cada producto busca en el proveedor como lo hace la pantalla, baja TODAS
las fotos del album, les pasa el borrador de fondos y las encuadra, y reporta lo
mismo que se veria en la vista previa. Corrido sobre 10 productos (6 retro y 4
de temporada) los 10 salen con la prenda completa de portada.

Las tiendas del proveedor por seccion estan en `PROVIDER_STORES` dentro de
`scripts/lib/yupoo-search.mjs`.

---

## Pendiente

- **PEDIDO6** (6 unidades) sin cargar. Es **todo preventa**: ninguna suma al
  inventario disponible, todas van a `pedidos` esperando entrega.
- **El id 57, "Camiseta Real Madrid Lfstlr"**, tiene un titulo que no se
  entiende y sigue con la descripcion automatica vieja. Hay que preguntar que
  camiseta es.
- El gasto del PEDIDO5 se registro por los **US$767** que dice el excel. Si
  Snake aplico el descuento por pasar de 50 unidades, serian US$716 y hay que
  ajustarlo.
- **Descuento por volumen**: el PEDIDO5 tiene 51 unidades, o sea paso de 50.
  Deberian ser 51 USD menos. Falta confirmarlo con Snake.
- Dos productos quedaron con una sola foto (Argentina 2006 id 69, Korea id 78)
  porque esos albumes del proveedor solo tienen una. **Vale la pena volver a
  mirarlos**: el fallo de las extensiones `.jpg` hacia que albumes completos
  llegaran con una sola foto, asi que puede que ahora traigan mas.
- Quedan sueltos en la raiz varios archivos de sesiones viejas sin seguimiento
  de git (`temp_script_*.js`, `patch.py`, `diff.txt`, `test_admin.js`,
  `update_reserves.js`). Nadie los ha revisado; no se tocaron a proposito.

---

## Al escribir titulos y descripciones

Regla de oro: **el titulo lo pone quien tiene la camiseta en la mano.** No
cambiarlo por deduccion. Si algo no cuadra, preguntar.

Paso una vez: el titulo decia "Argentina Mundial 2026 Visitante" y se cambio a
"Edicion Especial Campeones 2022" porque la foto mostraba el parche de campeon
del mundo. Era al reves: Argentina gano en 2022 y por eso llega al Mundial 2026
como campeona defensora, con ese parche puesto. La foto confirmaba el titulo.

Y hay un limite de fondo: **el conocimiento del asistente tiene fecha de
corte.** Sobre equipaciones de la temporada en curso puede estar
desactualizado, aunque suene seguro.

Que hacer entonces, en orden:

1. **Lo que dice el excel y el proveedor manda.** El titulo del album en yupoo
   trae la temporada y la variante (主场 local, 客场 visitante), y eso es dato
   vivo, no memoria.
2. **La foto sirve para lo verificable**: de que color es, que patrocinador
   lleva, si dos productos son la misma camiseta. No sirve para decidir si una
   camiseta es oficial ni de que temporada es.
3. **Para lo reciente, buscar en internet antes de escribir.** Asi salio que la
   suplente de Argentina 2026 esta inspirada en el fileteado porteño, un detalle
   que vende y que no estaba en ninguna memoria.
4. **Ante la duda, preguntar.** Un titulo cambiado por una suposicion rompe la
   direccion de la pagina y desinforma al cliente.

Para camisetas viejas (los retro de los 90 y 2000) el riesgo es bajo: esa
historia no cambia. El riesgo esta en las temporadas recientes.

---

## Como se elige y se ordena cada foto

Vive en `api/process-photo.mjs`. Es el paso que mas veces se rompio, asi que
conviene entenderlo antes de tocarlo.

Se le pasa el borrador de fondos a **todas** las fotos del album, pero eso es
solo para **medir**: el recorte se usa o se descarta despues.

| Medida | Que dice |
|---|---|
| `borde_opaco` | cuanto del borde de la imagen quedo opaco. Si se ve la prenda entera hay fondo alrededor y el borde queda vacio; en un acercamiento la tela se sale por los lados |
| `proporcion` | cuanto de la imagen quedo opaco en total |

Una foto se publica **sin fondo** solo si `borde_opaco <= 0.05` **y**
`proporcion >= 0.35`. Cualquier otra se publica **como vino del proveedor**.

Las dos condiciones hacen falta. El borde solo dice que el objeto cabe entero,
y eso tambien lo cumple un escudo recortado; una camiseta completa ademas
**ocupa** la foto (entre 53% y 65% en los albumes medidos), mientras que el
escudo suelto se quedaba en 24%.

El orden final es: **frente, espalda, resto de prenda completa, acercamientos**.
Entre las completas manda el numero de colores distintos en el pecho.

Valores reales del album de la Barcelona 08/09 (`/albums/95099080`, 13 fotos):

```
foto 11   borde 0.003   ->  sin fondo   (frente, 80 colores)
foto 12   borde 0.001   ->  sin fondo   (espalda, 11 colores)
las otras 11            ->  con su fondo
```

Cosas que se probaron y **no** funcionan, para no repetirlas:

- **CLIP con frases** ("a full front view of a complete soccer jersey"): las 13
  fotos dieron ~0.33. No discrimina nada. El endpoint se quito.
- **La proporcion total sola**: el primer plano del cuello daba 0.542, igual
  que una camiseta entera.
- **Histograma de color para desempatar albumes**: se quito de
  `photo_service.py`. Las fotos del excel son recortes con otras imagenes
  alrededor, asi que el histograma sale dominado por el fondo. Daba 0.7%, 0.9%,
  1.5% y de golpe 73.8%: ruido. Se habia agregado porque acerto una vez con la
  Real Madrid 2011-12, pero al medirlo con mas casos rompio la Liverpool 95/96.

---

## Por donde se puede romper, y que lo protege

Repaso de los puntos donde el flujo podria fallar y que hay puesto para que no
haga daño en silencio.

| Que puede pasar | Que lo protege |
|---|---|
| Cargar dos veces el mismo pedido | El registro en `lotes-cargados/`, que va en git. Salta lo ya escrito y la pantalla lo avisa. |
| Que se pierda ese registro | Esta en git, no en una carpeta temporal. Antes vivia en `.codex_tmp/`, que se limpia. |
| Que una carga se corte a la mitad | Cada referencia se anota apenas se aplica. Al retomar, se salta sola. |
| Que el excel venga con columnas movidas | Se revisa el encabezado antes de leer y se detiene con un mensaje claro. Sin esto el pedido entraba corrido sin avisar. |
| Una fila con cantidad en cero | Se detiene y dice cual es. Antes creaba un producto con stock vacio. |
| Crear repetido algo que ya esta en el catalogo | Se compara la FOTO del excel contra las fotos del catalogo, no solo los nombres. Si el parecido es altisimo se enlaza sola; si hay dos parecidas, la pantalla las muestra para elegir. |
| Que el robot o la GPU no esten | La pantalla lo muestra arriba en rojo antes de empezar. |
| Que el proveedor no tenga la camiseta | Queda marcada como "no se encontro". Se puede cargar igual y ponerle fotos despues. |
| Que la comparacion visual se equivoque | Sale marcada para revisar y se elige otra con un clic. |
| Que el modelo escriba una descripcion inventada | Se valida antes de publicar: no puede cambiar el equipo ni la temporada, ni meter enlaces. Si no pasa, queda el texto por reglas. |
| Que el modelo no responda | Reintenta con espera creciente. Si aun asi falla, texto por reglas y la pantalla dice a cuales repasar. |
| Que se dañen las cuentas | La carga no toca ventas, cobros ni saldos. Solo agrega el gasto de la compra. Se comprueba con `snapshot-finanzas.mjs`. |
| Que el borrador de fondos rompa un acercamiento | Solo se le quita el fondo a las fotos que muestran la prenda completa. Las demas se publican tal como vinieron. |
| Que la ficha quede sin una foto de la camiseta entera | El orden pone primero frente y espalda; los acercamientos van al final. |
| Que se procese un album que no se eligio | Solo uno a la vez, y el enlace al proveedor no dispara la tarjeta. |
| Que se guarden fotos sin verlas | Elegir el album ya no guarda: hay vista previa y el producto no cambia hasta darle a Guardar. |
| Que se quite la ultima foto de un producto | Se revisan todas las marcas antes de escribir; si una dejaria un producto sin fotos, no se toca ninguno. |
| Que se acumulen servicios de fotos comiendose la GPU | Se reutiliza el que ya responda y el robot mata el suyo al cerrarse. |
| Ver la pantalla vieja del navegador | Se sirve con `Cache-Control: no-store`. |

Lo que **sigue necesitando ojo humano**, a proposito:

- Elegir entre dos camisetas muy parecidas del mismo equipo y temporada (tipico
  entre la version Fan y la Player, que se ven casi identicas en foto).
- Confirmar si una referencia es nueva cuando la foto no es concluyente.
- Poner el nombre del cliente en las de preventa.
- El nombre del lote y la TRM de compra.
- Repasar las descripciones que quedaron con el texto basico.

Ninguna de esas se puede adivinar sin arriesgar el inventario o la ficha, asi
que la pantalla las pregunta en vez de suponer.
