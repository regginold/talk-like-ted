// creates plot which shows the running average of the number of words per 
// minute spoken by the user.


var all_wpm_data = null;
var current_slider_vals = null;
var transcript_selection_num = 0;

/**
 * Sets discrete values for the wpm_running_avg slider given the appropriate
 * bin sizes.
 */
socket.on('update speech dt slider', function(slider_vals) {
    var wpm_slider_vals = $('#wpm-slider-bin-values');
    // make sure there are no values in the datalist.
    wpm_slider_vals.empty();
    // add items to the datalist
    for (i=0; i<slider_vals.length; i++){
        var item = `<option value="${slider_vals[i]}" label="${slider_vals[i]}"></option>`;
        // console.log(item);
        wpm_slider_vals.append(item);
    }

    // unsure of how to do this in jQuery?
    var wpm_slider = document.getElementById('speed-bin-slider');
    wpm_slider.min = slider_vals[0];
    wpm_slider.max = slider_vals[slider_vals.length-1];
    wpm_slider.value = slider_vals[0];

    $('#current-wpm-slider-val').text(slider_vals[0]);

    current_slider_vals = slider_vals;
    $('#speed-plot-and-annotations').css('display', 'block');
});

socket.on('speech less than 10 seconds', function(){
    // do something
});

socket.on('make speech dt plot', function(data){
    var margin = {top: 0, left: 40, bottom: 40, right: 0};
    var plot_width = 500 - margin.left - margin.right,
        plot_height = 250 - margin.top - margin.bottom;
    var ix = current_slider_vals[0];

    // make the data available gloabally
    all_wpm_data = data;
    // then just take the first value in the set.
    datum = data[ix];
    // console.log(datum.length);
    // console.log(d3.max(datum, function(d) { return d.wpm; }));

    // var tooltip = d3.select('body')
    //     .append('div')
    //         .attr('class', 'running-avg-tooltip');
    var tooltip = d3.select('#running-avg-tooltip-modal')

    var x = d3.scaleLinear()
                .domain([0, datum.length])
                .range([0, plot_width - 55]);
    
    var y = d3.scaleLinear()
                .domain([0, d3.max(datum, function(d) { return d.wpm; }) + 10])
                .range([plot_height - 10, 10]);

    var line = d3.line()
        .x(function(d, i) { return x(i); })
        .y(function(d) { return y(d.wpm); })
        .curve(d3.curveMonotoneX);

    var svg = d3.select('#speed-dt-plot')
                .selectAll('svg')
                    .attr('width', plot_width)
                    .attr('height', plot_height)
                .append('g')
                    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')

    svg.append('path')
        .datum(datum)
        .attr('class', 'running-wpm-line')
        .attr('d', line);

    svg.append('g')
        .attr('class', 'wpm-x-axis')
        .attr('transform', 'translate(0, ' + plot_height + ')')
        .call(d3.axisBottom(x).ticks(10));

    svg.append('g')
        .attr('class', 'wpm-y-axis')
        .call(d3.axisLeft(y).ticks(5));

    svg.append('g')
        .selectAll('.dot')
            .data(datum)
            .enter()
                .append('circle')
                .attr('class', 'dot')
                .attr('r', 3)
                .attr('cx', function(d, i) {
                    return x(i);
                })
                .attr('cy', function(d) {
                    return y(d.wpm);
                })
                .attr('fill', 'rgb(255, 36, 0)')
                .on('mouseover', function() {
                    d3.select(this)
                        .style('cursor', 'pointer');
                })
                .on('click', function(d) {
                    tooltip.style('top', (d3.event.pageY) - 50 + 'px');
                    tooltip.style('left', (d3.event.pageX) + 20 + 'px');
                    tooltip.style('display', 'block');
                    d3.select('#tooltip-transcript-text').text(d.transcript);
                    d3.select(this).attr('fill', 'black');
                    return tooltip;
                })
});

// setup some functions to handle events for opening/closing the transcript
// modal.
$('#tooltip-modal-close').hover(function(){
    $(this).css('font-weight', 'bold');
    $(this).css('cursor', 'pointer');
}, function() {
    $(this).css('font-weight', 'normal');
});

$('#tooltip-modal-close').click(function(){
    $('#running-avg-tooltip-modal').css('display', 'none');
});

$('#see-transcript-from-speed').hover(function(){
    $(this).css('cursor', 'pointer');
});

/**
 * Highlight and jump to the transcript from the selected bin.
 */
$('#see-transcript-from-speed').click(function(){
    var current_transcript = $('#tooltip-transcript-text').text();
    var selection_text_found = false;
    var transcript_to_selection = '';
    // get the transcript up to the piece of the transcript that we are interested
    // in. If you don't do this, then the remainder of the function will just
    // find the first occurence of the word in the transcript dialog box -- 
    // if this is a single word, it will almost certainly break.
    // NOTE: This will still break if there are two chunks of transcript that
    // match each other exactly.
    d3.select('#speed-dt-plot')
        .selectAll('circle')
        .select(function(d, i) {
            var circle_text = d.transcript;
            if (current_transcript === circle_text) { 
                selection_text_found = true;
            }
            if (!selection_text_found) {
                transcript_to_selection += circle_text;
            }
        });

    var full_transcript = $('#completed-interactive-transcript').text();
    var text_location = full_transcript.indexOf(current_transcript, transcript_to_selection.length);

    var num_words_before_selection = full_transcript.slice(0, text_location).split(' ').length;
    var num_words_in_selection = current_transcript.split(' ').length;

    var inserted_id = false;
    var selector_id = `selected-transcript-text-${transcript_selection_num}`;
    d3.select('#completed-interactive-transcript')
        .selectAll('span')
        .select(function(d, i) {
            if (i >= num_words_before_selection - 1 && i < (num_words_before_selection + num_words_in_selection - 1)) {
                d3.select(this).style('background-color', 'rgb(255, 80, 80)');
                if (!inserted_id) {
                    inserted_id = true;
                    d3.select(this).attr('id', selector_id);
                }
            } else {
                d3.select(this).style('background-color', 'white');
            }
        });
    var target = $('#' + selector_id);
    $("html, body").animate({ scrollTop: $(target).offset().top - 100 });
    transcript_selection_num += 1;
});

/**
 * Transitions the running average line plot to new user-defined bin.
 * @param {int} ix - the currently selected bin size (it's index).
 */
var update_running_wpm_plot = function(ix) {

    var margin = {top: 0, left: 40, bottom: 40, right: 0};
    var plot_width = 500 - margin.left - margin.right,
        plot_height = 250 - margin.top - margin.bottom;

    var datum = all_wpm_data[ix];

    var x = d3.scaleLinear()
                .domain([0, datum.length])
                .range([0, plot_width - 55]);
    
    var y = d3.scaleLinear()
                .domain([0, d3.max(datum, function(d) { return d.wpm; }) + 10])
                .range([plot_height - 10, 10]);

    var line = d3.line()
        .x(function(d, i) { return x(i); })
        .y(function(d) { return y(d.wpm); })
        .curve(d3.curveMonotoneX);

    d3.select('#speed-dt-plot')
        .select('path')
            .datum(datum)
            .transition()
            .duration(100)
            .attr('class', 'running-wpm-line')
            .attr('d', line);

    d3.selectAll('circle')
        .data(datum)
        .transition()
        .duration(200)
        .attr('cy', function(d) {
            return y(d.wpm);
        });

    d3.select('.wpm-y-axis')
        .transition()
        .duration(200)
        .call(d3.axisLeft(y).ticks(5));

}

/**
 * Snap the slider to a specific value on user input.
 */
$('#speed-bin-slider').change(function() {
    var wpm_slider = document.getElementById('speed-bin-slider');
    var current_slider_val = wpm_slider.value;
    
    var diff = 0;
    var min_diff = Infinity;
    var min_diff_val = null;
    // find out what the closest ticked value is:
    for (i=0; i<current_slider_vals.length; i++) {
        diff = Math.abs(current_slider_val - current_slider_vals[i]);
        if (diff < min_diff) {
            min_diff = diff;
            min_diff_val = current_slider_vals[i];
        }
    }

    wpm_slider.value = min_diff_val;
    $('#current-wpm-slider-val').text(min_diff_val);
    update_running_wpm_plot(min_diff_val);
});