// example-sockets.js

var socket = io.connect('http://' + document.domain + ':' + location.port);

/**
 * When we have opened the socket, connect to the server and load the example
 * data.
 */
socket.on('connect', function(){
    socket.emit('connect example.html');

    // show the nav modal.
    var nav_modal = document.getElementById('text-analysis-nav-modal');
    nav_modal.style.display = 'block';

    // close the nav modal if it's open
    if (nav_modal_expanded) {
        toggle_nav_modal_closed();
    }
    // and bring it onto the page
    load_nav_modal(true);
})


/**
 * Show the plots associated with the interactive transcript and word frequency
 */
socket.on('word counts including stop', function(d){
    // this is a list of dict.. [{'word': String, 'count': Integer}, ...]
    var counts = d['counts'];
    // this is a list of dict.. [{'word': String}, ..] where each item is ordered
    // as words were spoken.
    var transcript = d['transcript'];
    show_transcript(transcript);
    show_section_labels();
    // display the div that will contain the plots.
    $('#completed-transcript-plots').css('display', 'block');
    plot_word_counts_including_stop(counts);
});

/**
 * Show the word frequency usage plot which excludes common english stop words.
 */
socket.on('word counts excluding stop', function(d){
    plot_word_counts_excluding_stop(d);
});