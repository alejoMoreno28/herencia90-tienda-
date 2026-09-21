# Caso completo: Arsenal 26/27

El video que se hizo el 20 de septiembre de 2026, de punta a punta, con los
numeros reales. Si es tu primera vez con esta skill, sigue esto.

Material: `HERENCIA 90 MARKETING\VIDEO CRUDOS PEDIDO 4\1\20260623_135537.mp4`
Resultado: 1080x1920, 14.47s, 24.5 MB.

---

## 1. Mirar el material

```powershell
.\scripts\analizar-clips.ps1 -Carpeta "...\VIDEO CRUDOS PEDIDO 4\1" -Salida "temp"
```

El clip: 3840x2160, 60fps, 65.6s, rotacion -90 (o sea 2160x3840 vertical,
exactamente 2x el lienzo final).

Lo que se vio en la hoja de contactos:

- **0-9s y 17-18s: boca abajo.** El sponsor se lee invertido → `girar: 180`
- **10-16s y 19-38s: bien**
- **39-65s: inservible.** Camara tan cerca que solo se ve rojo plano

De 65.6 segundos, solo ~38 servian. **Siempre mira antes de cortar.**

Truco para el gancho: saca una hoja densa de los primeros 10s **ya girada**,
para verla como quedaria en pantalla.

```powershell
ffmpeg -t 10 -i crudo.mp4 -vf "hflip,vflip,fps=2,scale=260:462" g_%03d.jpg
```

Ahi se vio que entre **0.9s y 3s** la camiseta se ve completa de frente con
Emirates, escudo, adidas, mangas blancas con chevron y la etiqueta colgando.
Ese fue el plano de apertura.

## 2. Identificar

Detalles visibles: cuerpo rojo, mangas raglan blancas, granate en cuello y
punos, patron zigzag, escudo monocromo blanco, Emirates, adidas.

Verificado contra tres fuentes (Footy Headlines, Arseblog, Football Shirt
Culture): **Arsenal home 2026/27, salida 15 mayo 2026**. El zigzag del cuello
y punos es la arquitectura del Emirates Stadium.

Ese detalle con historia es oro para el guion. Buscalo siempre.

## 3. La noticia

Busqueda: `Arsenal Premier League table September 2026`

Resultado: **Arsenal gano la Premier 2025/26, primer titulo en 22 anos**, y
arranco la 26/27 con 4 victorias de 4 y un solo gol en contra. Confirmado por
ESPN y Sky Sports.

Gancho evidente: la camiseta con la que defiende el titulo.

## 4. El guion

Se pregunto la voz primero. Para **Valentino** (2.14 palabras/seg), 31
palabras:

> Arsenal esperó veintidós años para volver a ser campeón. Esta es la camiseta
> con la que defiende el título. El zigzag del cuello es el Emirates Stadium.
> Disponible en Herencia 90.

Cierra con "Disponible en Herencia 90" porque asi cierra el video de Brasil
que ya funciono. Con **Nandez** cabrian las 41 palabras y el CTA largo
("Entra al link antes de que se agote").

Numeros en letras: "veintidós", no "22".

## 5. Voz

```powershell
.\scripts\voz-fishaudio.ps1 -Guion guion_valentino.txt -Salida voz\valentino.mp3 -Voz valentino-calm
```

Salio 14.47s a 2.14 palabras/seg. En rango.

## 6. Subtitulos

```powershell
.\scripts\subtitulos-karaoke.ps1 -Audio voz\valentino.mp3 -Guion guion_valentino.txt -Salida subtitulos.ass
```

31 palabras, 31 eventos, alineacion 1 a 1.

## 7. Beats y plan

Los tiempos por palabra de esa voz marcan donde cae cada corte:

| Palabra | Empieza |
|---|---|
| Arsenal | 0.00 |
| años | 1.50 |
| esta | 4.24 |
| con | 5.56 |
| título | 6.68 |
| El zigzag | 7.78 |
| es | 9.28 |
| Stadium | 10.58 |
| disponible | 12.10 |

Plan final, 11 tomas, todas entre 1.06s y 1.96s:

| # | Desde | Dur | Girar | Que se ve |
|---|---|---|---|---|
| 1 | 0.9 | 1.96 | 180 | **GANCHO** camiseta completa de frente |
| 2 | 11.0 | 1.18 | 0 | escudo del canon grande |
| 3 | 12.5 | 1.10 | 0 | escudo otro angulo |
| 4 | 8.1 | 1.32 | 180 | camiseta completa mas cerca |
| 5 | 14.4 | 1.12 | 0 | adidas tres rayas |
| 6 | 23.5 | 1.10 | 0 | textura de la tela |
| 7 | 21.8 | 1.06 | 0 | puno y cuello zigzag (dice ZIGZAG DEL CUELLO) |
| 8 | 19.4 | 1.16 | 0 | chevron manga blanca |
| 9 | 5.0 | 1.52 | 180 | Emirates grande (dice STADIUM) |
| 10 | 26.8 | 1.46 | 0 | etiqueta, producto nuevo |
| 11 | 2.6 | 1.49 | 180 | **CIERRE** camiseta completa de frente |

Fijate en la sincronia: cuando la voz dice "zigzag del cuello", en pantalla
esta el zigzag del cuello. Cuando dice "Emirates Stadium", esta el sponsor.

Y fijate en el orden: abre y cierra con el mismo plano bonito de la camiseta
completa. El producto es la primera y la ultima imagen.

## 8. Montar

```powershell
.\scripts\montar-video.ps1 -Plan plan.json -Voz voz\valentino.mp3 -Subtitulos subtitulos.ass -Salida salida\ARSENAL_2627_VALENTINO.mp4
```

## 9. Caption

> Arsenal defiende el título con esta. Home 26/27, el zigzag es el Emirates
> Stadium. Disponible en Herencia 90 🔴⚪
> #camisetasdefutbol #arsenal #herencia90 #futbolcolombia #camisetascolombia

---

## Errores que se cometieron ese dia

Para no repetirlos:

1. **Se abrio con el escudo en vez de con la camiseta completa.** Se priorizo
   que la palabra "Arsenal" sincronizara con la imagen. Mal: el gancho manda.
2. **Subtitulos a tamano 64.** Se veian mas pequenos que los del usuario. Se
   midio recortando la misma franja de ambos videos: los suyos eran 1.37x.
   El tamano correcto es 88.
3. **No se reviso la orientacion.** El primer render abria con el logo al
   reves.
4. **Tomas de 1.7-1.8s.** Arrastraban. Hay que partir los beats largos.
5. **Se dirigio la voz como "pausada".** Salio a 1.89 palabras/seg cuando el
   objetivo son ~3. El registro narrador no es lento.
6. **Se ofrecieron voces castellanas.** El usuario quiere latino siempre.
   Muchas voces dicen "Spanish male voice" queriendo decir *de Espana*.

## Como verificar el resultado

Antes de entregar, saca una hoja de contactos del mp4 final y **miralo**:

```powershell
ffmpeg -i final.mp4 -vf "fps=1.5,scale=200:356" c_%03d.jpg
```

Revisa: gancho bonito, nada al reves, subtitulos legibles, sincronia
palabra-imagen, ningun plano que arrastre.
