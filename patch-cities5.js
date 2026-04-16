const fs = require('fs');
let file = fs.readFileSync('scripts/generate-product-pages.mjs', 'utf8');

file = file.replace(/(\s*match\(product\)\s*\{\s*return includesNormalized\([\s\S]*?\);\s*\})\s*,\s*\{\s*type: 'city',/g, "$1\n  },\n  {\n    type: 'city',");

fs.writeFileSync('scripts/generate-product-pages.mjs', file);
