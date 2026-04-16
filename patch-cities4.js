const fs = require('fs');
let file = fs.readFileSync('scripts/generate-product-pages.mjs', 'utf8');

if (!file.includes("slug: 'medellin'")) {
  const citiesCode = `,
  {
    type: 'city',
    slug: 'bogota',
    name: 'Bogota',
    eyebrow: 'Envios a Bogota',
    title: 'Camisetas de Futbol en Bogota | Herencia 90',
    shortDescription: 'Compra camisetas de futbol en Bogota con pago contra entrega. Camisetas retro, importadas y de temporada enviadas a tu casa.',
    intro: 'Llevamos la pasion del futbol a Bogota con envio seguro y pago contra entrega. Encuentra las mejores referencias retro y de la nueva temporada.',
    faqTitle: 'Preguntas sobre envios a Bogota',
    match(product) { return true; }
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
  
  file = file.replace(/  \}\r?\n\];/, citiesCode);
  fs.writeFileSync('scripts/generate-product-pages.mjs', file);
}
