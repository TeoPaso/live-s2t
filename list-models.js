import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.VITE_GEMINI_API_KEY;

async function listModels() {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1alpha/models?key=${apiKey}`);
    const data = await res.json();
    const bidiModels = data.models.filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('bidiGenerateContent'));
    console.log("Bidi models:", bidiModels.map(m => m.name));
}

listModels();
