# Análisis de los videos de referencia

Medido sobre los dos videos que mandó Alejo: **Brasil 2004 Ronaldo** (13.0 s) y
**Argentina 2026** (14.7 s). Todo lo de aquí ya está cargado en
`config/marca.json` y `config/estilos_subtitulos.json`.

## Formato

| | Brasil 2004 | Argentina 2026 |
|---|---|---|
| Resolución | 1080x1920 | 1080x1920 |
| FPS | 30 | 30 |
| Duración | 13.0 s | 14.7 s |
| Cortes detectados | 9 | 9 |
| Duración mediana del corte | 1.37 s | 1.53 s |
| Corte más corto / más largo | 1.00 / 2.20 s | 1.07 / 2.70 s |
| Ritmo del habla | ~185 palabras por minuto | ~185 ppm |

**Conclusión:** videos de 13-15 s, exactamente 9 cortes, ninguno pasa de ~2.5 s.
Ritmo rápido y parejo, sin tomas largas.

## Subtítulos

Medido pixel a pixel sobre fotogramas a resolución completa:

- **Mayúsculas**, sin puntuación
- **2-3 palabras por bloque**, envuelve a segunda línea cuando no cabe
- Palabra activa en **amarillo dorado RGB(254, 219, 0)**, el resto en blanco puro
- Borde negro grueso, sin sombra
- Alto de letra **60-75 px** sobre 1920 → equivale a cuerpo ~90 en Montserrat ExtraBold
- Centrado horizontal, ocupa ~70% del ancho
- Posición vertical: **66% en Argentina, 78% en Brasil**

> Los dos videos no coinciden en la altura. Se fijó **68%** por defecto: cerca del
> de Argentina y lo bastante arriba para no chocar con la interfaz de TikTok, que
> tapa la franja de abajo con el texto del post y los botones.

### Un detalle que en los videos originales está mal

En los dos aparece **"CLáSICO", "DISEñO", "éPOCA", "FúTBOL", "DESPUéS",
"OBLIGACIóN"**: la herramienta que los hizo pasa a mayúsculas pero deja las
vocales acentuadas y la eñe en minúscula. Nuestro motor lo hace bien y escribe
**CLÁSICO, DISEÑO, ÉPOCA, FÚTBOL, DESPUÉS, OBLIGACIÓN**.

## Voz

Medida por frecuencia fundamental sobre el audio (aproximada: la música de fondo
altera un poco la lectura).

| | Tono mediano | Rango | Lectura |
|---|---|---|---|
| Brasil 2004 | 123 Hz | 98-163 Hz | Masculina media, tirando a grave |
| Argentina 2026 | 140 Hz | 107-182 Hz | Masculina más joven y aguda |

Son dos voces distintas, coherente con que Alejo use **Valentino** (la madura) y
**Nandez** (la joven). Al elegir el reemplazo, buscar voces en esos rangos.

## Material en crudo

Camiseta extendida sobre una cama o superficie lisa, grabada desde arriba con el
celular en la mano. Las tomas que se repiten en los dos videos:

1. Plano general de la camiseta completa
2. Primer plano del escudo
3. Nombre y número de la espalda
4. Detalle de tela, costuras o cuello
5. La mano recorriendo o levantando la camiseta
6. La etiqueta original colgando

## Estructura del guión

Los dos siguen el mismo patrón:

1. **Gancho** por negación o dato fuerte
   *"Esta no es cualquier Brasil"* · *"Después de la locura que hizo Messi en su debut"*
2. **Identidad**: selección, año, jugador, qué la hace especial
3. **Nostalgia**: la época, el recuerdo, por qué importa
4. **Disponibilidad**: en stock, bajo pedido, personalizable
5. **Llamado a la acción**: *"Entra al link de nuestro perfil antes de que se agoten"*

## Verificación

Se renderizó un fragmento con el motor usando el propio video de Brasil como
material y se comparó contra el original. Los subtítulos salen prácticamente
idénticos en tipografía, tamaño, color, borde y posición.
