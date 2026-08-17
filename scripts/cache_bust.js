const path = require('path');
const { versionRepository } = require('./lib/asset-versioning.js');

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const repoRoot = path.resolve(argumentValue('--root') || path.join(__dirname, '..'));
const { changedFiles } = versionRepository(repoRoot);

if (changedFiles.length === 0) {
  console.log('Asset versions already match their file contents.');
} else {
  for (const filePath of changedFiles) {
    console.log(`Versioned ${path.relative(repoRoot, filePath)}`);
  }
  console.log(`Updated ${changedFiles.length} file(s).`);
}
