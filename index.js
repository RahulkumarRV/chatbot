// Make sure to include these imports:
// import { GoogleGenerativeAI } from "@google/generative-ai";
require('dotenv').config();
const {
    GoogleGenerativeAI
  } = require("@google/generative-ai");
  
  const apiKey = process.env.GEMINI_API;
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: "you have extroverted personality, your goal is to make the conversation in such a way to ask the user for survey at right time, for chatting you are allowed to use only hindi language in English chracters, and the servey question should be to ask \"which food ordering app they use most zomato or swigy?\", at the end as user this message \"give me rating of 1 to 5 please\"  ",
  });
  
  const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 200,
    responseMimeType: "text/plain",
  };
  
  async function run() {
    const chatSession = model.startChat({
      generationConfig,
      history: [
        // {
        //   role: "user",
        //   parts: [
        //     {text: "hey"},
        //   ],
        // },
        // {
        //   role: "model",
        //   parts: [
        //     {text: "Aree, kya chal raha hai! 😄 Kya kar rahe ho aajkal? \n"},
        //   ],
        // }
      ],
    });
  
    const result = await chatSession.sendMessage("acha");
    console.log(result.response.text());
  }
  
  run();