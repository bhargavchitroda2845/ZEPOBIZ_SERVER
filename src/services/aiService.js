const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const generateReply = async (message, context, history = [], imageData = null) => {
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const systemContext = `Business: ${context.businessName}. Items: ${context.productList}.
      Rules:
      1. Extract items: [[ORDER_CONFIRMED: {"items": [{"product": "NAME", "quantity": NUM}], "address": "ADDR"}]]
      2. If change address: [[CHANGE_ADDRESS]]
      3. Keep response short.`;

      let result;
      if (imageData) {
        const parts = [
          { text: `${systemContext}\n\nImage Text: ${message}` },
          { inlineData: { mimeType: imageData.mimeType, data: imageData.base64 } }
        ];
        result = await model.generateContent(parts);
      } else {
        result = await model.generateContent(`${systemContext}\n\nUser: ${message}`);
      }

      const response = await result.response;
      return response.text();

    } catch (error) {
      attempts++;
      console.error(`AI Attempt ${attempts} failed:`, error.message);
      
      if (error.message.includes('429') && attempts < maxAttempts) {
        console.log("Quota exceeded. Waiting 10 seconds before retry...");
        await sleep(10000);
        continue;
      }
      
      return "I'm a bit busy right now! Please try again in 30 seconds, or type 'confirm' if the order above is correct.";
    }
  }
};



module.exports = { generateReply };

