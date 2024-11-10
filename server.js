const express = require('express');
require('dotenv').config();
const app = express();
app.use(express.json());
app.use(express.urlencoded({extended: false}));
const PORT = process.env.PORT || 3000;

const accountSid = process.env.ACCOUNT_SID
const authToken = process.env.AUTH_TOKEN
const client = require('twilio')(accountSid, authToken);

app.get('/', (req, res) =>{
    res.send("Hello would!");
});

// Endpoint to receive incoming messages
app.post('/whatsapp', express.json(), (req, res) => {
    return new Promise((resolve, reject) => {
        console.log(req.body.Body);

        var messageToSend = "";

        if(req.body.Body == 'hi'){
            messageToSend = "Hello There, How I can assit you";
        }
        else{
            messageToSend = "Hello " + req.body.Body + ", How are you.";
        }

        client.messages.create({
            body: messageToSend,
            from: 'whatsapp:+14155238886',
            to: 'whatsapp:+918553376407'
        })
        .then((message) =>{
            console.log(message.sid);
            resolve(message.sid);
        })
        // const message = await client.messages.create({
            //         from: 'whatsapp:+14155238886',
            //         contentSid: 'HXb5b62575e6e4ff6129ad7c8efe1f983e',
            //         contentVariables: '{"1":"12/1","2":"3pm"}',
            //         to: 'whatsapp:+916283690512'
            //     });
    });
});


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
