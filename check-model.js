import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.VITE_GEMINI_API_KEY;

async function checkModel() {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash?key=${apiKey}`);
    const data = await res.json();
    console.log(data);
}

checkModel();