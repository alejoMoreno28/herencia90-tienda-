const fs = require('fs');

let file = fs.readFileSync('tests/site-seo.test.mjs', 'utf8');

const newTestBlock = `});

check('static city pages exist and are included in the sitemap', () => {
  const cityPagesDir = path.join(root, 'web', 'ciudades');
  assert.ok(fs.existsSync(cityPagesDir), 'web/ciudades should exist');

  const samplePage = path.join(cityPagesDir, 'medellin.html');
  assert.ok(fs.existsSync(samplePage), 'sample city page should exist');

  const sampleHtml = fs.readFileSync(samplePage, 'utf8');
  assert.match(sampleHtml, /Medellin/i);
  assert.match(sampleHtml, /application\\/ld\\+json/i);

  const sitemap = fs.readFileSync(path.join(root, 'web', 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /https:\\/\\/www\\.herencia90\\.shop\\/ciudades\\/medellin/i);
  assert.match(sitemap, /https:\\/\\/www\\.herencia90\\.shop\\/ciudades\\/ibague/i);
});`;

file = file.replace(/  assert\.match\(sitemap, \/https:\\\/\\\/www\\\.herencia90\\\.shop\\\/categorias\\\/real-madrid\/i\);\n\}\);/, `  assert.match(sitemap, /https:\\/\\/www\\.herencia90\\.shop\\/categorias\\/real-madrid/i);\n${newTestBlock}`);

fs.writeFileSync('tests/site-seo.test.mjs', file);
