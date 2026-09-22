# Estilo visual - medido, no supuesto

Todo lo de aqui salio de medir los dos videos de HERENCIA90 que funcionaron.
Si cambias un numero, mide contra ellos otra vez.

## Lienzo

| | |
|---|---|
| Resolucion | 1080x1920 (9:16) |
| Fps | 30 |
| Codec | H.264, yuv420p, CRF 18 |
| Duracion | 13-15s |
| Peso tipico | 19-25 MB |

El material crudo del usuario sale del telefono a 3840x2160 60fps con
rotacion -90 en metadata, o sea 2160x3840 vertical. Es exactamente 2x el
lienzo final: baja limpio sin recortar nada.

## Subtitulos

Replica del look de CapCut que el usuario ya venia usando.

| | |
|---|---|
| Fuente | Arial Black |
| Tamano | 88 |
| Color base | blanco `&H00FFFFFF` |
| Palabra activa | amarillo `&H0000FFFF` |
| Borde | negro, grosor 6 |
| Sombra | 3 |
| Alineacion | 2 (abajo centrado) |
| Margen inferior | 400 |
| Margen lateral | 90 |
| Mayusculas | siempre |
| Palabras por pantalla | 3 |

El karaoke se hace con un evento `Dialogue` por palabra: el grupo entero
visible, la palabra en curso en amarillo. Mas simple y mas fiable que los tags
`\k`, y da el mismo efecto.

Los subtitulos largos parten solos en dos lineas (`WrapStyle: 2`). Eso esta
bien: el video de Argentina los tiene asi.

**Verificacion rapida del tamano.** Recorta la misma franja de tu render y de
la referencia y comparalas:

```powershell
ffmpeg -ss 1.0 -i referencia.mp4 -frames:v 1 -vf "crop=1080:340:0:1330" ref.jpg
ffmpeg -ss 9.6 -i tuyo.mp4       -frames:v 1 -vf "crop=1080:340:0:1330" mio.jpg
```

Las mayusculas deben medir lo mismo.

## Ritmo y cortes

- Corte cada **0.9-1.8s**.
- Cada corte cae en el **arranque de una frase**, no en medio de una palabra.
- Saca los tiempos por palabra con whisper y usalos como rejilla.
- 10-12 tomas en un video de 13-15s.

## Que planos buscar

Heredado de las referencias de unboxing y confirmado en el material propio:

1. Escudo en primer plano (el plano mas fuerte, sirve de apertura y de cierre)
2. Camiseta completa, plana y bien iluminada
3. Manos levantandola o extendiendola (da escala y movimiento)
4. Sponsor grande
5. Logo de la marca / tres rayas
6. Detalle de diseno con historia (patron, cuello, punos)
7. Etiqueta colgante (comunica "nuevo")
8. Textura de la tela con la mano pasando

## El gancho manda (regla del usuario)

Los primeros 2 segundos deciden si la persona se queda. Ahi va **el plano mas
bonito que tengas**, no el que mejor sincroniza con la palabra.

El plano de apertura tiene que cumplir las cinco:

1. Camiseta **de frente** y completa en cuadro
2. **Logos visibles**: escudo, sponsor y marca
3. Se nota la **calidad** (tela, costuras, etiqueta colgando)
4. **El cuello completo dentro del encuadre.** Una camiseta cortada por arriba
   se ve fea. El usuario lo señalo expresamente.
5. **Nada de manos** y la prenda **bien tendida**: mangas derechas, hombros
   parejos, sin bultos ni arrugas. Una camiseta arrugada se ve descuidada.

### Si no hay ningun plano estatico bonito, usa movimiento

Regla textual del usuario: *"si no se ve muy bonita, es mejor no colocarla y
mas facil se coloca un video donde haya movimiento para que no se note tanto"*.

Un plano estatico de una camiseta desordenada, sostenido dos segundos, es lo
peor que puedes abrir. Si el material no te da un tendido limpio, busca el
momento en que las manos **levantan o sacuden** la prenda hacia la camara: el
movimiento engancha y disimula las arrugas.

Mejor todavia: arranca en el tendido limpio y deja que el plano termine justo
cuando las manos entran a levantarla. Primer fotograma bonito (que es la
portada en TikTok) y movimiento inmediatamente despues.

### Buscalo bien antes de rendir

El plano bueno casi siempre existe: suele estar en los **primeros segundos**,
antes de que las manos entren a manipular la prenda. En el clip de Portugal
estaba en el segundo 4 y se habia usado el 69, que estaba arrugado.

```powershell
ffmpeg -t 10 -i crudo.mp4 -vf "hflip,vflip,fps=2,scale=260:462" g_%03d.jpg
```

### Esto aplica a todo el video, pero sobre todo al inicio

Las tomas del cuerpo pasan en menos de un segundo y perdonan mas. El gancho y
el cierre se miran con calma: ahi no pasa una imagen fea.

Busca ese plano antes de armar el resto. Saca una hoja de contactos densa
(cada 0.5s) de los primeros 10-15 segundos y **ya girada**, para verla como
quedaria en pantalla:

```powershell
ffmpeg -t 10 -i crudo.mp4 -vf "hflip,vflip,fps=2,scale=260:462" g_%03d.jpg
```

Cierra con el mismo plano. Abrir y cerrar con la camiseta completa deja el
producto como ultima imagen, que es lo que vende.

La sincronia palabra-imagen (abajo) manda en el **cuerpo** del video, no en el
gancho. Si chocan, gana el gancho.

## Duracion de las tomas

Ningun plano por encima de **1.8s**; el video se siente lento. Ninguno por
debajo de **0.65s**; no alcanza a leerse.

Si un beat del guion dura mas de 1.8s, partelo en dos tomas cortando en un
limite de palabra dentro de la frase. Los cortes no tienen que caer solo donde
empieza una frase.

## Sincronia palabra-imagen

Es lo que separa un video que vende de uno que no. Cuando la voz nombra algo,
eso tiene que estar en pantalla:

| La voz dice | En pantalla va |
|---|---|
| "Arsenal" | el escudo |
| "el zigzag del cuello" | el zigzag del cuello |
| "Emirates Stadium" | el sponsor Emirates |
| "la tenemos disponible" | la etiqueta |

## Orientacion: AUDITAR TODAS LAS TOMAS, SIEMPRE

Regla del usuario, textual: *"es muy importante que en todos los videos, en
absolutamente todos los videos, siempre la imagen este de frente"*. El cliente
mira el celular: cada imagen tiene que leerse derecha.

**No basta con revisar el gancho.** El usuario filma la prenda sobre la mesa y
la va girando: dentro del MISMO clip la orientacion cambia varias veces. Una
toma que estaba bien a los 26 segundos puede estar al reves a los 28.

Por eso, antes de entregar, corre esto en cada video:

```powershell
.\scripts\auditar-orientacion.ps1 -Video salida\FINAL.mp4 -Plan plan.json
```

Saca un fotograma por toma, numerado y con el giro que tiene puesto. **Miralo
entero.** Donde una salga al reves, cambia su `girar` en el plan y vuelve a
montar.

### Que mirar en cada toma

| Elemento | Como sabes que esta derecho |
|---|---|
| Numero y nombre | se leen, no estan en espejo |
| Escudo del Bayern | las cinco estrellas van **arriba** |
| Escudo del United | "MANCHESTER" arriba, "UNITED" abajo |
| Escudo de Portugal | la punta del escudo va **abajo** |
| Escudo del CBF (Brasil) | las cinco estrellas van **arriba** |
| Escudo del Real Madrid | la corona va **arriba** |
| Logo Puma | el gato salta hacia la **izquierda** |
| Logo Telekom | el travesano de la "T" va **arriba** |
| Sponsor y etiquetas | "Emirates", "AIG", "NikeFIT", "Climacool" legibles |

Las tomas que solo muestran estampado o tela sin texto no importan: no hay
forma de que se vean al reves.

### Cuanto pesa esto

En la primera version de los seis videos del pedido 4 habia **14 tomas al
reves** repartidas en los seis. Ninguna la detecto el verificador automatico
porque no es algo que se pueda medir: hay que mirarlo. La auditoria las
encontro todas en una pasada.

## Orientacion del material crudo

El usuario filma la camiseta acostada sobre la mesa y muy seguido queda boca
abajo respecto a la camara: el sponsor y el escudo se leen invertidos.

Mira la hoja de contactos antes de armar el plan y marca `girar: 180` en las
tomas afectadas. Una apertura con el logo al reves arruina el gancho.

En el clip del Arsenal (`20260623_135537.mp4`), los segundos 0-9 y 17-18
estaban invertidos; 10-16 y 19-38 estaban bien.

## Material inservible

No todo el clip sirve. En el del Arsenal, de 65.6s solo los primeros ~38s
tenian planos utiles: del segundo 39 en adelante la camara queda tan cerca que
solo se ve rojo plano sin referencia.

Saca siempre la hoja de contactos con el segundo marcado y elige mirando.
