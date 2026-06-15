export function buildProductDraft(reference) {
  const title = reference.title || ['Camiseta', reference.teamName, reference.seasonLabel].filter(Boolean).join(' ');
  const categoryLabel = labelForCategory(reference.categoryPrimary);
  const typeLabel = labelForType(reference.shirtType);
  const colorText = reference.expectedColors.length ? ` Colores esperados: ${reference.expectedColors.join(', ')}.` : '';
  const noteText = reference.notes ? ` Notas: ${reference.notes}.` : '';
  const description = [
    `Camiseta ${title} disponible para HERENCIA90.`,
    `Referencia ${categoryLabel}${typeLabel ? `, version ${typeLabel}` : ''}.`,
    colorText.trim(),
    noteText.trim(),
    'Producto sujeto a revision visual antes de publicar.',
  ].filter(Boolean).join(' ');

  return {
    title,
    description,
    seoTitle: `${title} | HERENCIA90`,
    metaDescription: description.slice(0, 156),
    tags: buildTags(reference),
    confidence: confidenceFor(reference),
    warnings: buildWarnings(reference),
  };
}

function buildTags(reference) {
  return [
    reference.teamName,
    reference.seasonLabel,
    reference.categoryPrimary,
    reference.shirtType,
    reference.fitType !== 'unknown' ? reference.fitType : '',
    reference.sleeveType !== 'unknown' ? `manga-${reference.sleeveType}` : '',
    ...reference.expectedColors,
  ].filter(Boolean);
}

function buildWarnings(reference) {
  const warnings = [];
  if (!reference.providerUrl) warnings.push('Sin URL de proveedor.');
  if (!reference.teamName) warnings.push('Falta equipo.');
  if (!reference.seasonLabel) warnings.push('Falta temporada.');
  if (reference.shirtType === 'unknown') warnings.push('Tipo de camiseta no identificado.');
  if (reference.expectedColors.length === 0) warnings.push('Sin colores esperados para validar imagenes.');
  return warnings;
}

function confidenceFor(reference) {
  let score = 0.35;
  if (reference.providerUrl) score += 0.1;
  if (reference.teamName) score += 0.15;
  if (reference.seasonLabel) score += 0.15;
  if (reference.shirtType !== 'unknown') score += 0.1;
  if (reference.expectedColors.length) score += 0.1;
  if (reference.notes) score += 0.05;
  return Number(Math.min(score, 0.95).toFixed(2));
}

function labelForCategory(value) {
  const labels = {
    retro: 'retro',
    seleccion: 'de seleccion',
    temporada_actual: 'de temporada actual',
    edicion_especial: 'de edicion especial',
    club: 'de club',
  };
  return labels[value] || value || 'sin categoria';
}

function labelForType(value) {
  const labels = {
    local: 'local',
    visitante: 'visitante',
    tercera: 'tercera',
    portero: 'portero',
    entrenamiento: 'entrenamiento',
    especial: 'especial',
  };
  return labels[value] || '';
}
