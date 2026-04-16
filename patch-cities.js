const fs = require('fs');

let file = fs.readFileSync('scripts/generate-product-pages.mjs', 'utf8');

// 1. Add cityOutputDir
file = file.replace(
  "const categoryOutputDir = path.join(root, 'web', 'categorias');",
  "const categoryOutputDir = path.join(root, 'web', 'categorias');\nconst cityOutputDir = path.join(root, 'web', 'ciudades');"
);

// 2. Add cities to seoCollections
const citiesCode = `  },
  {
    type: 'city',
    slug: 'bogota',
    name: 'Bogota',
    eyebrow: 'Envios a Bogota',
    title: 'Camisetas de Futbol en Bogota | Herencia 90',
    shortDescription: 'Compra camisetas de futbol en Bogota con pago contra entrega. Camisetas retro, importadas y de temporada enviadas a tu casa.',
    intro: 'Llevamos la pasion del futbol a Bogota con envio seguro y pago contra entrega. Encuentra las mejores referencias retro y de la nueva temporada.',
    faqTitle: 'Preguntas sobre envios a Bogota',
    match(product) { return true; } // Muestra todos los productos
  },
  {
    type: 'city',
    slug: 'medellin',
    name: 'Medellin',
    eyebrow: 'Envios a Medellin',
    title: 'Camisetas de Futbol en Medellin | Herencia 90',
    shortDescription: 'Compra camisetas de futbol en Medellin con pago contra entrega. Camisetas retro, importadas y de temporada enviadas a tu casa.',
    intro: 'Llevamos la pasion del futbol a Medellin con envio seguro y pago contra entrega. Encuentra las mejores referencias retro y de la nueva temporada.',
    faqTitle: 'Preguntas sobre envios a Medellin',
    match(product) { return true; }
  },
  {
    type: 'city',
    slug: 'cali',
    name: 'Cali',
    eyebrow: 'Envios a Cali',
    title: 'Camisetas de Futbol en Cali | Herencia 90',
    shortDescription: 'Compra camisetas de futbol en Cali con pago contra entrega. Camisetas retro, importadas y de temporada enviadas a tu casa.',
    intro: 'Llevamos la pasion del futbol a Cali con envio seguro y pago contra entrega. Encuentra las mejores referencias retro y de la nueva temporada.',
    faqTitle: 'Preguntas sobre envios a Cali',
    match(product) { return true; }
  },
  {
    type: 'city',
    slug: 'barranquilla',
    name: 'Barranquilla',
    eyebrow: 'Envios a Barranquilla',
    title: 'Camisetas de Futbol en Barranquilla | Herencia 90',
    shortDescription: 'Compra camisetas de futbol en Barranquilla con pago contra entrega. Camisetas retro, importadas y de temporada enviadas a tu casa.',
    intro: 'Llevamos la pasion del futbol a Barranquilla con envio seguro y pago contra entrega. Encuentra las mejores referencias retro y de la nueva temporada.',
    faqTitle: 'Preguntas sobre envios a Barranquilla',
    match(product) { return true; }
  },
  {
    type: 'city',
    slug: 'ibague',
    name: 'Ibague',
    eyebrow: 'Envios a Ibague',
    title: 'Camisetas de Futbol en Ibague | Herencia 90',
    shortDescription: 'Compra camisetas de futbol en Ibague con pago contra entrega. Camisetas retro, importadas y de temporada enviadas a tu casa.',
    intro: 'Llevamos la pasion del futbol a Ibague con envio seguro y pago contra entrega. Encuentra las mejores referencias retro y de la nueva temporada.',
    faqTitle: 'Preguntas sobre envios a Ibague',
    match(product) { return true; }
  }
];`;
file = file.replace(/  \}\n\];/g, citiesCode);

// 3. Update getCollectionUrl
file = file.replace(
  "function getCollectionUrl(collection) {\n  return `${siteUrl}/categorias/${collection.slug}`;\n}",
  "function getCollectionUrl(collection) {\n  if (collection.type === 'city') return `${siteUrl}/ciudades/${collection.slug}`;\n  return `${siteUrl}/categorias/${collection.slug}`;\n}"
);

// 4. Update breadcrumbs text in renderCollectionPage
file = file.replace(
  "<span>Categorias</span>",
  "<span>${collection.type === 'city' ? 'Ciudades' : 'Categorias'}</span>"
);

// 5. Update generation loop
const loopCode = `fs.mkdirSync(outputDir, { recursive: true });
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
}`;

file = file.replace(
  /fs\.mkdirSync\(outputDir, \{ recursive: true \}\);[\s\S]*?renderCollectionPage\(collection\), 'utf8'\);\n\}/,
  loopCode
);

fs.writeFileSync('scripts/generate-product-pages.mjs', file);
