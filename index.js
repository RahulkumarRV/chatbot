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
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("Connected to MongoDB"))
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

// Function to get bot response with personality-specific prompts
const getReplayFromBot = async (userMessage, userNumber) => {
    // Retrieve conversation history or create a new one if none exists
    let conversation = await Conversation.findOne({ userNumber });
    const currentTimestamp = new Date();

    // If no conversation exists, start with first personality
    if (!conversation) {
        conversation = new Conversation({ userNumber, personalityType: 'extroverted', messages: [] });
    } else {
        // Check if it’s time to switch personality
        const timeDifference = currentTimestamp - conversation.lastInteraction;
        if ((timeDifference >= 2 * 60 * 60 * 1000 || conversation.ratingReceived) &&
            conversation.personalityType === 'extroverted') {
            conversation.personalityType = 'introverted';
            conversation.messages = [];  // Clear messages for new personality
        } else if ((timeDifference >= 2 * 60 * 60 * 1000 || conversation.ratingReceived) &&
            conversation.personalityType === 'introverted') {
            conversation.personalityType = 'extroverted';
            conversation.messages = [];  // Clear messages for new personality
        }
    }

    // Append user message to conversation history
    conversation.messages.push({ role: "user", text: userMessage, timestamp: currentTimestamp });
    conversation.lastInteraction = currentTimestamp;
    conversation.ratingReceived = false;  // Reset rating status

    // Use personality-specific prompt for bot response
    const personalityPrompt = conversation.personalityType === 'extroverted' ? 
        "Hey! In this chat, I’ll keep it lively to encourage you. Let’s chat!" : 
        "Hello, I’m here to listen and help—no rush. Take your time.";
    const chat = model.startChat({
        history: conversation.messages.map(msg => ({
            role: msg.role,
            parts: [{ text: msg.text }]
        })),
        prompt: personalityPrompt
    });

    const result = await chat.sendMessage(userMessage);
    const botReply = result.response.text();
    conversation.messages.push({ role: "bot", text: botReply, timestamp: currentTimestamp });

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
