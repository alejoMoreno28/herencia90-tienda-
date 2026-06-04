const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const INPUT_DIR = path.resolve(__dirname, '../../EQUIPOS');
const OUTPUT_DIR = path.resolve(__dirname, '../../EQUIPOS_CENSURADOS');

// Servir imágenes estáticas de origen
app.use('/images', express.static(INPUT_DIR));

// Variables de estado
let imagesToProcess = [];
let currentIndex = 0;

// Escanear directorio recursivamente
async function scanDir(dir) {
    let results = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results = results.concat(await scanDir(fullPath));
        } else if (/\.(png|webp|jpg|jpeg)$/i.test(entry.name)) {
            // Guardar ruta relativa
            results.push(path.relative(INPUT_DIR, fullPath));
        }
    }
    return results;
}

// Inicializar lista
app.get('/api/init', async (req, res) => {
    try {
        imagesToProcess = await scanDir(INPUT_DIR);
        currentIndex = 0;
        res.json({ total: imagesToProcess.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener la siguiente imagen
app.get('/api/next', (req, res) => {
    if (currentIndex >= imagesToProcess.length) {
        return res.json({ done: true });
    }
    
    const relativePath = imagesToProcess[currentIndex];
    // Reemplazar barras invertidas (Windows) por barras normales para URLs
    const urlPath = relativePath.replace(/\\/g, '/');
    
    res.json({
        done: false,
        imagePath: urlPath,
        progress: `${currentIndex + 1} / ${imagesToProcess.length}`
    });
});

// Procesar imagen (Censurar o Saltar)
app.post('/api/process', async (req, res) => {
    try {
        if (currentIndex >= imagesToProcess.length) return res.status(400).json({ error: "No hay más imágenes" });

        const { action, patches } = req.body;
        const relativePath = imagesToProcess[currentIndex];
        
        const inputPath = path.join(INPUT_DIR, relativePath);
        const outputPath = path.join(OUTPUT_DIR, relativePath);
        const DB_FILE = path.join(__dirname, 'censor_db.json');
        
        // Crear directorios si no existen
        await fs.mkdir(path.dirname(outputPath), { recursive: true });

        // Cargar base de datos de coordenadas por si acaso
        let censorDB = {};
        const dbExists = await fs.access(DB_FILE).then(() => true).catch(() => false);
        if (dbExists) {
            censorDB = JSON.parse(await fs.readFile(DB_FILE, 'utf8'));
        }

        if (action === 'skip') {
            // Copiar la imagen tal cual
            await fs.copyFile(inputPath, outputPath);
            censorDB[relativePath] = [];
            await fs.writeFile(DB_FILE, JSON.stringify(censorDB, null, 2));
            console.log(`⏭️ Saltado (sin censura): ${relativePath}`);
        } else if (action === 'censor') {
            // Normalizar la imagen aplicando la rotación EXIF (fotos de celular)
            const normalizedBuffer = await sharp(inputPath).rotate().toBuffer();
            const metadata = await sharp(normalizedBuffer).metadata();
            
            const realWidth = metadata.width;
            const realHeight = metadata.height;

            const composites = [];

            for (const patch of patches) {
                const blurWidth = Math.floor(realWidth * patch.sizeRatio);
                const blurHeight = Math.floor(blurWidth * 0.75); // Relación 4:3 para el parche

                let boxToBlur = {
                    left: Math.floor(patch.x - (blurWidth / 2)),
                    top: Math.floor(patch.y - (blurHeight / 2)),
                    width: blurWidth,
                    height: blurHeight
                };

                // Asegurar límites
                boxToBlur.left = Math.max(0, Math.min(boxToBlur.left, realWidth - 1));
                boxToBlur.top = Math.max(0, Math.min(boxToBlur.top, realHeight - 1));
                boxToBlur.width = Math.max(1, Math.min(boxToBlur.width, realWidth - boxToBlur.left));
                boxToBlur.height = Math.max(1, Math.min(boxToBlur.height, realHeight - boxToBlur.top));
                
                const blurredBox = await sharp(normalizedBuffer)
                    .extract(boxToBlur)
                    .blur(25) // Nivel intermedio: más fuerte que 15 pero sin destruir la estética
                    .toBuffer();

                composites.push({ input: blurredBox, top: boxToBlur.top, left: boxToBlur.left });
            }

            await sharp(normalizedBuffer)
                .composite(composites)
                .toFile(outputPath);
            
            // Guardar coordenadas para no tener que repetir clics en el futuro
            censorDB[relativePath] = patches;
            await fs.writeFile(DB_FILE, JSON.stringify(censorDB, null, 2));
                
            console.log(`✅ Censurado (${patches.length} logos): ${relativePath}`);
        }

        currentIndex++;
        res.json({ success: true });
    } catch (error) {
        console.error("Error al procesar:", error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`\n=================================================`);
    console.log(`🚀 HERRAMIENTA VISUAL DE CENSURA LISTA`);
    console.log(`👉 Abre tu navegador web y entra a: http://localhost:${PORT}`);
    console.log(`=================================================\n`);
});
