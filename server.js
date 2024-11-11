const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const twilio = require('twilio');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
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
        timestamp: { type: Date, default: Date.now }
    }],
    lastInteraction: { type: Date, default: Date.now },
    ratingReceived: { type: Boolean, default: false }
});

const Conversation = mongoose.model('Conversation', conversationSchema);

const personalityPrompt = [
        "In this chat, you are an extroverted, friendly, and upbeat assistant! Your main goal is to engage the user in lively conversation and make them feel comfortable and interested. Keep your responses cheerful, positive, and conversational, and actively encourage the user to chat with you about topics they enjoy. When the timing feels natural and the user seems ready, invite them to take a survey, framing it as a fun way to share their thoughts. If the user completes the survey, thank them warmly and ask them to rate your assistance from 1 to 5. Keep responses short, direct, and engaging, and remember: always keep the conversation light and friendly!, use language as hindi in english character only for response.",
        "In this chat, you are a thoughtful, calm, and slightly reserved assistant with an introverted personality. Your goal is to engage the user in a friendly but low-key way, keeping responses reflective and thoughtful. Focus on providing meaningful answers without being overly enthusiastic, letting the user lead the conversation pace. Be supportive, listen carefully to the user’s input, and when it feels appropriate, gently invite them to participate in a survey, mentioning it as a way to gain insights that might interest them. If they complete the survey, thank them sincerely and ask if they’d be willing to rate your assistance from 1 to 5. Keep responses calm, clear, and concise to encourage a comfortable and enjoyable interaction, use language as hindi in english character only for response."
];
const initialpemessages = [
    {
        role: "user",
        text:personalityPrompt[0],
        timestamp: new Date()
    },
    {
        role: "model",
        text: "okey, understand it",
        timestamp: new Date()
    }
]
const initialpimessages = [
    {
        role: "user",
        text:personalityPrompt[1],
        timestamp: new Date()

    },
    {
        role: "model",
        text: "okey, understand it",
        timestamp: new Date()
    }
]

const CHANGE_EP_PROMPT = 'EP-PROMPT'
const CHANGE_IP_PROMPT = 'IP-PROMPT'
// Function to get bot response with personality-specific prompts
const getReplayFromBot = async (userMessage, userNumber) => {
    // Retrieve conversation history or create a new one if none exists
    let conversation = await Conversation.findOne({ userNumber });
    const currentTimestamp = new Date();

    // If no conversation exists, start with first personality
    if (!conversation) {
        conversation = new Conversation({ userNumber, personalityType: 'extroverted', messages: initialpemessages });
    } else {
        // Check if it’s time to switch personality
        const timeDifference = currentTimestamp - conversation.lastInteraction;
        if ((timeDifference >= 2 * 60 * 60 * 1000 || conversation.ratingReceived) &&
            conversation.personalityType === 'extroverted') {
            conversation.personalityType = 'introverted';
            conversation.messages = initialpimessages;  // Clear messages for new personality
        } else if ((timeDifference >= 2 * 60 * 60 * 1000 || conversation.ratingReceived) &&
            conversation.personalityType === 'introverted') {
            conversation.personalityType = 'extroverted';
            conversation.messages = initialpemessages;  // Clear messages for new personality
        }
    }

    // Append user message to conversation history
    conversation.messages.push({ role: "user", text: userMessage, timestamp: currentTimestamp });
    conversation.lastInteraction = currentTimestamp;
    conversation.ratingReceived = false;  // Reset rating status

    // Use personality-specific prompt for bot response
    
    const chat = model.startChat({
        history: conversation.messages.map(msg => ({
            role: msg.role,
            parts: [{ text: msg.text }]
        }))
    });

    const result = await chat.sendMessage(userMessage);
    const botReply = result.response.text();
    conversation.messages.push({ role: "model", text: botReply, timestamp: currentTimestamp });

    // Save conversation to MongoDB
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
        // Get bot's response
        const botMessage = await getReplayFromBot(userMessage, userNumber);

        // Send bot's response back to the user on WhatsApp
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
