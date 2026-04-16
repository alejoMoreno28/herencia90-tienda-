const fs = require('fs');
let c = fs.readFileSync('web/js/app.js', 'utf8');
c = c.replace(
    '<span>Sobre Nosotros</span>\r\n            </a>',
    '<span>Sobre Nosotros</span>\r\n            </a>\r\n            <a href="/preguntas-frecuentes" class="category-drawer-link">\r\n                <span class="drawer-link-icon"><i class="ph-bold ph-question"></i></span>\r\n                <span>Preguntas Frecuentes</span>\r\n            </a>'
);
fs.writeFileSync('web/js/app.js', c);
console.log('Mobile nav updated');
