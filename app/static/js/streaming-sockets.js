/**
 * This script defines the sockets that will be initialized for stream.html
 */

 /**
 * When the user has finished speaking, show the nav modal
 */
socket.on('speech processing done', function() {
    var nav_modal = document.getElementById('text-analysis-nav-modal');
    nav_modal.style.display = 'block';
});

/**
 * Show the plots associate with the interactive transcript and word frequency
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
    load_nav_modal(true);
    if (!nav_modal_expanded) {
        toggle_nav_modal_opened();
    }
});

/**
 * Show the word frequency usage plot which excludes common english stop words.
 */
socket.on('word counts excluding stop', function(d){
    plot_word_counts_excluding_stop(d);
});

/**
 * Remove all of the plots from the page when the user hits record again.
 */
socket.on('remove plots', function(d) {
    // hide the the nav modal and section labels.
    $('#text-analysis-nav-modal').css('display', 'none');
    hide_section_labels();

    // then get rid of everything within the word frequency plots.
    $('#completed-transcript-plots').css('display', 'none');
    d3.select('#most-common-words-plot').selectAll('svg').selectAll('*').remove();
    d3.select('#tf-idf-words-plot').selectAll('svg').selectAll('*').remove();

    // and get rid of the interactive transcript.
    d3.select('#completed-interactive-transcript').selectAll('*').remove();

    //get rid of the running wpm plot and hide the div it's sitting in
    d3.select('#speed-dt-plot').selectAll('svg').selectAll('*').remove();
    $('#speed-plot-and-annotations').css('display', 'none');

    //also get rid of the div containing the lda plots
    $('#lda-plots').css('display', 'none');
});