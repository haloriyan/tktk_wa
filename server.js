const {Client, LegacySessionAuth} = require('whatsapp-web.js');
const fs = require('fs');
const express = require('express');
const qrcode = require('qrcode');
const qrTerminal = require('qrcode-terminal');
const http = require('http');
const socketIO = require('socket.io');

const SESSION_FILE_PATH = "./wtf-session.json";
let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
    sessionCfg = require(SESSION_FILE_PATH);
}

const PORT = process.env.PORT || 2020;
const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const client = new Client({
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas',
            '--no-first-run', '--no-zygote', '--single-process', '--disable-gpu'
        ]
    },
    authStrategy: new LegacySessionAuth({
        session: sessionCfg,
        restartOnAuthFail: true,
    })
})

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.get('/', (req, res) => {
    res.sendFile('index.html', {root: __dirname});
});

let today = new Date();
let now = today.toLocaleString();

io.on('connection', socket => {
    socket.emit('message', `${now} connected`);

    client.on('qr', qr => {
        socket.emit('message', 'Coooook');
        // qrTerminal.generate(qr);
        qrcode.toDataURL(qr, (err, url) => {
            socket.emit("qr", url);
            socket.emit('message', `${now} QR Code received`);
        })
    })

    client.on('ready', () => {
        socket.emit('message', `${now} WhatsApp is ready!`);
    });
    
    client.on('authenticated', (session) => {
        socket.emit('message', `${now} Whatsapp is authenticated!`);
        sessionCfg = session;
        fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function(err) {
          if (err) {
            console.error(err);
          }
        });
    });

    client.on('auth_failure', function(session) {
        socket.emit('message', `${now} Auth failure, restarting...`);
    });

    client.on('disconnected', function() {
        socket.emit('message', `${now} Disconnected`);
        if (fs.existsSync(SESSION_FILE_PATH)) {
          fs.unlinkSync(SESSION_FILE_PATH, function(err) {
            if(err) return console.log(err);
            console.log('Session file deleted!');
          });
          client.destroy();
          client.initialize();
        }
    });
});
client.initialize()

app.post('/send', (req, res) => {
    const phone = req.body.phone;
    const message = req.body.message;
    // const phone = "6285159772902@c.us";
    // const message = "halo riyan";
  
    client.sendMessage(phone, message)
        .then(response => {
            res.status(200).json({
                error: false,
                data: {
                message: 'Pesan terkirim',
                meta: response,
            },
        });
    })
    .catch(error => {
        res.status(200).json({
            error: true,
            data: {
                message: 'Error send message',
                meta: error,
            },
        });
    });
  });

server.listen(PORT, () => {
    console.log('App listen on port ', PORT);
});