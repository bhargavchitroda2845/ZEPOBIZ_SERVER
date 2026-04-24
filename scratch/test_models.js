require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // There is no direct listModels in the SDK easily accessible without extra auth usually
    // but we can try to "guess" or use the model that definitely works.
    console.log("Testing gemini-1.5-flash...");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Hi");
    console.log("Success with gemini-1.5-flash!");
  } catch (err) {
    console.log("Error with gemini-1.5-flash:", err.message);
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log("Testing gemini-1.5-flash-001...");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-001" });
    const result = await model.generateContent("Hi");
    console.log("Success with gemini-1.5-flash-001!");
  } catch (err) {
    console.log("Error with gemini-1.5-flash-001:", err.message);
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log("Testing gemini-pro...");
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent("Hi");
    console.log("Success with gemini-pro!");
  } catch (err) {
    console.log("Error with gemini-pro:", err.message);
  }
}

listModels();
