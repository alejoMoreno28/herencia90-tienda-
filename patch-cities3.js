const fs = require('fs');
let file = fs.readFileSync('scripts/generate-product-pages.mjs', 'utf8');

const regex = /fs\.mkdirSync\(outputDir, \{ recursive: true \}\);\s*fs\.mkdirSync\(categoryOutputDir, \{ recursive: true \}\);\s*for.*$/s;

const newBottom = `fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(categoryOutputDir, { recursive: true });
fs.mkdirSync(cityOutputDir, { recursive: true });

for (const product of products) {
  const filePath = path.join(outputDir, \`\${slugify(product.equipo)}.html\`);
  fs.writeFileSync(filePath, renderProductPage(product), 'utf8');
}

for (const collection of seoCollections) {
  const filePath = collection.type === 'city' 
    ? path.join(cityOutputDir, \`\${collection.slug}.html\`)
    : path.join(categoryOutputDir, \`\${collection.slug}.html\`);
  fs.writeFileSync(filePath, renderCollectionPage(collection), 'utf8');
}

fs.writeFileSync(sitemapPath, buildSitemap(), 'utf8');
fs.writeFileSync(robotsPath, buildRobots(), 'utf8');

console.log(\`Generated \${products.length} product pages, sitemap.xml and robots.txt\`);
`;

file = file.replace(regex, newBottom);

fs.writeFileSync('scripts/generate-product-pages.mjs', file);
