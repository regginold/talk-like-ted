// vizualizations to show most-commonly used words.

var word_data = null;
var nav_modal_expanded = true;

/**
 * Gets the current width of the left column on the page
 */
var left_col_width = function() {
    return parseFloat($('.col-md-3').width()) + parseFloat($('.col-left').css('padding-left')) * 2;
}

/**
 * Pulls the nav modal onto the page when the user has finished recording.
 * Note that the nav's starting position is (-500, 200)
 * @param {bool} show - whether to show or hide the nav modal
 */
var load_nav_modal = function(show) {
    var nav_modal = document.getElementById('text-analysis-nav-modal');
    if (show) {
        nav_modal.style.display = 'block';
        $('#text-analysis-nav-modal').css('position', 'absolute').animate({
            left: $('.col-left').position().left + 500,
            width: left_col_width()
        });
    } else {
        nav_modal.style.display = 'none';
    }
}

/**
 * Shrinks the nav modal to the size of the hamburger menu.
 */
var toggle_nav_modal_closed = function() {
    $('#text-analysis-nav-modal').animate({
        height: '25px',
        width: '25px',
        top: $(document).scrollTop() + 30
    }, 200);
    nav_modal_expanded = false;
}

/**
 * Expands the nav modal to match the width of the left column (.col-md-3)
 */
var toggle_nav_modal_opened = function() {
    // console.log(col_width);
    $('#text-analysis-nav-modal').animate({
        height: '260px',
        width: left_col_width(),
        top: $(document).scrollTop() + 35
    }, 200);
    nav_modal_expanded = true;
}

/**
 * Toggles the nav modal when the hamburger menu icon is clicked
 */
$('#hamburger-menu').click(function(){
    if (nav_modal_expanded) {
        toggle_nav_modal_closed();
    } else {
        toggle_nav_modal_opened();
    }
});

/**
 * Change the cursor into a hand (pointer) when user mouses over the hamburger
 * menu icon.
 */
$('#hamburger-menu').mouseover(function(){
    $(this).css('cursor', 'pointer');
});

/**
 * Setup the items in the nav modal list.
 * (1) Change cursor to pointer when user scrolls over link.
 * (2) Scrolls the page to the appropriate location when a link is clicked.
 * (3) Shrinks the size of the nav modal to the size of the hamburger menu icon.
 */
$('.text-list-item').each(function(){
    $(this).hover(function(){ $(this).css('cursor', 'pointer'); });
    var offset = 0;
    $(this).click(function(){
        var target = $(this).data('link-target');
        if (target === '#speed-dt-plot') {
            offset = 190;
        } else {
            offset = 100;
        }
        $("html, body").animate({ scrollTop: $(target).offset().top - offset });
        toggle_nav_modal_closed();
    });
});

/**
 * Update the size of the nav modal so that it matches the size of the left column
 * when a user resizes the window. Also update each of the plot rows to make sure
 * their heights are the same as that of the page.
 */
$(window).resize(function() {
    $('#text-analysis-nav-modal').css(
        'width', left_col_width()
    ).css(
        'left', $('.col-left').position().left + 500
    );

    // uncomment this if you want each row labeled with 'plot-row' to be adjusted
    // to fit the size of the window whenever the window size changes.

    // var plot_row = $('.plot-row')
    // var current_row_height = null;
    // var window_height = parseInt($(window).height());

    // plot_row.each(function() {
    //     current_row_height = parseInt($(this).css('height'));
    //     if ( current_row_height < window_height ) {
    //         $(this).css('height', window_height);
    //     }
    // });
})

/**
 * Make the nav modal follow the user's position on the page.
 */
$(document).scroll(function(){
    $('#text-analysis-nav-modal').css('top', $(document).scrollTop() + 30);
});

/**
 * Displays the section labels.
 */
var show_section_labels = function() {
    $('.section-label').css('display', 'block');
}

/**
 * Hides the section labels.
 */
var hide_section_labels = function() {
    $('.section-label').css('display', 'none');
}

/**
 * Displays an interactive transcript on the page.
 * @param {Array} transcript - Each item in the list should be a dict with the key
 *                             `word` and the value should be the word spoken. Items
 *                             should be arranged sequentially so that `transcript[0]`
 *                             is the first word spoken and `transcript[transcript.length-1]` 
 *                             is the last.
 */
var show_transcript = function(transcript) {
    // get rid of any text that is in the streaming-transcript div, and
    // replace the div with the completed-interactive-transcript div.
    $('#streaming-transcript').empty();
    d3.select('#completed-interactive-transcript')
        .selectAll('span')
        .data(transcript)
        .enter()
        .append('span')
            .text(function (d) { return d.word + " "; })
            .on('mouseover', function() {
                d3.select(this)
                    .transition()
                    .duration(100)
                    .style('font-weight', 'bold')
                    .style('cursor', 'pointer');
            })
            .on('mouseout', function(){
                d3.select(this)
                    .transition()
                    .duration(100)
                    .style('font-weight', 'normal');
            })
            .on('click', function(datum) {
                highlight_words('#completed-interactive-transcript', datum, 'gray');
                highlight_bar('#most-common-words-plot', datum, 'black', 'steelblue');
                highlight_bar('#tf-idf-words-plot', datum, 'black', 'orange');
            });
}

/**
 * Plot the user's most-used words.
 * @param {Array} data - Each element should be a dict with the keys `word` and `count`.
 */
var plot_word_counts_including_stop = function(data) {
    vertical_bar_plot(
        selector='#most-common-words-plot',
        data=data,
        height=200,
        width=150,
        bar_color='steelblue',
        update_selector='#completed-interactive-transcript',
        update=highlight_words
    );
}

/**
 * Plot the users most-used non-stop-words.
 * @param {Array} data - Each element should be a dict with the keys `word` and `count`.
 */
var plot_word_counts_excluding_stop = function(data) {
    vertical_bar_plot(
        selector='#tf-idf-words-plot',
        data=data,
        height=200,
        width=150,
        bar_color='orange',
        update_selector='#completed-interactive-transcript',
        update=highlight_words
    );
}

/**
 * Creates a vertical bar plot given a selector and data
 * @param {string} selector - ID of element wher the plot should be plotted.
 *                            There should already be an svg tag in this element.
 * @param {Array} data - Each element should be a dict with a `count` key and a
 *                       `word` key.
 * @param {int} height - plot height
 * @param {int} width - plot width
 * @param {string} bar_color - valid html color
 * @param {string} update_selector - ID of element that will be updated when a 
 *                                   user clicks one of the bars.
 * @param {function} update - function that will be called when a user clicks one
 *                            of the bars. Function should take the following 
 *                            params: `update_selector`, `data`, `bar_color`.
 */
var vertical_bar_plot = function(selector, data,
    height=200, width=150, bar_color='steelblue', update_selector, update=function(){}) {

    var num_items = data.length;
    var bar_plot_height = height;
    var bar_plot_width = width;
    var bar_height = bar_plot_height/num_items;
    var bar_color = bar_color;
    var margin_top = 2;
    var margin_left = 2;
    var bar_margin_right = 20;

    var x = d3.scaleLinear()
        .domain([0, d3.max(data, function(d) { return d.count; })])
        .range([margin_left, bar_plot_width - bar_margin_right]);

    d3.select(selector)
        .selectAll('svg')
            .attr('width', bar_plot_width)
            .attr('height', bar_plot_height)
        .selectAll('g')
            .data(data)
            .enter()
                .append('g')
                .append('rect')
                    .attr('width', function(d) {return x(d.count); })
                    .attr('height', bar_height - 2)
                    .style('opacity', 0.9)
                    .attr('rx', 5)
                    .attr('ry', 5)
                    .attr('fill', bar_color)
                    .attr('transform', function(d, i) {
                        return "translate(0," + ((i * bar_height) + margin_top) + ")";
                    })
                .on('mouseover', function(d) {
                    d3.select(this)
                        .style('stroke-width', 2)
                        .style('stroke', 'black')
                        .style('cursor', 'pointer');
                })
                .on('mouseout', function(d) {
                    d3.select(this)
                        .style('stroke-width', 1)
                        .style('stroke', bar_color);
                })
                .on('click', function(d) {
                    update(update_selector, d, bar_color);
                });

    d3.select(selector)
        .selectAll('svg')
        .selectAll('g')
            .data(data)
            .append('text')
                .attr('x', function(d) { return 1; })
                .attr('y', function(d, i) { return i * bar_height + bar_height/2 + margin_top; })
                .attr('dy', '.35em')
                .text(function(d) { return d.word; })
                .style('color', 'black');

    d3.select(selector)
        .selectAll('svg')
        .selectAll('g')
            .data(data)
            .append('text')
                .attr('x', function(d) { return x(d.count) + 2; })
                .attr('y', function(d, i) { return i * bar_height + bar_height/2 + margin_top; })
                .attr('dy', '.35em')
                .text(function(d) { return d.count; })
                .style('color', 'black');
}

/**
 * Checks if two words are equal; case and punctuation insensitive.
 * @param {string} d - word 1
 * @param {string} expected - word 2
 * @param {any} value_if_true - value to return if words are equal
 * @param {any} value_if_false - value to return if words are not equal
 */
var words_equal = function(d, expected, value_if_true, value_if_false) {
    // strip punctuation from words
    var d_minus_punct = d.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").toLowerCase();
    var exp_minus_punct = expected.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").toLowerCase();
    return d_minus_punct === exp_minus_punct ? value_if_true : value_if_false;
}

/**
 * Highlights words in a div when a user clicks on a bar using d3.
 * @param {string} selector - ID of div to highlight words within.
 * @param {dict} datum - word to highlight; must have the key `word`
 * @param {string} color - valid html color; this will be the highlight color.
 */
var highlight_words = function(selector, datum, color) {
    d3.select(selector)
        .selectAll('span')
        .transition()
        .duration(100)
        .style('background-color', function(d) {
            return words_equal(d.word, datum.word, color, 'white');
        });
}

/**
 * Highlights bars when a user clicks on a word using d3.
 * @param {string} selector - ID of element containing bar plot.
 * @param {dict} datum - bar (representing word) to highlight in bar plot; must have key `word`
 * @param {string} outline_color_on - outline color of bar if word matches bar
 * @param {string} outline_color_off - outline color of bar if word does not match bar
 */
var highlight_bar = function(selector, datum, outline_color_on='black',
        outline_color_off='steelblue') {
    d3.select(selector)
        .selectAll('rect')
        .transition()
        .duration(100)
        .style('stroke-width', function(d) {
            return words_equal(d.word, datum.word, 2, 1);
        })
        .style('stroke', function(d) {
            return words_equal(d.word, datum.word, outline_color_on, outline_color_off);
        })
}