const fs = require('fs');

let file = fs.readFileSync('scripts/generate-product-pages.mjs', 'utf8');

file = file.replace(
  "for (const collection of seoCollections) {\n  const filePath = path.join(categoryOutputDir, `${collection.slug}.html`);\n  fs.writeFileSync(filePath, renderCollectionPage(collection), 'utf8');\n}",
  `for (const collection of seoCollections) {
  const filePath = collection.type === 'city' 
    ? path.join(cityOutputDir, \`\${collection.slug}.html\`)
    : path.join(categoryOutputDir, \`\${collection.slug}.html\`);
  fs.writeFileSync(filePath, renderCollectionPage(collection), 'utf8');
}`
);

fs.writeFileSync('scripts/generate-product-pages.mjs', file);
