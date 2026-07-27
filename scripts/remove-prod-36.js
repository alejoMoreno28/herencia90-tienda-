const fs = require('fs');
const path = require('path');
const productId = 36;
const webDir = path.join(process.cwd(), 'web');

const dirsToClean = [
    path.join(webDir, 'ciudades'),
    path.join(webDir, 'categorias')
];

let filesProcessed = 0;
let itemsRemoved = 0;

for (const dir of dirsToClean) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
    for (const file of files) {
        const filePath = path.join(dir, file);
        let html = fs.readFileSync(filePath, 'utf8');
        let modified = false;

        // 1. Remove from STATIC_COLLECTION JSON
        const staticMatch = html.match(/const STATIC_COLLECTION = (\{.*?\});/);
        if (staticMatch) {
            try {
                const collection = JSON.parse(staticMatch[1]);
                const originalLength = collection.products ? collection.products.length : 0;
                
                collection.productIds = (collection.productIds || []).filter(id => id !== productId);
                collection.products = (collection.products || []).filter(p => p.id !== productId);
                
                if (collection.products.length !== originalLength) {
                    html = html.replace(staticMatch[0], 'const STATIC_COLLECTION = ' + JSON.stringify(collection) + ';');
                    modified = true;
                    itemsRemoved++;
                }
            } catch (e) {
                console.error('Error parsing JSON in', file);
            }
        }

        if (modified) {
            fs.writeFileSync(filePath, html, 'utf8');
            filesProcessed++;
        }
    }
}

// Remove from productos.json if exists
const prodJsonPath = path.join(webDir, 'productos.json');
if (fs.existsSync(prodJsonPath)) {
    let prods = JSON.parse(fs.readFileSync(prodJsonPath, 'utf8'));
    const before = prods.length;
    prods = prods.filter(p => p.id !== productId);
    if (prods.length !== before) {
        fs.writeFileSync(prodJsonPath, JSON.stringify(prods, null, 2), 'utf8');
        console.log('Removed from productos.json');
    }
}

// Delete the specific shirt HTML
const productHtmlPath = path.join(webDir, 'camisetas', 'camiseta-arsenal-local-2025-26.html');
if (fs.existsSync(productHtmlPath)) {
    fs.unlinkSync(productHtmlPath);
    console.log('Deleted product HTML page');
}

console.log(`Done. Processed ${filesProcessed} files, removed ${itemsRemoved} product instances.`);
