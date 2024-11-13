const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const twilio = require('twilio');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API);
const PORT = process.env.PORT || 3000;

const accountSid = process.env.ACCOUNT_SID;
const authToken = process.env.AUTH_TOKEN;
const client = twilio(accountSid, authToken);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI).then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Define conversation schema with personality type and timestamps
const conversationSchema = new mongoose.Schema({
    userNumber: String,
    personalityType: { type: String, enum: ['extroverted', 'introverted'], default: 'extroverted' },
    messages: [{
        role: String,
        text: String,
        personality: String,
        timestamp: { type: Date, default: Date.now }
    }],
    lastInteraction: { type: Date, default: Date.now },
    waitingForRating: { type: Boolean, default: false },
    ratingReceived: { type: Boolean, default: false }
});

const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: "you have extroverted personality, your goal is to make the conversation in such a way to ask the user for survey at right time, for chatting you are allowed to use only hindi language in English chracters, and the survey question should be to ask \"which food ordering app they use most zomato or swigy?\", at the end ask user \"give me rating of 1 to 5 please\"",
});

const updateModelPersonality = (personalityType) => {
    if (personalityType === 'extroverted') {
        return genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            systemInstruction: "you have extroverted personality, your goal is to make the conversation in such a way to ask the user for survey at right time, for chatting you are allowed to use only hindi language in English chracters, and the survey question should be to ask \"which food ordering app they use most zomato or swigy?\", at the end ask user \"give me rating of 1 to 5 please\"",
        });
    } else {
        return genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            systemInstruction: "you have introverted personality, your goal is to make the conversation in such a way to ask the user for survey at right time, for chatting you are allowed to use only hindi language in English chracters, and the survey question should be to ask \"which food ordering app they use most zomato or swigy?\", at the end ask user \"give me rating of 1 to 5 please\"",
        });
    }
};

const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 200,
    responseMimeType: "text/plain",
};

const Conversation = mongoose.model('Conversation', conversationSchema);

let modelInstance = model; // Initial model instance

// Function to get bot response with personality-specific prompts
const getReplayFromBot = async (userMessage, userNumber) => {
    let conversation = await Conversation.findOne({ userNumber });
    const currentTimestamp = new Date();

    if (!conversation) {
        conversation = new Conversation({ userNumber, personalityType: 'extroverted', messages: [] });
    } else {
        const timeSinceLastInteraction = currentTimestamp - conversation.lastInteraction;

        if (conversation.ratingReceived && timeSinceLastInteraction >= 2 * 60 * 60 * 1000) {
            conversation.personalityType = conversation.personalityType === 'extroverted' ? 'introverted' : 'extroverted';
            conversation.ratingReceived = false;
            modelInstance = updateModelPersonality(conversation.personalityType);
        }
    }

    conversation.messages.push({ role: "user", text: userMessage, personality: conversation.personalityType, timestamp: currentTimestamp });
    conversation.lastInteraction = currentTimestamp;

    if (conversation.waitingForRating && /^[1-5]$/.test(userMessage)) {
        conversation.ratingReceived = true;
        conversation.waitingForRating = false;
    }

    const chat = modelInstance.startChat({
        generationConfig,
        history: conversation.messages.map(msg => ({
            role: msg.role,
            parts: [{ text: msg.text }]
        }))
    });

    const result = await chat.sendMessage(userMessage);
    const botReply = result.response.text();
    conversation.messages.push({ role: "model", text: botReply, personality: conversation.personalityType, timestamp: currentTimestamp });

    if (botReply.includes("1 se 5")) {
        conversation.waitingForRating = true;
    }

    await conversation.save();
    console.log(`Bot Reply [${conversation.personalityType}]:`, botReply);

    return botReply;
};

// Endpoint to receive incoming messages
app.post('/whatsapp', async (req, res) => {
    const userMessage = req.body.Body;
    const userNumber = req.body.From;
    console.log("User message:", userMessage);

    try {
        const botMessage = await getReplayFromBot(userMessage, userNumber);

        client.messages.create({
            body: botMessage,
            from: 'whatsapp:+14155238886',
            to: userNumber
        })
        .then((message) => {
            console.log("Message sent:", message.sid);
            res.status(200).send("Message sent");
        })
        .catch((error) => {
            console.error("Error sending message:", error);
            res.status(500).send("Failed to send message");
        });

    } catch (error) {
        console.error("Error generating response:", error);
        res.status(500).send("Error generating response");
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
