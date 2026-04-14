# Google Search Console Checklist

Estado actual:
- Sitemap activo: `https://www.herencia90.shop/sitemap.xml`
- Robots activo: `https://www.herencia90.shop/robots.txt`
- URLs SEO activas por camiseta: `https://www.herencia90.shop/camisetas/...`
- Sincronizacion automatica del catalogo SEO: cada 6 horas desde GitHub Actions

Pasos manuales obligatorios:
1. Entrar a Google Search Console con la cuenta que administrara la web.
2. Agregar la propiedad de `https://www.herencia90.shop/`.
3. Verificar la propiedad.
   Opcion recomendada: propiedad de dominio por DNS, porque cubre mejor futuras variantes del sitio.
4. Ir a `Sitemaps` y enviar `https://www.herencia90.shop/sitemap.xml`.
5. Usar `Inspeccion de URL` y pedir indexacion de estas paginas primero:
   - `https://www.herencia90.shop/`
   - `https://www.herencia90.shop/preventa`
   - `https://www.herencia90.shop/camisetas/camiseta-local-colombia-26`
   - `https://www.herencia90.shop/camisetas/camiseta-local-real-madrid-25-26`
   - `https://www.herencia90.shop/camisetas/camiseta-local-barcelona-25-26`
   - `https://www.herencia90.shop/camisetas/camiseta-local-bayern-munich-25-26`
   - `https://www.herencia90.shop/camisetas/camiseta-local-colombia-26-mujer`

Chequeo recomendado despues de indexar:
1. Confirmar que Google lea el sitemap sin errores.
2. Revisar cobertura de indexacion durante la primera semana.
3. Volver a pedir indexacion manual si una referencia clave sigue fuera despues de varios dias.

Notas utiles:
- Las paginas SEO se regeneran automaticamente desde Supabase cada 6 horas.
- Si agregas o editas una camiseta en el panel admin, el sitemap y las fichas deberian actualizarse solos en el siguiente ciclo.
- Si quieres una sincronizacion inmediata fuera del horario, puedes ejecutar manualmente el workflow `Sync SEO Catalog` en GitHub Actions.
