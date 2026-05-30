import express from 'express';
import { loadEnvFile } from 'process';
import handler from './api/search-provider-images.js';

try {
    loadEnvFile('.env');
} catch (e) {
    console.warn("⚠️ No se encontró .env, asegúrate de tener las variables de entorno configuradas.");
}

const app = express();
app.use(express.json());

// CORS casero para que herencia90.shop pueda conectarse
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.post('/api/search-provider-images', async (req, res) => {
    try {
        await handler(req, res);
    } catch(e) {
        console.error("Error en local handler:", e);
        if (!res.headersSent) {
            res.status(500).json({ error: e.message });
        }
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log('======================================================');
    console.log('✅ ROBOT EXTRAIDOR DE FOTOS ESTÁ ACTIVO Y ESCUCHANDO');
    console.log('======================================================');
    console.log('👉 Mantén esta ventana abierta.');
    console.log('👉 Ahora ve a herencia90.shop/admin, pega tu Excel y el robot descargará las fotos usando tu internet local.');
    console.log(`(Puerto interno: ${PORT})`);
});
