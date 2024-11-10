const express = require('express');
require('dotenv').config();
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const PORT = process.env.PORT || 3000;

const accountSid = process.env.ACCOUNT_SID;
const authToken = process.env.AUTH_TOKEN;
const openaikey = process.env.OPEN_AI_KEY;

const client = require('twilio')(accountSid, authToken);
const { OpenAI } = require("openai");
const openaiclient = new OpenAI({
    apiKey: openaikey
});
let messages = [];

const getReplayFromBot = async (message) => {
    const chat = model.startChat({
        history: messages,
    });

    const result = await chat.sendMessage(message);

    // Extract response text from the model result object
    const botReply = result.response.text;

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

app.get('/', (req, res) => {
    res.send("Hello world!");
});

// Endpoint to receive incoming messages
app.post('/whatsapp', async (req, res) => {
    const userMessage = req.body.Body;
    console.log("User message:", userMessage);

    try {
        // Get bot's response
        const botMessage = await getReplayFromBot(userMessage);

        // Send response back to the user on WhatsApp
        client.messages.create({
            body: botMessage,
            from: 'whatsapp:+14155238886',
            to: 'whatsapp:+916283690512'
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
        console.error("Error getting response from Gemini API:", error);
        res.status(500).send("Error generating response");
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    getReplayFromBot("Hey! In this chat, you will respond as if you have an extroverted personality. You will only answer questions to encourage and engage the user in conversation to take the survey. If you feel the user is ready, you will present a survey for them to answer. Make sure all replies are short, one or two lines max.");
});
