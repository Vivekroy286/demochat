const localVideo = document.querySelector('#local-video');

// local video stream
var localStream = new MediaStream();

// local screen stream
// for screen sharing
var localDisplayStream = new MediaStream();

// buttons to toggle self audio and video
btnToggleAudio = document.querySelector("#btn-toggle-audio");
btnToggleVideo = document.querySelector("#btn-toggle-video");

var messageInput = document.querySelector('#msg');
var btnSendMsg = document.querySelector('#btn-send-msg');

// ul of messages
var ul = document.querySelector("#message-list");

var loc = window.location;

var endPoint = '';
var wsStart = 'ws://';

if (loc.protocol == 'https:') {
    wsStart = 'wss://';
}

var endPoint = wsStart + loc.host + loc.pathname;

var webSocket;

var usernameInput = document.querySelector('#username');
var username;

var btnJoin = document.querySelector('#btn-join');
var btnLogout = document.querySelector('#btn-logout');

// set username
// join room (initiate websocket connection)
// upon button click
btnJoin.onclick = () => {
    username = usernameInput.value;

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

    document.querySelector('#label_username').innerHTML = username;

    webSocket = new WebSocket(endPoint);

    webSocket.onopen = function(e) {
        console.log('Connection opened! ', e);

        // notify other peers
        sendSignal('new-peer', {
            'local_screen_sharing': false,
        });
    }

    webSocket.onmessage = webSocketOnMessage;

    webSocket.onclose = function(e) {
        console.log('Connection closed! ', e);
    }

    webSocket.onerror = function(e) {
        console.log('Error occured! ', e);
    }

    btnSendMsg.disabled = false;
    messageInput.disabled = false;

    console.log(btnLogout);
}

function webSocketOnMessage(event) {
    var parsedData = JSON.parse(event.data);

    var action = parsedData['action'];
    // username of other peer
    var peerUsername = parsedData['peer'];

    console.log('peerUsername: ', peerUsername);
    console.log('action: ', action);

    if (peerUsername == username) {
        // ignore all messages from oneself
        return;
    }

    // boolean value specified by other peer
    // indicates whether the other peer is sharing screen
    var remoteScreenSharing = parsedData['message']['local_screen_sharing'];
    console.log('remoteScreenSharing: ', remoteScreenSharing);

    // channel name of the sender of this message
    // used to send messages back to that sender
    // hence, receiver_channel_name
    var receiver_channel_name = parsedData['message']['receiver_channel_name'];
    console.log('receiver_channel_name: ', receiver_channel_name);

    // in case of new peer
    if (action == 'new-peer') {
        console.log('New peer: ', peerUsername);

        // create new RTCPeerConnection
        createOfferer(peerUsername, false, remoteScreenSharing, receiver_channel_name);

        if (screenShared && !remoteScreenSharing) {
            // if local screen is being shared
            // and remote peer is not sharing screen
            // send offer from screen sharing peer
            console.log('Creating screen sharing offer.');
            createOfferer(peerUsername, true, remoteScreenSharing, receiver_channel_name);
        }

        return;
    }

    // remote_screen_sharing from the remote peer
    // will be local screen sharing info for this peer
    var localScreenSharing = parsedData['message']['remote_screen_sharing'];

    if (action == 'new-offer') {
        console.log('Got new offer from ', peerUsername);

        // create new RTCPeerConnection
        // set offer as remote description
        var offer = parsedData['message']['sdp'];
        console.log('Offer: ', offer);
        var peer = createAnswerer(offer, peerUsername, localScreenSharing, remoteScreenSharing, receiver_channel_name);

        return;
    }


    if (action == 'new-answer') {
        // in case of answer to previous offer
        // get the corresponding RTCPeerConnection
        var peer = null;

        peer = mapPeers[peerUsername][0];

        // get the answer
        var answer = parsedData['message']['sdp'];

        console.log('mapPeers:');
        for (key in mapPeers) {
            console.log(key, ': ', mapPeers[key]);
        }

        console.log('peer: ', peer);
        console.log('answer: ', answer);

        // set remote description of the RTCPeerConnection
        peer.setRemoteDescription(answer);

        return;
    }
}

messageInput.addEventListener('keyup', function(event) {
    if (event.keyCode == 13) {
        // prevent from putting 'Enter' as input
        event.preventDefault();

        // click send message button
        btnSendMsg.click();
    }
});

btnSendMsg.onclick = btnSendMsgOnClick;

function btnSendMsgOnClick() {
    var message = messageInput.value;

    var li = document.createElement("li");
    li.appendChild(document.createTextNode("Me: " + message));
    ul.appendChild(li);

    var dataChannels = getDataChannels();

    console.log('Sending: ', message);

    // send to all data channels
    for (index in dataChannels) {
        dataChannels[index].send(username + ': ' + message);
    }

    messageInput.value = '';
}

const constraints = {
    'video': true,
    'audio': true
}

userMedia = navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
        localStream = stream;
        console.log('Got MediaStream:', stream);
        var mediaTracks = stream.getTracks();

        for (i = 0; i < mediaTracks.length; i++) {
            console.log(mediaTracks[i]);
        }

        localVideo.srcObject = localStream;
        localVideo.muted = true;

        window.stream = stream; // make variable available to browser console

        audioTracks = stream.getAudioTracks();
        videoTracks = stream.getVideoTracks();

        // unmute audio and video by default
        audioTracks[0].enabled = true;
        videoTracks[0].enabled = true;

        btnToggleAudio.onclick = function() {
            audioTracks[0].enabled = !audioTracks[0].enabled;
            if (audioTracks[0].enabled) {
                btnToggleAudio.innerHTML = 'Audio Mute';
                return;
            }

            btnToggleAudio.innerHTML = 'Audio Unmute';
        };

        btnToggleVideo.onclick = function() {
            videoTracks[0].enabled = !videoTracks[0].enabled;
            if (videoTracks[0].enabled) {
                btnToggleVideo.innerHTML = 'Video Off';
                return;
            }

            btnToggleVideo.innerHTML = 'Video On';
        };
    }).catch(error => {
        console.error('Error accessing media devices.', error);
    });

// send the given action and message
// over the websocket connection
function sendSignal(action, message) {
    webSocket.send(
        JSON.stringify({
            'peer': username,
            'action': action,
            'message': message,
        })
    )
}

// create RTCPeerConnection as offerer
// and store it and its datachannel
// send sdp to remote peer after gathering is complete