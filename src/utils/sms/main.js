const http = require('http');
const { exit } = require('process');

const data = JSON.stringify({
    username: '9120779086',
    password: '2896a31d-9158-45f5-ac67-ee730468efde',
    to: '0989120779086',
    from: '50002710079086',
    text: 'This is some text that needs to be long enough, so that we can check how many words can fit in the notification bar, so we need words, lots of words, but we\'re running low on words, oops, this is the last one...except the dots...oh goodness, this is really the last one, or is it?, haha got you on that one, but seriously there is a limit on how many words we can fit in one message, if we run out of words we can no lo',
    isflash: false
})

const options = {
    method: 'POST',
    headers: {
        "content-type": 'application/x-www-form-urlencoded'
    }
}

const req = http.request('http://rest.payamak-panel.com/api/SendSMS/GetDeliveries2', options, (res) => {
    console.log("Status code: ", res.statusCode);
    console.log("Headers: ", res.headers);

    let body = ''

    res.on('error', err => {
        console.log("ERROR: ", err);
    })

    res.on('data', chunk => {
        body += chunk;
    })

    res.on('end', () => {
        console.log("BODY: ",body);
    })

})
req.write(data);
req.end();