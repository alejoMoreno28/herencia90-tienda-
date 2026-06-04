const fs = require('fs');
const path = require('path');

const ts = Date.now();
const vercelPath = path.join(__dirname, '..', 'vercel.json');
let vercelJson = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));

vercelJson.headers = [
  {
    "source": "/(.*)\\.(js|css)",
    "headers": [
      { "key": "Cache-Control", "value": "public, max-age=3600, stale-while-revalidate=86400" }
    ]
  },
  {
    "source": "/(.*)\\.(webp|png|jpg|jpeg|gif|svg|mp4|webm)",
    "headers": [
      { "key": "Cache-Control", "value": "public, max-age=3600, stale-while-revalidate=86400" }
    ]
  },
  {
    "source": "/(.*)\\.json",
    "headers": [
      { "key": "Cache-Control", "value": "no-store, no-cache, must-revalidate" }
    ]
  },
  {
    "source": "/(.*)\\.html",
    "headers": [
      { "key": "Cache-Control", "value": "no-store, no-cache, must-revalidate" }
    ]
  },
  {
    "source": "/",
    "headers": [
      { "key": "Cache-Control", "value": "no-store, no-cache, must-revalidate" }
    ]
  }
];

fs.writeFileSync(vercelPath, JSON.stringify(vercelJson, null, 2));
console.log('Updated vercel.json');

const walkSync = function(dir, filelist) {
  let files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    if (fs.statSync(dir + '/' + file).isDirectory()) {
      filelist = walkSync(dir + '/' + file, filelist);
    } else {
      if (file.endsWith('.html')) {
        filelist.push(dir + '/' + file);
      }
    }
  });
  return filelist;
};

const webDir = path.join(__dirname, '..', 'web');
const htmlFiles = walkSync(webDir);

htmlFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content.replace(/\.css\?v=[^"']+/g, `.css?v=${ts}`)
                          .replace(/\.js\?v=[^"']+/g, `.js?v=${ts}`);
  if (content !== newContent) {
    fs.writeFileSync(file, newContent);
    console.log(`Updated ${file}`);
  }
});

const appJsPath = path.join(__dirname, '..', 'web', 'js', 'app.js');
let appJsContent = fs.readFileSync(appJsPath, 'utf8');
appJsContent = appJsContent.replace(/fetch\('([^']+?\.json)'\)/g, `fetch('$1?v=${ts}')`);
appJsContent = appJsContent.replace(/fetch\('([^']+?\.json)\?v=\d+'\)/g, `fetch('$1?v=${ts}')`);
fs.writeFileSync(appJsPath, appJsContent);
console.log('Updated app.js');
