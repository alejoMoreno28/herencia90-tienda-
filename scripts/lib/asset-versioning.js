const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const VERSIONED_EXTENSIONS = new Set(['css', 'js', 'json']);

function contentVersion(filePath) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(filePath))
    .digest('hex')
    .slice(0, 12);
}

function listFiles(directory, predicate) {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return listFiles(entryPath, predicate);
      return predicate(entryPath) ? [entryPath] : [];
    });
}

function resolveLocalAsset(currentFile, webDir, assetUrl) {
  let decodedUrl;
  try {
    decodedUrl = decodeURIComponent(assetUrl);
  } catch {
    decodedUrl = assetUrl;
  }

  const candidate = decodedUrl.startsWith('/')
    ? path.resolve(webDir, decodedUrl.slice(1))
    : path.resolve(path.dirname(currentFile), decodedUrl);
  const relative = path.relative(webDir, candidate);

  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) return null;
  return candidate;
}

function withVersion(query, version) {
  const parameters = (query || '')
    .replace(/^\?/, '')
    .split('&')
    .filter(Boolean)
    .filter((parameter) => !/^v=/i.test(parameter));

  parameters.push(`v=${version}`);
  return `?${parameters.join('&')}`;
}

function versionFileReferences(filePath, webDir, allowedExtensions) {
  const original = fs.readFileSync(filePath, 'utf8');
  const assetPattern = /(["'])(?!https?:\/\/|\/\/|data:)([^"'?#]+?\.(css|js|json))(\?[^"'#\s]*)?(#[^"']*)?\1/gi;
  const updated = original.replace(
    assetPattern,
    (match, quote, assetUrl, extension, query = '', fragment = '') => {
      if (!allowedExtensions.has(extension.toLowerCase())) return match;

      const assetPath = resolveLocalAsset(filePath, webDir, assetUrl);
      if (!assetPath) return match;

      return `${quote}${assetUrl}${withVersion(query, contentVersion(assetPath))}${fragment}${quote}`;
    }
  );

  if (updated === original) return false;
  fs.writeFileSync(filePath, updated);
  return true;
}

function versionRepository(repoRoot = path.resolve(__dirname, '..', '..')) {
  const root = path.resolve(repoRoot);
  const webDir = path.join(root, 'web');
  if (!fs.existsSync(webDir)) {
    throw new Error(`No se encontro el directorio web en ${webDir}`);
  }

  const changedFiles = [];
  const javascriptFiles = listFiles(path.join(webDir, 'js'), (filePath) => filePath.endsWith('.js'));
  const htmlFiles = listFiles(webDir, (filePath) => filePath.endsWith('.html'));

  for (const filePath of javascriptFiles) {
    if (versionFileReferences(filePath, webDir, new Set(['json']))) {
      changedFiles.push(filePath);
    }
  }

  for (const filePath of htmlFiles) {
    if (versionFileReferences(filePath, webDir, VERSIONED_EXTENSIONS)) {
      changedFiles.push(filePath);
    }
  }

  return { changedFiles };
}

module.exports = {
  contentVersion,
  versionRepository
};
