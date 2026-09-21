---
name: editor-herencia90
description: Edita videos verticales para TikTok de la marca Herencia 90 (camisetas de fútbol retro) a partir del material en crudo de Alejo y de un guión escrito por él. Úsala cuando Alejo pida editar, montar o armar un video, un TikTok o un reel de una camiseta.
---

# Editor de video de Herencia 90

Convierte **material en crudo + un guión escrito por Alejo** en un MP4 vertical
listo para TikTok: voz en off, subtítulos dinámicos, cortes al ritmo, música y
efectos.

**Alejo escribe el guión. Tú no inventas el texto.** Tu trabajo es ejecutarlo
bien: elegir qué toma acompaña cada frase, dónde cortar y cómo rematar.

---

## Si es la primera vez que abres este proyecto

Lee `HERENCIA 90 APLICACION EDICION DE VIDEO/docs/CONTEXTO.md`: resume qué se
decidió, qué está construido y qué falta. Te ahorra preguntar lo ya resuelto.

## Antes de empezar

Lee siempre `config/marca.json` (tono, duración objetivo, ritmo de corte) y
revisa que exista la carpeta del proyecto con `crudo/` y `guion.txt`.

Si falta el guión, **pregunta por él. No lo escribas tú** salvo que Alejo lo
pida explícitamente.

---

## El flujo, paso a paso

**Todos los comandos se corren desde la carpeta de la aplicación.** Entra
primero:

```bash
cd "HERENCIA 90 APLICACION EDICION DE VIDEO"
```

Si `python -m motor.cli revisar` falla porque falta algo, no improvises: dile a
Alejo que ejecute `INSTALAR.bat` y espera.

### 1. Mira el material (este paso no se salta)

```bash
python -m motor.cli frames proyectos/<nombre>/crudo --cada 1
```

Extrae fotogramas y escribe `trabajo/frames/indice.json`. **Ábrelos y míralos
de verdad**, uno por uno. Anota para cada clip:

- qué se ve (camiseta completa, escudo, etiqueta, tela, manos, la persona)
- si está borroso, movido, oscuro o mal encuadrado
- cuál es el **mejor segundo** de todo el material: ese va en el gancho

Sin este paso estás editando a ciegas y se nota en el resultado.

### 2. Separa las tomas

```bash
python -m motor.cli escenas proyectos/<nombre>/crudo
```

Un clip largo suele traer varias tomas pegadas. Esto te da pedazos limpios
para elegir en vez de un bloque de 40 segundos.

### 3. Genera la voz en off

```bash
python -m motor.cli voz proyectos/<nombre>/guion.txt
```

Por defecto usa `edge-tts` con la voz que Alejo escogió. Banderas útiles:
`--voz`, `--velocidad` (1.08 por defecto, el ritmo de TikTok),
`--motor kokoro` (sin internet) o `--motor elevenlabs` (calidad final).

### 4. Calcula los subtítulos

```bash
python -m motor.cli subtitulos proyectos/<nombre>/trabajo/voz.wav --guion proyectos/<nombre>/guion.txt
```

Produce `trabajo/palabras.json` (el tiempo exacto de cada palabra) y
`trabajo/subs.ass`. Estilos: `viral` (por defecto), `limpio`, `herencia`.

### 5. Decide el reparto de tomas — **aquí está tu valor**

Lee `trabajo/palabras.json` y cruza los tiempos con lo que viste en los frames.
Escribe `plan.json` en la carpeta del proyecto:

```json
{
  "resolucion": [1080, 1920],
  "fps": 30,
  "voz": "trabajo/voz.wav",
  "subtitulos": "trabajo/subs.ass",
  "musica": {"archivo": "../../assets/musica/x.mp3", "volumen_db": -20, "ducking": true},
  "cortes": [
    {"clip": "crudo/a.mp4", "desde": 2.0, "hasta": 3.2, "efecto": "zoom_in"}
  ]
}
```

Reglas que no se negocian:

- **El primer corte es el más corto (≈1 s) y la toma más impactante.** Es el gancho.
- Cada corte dura entre **1.0 y 2.2 s**, con mediana ~1.45 s. Medido sobre los
  videos reales de Alejo: los dos tienen exactamente **9 cortes**.
- **La imagen debe ilustrar lo que se está diciendo.** Si la frase habla del
  escudo, en pantalla va el escudo. Esto es lo único que ninguna herramienta
  automática hace bien, y es exactamente lo que tú sí puedes hacer.
- Los cortes deben **sumar al menos lo que dura la voz**. Si falta, repite la
  mejor toma con otro encuadre o efecto, nunca dejes la pantalla en negro.
- No repitas el mismo efecto dos veces seguidas.
- Descarta las tomas borrosas o movidas, aunque te quedes corto de material.

Efectos: `ninguno`, `zoom_in`, `zoom_out`, `pan_der`, `pan_izq`.

El guión de Alejo sigue siempre el mismo patrón, y el reparto de tomas debe
acompañarlo (está detallado en `docs/REFERENCIAS.md`):

| Parte del guión | Qué toma va bien |
|---|---|
| Gancho | La toma más impactante: el número, el nombre, el escudo en primer plano |
| Identidad de la camiseta | Plano general, escudo, nombre y número |
| Nostalgia | Detalle de tela, costuras, cuello, la mano recorriéndola |
| Disponibilidad | La etiqueta original colgando, plano general |
| Llamado a la acción | Plano general limpio, sin manos tapando |

### 6. Renderiza

```bash
python -m motor.cli montar proyectos/<nombre>/plan.json
```

Sale en `salida/video_final.mp4`.

### 7. Revisa tu propio trabajo (obligatorio)

```bash
python -m motor.cli revisar-resultado proyectos/<nombre>/salida/video_final.mp4
```

Abre los fotogramas del resultado y comprueba de verdad:

- ¿Los subtítulos se leen? ¿Se salen del encuadre? ¿Tapan algo importante?
- ¿El encuadre 9:16 cortó la camiseta o el escudo?
- ¿La imagen corresponde a lo que se dice en ese momento?
- ¿La duración está entre 12 y 22 segundos? Los suyos duran 13-15 s.

**Si algo está mal, corrige `plan.json` y vuelve a renderizar.** No entregues
un video que no revisaste. Solo entonces avisa a Alejo, diciéndole qué decidiste
y por qué.

---

## Cuando algo falla

| Problema | Qué hacer |
|---|---|
| Falta una dependencia | `python -m motor.cli revisar` dice qué falta y cómo instalarlo |
| Los subtítulos se ven con otra tipografía | Falta Montserrat en `assets/fuentes/` (ver el LÉEME de esa carpeta) |
| La voz falla por red | `edge-tts` necesita internet. Sin internet: `--motor kokoro` |
| Los cortes no alcanzan la voz | El motor avisa. Agrega cortes al plan, no lo ignores |
| Un subtítulo quedó mal escrito | `trabajo/subs.ass` es texto plano: corrígelo y solo repite el paso 6 |

## Lo que no debes hacer

- No reescribas el guión de Alejo ni le cambies palabras.
- No inventes precios, tallas, stock ni promociones.
- No entregues sin haber hecho el paso 7.
- No borres nada de `crudo/`: es el material original de Alejo.
