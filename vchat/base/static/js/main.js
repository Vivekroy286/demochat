// map peer usernames to corresponding RTCPeerConnections
// as key value pairs
var mapPeers = {};

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

    document.querySelector('#label-username').innerHTML = username + " in call";

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
function createOfferer(peerUsername, localScreenSharing, remoteScreenSharing, receiver_channel_name) {
    var peer = new RTCPeerConnection(null);

    // add local user media stream tracks
    addLocalTracks(peer, localScreenSharing);

    // create and manage an RTCDataChannel
    var dc = peer.createDataChannel("channel");
    dc.onopen = () => {
        console.log("Connection opened.");
    };
    var remoteVideo = null;
    // none of the peers are sharing screen (normal operation)

    dc.onmessage = dcOnMessage;

    remoteVideo = createVideo(peerUsername);
    setOnTrack(peer, remoteVideo);
    console.log('Remote video source: ', remoteVideo.srcObject);

    // store the RTCPeerConnection
    // and the corresponding RTCDataChannel
    mapPeers[peerUsername] = [peer, dc];

    peer.oniceconnectionstatechange = () => {
        var iceConnectionState = peer.iceConnectionState;
        if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {
            console.log('Deleting peer');
            delete mapPeers[peerUsername];
            if (iceConnectionState != 'closed') {
                peer.close();
            }
            removeVideo(remoteVideo);
        }
    };

    peer.onicecandidate = (event) => {
        if (event.candidate) {
            console.log("New Ice Candidate! Reprinting SDP" + JSON.stringify(peer.localDescription));
            return;
        }

        // event.candidate == null indicates that gathering is complete

        console.log('Gathering finished! Sending offer SDP to ', peerUsername, '.');
        console.log('receiverChannelName: ', receiver_channel_name);

        // send offer to new peer
        // after ice candidate gathering is complete
        sendSignal('new-offer', {
            'sdp': peer.localDescription,
            'receiver_channel_name': receiver_channel_name,
            'local_screen_sharing': localScreenSharing,
            'remote_screen_sharing': remoteScreenSharing,
        });
    }

    peer.createOffer()
        .then(o => peer.setLocalDescription(o))
        .then(function(event) {
            console.log("Local Description Set successfully.");
        });

    console.log('mapPeers[', peerUsername, ']: ', mapPeers[peerUsername]);

    return peer;
}

// create RTCPeerConnection as answerer
// and store it and its datachannel
// send sdp to remote peer after gathering is complete
function createAnswerer(offer, peerUsername, localScreenSharing, remoteScreenSharing, receiver_channel_name) {
    var peer = new RTCPeerConnection(null);

    addLocalTracks(peer, localScreenSharing);

    // set remote video
    var remoteVideo = createVideo(peerUsername);

    // and add tracks to remote video
    setOnTrack(peer, remoteVideo);

    // it will have an RTCDataChannel
    peer.ondatachannel = e => {
        console.log('e.channel.label: ', e.channel.label);
        peer.dc = e.channel;
        peer.dc.onmessage = dcOnMessage;
        peer.dc.onopen = () => {
            console.log("Connection opened.");
        }

        // store the RTCPeerConnection
        // and the corresponding RTCDataChannel
        // after the RTCDataChannel is ready
        // otherwise, peer.dc may be undefined
        // as peer.ondatachannel would not be called yet
        mapPeers[peerUsername] = [peer, peer.dc];
    }

    peer.oniceconnectionstatechange = () => {
        var iceConnectionState = peer.iceConnectionState;
        if (iceConnectionState === "failed" || iceConnectionState === "disconnected" || iceConnectionState === "closed") {
            delete mapPeers[peerUsername];
            if (iceConnectionState != 'closed') {
                peer.close();
            }
            removeVideo(remoteVideo);
        }
    };


    peer.onicecandidate = (event) => {
        if (event.candidate) {
            console.log("New Ice Candidate! Reprinting SDP" + JSON.stringify(peer.localDescription));
            return;
        }

        // event.candidate == null indicates that gathering is complete

        console.log('Gathering finished! Sending answer SDP to ', peerUsername, '.');
        console.log('receiverChannelName: ', receiver_channel_name);

        // send answer to offering peer
        // after ice candidate gathering is complete
        // answer needs to send two types of screen sharing data
        // local and remote so that offerer can understand
        // to which RTCPeerConnection this answer belongs
        sendSignal('new-answer', {
            'sdp': peer.localDescription,
            'receiver_channel_name': receiver_channel_name,
            'local_screen_sharing': localScreenSharing,
            'remote_screen_sharing': remoteScreenSharing,
        });
    }

    peer.setRemoteDescription(offer)
        .then(() => {
            console.log('Set offer from %s.', peerUsername);
            return peer.createAnswer();
        })
        .then(a => {
            console.log('Setting local answer for %s.', peerUsername);
            return peer.setLocalDescription(a);
        })
        .then(() => {
            console.log('Answer created for %s.', peerUsername);
            console.log('localDescription: ', peer.localDescription);
            console.log('remoteDescription: ', peer.remoteDescription);
        })
        .catch(error => {
            console.log('Error creating answer for %s.', peerUsername);
            console.log(error);
        });

    return peer
}

function dcOnMessage(event) {
    var message = event.data;

    var li = document.createElement("li");
    li.appendChild(document.createTextNode(message));
    ul.appendChild(li);
}

// get all stored data channels
function getDataChannels() {
    var dataChannels = [];

    for (peerUsername in mapPeers) {
        console.log('mapPeers[', peerUsername, ']: ', mapPeers[peerUsername]);
        var dataChannel = mapPeers[peerUsername][1];
        console.log('dataChannel: ', dataChannel);

        dataChannels.push(dataChannel);
    }

    return dataChannels;
}

// get all stored RTCPeerConnections
// peerStorageObj is an object
function getPeers(peerStorageObj) {
    var peers = [];

    for (peerUsername in peerStorageObj) {
        var peer = peerStorageObj[peerUsername][0];
        console.log('peer: ', peer);

        peers.push(peer);
    }

    return peers;
}

// for every new peer
// create a new video element
// and its corresponding user gesture button
// assign ids corresponding to the username of the remote peer
function createVideo(peerUsername) {
    var videoContainer = document.querySelector('#video-container');

    // create the new video element
    // and corresponding user gesture button
    var remoteVideo = document.createElement('video');
    // var btnPlayRemoteVideo = document.createElement('button');

    remoteVideo.id = peerUsername + '-video';
    remoteVideo.autoplay = true;
    remoteVideo.playsinline = true;
    remoteVideo.class = 'all-video';

    // wrapper for the video and button elements
    var videoWrapper = document.createElement('div');

    // add the wrapper to the video container
    videoContainer.appendChild(videoWrapper);

    // add the video to the wrapper
    videoWrapper.appendChild(remoteVideo);

    return remoteVideo;
}

// set onTrack for RTCPeerConnection
// to add remote tracks to remote stream
// to show video through corresponding remote video element
function setOnTrack(peer, remoteVideo) {
    console.log('Setting ontrack:');
    // create new MediaStream for remote tracks
    var remoteStream = new MediaStream();

    // assign remoteStream as the source for remoteVideo
    remoteVideo.srcObject = remoteStream;

    console.log('remoteVideo: ', remoteVideo.id);

    peer.addEventListener('track', async(event) => {
        console.log('Adding track: ', event.track);
        remoteStream.addTrack(event.track, remoteStream);
    });
}

// called to add appropriate tracks
// to peer
function addLocalTracks(peer, localScreenSharing) {
    if (!localScreenSharing) {
        // if it is not a screen sharing peer
        // add user media tracks
        localStream.getTracks().forEach(track => {
            console.log('Adding localStream tracks.');
            peer.addTrack(track, localStream);
        });

        return;
    }

    // if it is a screen sharing peer
    // add display media tracks
    localDisplayStream.getTracks().forEach(track => {
        console.log('Adding localDisplayStream tracks.');
        peer.addTrack(track, localDisplayStream);
    });
}

function removeVideo(video) {
    // get the video wrapper
    var videoWrapper = video.parentNode;
    // remove it
    videoWrapper.parentNode.removeChild(videoWrapper);
}