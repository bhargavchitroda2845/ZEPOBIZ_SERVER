require('dotenv').config();
const axios = require('axios');

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

  try {
    const response = await axios.get(url);
    console.log("--- AVAILABLE MODELS ---");
    response.data.models.forEach(m => {
      if (m.supportedGenerationMethods.includes('generateContent')) {
        console.log(m.name);
      }
    });
    console.log("------------------------");
  } catch (err) {
    console.log("Error listing models:", err.response?.data || err.message);
  }
}

listModels();
