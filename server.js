const express = require('express');
require('dotenv').config();
const app = express();
app.use(express.json());
app.use(express.urlencoded({extended: false}));
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const PORT = process.env.PORT || 3000;

const accountSid = process.env.ACCOUNT_SID
const authToken = process.env.AUTH_TOKEN
const openaikey = process.env.OPEN_AI_KEY

const client = require('twilio')(accountSid, authToken);
const { OpenAI} = require("openai");
const openaiclient = new OpenAI({
    apiKey: openaikey
});
let messages = [
    {
        role: "model",
        parts: [{ text: "Hey! In this chat, you will respond as if you have an extroverted personality. you will only answer questions to encourage and engage the user in conversation to take the survey. If you feel the user is ready, you will present a survey for you to answer. make sure all reply should be short lesser or in a line one or two max" }],
    }
];

const getReplayFromBot = async (message) => {
    const chat = model.startChat({
    history: messages,
    });
    let result = await chat.sendMessage(message);
    messages.append(
        {
            role: "user",
            parts: [{ text: message }],
        },
        {
            role: "model",
            parts: [{ text: result.response.text() }],
        }
    );
    console.log(result.response.text());
    return result.response.text();
}

app.get('/', (req, res) =>{
    res.send("Hello would!");
});

// Endpoint to receive incoming messages
app.post('/whatsapp', express.json(), (req, res) => {
    return new Promise(async (resolve, reject) => {
        const userMessage = req.body.Body;
        console.log("User message:", userMessage);

        // Add user message to conversation history

        try {
            
            const botMessage = getReplayFromBot(userMessage);
            // Send OpenAI's response back to the user on WhatsApp
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
            console.error("Error getting response from OpenAI:", error);
            res.status(500).send("Error generating response");
        }
    });
});


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
