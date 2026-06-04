const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const CONFIG = {
    INPUT_DIR: 'EQUIPOS',
    OUTPUT_DIR: 'EQUIPOS_CENSURADOS'
};

async function processImage(inputPath, outputPath) {
    try {
        const imageMeta = await sharp(inputPath).metadata();
        const width = imageMeta.width;
        const height = imageMeta.height;

        if (!width || !height) return;

        // Zona del Pecho Derecho (donde van Nike/Adidas)
        // Valores relativos al tamaño de la camiseta
        const boxToBlur = {
            left: Math.floor(width * 0.20),
            top: Math.floor(height * 0.22),
            width: Math.floor(width * 0.20), // 20% del ancho
            height: Math.floor(height * 0.15) // 15% del alto
        };

        // Asegurar límites
        boxToBlur.left = Math.max(0, Math.min(boxToBlur.left, width - 1));
        boxToBlur.top = Math.max(0, Math.min(boxToBlur.top, height - 1));
        boxToBlur.width = Math.max(1, Math.min(boxToBlur.width, width - boxToBlur.left));
        boxToBlur.height = Math.max(1, Math.min(boxToBlur.height, height - boxToBlur.top));

        // 3. APLICAR PARCHE DIFUMINADO (BLUR)
        const imageBuffer = await sharp(inputPath).toBuffer();
        
        // Extraer la zona y difuminarla fuertemente
        const blurredBox = await sharp(imageBuffer)
            .extract({
                left: boxToBlur.left,
                top: boxToBlur.top,
                width: boxToBlur.width,
                height: boxToBlur.height
            })
            .blur(40) // Blur intenso para tapar marcas
            .toBuffer();

        // Superponer la zona difuminada encima de la original
        await sharp(imageBuffer)
            .composite([
                { input: blurredBox, top: boxToBlur.top, left: boxToBlur.left }
            ])
            .toFile(outputPath);

        console.log(`✅ Censurado: ${outputPath}`);
    } catch (error) {
        console.error(`❌ Error en ${inputPath}:`, error.message);
    }
}

async function traverseDirectory(currentDir, targetDir) {
    await fs.mkdir(targetDir, { recursive: true });
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullInputPath = path.join(currentDir, entry.name);
        const fullOutputPath = path.join(targetDir, entry.name);
        
        if (entry.isDirectory()) {
            await traverseDirectory(fullInputPath, fullOutputPath);
        } else if (entry.isFile() && /\.(png|webp|jpg|jpeg)$/i.test(entry.name)) {
            await processImage(fullInputPath, fullOutputPath);
        }
    }
}

async function main() {
    const inputDir = process.argv[2] || CONFIG.INPUT_DIR;
    const outputDir = process.argv[3] || CONFIG.OUTPUT_DIR;
    
    console.log(`Iniciando Censura Heurística: ${inputDir} -> ${outputDir}`);
    await traverseDirectory(path.resolve(inputDir), path.resolve(outputDir));
    console.log('🎉 Censura completada.');
}

main();
