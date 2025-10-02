(async function(){
  const data = await d3.csv("proto_data.csv", d3.autoType);

  // Setup
  const svg = d3.select("#chart");
  const width = +svg.attr("width");
  const height = +svg.attr("height");
  const margin = {top: 20, right: 20, bottom: 50, left: 60};
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  // Scales
  const x = d3.scaleLinear()
    .domain([0, 10])
    .range([0, innerW]);

  const y = d3.scaleLinear()
    .domain([0, 20])           
    .range([innerH, 0]);

  // Axes
  const xAxis = d3.axisBottom(x);
  const yAxis = d3.axisLeft(y);

  g.append("g")
    .attr("transform", `translate(0,${innerH})`)
    .call(xAxis);

  g.append("g")
    .call(yAxis);

  // Axis labels
  g.append("text")
    .attr("class", "axis-label")
    .attr("x", innerW/2)
    .attr("y", innerH + 40)
    .attr("text-anchor", "middle")
    .text("Hours of Sleep (night before)");

  g.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerH/2)
    .attr("y", -45)
    .attr("text-anchor", "middle")
    .text("Minutes Late to First Class");

  // Points (static)
  g.selectAll("circle")
    .data(data)
    .join("circle")
      .attr("cx", d => x(d.sleep))
      .attr("cy", d => y(d.late))
      .attr("r", 4)
      .attr("fill", "#2f6fde")
      .attr("opacity", 0.9);
})();