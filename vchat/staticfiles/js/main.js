console.log('In main.js!');

var mapPeers = {};

var usernameInput = document.querySelector('#username');
var btnJoin = document.querySelector('#btn-join');
var btnLogout = document.querySelector('#btn-logout');

var username;

var webSocket;

function webSocketOnMessage(event) {
    var parsedData = JSON.parse(event.data);
    var peerUsername = parsedData['peer'];
    var action = parsedData['action'];

    if (username == peerUsername) {
        return;
    }

    var receiver_channel_name = parsedData['message']['receiver_channel_name'];

    if (action == 'new-peer') {
        createOfferer(peerUsername, receiver_channel_name);

        return;

    }

    if (action == 'new-offer') {
        var offer = parsedData['message']['sdp'];

        createAnswerer(offer, peerUsername, receiver_channel_name);

        return;
    }

    if (action == 'new-answer') {
        var answer = parsedData['message']['sdp'];

        var peer = mapPeers[peerUsername][0];

        peer.setRemoteDescription(answer);

        return;
    }
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

        sendSignal('new-peer', {});
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

const btnToggleAudio = document.querySelector('#btn-toggle-audio');
const btnToggleVideo = document.querySelector('#btn-toggle-video');

var userMedia = navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
        localStream = stream;
        localVideo.srcObject = localStream;
        localVideo.muted = true;

        var audioTracks = stream.getAudioTracks();
        var videoTracks = stream.getVideoTracks();

        audioTracks[0].enabled = true;
        videoTracks[0].enabled = true;

        btnToggleAudio.addEventListener('click', () => {
            audioTracks[0].enabled = !audioTracks[0].enabled;

            if (audioTracks[0].enabled) {
                btnToggleAudio.innerHTML = 'Audio mute';

                return;

            }

            btnToggleAudio.innerHTML = 'Audio Unmute';
        });

        btnToggleVideo.addEventListener('click', () => {
            videoTracks[0].enabled = !videoTracks[0].enabled;

            if (videoTracks[0].enabled) {
                btnToggleVideo.innerHTML = 'Video Off';

                return;

            }

            btnToggleVideo.innerHTML = 'Video On';
        });
    })
    .catch(error => {
        console.log('Error assessing media devices.', error);
    });

var btnSendingMsg = document.querySelector('#btn-send-msg');
var messageList = document.querySelector('#message-list');
var messageInput = document.querySelector('#msg');

btnSendingMsg.addEventListener('click', sendMsgOnClick);

function sendMsgOnClick() {
    var message = messageInput.value;

    var li = document.createElement('li');
    li.appendChild(document.createTextNode('Me: ' + message));
    messageList.appendChild(li);

    var datachannels = getDataChannels();

    message = username + ':' + message;

    for (index in datachannels) {
        datachannels[index].send(message);

    }

    messageInput.value = '';


}


function sendSignal(action, message) {
    var jsonStr = JSON.stringify({
        'peer': username,
        'action': action,
        'message': message,
    });

    webSocket.send(jsonStr);
}

function createOfferer(peerUsername, receiver_channel_name) {


    var configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }, // STUN server
            {
                urls: 'turn:turn.google.com:19305',
                username: 'webrtc',
                credential: 'secret'
            }
            // Add more TURN servers if needed
        ]
    };

    var peer = new RTCPeerConnection(configuration);

    addLocalTracks(peer);

    var dc = peer.createDataChannel('channel');
    dc.addEventListener('open', () => {
        console.log('Connection opened!');
    });
    dc.addEventListener('message', dcOnMessage);

    var remoteVideo = createVideo(peerUsername);
    setOnTrack(peer, remoteVideo);

    mapPeers[peerUsername] = [peer, dc];

    peer.addEventListener('iceconnectionstatechange', () => {
        var iceConnectionState = peer.iceConnectionState;

        if (iceConnectionState === 'failed' || iceConnectionState === 'disconnected' || iceConnectionState === 'closed') {
            delete mapPeers[peerUsername];

            if (iceConnectionState != 'closed') {
                peer.close();
            }

            removeVideo(remoteVideo);

        }
    });

    peer.addEventListener('icecandidate', (event) => {
        if (event.candidate) {
            console.log('New ice candidate: ', JSON.stringify(peer.localDescription));

            return;
        }

        sendSignal('new-offer', {
            'sdp': peer.localDescription,
            'receiver_channel_name': receiver_channel_name
        });
    });

    peer.createOffer()
        .then(o => peer.setLocalDescription(o))
        .then(() => {
            console.log('Local description set successfully.');
        });

}

function createAnswerer(offer, peerUsername, receiver_channel_name) {

    var configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }, // STUN server

            // Add more TURN servers if needed
        ]
    };

    var peer = new RTCPeerConnection(configuration);

    addLocalTracks(peer);

    var remoteVideo = createVideo(peerUsername);
    setOnTrack(peer, remoteVideo);

    peer.addEventListener('datachannel', e => {
        peer.dc = e.channel;
        peer.dc.addEventListener('open', () => {
            console.log('Connection opened!');
        });
        peer.dc.addEventListener('message', dcOnMessage);

        mapPeers[peerUsername] = [peer, peer.dc];
    });

    peer.addEventListener('iceconnectionstatechange', () => {
        var iceConnectionState = peer.iceConnectionState;

        if (iceConnectionState === 'failed' || iceConnectionState === 'disconnected' || iceConnectionState === 'closed') {
            delete mapPeers[peerUsername];

            if (iceConnectionState != 'closed') {
                peer.close();
            }

            removeVideo(remoteVideo);

        }
    })

    peer.addEventListener('icecandidate', (event) => {
        if (event.candidate) {
            console.log('New ice candidate: ', JSON.stringify(peer.localDescription));

            return;
        }

        sendSignal('new-answer', {
            'sdp': peer.localDescription,
            'receiver_channel_name': receiver_channel_name
        });
    });

    peer.setRemoteDescription(offer)
        .then(() => {
            console.log('Remote description set successfully for %s.', peerUsername);

            return peer.createAnswer();

        })
        .then(a => {
            console.log('Answer created!');

            peer.setLocalDescription(a);
        })

}

function addLocalTracks(peer) {
    localStream.getTracks().forEach(track => {
        peer.addTrack(track, localStream);
    });

    return;

}


function dcOnMessage(event) {
    var message = event.data;

    var li = document.createElement('li');
    li.appendChild(document.createTextNode(message));
    messageList.appendChild(li);

}

function createVideo(peerUsername) {
    var videoContainer = document.querySelector('#video-container');

    var remoteVideo = document.createElement('video');

    remoteVideo.id = peerUsername + '-video';
    remoteVideo.autoplay = true;
    remoteVideo.playsInline = true;

    var videoWrapper = document.createElement('div');

    videoContainer.appendChild(videoWrapper);

    videoWrapper.appendChild(remoteVideo);

    return remoteVideo;


}

function setOnTrack(peer, remoteVideo) {
    var remoteStream = new MediaStream();

    remoteVideo.srcObject = remoteStream;

    peer.addEventListener('track', async(event) => {
        remoteStream.addTrack(event.track, remoteStream);

    });

}

function removeVideo(video) {
    var videoWrapper = video.parentNode;

    videoWrapper.parentNode.removeChild(videoWrapper);


}

function getDataChannels() {
    var datachannels = [];

    for (peerUsername in mapPeers) {
        var datachannel = mapPeers[peerUsername][1];

        datachannels.push(datachannel);

    }
    return datachannels;
}

document.getElementById('btn-log-out').addEventListener('click', (e) => {
    window.location.href = "/login";
})

// Select elements
const messagesContainer = document.getElementById('messages');
const clearChatContainer = document.getElementById('clear-chat-container');
const clearChatButton = document.getElementById('btn-clear-chat');

// Check if messages container has reached full height
function checkChatHeight() {
    // Maximum height of messages container
    const maxHeight = messagesContainer.scrollHeight;

    // Current scroll position of messages container
    const scrollPosition = messagesContainer.scrollTop + messagesContainer.clientHeight;

    // Toggle visibility of clear chat button based on scroll position
    if (scrollPosition >= maxHeight) {
        clearChatContainer.style.display = 'flex'; // Show clear chat button container
    } else {
        clearChatContainer.style.display = 'none'; // Hide clear chat button container
    }
}

// Event listener for scroll events on messages container
messagesContainer.addEventListener('scroll', checkChatHeight);

// Event listener for clear chat button
clearChatButton.addEventListener('click', function() {
    document.getElementById('message-list').innerHTML = ''; // Clear messages
    clearChatContainer.style.display = 'none'; // Hide clear chat button after clearing messages
});