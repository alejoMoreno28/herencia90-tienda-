const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const INPUT_DIR = path.join(__dirname, '../EQUIPOS');
const CENSORED_DIR = path.join(__dirname, '../EQUIPOS_CENSURADOS');
const DB_FILE = path.join(__dirname, 'censor_tool/censor_db.json');

async function scanDir(dir) {
    let results = [];
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results = results.concat(await scanDir(fullPath));
        } else if (/\.(png|webp|jpg|jpeg)$/i.test(entry.name)) {
            results.push(path.relative(CENSORED_DIR, fullPath));
        }
    }
    return results;
}

// Simple union-find for clustering nearby pixels
class UnionFind {
    constructor(size) {
        this.parent = new Int32Array(size);
        for(let i=0; i<size; i++) this.parent[i] = i;
    }
    find(i) {
        if (this.parent[i] === i) return i;
        return this.parent[i] = this.find(this.parent[i]);
    }
    union(i, j) {
        let rootI = this.find(i);
        let rootJ = this.find(j);
        if (rootI !== rootJ) this.parent[rootI] = rootJ;
    }
}

async function processImage(relPath, censorDB) {
    const origPath = path.join(INPUT_DIR, relPath);
    const censPath = path.join(CENSORED_DIR, relPath);
    
    if (!fs.existsSync(origPath)) return;
    
    // Load original with EXIF rotation
    const origBuffer = await sharp(origPath).rotate().toBuffer();
    const censBuffer = await fs.promises.readFile(censPath);
    
    const origMeta = await sharp(origBuffer).metadata();
    const censMeta = await sharp(censBuffer).metadata();
    
    if (origMeta.width !== censMeta.width || origMeta.height !== censMeta.height) {
        console.log(`⚠️ Dimensiones no coinciden para ${relPath}. Saltando.`);
        return;
    }

    // Get raw grayscale difference to save memory
    const diffBuffer = await sharp(origBuffer)
        .composite([{ input: censBuffer, blend: 'difference' }])
        .greyscale()
        .raw()
        .toBuffer();
        
    const width = origMeta.width;
    const height = origMeta.height;
    
    // Find all pixels with difference > 5
    let diffPixels = [];
    for (let i = 0; i < diffBuffer.length; i++) {
        if (diffBuffer[i] > 5) {
            diffPixels.push(i);
        }
    }
    
    if (diffPixels.length === 0) {
        console.log(`⏭️ Sin logos marcados: ${relPath}`);
        censorDB[relPath] = [];
        return;
    }

    // Cluster pixels into bounding boxes
    // To avoid O(N^2) on millions of pixels, we divide the image into a grid of 20x20 blocks
    const blockSize = 20;
    const cols = Math.ceil(width / blockSize);
    const rows = Math.ceil(height / blockSize);
    const grid = new Int32Array(cols * rows);
    
    for (let idx of diffPixels) {
        let x = idx % width;
        let y = Math.floor(idx / width);
        let gx = Math.floor(x / blockSize);
        let gy = Math.floor(y / blockSize);
        grid[gy * cols + gx] = 1;
    }
    
    let uf = new UnionFind(cols * rows);
    
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            let idx = y * cols + x;
            if (grid[idx]) {
                // Check neighbors (right, bottom, bottom-right, bottom-left)
                const neighbors = [
                    [1, 0], [0, 1], [1, 1], [-1, 1], [2, 0], [0, 2] // slight tolerance
                ];
                for (let [dx, dy] of neighbors) {
                    let nx = x + dx;
                    let ny = y + dy;
                    if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
                        let nIdx = ny * cols + nx;
                        if (grid[nIdx]) {
                            uf.union(idx, nIdx);
                        }
                    }
                }
            }
        }
    }
    
    // Aggregate bounding boxes by root
    let boxes = {};
    for (let idx of diffPixels) {
        let x = idx % width;
        let y = Math.floor(idx / width);
        let gx = Math.floor(x / blockSize);
        let gy = Math.floor(y / blockSize);
        let root = uf.find(gy * cols + gx);
        
        if (!boxes[root]) {
            boxes[root] = { minX: x, minY: y, maxX: x, maxY: y };
        } else {
            if (x < boxes[root].minX) boxes[root].minX = x;
            if (x > boxes[root].maxX) boxes[root].maxX = x;
            if (y < boxes[root].minY) boxes[root].minY = y;
            if (y > boxes[root].maxY) boxes[root].maxY = y;
        }
    }
    
    let patches = [];
    let composites = [];
    
    for (let root in boxes) {
        let b = boxes[root];
        let bw = b.maxX - b.minX + 1;
        let bh = b.maxY - b.minY + 1;
        
        // Ignore tiny noise (less than 10x10)
        if (bw < 10 || bh < 10) continue;
        
        // Expand bounding box slightly for safety
        let expand = 15;
        let finalLeft = Math.max(0, b.minX - expand);
        let finalTop = Math.max(0, b.minY - expand);
        let finalWidth = Math.min(width - finalLeft, bw + expand*2);
        let finalHeight = Math.min(height - finalTop, bh + expand*2);
        
        let sizeRatio = finalWidth / width;
        patches.push({ x: finalLeft + finalWidth/2, y: finalTop + finalHeight/2, sizeRatio });
        
        // Apply MASSIVE blur (50)
        const blurredBox = await sharp(origBuffer)
            .extract({ left: finalLeft, top: finalTop, width: finalWidth, height: finalHeight })
            .blur(50)
            .toBuffer();
            
        composites.push({ input: blurredBox, top: finalTop, left: finalLeft });
    }
    
    censorDB[relPath] = patches;
    
    if (composites.length > 0) {
        await sharp(origBuffer)
            .composite(composites)
            .toFile(censPath);
        console.log(`✅ Intensificado (${composites.length} logos): ${relPath}`);
    } else {
        console.log(`⏭️ Sin logos marcados: ${relPath}`);
    }
}

async function run() {
    console.log("🚀 Iniciando proceso de intensificación de difuminado automático...");
    const images = await scanDir(CENSORED_DIR);
    let censorDB = {};
    
    for (const relPath of images) {
        try {
            await processImage(relPath, censorDB);
        } catch(e) {
            console.error(`❌ Error en ${relPath}: ${e.message}`);
        }
    }
    
    fs.writeFileSync(DB_FILE, JSON.stringify(censorDB, null, 2));
    console.log("🎉 ¡Terminado! La base de datos de clics ha sido guardada y las fotos están re-censuradas al máximo.");
}

run();
