// Loads data.csv as scatterplot
// Plots: sleep (x) vs minutes late (y)
// Framework from https://medium.com/@kj_schmidt/making-a-simple-scatter-plot-with-d3js-58cc894d7c97
(function() {
  const svg = d3.select("#chart");
  const width = +svg.attr("width");
  const height = +svg.attr("height");
  const margin = { top: 20, right: 28, bottom: 72, left: 76 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  // Tooltip, will be useful for hover interaction
  const tip = d3.select("#tooltip");

  // Following specifications heavily inspired by data viz + info aestehtics lab03_svg 

  // Axis labels
  svg.append("text")
    .attr("class", "axis-label")
    .attr("x", margin.left + innerW/2)
    .attr("y", height - 22)
    .attr("text-anchor", "middle")
    .text("Hours of Sleep (night before)");

  svg.append("text")
    .attr("class", "axis-label")
    .attr("transform", `translate(22, ${margin.top + innerH/2}) rotate(-90)`)
    .attr("text-anchor", "middle")
    .text("Minutes Late to First Class");

  function render(data){
    data = data.map(d => ({
      date: d.date,
      weekday: d.weekday,
      sleep: +d.sleep,
      late: +d.late
    }));

    // Scales
    const x = d3.scaleLinear()
      .domain([Math.floor(d3.min(data, d => d.sleep)), Math.ceil(d3.max(data, d => d.sleep))])
      .nice()
      .range([0, innerW]);

    const y = d3.scaleLinear()
      .domain([0, Math.max(30, d3.max(data, d => d.late))])
      .nice()
      .range([innerH, 0]);

    // Nap zone band (<3h): Used GPT-5 to write the "fill" instruction
    const x0 = x.domain()[0];
    g.append("rect")
      .attr("x", x(x0))
      .attr("y", 0)
      .attr("width", x(Math.min(3, x.domain()[1])) - x(x0))
      .attr("height", innerH)
      .attr("fill", "var(--band)");

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x));
    g.append("g")
      .call(d3.axisLeft(y));

    // Points
    // Hover interaction inspired by https://medium.com/@kj_schmidt/hover-effects-for-your-scatter-plot-447df80ea116
    g.selectAll("circle")
      .data(data)
      .join("circle")
      .attr("cx", d => x(d.sleep))
      .attr("cy", d => y(d.late))
      .attr("r", 3.5)
      .attr("fill", "var(--dot)")
      .attr("opacity", 0.95)
      .on("mouseenter", function(e, d){
        d3.select(this).attr("r", 5);
        tip.style("opacity", 1)
           .html(`${d.date} (${d.weekday})<br/>Sleep: ${d.sleep}h<br/>Late: ${d.late} min`)
           .style("left", (e.pageX) + "px")
           .style("top", (e.pageY) + "px");
      })
      .on("mousemove", function(e){
        tip.style("left", (e.pageX) + "px")
           .style("top", (e.pageY) + "px");
      })
      .on("mouseleave", function(){
        d3.select(this).attr("r", 3.5);
        tip.style("opacity", 0);
      });

    // Nap zone label
    g.append("text")
      .attr("class", "annotation")
      .attr("x", x(Math.max(x0 + 0.4, 0.8)))
      .attr("y", y((y.domain()[1]-y.domain()[0]) * 0.7))
      .text("Nap Zone (<3h) — usually on time");
  }

  // Load CSV (assuming no fallback)
  d3.csv("data.csv").then(render);
})();
