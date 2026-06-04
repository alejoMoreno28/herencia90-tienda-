const fs = require('fs/promises');
const path = require('path');
const { Jimp } = require('jimp');

const CONFIG = {
    INPUT_DIR: 'EQUIPOS',
    OUTPUT_DIR: 'EQUIPOS_CENSURADOS',
    LABELS: ['logo', 'adidas logo', 'nike logo', 'puma logo', 'brand logo'],
    THRESHOLD: 0.015, // Umbral bajo porque zero-shot en ropa arrugada es ruidoso
};

async function processImage(detector, inputPath, outputPath) {
    try {
        const image = await Jimp.read(inputPath);
        const width = image.bitmap.width;
        const height = image.bitmap.height;

        if (!width || !height) return;

        // 1. IA INSPECCIONA LA IMAGEN
        const detections = await detector(inputPath, CONFIG.LABELS, { threshold: CONFIG.THRESHOLD });
        
        // 2. FILTRAR DETECCIONES LÓGICAS
        let bestDetection = null;
        for (const det of detections) {
            const boxWidth = det.box.xmax - det.box.xmin;
            const boxHeight = det.box.ymax - det.box.ymin;
            
            // Filtro: Debe ser tamaño de logo y estar en la mitad superior
            if (boxWidth < width * 0.2 && boxHeight < height * 0.2 && det.box.ymin < height * 0.6) {
                if (!bestDetection || det.score > bestDetection.score) {
                    bestDetection = det;
                }
            }
        }

        let boxToBlur;

        if (bestDetection) {
            console.log(`🤖 IA detectó logo en ${path.basename(inputPath)}: ${bestDetection.label} (Score: ${(bestDetection.score*100).toFixed(1)}%)`);
            const padding = 15;
            boxToBlur = {
                left: Math.max(0, Math.floor(bestDetection.box.xmin - padding)),
                top: Math.max(0, Math.floor(bestDetection.box.ymin - padding)),
                width: Math.ceil(bestDetection.box.xmax - bestDetection.box.xmin + padding*2),
                height: Math.ceil(bestDetection.box.ymax - bestDetection.box.ymin + padding*2)
            };
        } else {
            console.log(`⚠️ IA no estuvo segura en ${path.basename(inputPath)}. Aplicando censura heurística de seguridad en pecho derecho.`);
            boxToBlur = {
                left: Math.floor(width * 0.25),
                top: Math.floor(height * 0.20),
                width: Math.floor(width * 0.15),
                height: Math.floor(height * 0.15)
            };
        }
        
        // Asegurar que no exceda los límites
        boxToBlur.left = Math.max(0, Math.min(boxToBlur.left, width - 1));
        boxToBlur.top = Math.max(0, Math.min(boxToBlur.top, height - 1));
        boxToBlur.width = Math.max(1, Math.min(boxToBlur.width, width - boxToBlur.left));
        boxToBlur.height = Math.max(1, Math.min(boxToBlur.height, height - boxToBlur.top));

        // 3. APLICAR PARCHE (CENSURA) CON JIMP (Evita conflictos)
        // Oscurecemos los píxeles de la zona directamente en el buffer
        image.scan(boxToBlur.left, boxToBlur.top, boxToBlur.width, boxToBlur.height, function(x, y, idx) {
            this.bitmap.data[idx + 0] = Math.floor(this.bitmap.data[idx + 0] * 0.1); // R
            this.bitmap.data[idx + 1] = Math.floor(this.bitmap.data[idx + 1] * 0.1); // G
            this.bitmap.data[idx + 2] = Math.floor(this.bitmap.data[idx + 2] * 0.1); // B
            // Alpha se mantiene
        });
        
        // Guardar
        await new Promise((resolve, reject) => {
            image.write(outputPath, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        console.log(`✅ Guardado: ${outputPath}`);
    } catch (error) {
        console.error(`❌ Error en ${inputPath}:`, error.message);
    }
}

async function traverseDirectory(detector, currentDir, targetDir) {
    await fs.mkdir(targetDir, { recursive: true });
    
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullInputPath = path.join(currentDir, entry.name);
        const fullOutputPath = path.join(targetDir, entry.name);
        
        if (entry.isDirectory()) {
            await traverseDirectory(detector, fullInputPath, fullOutputPath);
        } else if (entry.isFile() && /\.(png|webp|jpg|jpeg)$/i.test(entry.name)) {
            await processImage(detector, fullInputPath, fullOutputPath);
        }
    }
}

async function main() {
    console.log("Inicializando Agente Inspector de Visión (Transformers.js)...");
    const { pipeline, env } = await import('@xenova/transformers');
    env.allowLocalModels = false;

    try {
        const detector = await pipeline('zero-shot-object-detection', 'Xenova/owlvit-base-patch32');
        console.log("🚀 Agente IA listo.");

        const inputDir = process.argv[2] || CONFIG.INPUT_DIR;
        const outputDir = process.argv[3] || CONFIG.OUTPUT_DIR;
        
        console.log(`Explorando: ${inputDir} -> ${outputDir}`);
        await traverseDirectory(detector, path.resolve(inputDir), path.resolve(outputDir));
        
        console.log('🎉 Inspección y censura completada.');
    } catch (error) {
        console.error("Error fatal:", error);
    }
}

main();
