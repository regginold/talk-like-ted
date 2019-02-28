// linked_charts.js

// generate some hypothetical data
// var data = [
//     {'proportion': 0.5, 'topic': 'Topic A', 'categories': [{'name': 'cat1', 'value': 0.24}, {'name': 'cat2', 'value': 0.66}]}, 
//     {'proportion': 0.4, 'topic': 'Topic B', 'categories': [{'name': 'cat1', 'value': 0.66}, {'name': 'cat2', 'value': 0.32}]}, 
//     {'proportion': 0.3, 'topic': 'Topic C', 'categories': [{'name': 'cat1', 'value': 0.43}, {'name': 'cat2', 'value': 0.6}]},
//     {'proportion': 0.2, 'topic': 'Topic D', 'categories': [{'name': 'cat1', 'value': 0.17}, {'name': 'cat2', 'value': 0.85}]}, 
//     {'proportion': 0.1, 'topic': 'Topic E', 'categories': [{'name': 'cat1', 'value': 0.22}, {'name': 'cat2', 'value': 0.72}]},
// ];


// this is a hack so that we can use this script on both the example.html and 
// stream.html pages.
var url = window.location.pathname;
var filename = url.substring(url.lastIndexOf('/') + 1);

socket.on('topic modeling', function(data){
    make_plots(data);
});

if (!filename.includes('example'))
{
    $('form#update').on('input change', function(event) {
        var rng = $('input#num_topics');
        socket.emit('update lda topics', rng.val());
        $('#current_num_topics').text(rng.val());
        $('#current_topic').text('');
    });
} else {
    $('form#update').on('input change', function(event) {
        var rng = $('input#num_topics');
        socket.emit('example update lda topics', rng.val());
        $('#current_num_topics').text(rng.val());
        $('#current_topic').text('');
    });
}

var make_plots = function(data) {

    $('#lda-plots').css('display', 'block');

    d3.select('#topic-bubble-chart')
        .selectAll('svg').selectAll('*').remove();
    
    d3.select('#topic-bar-chart')
        .selectAll('svg').selectAll('*').remove();

    var bar_graph_set = false;
    var bar_graph = null;

    var width=400,
        height=300;

    var bar_width=100,
        bar_plot_height=300;

    // ==================Bubble Char=============================
    var bubbles = d3.select('#topic-bubble-chart').datum(data)
    var bubbles_svg = bubbles.selectAll('svg')
        .attr('width', width)
        .attr('height', height);

    var simulation = d3.forceSimulation(data)
        .force("charge", d3.forceManyBody().strength([-500]))
        .force("x", d3.forceX())
        .force("y", d3.forceY())
        .on("tick", ticked);

    function ticked(e) {
        node.attr("transform",function(d) {
            return "translate(" + [d.x+(width / 2), d.y+((height) / 2)] +")";
        });
    }

    var scale_radius = d3.scaleLinear()
        .domain([d3.min(data, function(d) { return +d.proportion * 100; }),
                d3.max(data, function(d) { return +d.proportion * 100; })])
        .range([20, 100]);

    var color_circles = d3.scaleOrdinal(d3.schemeSet1);

    var node = bubbles_svg.selectAll("circle")
        .data(data)
        .enter()
        .append("g")
        .attr('transform', 'translate(' + [width/2, height/2] + ')');

    node.append('circle')
        .attr('r', function(d) { return scale_radius(d.proportion * 100); })
        .style("fill", function(d) { return color_circles(d.topic); })
        .style('opacity', 0.9)
        .attr('stroke', 'black')
        .attr('stroke-width', 0)
            .on('mouseover', function() {
                d3.select(this)
                    .transition()
                    .duration(100)
                    .attr('stroke-width', 5)
                    .style('cursor', 'pointer')
            })
            .on('mouseout', function() {
                d3.select(this)
                    .transition()
                    .duration(100)
                    .attr('stroke-width', 0)
                    .style('cursor', 'auto')
            })
        .on("click", datum => {
            var color = color_circles(datum.topic);
            d3.select('#current_topic')
                .text(datum.topic)
                .style('color', color)
                .style('font-weight', 'bold');

            if (!bar_graph_set) {
                bar_graph = make_bar_chart(datum, color);
                bar_graph_set = true;
            }
            else {
                var prev_bars = d3.select('#topic-bar-chart')
                    .selectAll('svg').selectAll('*').remove();
                bar_graph = make_bar_chart(datum, color);
            }
        });

    node.append('text')
        .attr('clip-path', function(d, i) { return "url(#clip-" + i + ")"; })
        .attr('text-anchor', 'middle')
        .attr('x', function(d) { return 0; })
        .attr('y', function(d) {return '.3em'; })
        .text(function(d) { return d.topic; });

    //========================Bar Chart=====================================

    var make_bar_chart = function(datum, bar_color) {
        var data0 = datum.categories
        var bar_height = 20;

        var x = d3.scaleLinear()
            .domain([0, d3.max(data0, function(d) { return d.value; })])
            .range([0, bar_width]);

        var bars = d3.select('#topic-bar-chart')
        var bars_svg = bars.selectAll('svg')
            .attr('width', bar_width)
            .attr('height', bar_plot_height);

        var bar = bars_svg.selectAll('g')
            .data(data0)
            .enter()
            .append('g')
            .attr('transform', function(d, i) {
                return "translate(0," + i * bar_height + ")";
            });

        bar.append('rect')
            .attr('width', function(d) {return x(d.value); })
            .attr('height', bar_height - 1)
            .style('opacity', 0.9)
            .attr('rx', 5)
            .attr('ry', 5)
            .attr('fill', bar_color);

        bar.append('text')
            .attr('x', function(d) { return 5; })
            .attr('y', bar_height/2)
            .attr('dy', '.35em')
            .text(function(d) {return d.name; });

        return bar;
    }
}