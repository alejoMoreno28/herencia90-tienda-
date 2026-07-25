import express from 'express';
import { loadEnvFile } from 'process';
import { spawn } from 'node:child_process';
import path from 'node:path';
import searchProviderImagesHandler from './api/search-provider-images.js';
import matchProviderPhotoHandler from './api/match-provider-photo.mjs';
import processPhotoHandler from './api/process-photo.mjs';

try {
    loadEnvFile('.env');
} catch (e) {
    console.warn("⚠️ No se encontró .env, asegúrate de tener las variables de entorno configuradas.");
}

// El "python" del PATH normal en Windows puede ser un stub roto de Microsoft
// Store. Se puede fijar la ruta real via variable de entorno PYTHON_PATH.
const PYTHON_PATH = process.env.PYTHON_PATH || 'python';
const PHOTO_SERVICE_PORT = 5055;

async function waitForPhotoService(maxWaitMs = 120000) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
        try {
            const res = await fetch(`http://127.0.0.1:${PHOTO_SERVICE_PORT}/health`);
            if (res.ok) return true;
        } catch { /* aun no arranca */ }
        await new Promise((r) => setTimeout(r, 1500));
    }
    return false;
}

function startPhotoService() {
    console.log('🧠 Iniciando servicio de IA de fotos (quitar fondo + comparar)...');
    console.log(`   (usando: ${PYTHON_PATH})`);
    const child = spawn(PYTHON_PATH, [path.join('scripts', 'python', 'photo_service.py')], {
        stdio: 'inherit',
        shell: false,
    });
    child.on('error', (err) => {
        console.error('❌ No se pudo iniciar el servicio de fotos IA:', err.message);
        console.error('   Revisa que PYTHON_PATH en .env apunte al python.exe correcto.');
    });
    child.on('exit', (code) => {
        console.warn(`⚠️ El servicio de fotos IA se cerró (codigo ${code}). Quitar fondo / comparar no funcionara hasta reiniciar el robot.`);
    });
    return child;
}

const app = express();
app.use(express.json({ limit: '25mb' })); // las fotos en base64 pesan mas que el limite por defecto

// CORS casero para que herencia90.shop pueda conectarse
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

function wrap(handler) {
    return async (req, res) => {
        try {
            await handler(req, res);
        } catch (e) {
            console.error('Error en handler local:', e);
            if (!res.headersSent) res.status(500).json({ error: e.message });
        }
    };
}

app.post('/api/search-provider-images', wrap(searchProviderImagesHandler));
app.post('/api/match-provider-photo', wrap(matchProviderPhotoHandler));
app.post('/api/process-photo', wrap(processPhotoHandler));

app.get('/health', async (req, res) => {
    let photoServiceOk = false;
    try {
        const r = await fetch(`http://127.0.0.1:${PHOTO_SERVICE_PORT}/health`);
        photoServiceOk = r.ok;
    } catch { /* no disponible */ }
    res.json({ ok: true, photoService: photoServiceOk });
});

const PORT = 3001;

startPhotoService();

app.listen(PORT, async () => {
    console.log('======================================================');
    console.log('✅ ROBOT DE FOTOS ESTÁ ACTIVO Y ESCUCHANDO');
    console.log('======================================================');
    console.log('👉 Mantén esta ventana abierta.');
    console.log('👉 Ve a herencia90.shop/admin y usa "Ingresar nuevo lote" normalmente.');
    console.log(`(Puerto Node: ${PORT})`);
    console.log('\nEsperando a que el servicio de IA de fotos termine de cargar (puede tardar la primera vez)...');
    const ready = await waitForPhotoService();
    if (ready) {
        console.log('🧠 Servicio de IA de fotos listo. Búsqueda automática y quitar fondo ya disponibles.');
    } else {
        console.warn('⚠️ El servicio de IA de fotos no respondió a tiempo. La búsqueda automática/quitar fondo puede fallar.');
    }
});
