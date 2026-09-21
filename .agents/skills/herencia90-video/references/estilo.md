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

El plano de apertura tiene que cumplir las cuatro:

1. Camiseta **de frente** y completa en cuadro
2. **Logos visibles**: escudo, sponsor y marca
3. Se nota la **calidad** (tela, costuras, etiqueta colgando)
4. Nada de manos tapando ni encuadres cortados

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

## Orientacion - revisar siempre

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
