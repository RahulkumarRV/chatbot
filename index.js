// Make sure to include these imports:
// import { GoogleGenerativeAI } from "@google/generative-ai";
require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
let messages = [
    {
        role: "model",
        parts: [{ text: "Hey! In this chat, you will respond as if you have an extroverted personality. you will only answer questions to encourage and engage the user in conversation to take the survey. If you feel the user is ready, you will present a survey for you to answer. make sure all reply should be short lesser or in a line one or two max" }],
    }
];
const getReplayFromBot = async (message) => {
    messages.append(
        {
            role: "user",
            parts: [{ text: message }],
        }
    );
    const chat = model.startChat({
    history: messages,
    });
    let result = await chat.sendMessage("I have 2 dogs in my house.");
    console.log(result.response.text());
    return result.response.text();
}

chat();