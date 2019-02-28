// this script is to manage the heights of each of the plot rows.
// uncomment this if you want each plot row to be the same height as the page;

var initilize_rows = function() {
    var window_height = $(window).height();
    var presentation_rows = $('#practice-presenting');
    presentation_rows.css('height', window_height);
}

// initilize_rows();