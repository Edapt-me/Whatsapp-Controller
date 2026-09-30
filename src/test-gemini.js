require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

async function testGemini() {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: "Say hello to my WhatsApp bot in one short sentence."
        });

        console.log("\n========== GEMINI RESPONSE ==========");
        console.log(response.text);
        console.log("=====================================\n");

    } catch (error) {
        console.error("\nGemini API Error:");
        console.error(error.message);
    }
}

testGemini();