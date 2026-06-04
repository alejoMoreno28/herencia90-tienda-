async function main() {
    try {
        const { pipeline, env } = await import('@xenova/transformers');
        
        // Deshabilitar telemetría y usar caché local
        env.allowLocalModels = false; 
        
        console.log("Cargando modelo de IA (puede tardar unos minutos la primera vez al descargar ~600MB)...");
        let detector = await pipeline('zero-shot-object-detection', 'Xenova/owlvit-base-patch32');
        console.log("Modelo cargado. Procesando imagen de prueba...");
        
        const testImage = 'EQUIPOS/ALEMANIA 2026 VERSION FAN/alemania 2026 fan/12.png';
        const candidateLabels = ['logo', 'brand logo', 'adidas logo', 'nike logo', 'puma logo'];
        
        let output = await detector(testImage, candidateLabels, { threshold: 0.01 });
        console.log("Resultados de Detección:");
        console.log(JSON.stringify(output, null, 2));
    } catch (error) {
        console.error("Error en la IA:", error);
    }
}

main();
