const fs = require('fs');
let file = fs.readFileSync('scripts/generate-product-pages.mjs', 'utf8');

file = file.replace(/function getCollectionUrl\(collection\)\s*\{\s*return `\$\{siteUrl\}\/categorias\/\$\{collection\.slug\}`;\s*\}/, `function getCollectionUrl(collection) {
  if (collection.type === 'city') return \`\${siteUrl}/ciudades/\${collection.slug}\`;
  return \`\${siteUrl}/categorias/\${collection.slug}\`;
}`);

fs.writeFileSync('scripts/generate-product-pages.mjs', file);
