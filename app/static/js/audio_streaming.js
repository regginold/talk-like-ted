// code for streaming audio from the user's microphone to the server

var languageCodes = [
    'en-US', 'en-AU', 'en-CA', 'en-GH', 'en-GB', 'en-IN', 'en-IE',
    'en-KE', 'en-NZ', 'en-NG', 'en-PH', 'en-SG', 'en-ZA', 'en-TZ'
]

var mediaStream = null;
var audioConstraints = {audio: true};

var timerCanvas = document.getElementById('timerVisualization');
var timerCanvasContext = timerCanvas.getContext("2d");

var audioCanvas = document.getElementById('audioVisualization');
var audioCanvasContext = audioCanvas.getContext("2d");
var audioSignalBarWidth = 10;

var audioBufferSize = 8192;  // 8192 is good for a streaming rate of 44100 Hz.

var audioContext = window.AudioContext || window.webkitAudioContext;
var context = null;
var audioInput = null;
var recorder = null;

var mediaStreamOn = false;

var socket = io.connect('http://' + document.domain + ':' + location.port);

socket.on('async test', function(){
    console.log('async signal detected from Thread-2.');
});

socket.on('connect', function() {
    socket.emit('connect stream.html');
    // load the language codes into the drop-down menu
    var drop_down = document.getElementById('language-selector');
    for (i = 0; i < languageCodes.length; i++) {
        var option = document.createElement('option');
        option.text = languageCodes[i];
        drop_down.add(option);
    }
    $('#language-selector').on('change', function() {
        socket.emit('language changed', drop_down.options[drop_down.selectedIndex].text);
    });
});

socket.on('create audio url', function(filename) {
    $('audio').attr('src', filename);
});

socket.on('transcript update', function(data) {
    $('#streaming-transcript').text(data['transcript']);
});

socket.on('wpm', function(data){
    $('#current-words-per-min').text(data['words-per-minute']);
});

socket.on('waiting for responses', function(){
    // this should load a nav modal.
    console.log('waiting for responses.');
});

socket.on('waiting for responses complete', function(){
    console.log('we\'ve got responses!');
});

socket.on('update timer', function(data){
    timerCanvasContext.clearRect(0, 0, timerCanvas.width, timerCanvas.height);
    timerCanvasContext.font = '60px Veranda';
    timerCanvasContext.fillStyle = 'white';
    timerCanvasContext.textAlign = 'center';
    timerCanvasContext.textBaseline = 'middle';
    timerCanvasContext.fillText(data, timerCanvas.width/2, timerCanvas.height/2);
});

var streamFromMicrophone = function () {
    if (!mediaStreamOn){
        navigator.mediaDevices.getUserMedia(audioConstraints)
        .then(function(stream) {
            // reset the audio's src attribute
            $('audio').attr('src', '');

            // open a new stream
            mediaStream = stream;
            context = new audioContext();
            var sampleRate = context.sampleRate;
            audioInput = context.createMediaStreamSource(stream);

            // send signal to the server that we're starting a new user
            // recording
            socket.emit('audio stream load page', sampleRate);
            socket.emit('audio stream on', sampleRate);

            // create an audio node to capture all of the raw data from the 
            // user's microphone.
            recorder = context.createScriptProcessor(audioBufferSize, 1, 1);
            recorder.onaudioprocess = function(e) {
                var left = e.inputBuffer.getChannelData(0);
                visualizeAudioSignal(left);

                // send the raw audio to the server.
                socket.emit(
                    'audio stream', 
                    {
                        'audio': float32toArray(left)
                    }
                );
            }
            audioInput.connect(recorder);
            recorder.connect(context.destination);
            mediaStreamOn = true;
        })
        .catch(function(err){
            console.log(err.name + ": " + err.message);
        });
    } else {
        // close the stream, and disconnect all of the nodes.
        mediaStream.getTracks().forEach(function(track) { track.stop(); });
        mediaStream = null;
        mediaStreamOn = false;
        audioInput.disconnect(recorder);
        recorder.disconnect(context.destination);

        // let the server know that we're done streaming
        // this is where we'll create the new audio clip and save it (server-side),
        // then re-update our audio src with the newly-created clip (client-side).
        socket.emit('audio stream off');
        console.log('the audio stream is off.');
    }
}

function float32toArray(buffer){
    var buf = [];
    buffer.forEach(function(elem, index, arr) { buf.push(elem); })
    return buf;
}

var visualizeAudioSignal = function(data) {
    var max = 0;
    var mean = 0;
    var barSpacing = 10;

    for (i = 0; i < data.length; i++) {
        if (Math.abs(data[i]) > max) { max = Math.abs(data[i]); }
        mean += Math.abs(data[i]);
    }
    mean /= data.length;
    mean *= audioCanvas.height;
    mean = Math.ceil(mean);
    max *= audioCanvas.height;
    max = Math.ceil(max);

    audioCanvasContext.clearRect(0, 0, audioCanvas.width, audioCanvas.height);
    audioCanvasContext.fillStyle = 'white';

    var xxs = [
        audioCanvas.width/2 - audioSignalBarWidth/2,
        audioCanvas.width/2 - audioSignalBarWidth/2 - audioSignalBarWidth - barSpacing,
        audioCanvas.width/2 - audioSignalBarWidth/2 + audioSignalBarWidth + barSpacing
    ];
    var yys = [
        audioCanvas.height/2 - max/2,
        audioCanvas.height/2 - mean/2,
        audioCanvas.height/2 - mean/2
    ];
    var heights = [max, mean, mean];

    for (i = 0; i < 3; i++){
        audioCanvasContext.fillRect(
            xxs[i],         // x-coord of upper-left
            yys[i],        // y-coord of upper-left
            audioSignalBarWidth,         // width
            heights[i]                          // height
            );
    }
}

$('img#recordButtonImage').on('click', function(event){
    var imgSrc = '../static/img/record-button-active.png';
    if (mediaStream){
        imgSrc = '../static/img/record-button-inactive.png';
    } 
    $(this).attr('src', imgSrc);
    streamFromMicrophone();
});

$('img#recordButtonImage').hover(function(){
    $(this).css('cursor', 'pointer');
})