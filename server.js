const express = require('express');
require('dotenv').config();
const app = express();
app.use(express.json());
app.use(express.urlencoded({extended: false}));
const PORT = process.env.PORT || 3000;

const accountSid = process.env.ACCOUNT_SID
const authToken = process.env.AUTH_TOKEN
const openaikey = process.env.OPEN_AI_KEY

const client = require('twilio')(accountSid, authToken);
const { OpenAI} = require("openai");
const openaiclient = new OpenAI({
    apiKey: openaikey
});
const messages = [];
messages.push({ role: 'assistant', content: "Hey! In this chat, you will respond as if you have an extroverted personality. you will only answer questions to encourage and engage the user in conversation to take the survey. If you feel the user is ready, you will present a survey for you to answer." });

app.get('/', (req, res) =>{
    res.send("Hello would!");
});

// Endpoint to receive incoming messages
app.post('/whatsapp', express.json(), (req, res) => {
    return new Promise(async (resolve, reject) => {
        const userMessage = req.body.Body;
        console.log("User message:", userMessage);

        // Add user message to conversation history
        messages.push({ role: 'user', content: userMessage });

        try {
            // Send conversation to OpenAI to get a response
            const response = await openaiclient.chat.completions.create({
                messages:  messages,
                model: 'gpt-4o-mini'
            });
        
            // Get OpenAI's response and add it to the conversation history
            const botMessage = response.data.choices[0].message.content;
            messages.push({ role: 'assistant', content: botMessage });
        
            // Send OpenAI's response back to the user on WhatsApp
            client.messages.create({
              body: botMessage,
              from: 'whatsapp:+14155238886',
              to: 'whatsapp:+916283690512'  // Assumes user number in `From` field
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
