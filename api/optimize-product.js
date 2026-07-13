import { createClient } from '@supabase/supabase-js';
import adminSecurity from './_lib/admin-security.cjs';

const { applyAdminCors, authorizeAdminRequest, hasOversizedJsonBody } = adminSecurity;

export default async function handler(req, res) {
    const corsAllowed = applyAdminCors(req, res);
    if (req.method === 'OPTIONS') return corsAllowed ? res.status(204).end() : res.status(403).end();
    if (!corsAllowed) return res.status(403).json({ error: 'Origen no permitido.' });
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    if (hasOversizedJsonBody(req.body, 8 * 1024)) {
        return res.status(413).json({ error: 'Solicitud demasiado grande.' });
    }

    const authorization = await authorizeAdminRequest(req, process.env, createClient);
    if (!authorization.ok) {
        return res.status(authorization.status).json({ error: authorization.error });
    }

    const rawName = String(req.body?.rawName || '').trim();
    if (!rawName) {
        return res.status(400).json({ error: 'Missing rawName' });
    }
    if (rawName.length > 240) {
        return res.status(400).json({ error: 'El nombre es demasiado largo.' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY no configurada en el servidor.' });
    }

    try {
        const prompt = `Eres un experto mundial en camisetas de fútbol y SEO. El dueño de la tienda pegó este nombre crudo desde su Excel: "${rawName}".
Tu objetivo es analizarlo y devolver un JSON estrictamente estructurado (sin formato markdown \`\`\`json) con los siguientes campos:
1. "nombre_oficial": El nombre correcto y atractivo para la tienda online (Ej. "Barcelona Edición 125 Aniversario 2024/25").
2. "descripcion": Una descripción vendedora de 2 párrafos. El primero sobre la historia o detalle de la camiseta, el segundo sobre los materiales o tallaje.
3. "categoria": "Equipos Europeos", "Selecciones Nacionales", "Equipos Sudamericanos", "Retro", o "Nueva Colección".
4. "pais_o_club": El nombre del club o país (Ej. "Barcelona").
5. "decada": Si es retro, pon la década (Ej. "90s", "2000s"). Si es reciente, pon "Actual".
6. "termino_busqueda": Un término de búsqueda CORTO y preciso (Máximo 3 palabras: País/Club + Año). Ej: "Brasil 2004", "Arsenal 2003", "Real Madrid 2012". No pongas "Home", "Retro" ni colores.

Devuelve SOLO el JSON válido.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.3,
                    responseMimeType: "application/json"
                }
            })
        });

        if (!response.ok) {
            console.error("Error Gemini status:", response.status);
            throw new Error('Error en la API de Gemini');
        }

        const data = await response.json();
        const textResponse = data.candidates[0].content.parts[0].text;
        
        let jsonResult;
        try {
            const cleanText = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            jsonResult = JSON.parse(cleanText);
        } catch(e) {
            console.error("Error parseando respuesta JSON de Gemini");
            throw new Error('La IA no devolvió un JSON válido');
        }

        return res.status(200).json(jsonResult);
    } catch (error) {
        console.error("Error optimize-product:", error);
        return res.status(500).json({ error: 'No fue posible optimizar el producto.' });
    }
}
