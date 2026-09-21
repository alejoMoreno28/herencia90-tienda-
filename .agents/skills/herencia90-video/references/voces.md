# Voces

## DECIDIDO: Nandez y Valentino, las dos

El usuario cerro la decision el 20 sep 2026 despues de escuchar 30 candidatas.
Usa **las dos** y elige por video. **Si no dice cual, preguntale.**

Ambas salen de Fish Audio. Su configuracion vive en `voces/VOZ_ELEGIDA.txt`
de la carpeta de trabajo.

```powershell
.\scripts\voz-fishaudio.ps1 -Guion guion.txt -Salida voz\nandez.mp3 -Voz nandez
.\scripts\voz-fishaudio.ps1 -Guion guion.txt -Salida voz\valentino.mp3 -Voz valentino-calm
```

Lo de abajo es el historial de como se llego ahi y el plan B. No hace falta
releerlo salvo que Fish Audio falle.

## Ruta elegida por el usuario: Fish Audio

El usuario decidio usar Fish Audio, que aloja clones comunitarios de Valentino
y Nandez. Se le advirtio dos veces que sus terminos reservan el uso comercial
a planes de pago y a voces propias, y que su contenido es marketing de marca.
Reafirmo. **Es su decision, ya esta comunicada: no volver a plantearla.**

```powershell
.\scripts\voz-fishaudio.ps1 -Guion guion.txt -Salida voz\valentino.mp3
.\scripts\voz-fishaudio.ps1 -Guion guion.txt -Salida voz\nandez.mp3 -Voz nandez
```

La API key vive en la variable de entorno `FISH_AUDIO_API_KEY` del usuario.
**Nunca se la pidas por chat ni la escribas en ningun archivo.** El script la
lee solo, y `*.key` esta en el `.gitignore`.

Modelos de voz (reference_id), ya dentro del script, **con el ritmo medido**:

| Alias | reference_id | palabras/seg | Guion que le cabe en 14s |
|---|---|---|---|
| `valentino-calm` | 72e7f0bdb02e47eb9cb41e4617e0de9c | 2.14 - 2.28 | **31 palabras** |
| `valentino` | d6cc48df129d45b18d5fe1afb76c1a92 | 2.21 | **31 palabras** |
| `nandez` | 9be3e6c74a084848a47f3778cffeaed2 | 3.38 | **41 palabras** |

**Esto importa mucho.** Los dos Valentino hablan lento: con el guion estandar
de 41 palabras se van a 18 segundos. Para Valentino hay que escribir un guion
mas corto, de unas 31 palabras, cortando el CTA largo y cerrando con
"Disponible en Herencia 90" (que es como cierra el video de Brasil, o sea que
ya esta probado). Nandez si aguanta las 41.

Escribe el guion segun la voz elegida, no al reves.

Limite del plan gratis: 500 caracteres por generacion (el guion tipico va por
230) y 8.000 creditos al mes, o sea unos 30 videos.

Si Fish Audio falla o se queda sin creditos, el plan B listo es la voz de
Google dirigida (ver abajo), que ya da el registro narrador correcto.

## Alternativa sin API: la voz real de CapCut

**Antes de generar nada por API, pregunta si el usuario ya trajo la voz.**

Ninguna API tiene Valentino ni Nandez. Son internas de CapCut. Pero CapCut de
escritorio exporta solo el audio en mp3, y el pipeline acepta cualquier mp3.
El usuario pega el guion en CapCut, elige Valentino, exporta el audio y lo deja
en `proyectos/<x>/voz/`. Desde ahi la skill hace todo lo demas igual.

Eso da **la voz exacta, gratis**, a cambio de 2 minutos manuales. Cuando el
usuario quiera esa voz, esta es la respuesta correcta; no lo mandes a buscar
parecidos por API.

Instrucciones para el usuario en `VOZ_DESDE_CAPCUT.md` de la carpeta de trabajo.

## Si hay que generar por API

### La regla

El usuario quiere **acento latinoamericano**, nunca castellano de Espana.
Busca replicar las voces **Valentino** y **Nandez** de CapCut: narrador latino,
calido, con peso, del estilo que se viraliza en TikTok.

Esas dos voces son internas de CapCut y **no existen por API**. Hay que
aproximarlas.

**No te fies de la descripcion sola.** Muchas dicen "Spanish male voice"
queriendo decir *de Espana*, no *en espanol*. Filtra con el parametro `search`
del listado de voces, que devuelve el acento real:

```
audio_voices_list(search: "Mexican",  scope: "catalog")
audio_voices_list(search: "Colombian", scope: "all")
audio_voices_list(search: "Latin American", scope: "catalog")
audio_voices_list(search: "Argentine" | "Chilean" | "Venezuelan", scope: "catalog")
```

## Masculinas latinas del catalogo (lista completa, sep 2026)

Son pocas. Esta es toda la oferta:

| id | Nombre | Acento | Registro |
|---|---|---|---|
| 643 | Ernesto Calderon | Mexicano | Carisma y autoridad, narracion y documental |
| 1080 | Joaquin Arrieta | Mexicano, joven | Calido, redes sociales y publicidad |
| 79 | Roberto Perez | Mexico DF, maduro | Peso cultural |
| 76 | Alejo Vargas | Latino | Energetico y expresivo |
| 864 | Benjamin Soto | Chileno, joven | Conversacional, suena real; ads y social |
| 78 | Nico Braganza | Argentino | Claro, narracion de noticias |
| 917 | Alvaro Quintana | Cubano en Peru | Neutro |
| 947 | Nicolas Quintana | Panameno | Amigable |
| 967 | Ignacio Peralta | Cubano | Claro, contenido tecnico |
| 888 | Gonzalo Bermudez | Latino neutro, maduro | Narrador documental con ironia |

**No hay ninguna masculina colombiana en el catalogo.** Las unicas colombianas
son femeninas (Sofia Ramirez 612, Valentina Santos 846).

El usuario tiene un clon propio masculino colombiano: `Alex - clon prueba v01`,
id **144635**, que necesita `source: "mine"`. Es la unica via a un acento
colombiano masculino.

## Descartadas: de Espana

No usar salvo que el usuario lo pida. Emilio Ortega (560), Tomas Aguirre (562),
Mario Cebrian (561), Manuel Ladera (559), Manuel Ferrer (553), Diego Marin
(563), Alvaro Serrano (554), Fernando Ruiz (114), Ivan Mendoza (118),
Andres Bustamante (968), Javier Martinez (466), Carlos Gutierrez (67).

## Dirigir la interpretacion

El usuario rechazo voces buenas por sonar "muy humanas, muy normalitas". El
problema no era la voz sino la **falta de interpretacion**. Dos palancas:

**eleven_v3** acepta etiquetas `[tag]` dentro del `text`: `[narrating]`,
`[serious]`, `[dramatic]`. Cortas y simples, o se descartan en silencio.
Baja `stability` a 0.35 para que aterricen.

**gemini_v2_5_pro** acepta `systemInstruction`, prosa libre y es la palanca
fuerte. Escribela como direccion a un actor. Esta es la que dio el registro
narrador que el usuario buscaba. Direccion validada:

> Narrador latinoamericano de video viral de TikTok: voz grave, seria y con
> autoridad. Ritmo natural y continuo, a velocidad de conversacion, como quien
> cuenta algo que importa sin detenerse. Español neutro latino, nunca acento de
> España. Sin pausas largas, sin solemnidad exagerada, sin tono publicitario ni
> alegre.

Voces Google que funcionan con esa direccion: **Alnilam (698)** a 2.90
palabras/seg, Algenib (696) la unica `old` y la mas grave, Sadaltager (717).
Todas son `supportsAllLanguages`, asi que el acento lo fija la direccion.

**Ojo con el ritmo.** Una direccion que pida "pausada" o "pausa antes de cada
dato" dispara la duracion: con Algenib dio 21.7s para 41 palabras (1.89
palabras/seg) cuando el objetivo son ~3. Valentino en CapCut entrega a ~3
palabras/seg: es registro de narrador a **velocidad normal**, no narrador
lento. No pidas pausas en la direccion; pide gravedad y seguridad.

**El guion con etiquetas no es el guion de los subtitulos.** Las etiquetas no
se pronuncian, pero el texto del `.ass` tiene que salir del guion limpio. Manten
los dos archivos separados: `guion.txt` (limpio, para subtitulos) y el texto
con tags solo para la llamada de TTS.

## Ritmo

Con el guion estandar de 41 palabras:

- rango normal: 12.7 - 14.6s
- se pasan de 15s: Sergio Bermudez (17.5s), Sergio Morales (16.5s)
- dirigidas con pausas: 16.7 - 21.7s (demasiado)

Si la voz elegida se pasa, recorta el guion antes que subir la velocidad;
acelerar le quita el peso que hace que funcione. Para una voz de ~2.4
palabras/seg, apunta a 33 palabras en vez de 41.

## Parametros

`audio_tts` con `model: "eleven_v3"`, `stability: 0.45` sin etiquetas, `0.35`
con etiquetas. Mas alto aplana el registro narrador.

## La voz elegida

Vive en `voces/VOZ_ELEGIDA.txt` de la carpeta de trabajo, que genera
`ESCUCHAR_VOCES.bat`. Lee de ahi `voice_id` y `source` antes de generar.
Si el archivo no existe, pide al usuario que elija antes de gastar creditos.
