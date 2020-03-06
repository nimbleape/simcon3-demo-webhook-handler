const express = require('express');
const config = require('config');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const bent = require('bent');
const ifttWebhooks = require('ifttt-webhooks');

// create an instance
const ifttt = new ifttWebhooks.IFTTT(config.get('ifttt.webhookId'));

// parse application/json
app.use(bodyParser.json())

app.options('/kill/:id', cors()); // enable pre-flight request for DELETE
app.delete('/kill/:call_id', async (req, res) => {
    const del = bent(`https://${config.get('simwood.username')}:${config.get('simwood.password')}@${config.get('simwood.baseUrl')}`, 'DELETE', 'json', 200);
    const response = await del(`/v3/voice/${config.get('simwood.account')}/inprogress/${req.params.call_id}`);
    res.send(response);
});

app.post('/inbound-calls', async (req, res) => {
    // console.log('inbound req', req);

    let msg = null;
    switch(req.body.data.status) {
        case 'completed':
            msg = `Inbound Call Completed - ID ${req.body.data.call_id}`;
            break;
        case 'answered':
            msg = `Inbound Call Answered - ID ${req.body.data.call_id}`;
            break;
        case 'initiated':
            msg = `Inbound Call from ${req.body.data.from} to ${req.body.data.to} Initiated - ID ${req.body.data.call_id}`;
            break;
    }

    if (msg) {
        //send it to matrix
        const post = bent(config.get('matrix.url'), 'POST', 'json', 200);
        const response = await post('/', {
            text: msg,
            format: "plain",
            displayName: config.get('matrix.name'),
            avatarUrl: config.get('matrix.image')
        });
    }

    res.sendStatus(200);
});

app.post('/outbound-calls', async (req, res) => {
    // console.log('outbound req', req);

    let detonation = false;

    let msg = null;
    switch(req.body.data.status) {
        case 'completed':
            msg = `Outbound Call Completed - ID ${req.body.data.call_id}`;
            detonation = true;
            break;
        case 'answered':
            msg = `Outbound Call Answered  - ID ${req.body.data.call_id}`;
            break;
        case 'initiated':
            msg = `Outbound Call from ${req.body.data.from} to ${req.body.data.to} from IP ${req.body.data.ip} Initiated - ID ${req.body.data.call_id}`;
            break;
    }

    if (detonation) {
        // trigger an event with parameters
        await ifttt.trigger(config.get('ifttt.eventName'));
    }

    if (msg) {

        //send it to matrix
        const post = bent(config.get('matrix.url'), 'POST', 'json', 200);
        const response = await post('/', {
            text: msg,
            format: "plain",
            displayName: config.get('matrix.name'),
            avatarUrl: config.get('matrix.image')
        });
    }

    res.sendStatus(200);
});

app.listen(config.get('http.port'), () => {
    console.log(`Example app listening on port ${config.get('http.port')}!`);
});