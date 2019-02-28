
var data = [{"wpm": 10, "count": 9, "name": "ted"}, {"wpm": 20, "count": 8, "name": "ted"}, {"wpm": 30, "count": 8, "name": "ted"}, {"wpm": 40, "count": 3, "name": "ted"}, {"wpm": 50, "count": 7, "name": "ted"}, {"wpm": 60, "count": 8, "name": "ted"}, {"wpm": 70, "count": 22, "name": "ted"}, {"wpm": 80, "count": 19, "name": "ted"}, {"wpm": 90, "count": 19, "name": "ted"}, {"wpm": 100, "count": 26, "name": "ted"}, {"wpm": 110, "count": 65, "name": "ted"}, {"wpm": 120, "count": 124, "name": "ted"}, {"wpm": 130, "count": 224, "name": "ted"}, {"wpm": 140, "count": 373, "name": "ted"}, {"wpm": 150, "count": 499, "name": "ted"}, {"wpm": 160, "count": 459, "name": "ted"}, {"wpm": 170, "count": 399, "name": "ted"}, {"wpm": 180, "count": 292, "name": "ted"}, {"wpm": 190, "count": 177, "name": "ted"}, {"wpm": 200, "count": 93, "name": "ted"}, {"wpm": 210, "count": 41, "name": "ted"}, {"wpm": 220, "count": 17, "name": "ted"}, {"wpm": 230, "count": 2, "name": "ted"}, {"wpm": 240, "count": 0, "name": "ted"}, {"wpm": 250, "count": 1, "name": "ted"}, {"wpm": 260, "count": 0, "name": "ted"}, {"wpm": 270, "count": 0, "name": "ted"}, {"wpm": 280, "count": 1, "name": "ted"}, {"wpm": 290, "count": 0, "name": "ted"}, {"wpm": 0, "count": 0, "name": "user"}];

var plot_height = 200,
    plot_width = 300
    ted_bar_width = 7,
    user_bar_width = 3;

var margin = {top: 20, right: 20, bottom: 30, left: 40},
    width = plot_width - margin.left - margin.right,
    height = plot_height - margin.top - margin.bottom;

var x = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.wpm)])
    .range([0, width]);

var y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.count)])
    .range([height, 0]);

var svg = d3.select("#plot-wpm").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", 
            "translate(" + margin.left + "," + margin.top + ")");

svg.selectAll(".bar")
    .data(data)
    .enter().append("rect")
    .attr("class", function(d) {
            if (d.name == 'ted') {
                    return "bar-ted";
            } else {
                    return "bar-user";
            }
    })
    .attr("x", function(d) { return x(d.wpm); })
    .attr("y", function(d) { 
            if (d.name == 'user'){
                    return y(d3.max(data, d => d.count));
            }
            return y(d.count);
    })
    .attr("width", function(d) { 
            if (d.name == 'user') {
                    return user_bar_width;
            }
            return ted_bar_width;
    })
    .attr("height", function(d) {
            if (d.name == 'user') {
                    return height - y(d3.max(data, d => d.count));
            } else {
                    return height - y(d.count); 
            }
    });

svg.append("g")
    .attr("transform", "translate(0," + height +  ")")
    .call(d3.axisBottom(x).ticks(5));

// move the user's Words-per-minute bar around the plot.
var update_wpm_plot = function(data) {
    x.domain([0, d3.max(data, d => d.wpm)]);
    y.domain([0, d3.max(data, d => d.count)]);

    var user_wpm = 0;
    for (i=0; i<data.length; i++){
            if(data[i].name == 'user') { user_wpm = data[i].wpm; }
    }
//     console.log(user_wpm);
    svg.select(".bar-user").transition()
            .duration(500)
            .attr("x", x(user_wpm));
}

socket.on('wpm plot update', function(d) {
    var new_data = [];
    for (i=0; i<data.length; i++) {
            if (data[i].name == 'user') {
                    new_data.push({'wpm': d, 'count': 0, 'name': 'user'});
            } else {
                    new_data.push(data[i]);
            }
    }
    update_wpm_plot(new_data);
})