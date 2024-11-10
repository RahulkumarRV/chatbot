// Make sure to include these imports:
// import { GoogleGenerativeAI } from "@google/generative-ai";
require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
let messages = [
    
];

const getReplayFromBot = async (message) => {
    const chat = model.startChat({
        history: messages,
    });

    const result = await chat.sendMessage(message);

    // Extract response text from the model result object
    const botReply = result.response.text();

    // Update conversation history
    messages.push(
        {
            role: "user",
            parts: [{ text: message }],
        },
        {
            role: "model",
            parts: [{ text: botReply }],
        }
    );
    console.log(botReply);
    return botReply;
};

getReplayFromBot("Hey! In this chat, you will respond as if you have an extroverted personality. You will only answer questions to encourage and engage the user in conversation to take the survey. If you feel the user is ready, you will present a survey for them to answer. Make sure all replies are short, one or two lines max.");