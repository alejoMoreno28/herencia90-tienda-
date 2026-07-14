function asPositiveNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function absoluteAssetUrl(assetPath, siteUrl) {
  const value = String(assetPath || '').trim();
  const base = `${String(siteUrl || '').replace(/\/+$/, '')}/`;
  if (!value) return new URL('img/logo.webp', base).href;
  if (value.startsWith('//')) return `https:${value}`;
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    if (url.protocol === 'http:') url.protocol = 'https:';
    return url.href;
  }
  return new URL(value.replace(/^\/+/, ''), base).href;
}

export function getSellableSizes(tallas = {}) {
  return Object.entries(tallas)
    .filter(([size, quantity]) => !String(size).startsWith('R_') && asPositiveNumber(quantity) > 0)
    .map(([size]) => size);
}

export function getSellableStock(tallas = {}) {
  return Object.entries(tallas).reduce((total, [size, quantity]) => {
    if (String(size).startsWith('R_')) return total;
    return total + asPositiveNumber(quantity);
  }, 0);
}

function joinNatural(values) {
  if (values.length <= 1) return values[0] || '';
  if (values.length === 2) return `${values[0]} y ${values[1]}`;
  return `${values.slice(0, -1).join(', ')} y ${values.at(-1)}`;
}

export function buildProductSchemaDescription(product = {}, availableSizes = getSellableSizes(product.tallas)) {
  const description = String(product.descripcion || '').replace(/\s+/g, ' ').trim();
  if (description) return description;

  const rawName = String(product.equipo || 'Camiseta de futbol').replace(/\s+/g, ' ').trim();
  const name = /^camiseta\b/i.test(rawName) ? rawName : `Camiseta ${rawName}`;
  const sizeText = availableSizes.length
    ? ` Tallas disponibles: ${joinNatural(availableSizes)}.`
    : ' Consulta disponibilidad y tallas.';
  return `${name} disponible en HERENCIA90.${sizeText}`;
}
