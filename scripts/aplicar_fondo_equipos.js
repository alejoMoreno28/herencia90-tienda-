const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

// Configuración por defecto
const CONFIG = {
    BACKGROUND_PATH: 'FONDO IMAGENES FINAL 1.png',
    LOGO_PATH: 'LOGO NUEVO PNG@4x.png',
    INPUT_DIR: 'EQUIPOS',
    OUTPUT_DIR: 'EQUIPOS_CON_FONDO',
    LOGO_WIDTH_PERCENT: 0.15, // 15% del ancho de la imagen
    LOGO_MARGIN_PERCENT: 0.05 // 5% de margen
};

async function processImage(inputPath, outputPath, bgBuffer, logoBuffer) {
    try {
        const shirtImage = sharp(inputPath);
        const metadata = await shirtImage.metadata();
        const width = metadata.width;
        const height = metadata.height;

        if (!width || !height) {
            console.warn(`Saltando ${inputPath}: no se pudieron leer las dimensiones.`);
            return;
        }

        // 1. Preparar el fondo (redimensionar para cubrir el tamaño de la camiseta)
        const background = await sharp(bgBuffer)
            .resize(width, height, { fit: 'cover' })
            .toBuffer();

        // 2. Preparar el logo (redimensionar según el tamaño de la camiseta)
        const logoWidth = Math.round(width * CONFIG.LOGO_WIDTH_PERCENT);
        const margin = Math.round(width * CONFIG.LOGO_MARGIN_PERCENT);
        
        const logo = await sharp(logoBuffer)
            .resize(logoWidth, null, { fit: 'contain' })
            .toBuffer();
        
        const logoMeta = await sharp(logo).metadata();

        // Calcular posición del logo (esquina inferior derecha)
        const logoX = width - logoWidth - margin;
        const logoY = height - logoMeta.height - margin;

        // 3. Componer todo
        await sharp(background)
            .composite([
                { input: inputPath, blend: 'over' }, // Camiseta encima del fondo
                { input: logo, top: logoY, left: logoX, blend: 'over' } // Logo en la esquina
            ])
            .toFile(outputPath);
            
        console.log(`✅ Procesado: ${outputPath}`);
    } catch (error) {
        console.error(`❌ Error procesando ${inputPath}:`, error.message);
    }
}

async function traverseDirectory(currentDir, targetDir, bgBuffer, logoBuffer) {
    await fs.mkdir(targetDir, { recursive: true });
    
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullInputPath = path.join(currentDir, entry.name);
        const fullOutputPath = path.join(targetDir, entry.name);
        
        if (entry.isDirectory()) {
            await traverseDirectory(fullInputPath, fullOutputPath, bgBuffer, logoBuffer);
        } else if (entry.isFile() && /\.(png|webp)$/i.test(entry.name)) {
            await processImage(fullInputPath, fullOutputPath, bgBuffer, logoBuffer);
        }
    }
}

async function main() {
    // Permitir argumentos desde línea de comandos para testing
    const inputDirArg = process.argv[2] || CONFIG.INPUT_DIR;
    const outputDirArg = process.argv[3] || CONFIG.OUTPUT_DIR;
    
    const inputDir = path.resolve(inputDirArg);
    const outputDir = path.resolve(outputDirArg);
    const bgPath = path.resolve(CONFIG.BACKGROUND_PATH);
    const logoPath = path.resolve(CONFIG.LOGO_PATH);

    console.log('Iniciando proceso...');
    console.log(`- Origen: ${inputDir}`);
    console.log(`- Destino: ${outputDir}`);
    console.log(`- Fondo: ${bgPath}`);
    console.log(`- Logo: ${logoPath}`);

    try {
        const bgBuffer = await fs.readFile(bgPath);
        const logoBuffer = await fs.readFile(logoPath);
        
        await traverseDirectory(inputDir, outputDir, bgBuffer, logoBuffer);
        
        console.log('🎉 Proceso completado exitosamente.');
    } catch (error) {
        console.error('Error general:', error.message);
    }
}

main();
