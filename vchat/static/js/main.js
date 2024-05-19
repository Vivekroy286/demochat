console.log('In main.js!');



var usernameInput = document.querySelector('#username');
var btnJoin = document.querySelector('#btn-join');
var btnLogout = document.querySelector('#btn-logout');

var username;

var webSocket;

function webSocketOnMessage(event) {
    var parsedData = JSON.parse(event.data);
    var message = parsedData['message'];

    console.log('message: ', message);
}

// set username
// join room (initiate websocket connection)
// upon button click
btnJoin.addEventListener('click', () => {
    username = usernameInput.value;

    console.log('username: ', username);

    if (username == '') {
        // ignore if username is empty
        return;
    }

    // clear input
    usernameInput.value = '';
    // disable and vanish input
    btnJoin.disabled = true;
    usernameInput.style.visibility = 'hidden';
    // disable and vanish join button
    btnJoin.disabled = true;
    btnJoin.style.visibility = 'hidden';

    var labelUsername = document.querySelector('#label_username');
    labelUsername.innerHTML = username;

    var loc = window.location;
    var wsStart = 'ws://';

    if (loc.protocol == 'https:') {
        wsStart = 'wss://';
    }

    var endPoint = wsStart + loc.host + loc.pathname;

    console.log('endPoint: ', endPoint);

    webSocket = new WebSocket(endPoint);

    webSocket.addEventListener('open', (e) => {
        console.log('Connection opened! ');

        var jsonStr = JSON.stringify({
            'message': 'This is a message',
        });

        webSocket.send(jsonStr);

    });
    webSocket.addEventListener('message', webSocketOnMessage);
    webSocket.addEventListener('close', (e) => {
        console.log('Connection closed! ');

    });

    webSocket.addEventListener('error', (e) => {
        console.log('Error occured!');
    });

});

var localStream = new MediaStream();

const constraints = {
    'video': true,
    'audio': true
};
const localVideo = document.querySelector('#local-video');

var userMedia = navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
        localStream = stream;
        localVideo.srcObject = localStream;
        localVideo.muted = true;
    })
    .catch(error => {
        console.log('Error assessing media devices.', error);
    })