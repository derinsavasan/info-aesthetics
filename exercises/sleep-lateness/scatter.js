// D3 scatterplot: Sleep hours vs Minutes late
// Works best when served via a local server (e.g., VS Code Live Server)
(function() {
  const svg = d3.select("#chart");
  const width = +svg.attr("width");
  const height = +svg.attr("height");
  const margin = { top: 36, right: 28, bottom: 68, left: 68 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  // Axis labels
  svg.append("text")
     .attr("class", "axis-label")
     .attr("x", margin.left + innerW/2)
     .attr("y", height - 20)
     .attr("text-anchor", "middle")
     .text("Hours of Sleep (night before)");

  svg.append("text")
     .attr("class", "axis-label")
     .attr("transform", `translate(20, ${margin.top + innerH/2}) rotate(-90)`)
     .attr("text-anchor", "middle")
     .text("Minutes Late to First Class");

  // Try loading CSV; if it fails (e.g., opened as file://), fall back to inline data.
  function render(data) {
    data = data.map(d => ({
      sleep: +d.sleep,
      late: +d.late
    })).filter(d => Number.isFinite(d.sleep) && Number.isFinite(d.late));

    // Scales
    const x = d3.scaleLinear()
      .domain([Math.floor(d3.min(data, d => d.sleep) ?? 0), Math.ceil(d3.max(data, d => d.sleep) ?? 10)])
      .nice()
      .range([0, innerW]);

    const y = d3.scaleLinear()
      .domain([0, Math.max(30, Math.ceil(d3.max(data, d => d.late) ?? 30))])
      .nice()
      .range([innerH, 0]);

    // Nap Zone shading (<3h sleep)
    g.append("rect")
      .attr("x", x(0))
      .attr("y", 0)
      .attr("width", x(3) - x(0))
      .attr("height", innerH)
      .attr("fill", "#000")
      .attr("opacity", 0.06);

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x));
    g.append("g")
      .call(d3.axisLeft(y));

    // Points
    g.selectAll("circle")
      .data(data)
      .join("circle")
      .attr("cx", d => x(d.sleep))
      .attr("cy", d => y(d.late))
      .attr("r", 4)
      .attr("fill", "#2f6fde")
      .attr("opacity", 0.95);

    // Optional: quadratic trendline to show U-shape
    const coeffs = quadraticFit(data);
    if (coeffs) {
      const {a, b, c} = coeffs;
      const xs = d3.range(x.domain()[0], x.domain()[1] + 0.001, 0.05);
      const reg = xs.map(xi => ({x: xi, y: a + b*xi + c*xi*xi}));
      const line = d3.line()
        .x(d => x(d.x))
        .y(d => y(d.y));

      g.append("path")
        .datum(reg)
        .attr("fill", "none")
        .attr("stroke", "#111")
        .attr("stroke-width", 2)
        .attr("opacity", 0.75)
        .attr("d", line);

      // Label
      g.append("text")
        .attr("class", "annotation")
        .attr("x", x(x.domain()[0] + 0.3))
        .attr("y", y(d3.max(data, d => d.late) * 0.92))
        .text("Quadratic trendline (U-shape)");
    }

    // Nap Zone label
    g.append("text")
      .attr("class", "annotation")
      .attr("x", x(0.8))
      .attr("y", y((y.domain()[1]-y.domain()[0]) * 0.8))
      .text("Nap Zone (<3h) — oddly on time");

    // Worst point annotation
    const worst = data.reduce((a,b) => (a.late > b.late ? a : b), data[0]);
    if (worst) {
      g.append("line")
        .attr("x1", x(worst.sleep))
        .attr("y1", y(worst.late))
        .attr("x2", x(worst.sleep) + 36)
        .attr("y2", y(worst.late) - 36)
        .attr("stroke", "#555")
        .attr("stroke-dasharray", "3,3");
      g.append("text")
        .attr("class", "annotation")
        .attr("x", x(worst.sleep) + 40)
        .attr("y", y(worst.late) - 40)
        .text(`Worst: ${worst.late} min late`);
    }
  }

  function quadraticFit(points){
    if (!points || points.length < 3) return null;
    let Sx=0,Sx2=0,Sx3=0,Sx4=0,Sy=0,Sxy=0,Sx2y=0,n=points.length;
    for (const p of points){
      const xi=p.sleep, yi=p.late;
      const xi2=xi*xi, xi3=xi2*xi, xi4=xi2*xi2;
      Sx+=xi; Sx2+=xi2; Sx3+=xi3; Sx4+=xi4;
      Sy+=yi; Sxy+=xi*yi; Sx2y+=xi2*yi;
    }
    const A = [[n,Sx,Sx2],[Sx,Sx2,Sx3],[Sx2,Sx3,Sx4]];
    const B = [Sy,Sxy,Sx2y];
    const D = det3(A);
    if (!isFinite(D) || Math.abs(D) < 1e-9) return null;
    function det3(m){
      return m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])
           - m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])
           + m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
    }
    function replaceCol(A, col, B){
      const M = A.map(r=>r.slice());
      M[0][col] = B[0]; M[1][col] = B[1]; M[2][col] = B[2];
      return M;
    }
    const a = det3(replaceCol(A,0,B))/D;
    const b = det3(replaceCol(A,1,B))/D;
    const c = det3(replaceCol(A,2,B))/D;
    return {a,b,c};
  }

  // Load CSV, fallback to inline sample data if blocked
  d3.csv("data.csv").then(render).catch(() => {
    console.warn("Could not load data.csv. Using inline sample data.");
    render([
      {sleep: 2.2, late: 1},{sleep: 2.7, late: 3},{sleep: 2.9, late: 0},
      {sleep: 3.5, late: 14},{sleep: 4.2, late: 18},{sleep: 4.8, late: 22},
      {sleep: 5.1, late: 16},{sleep: 5.7, late: 21},{sleep: 6.2, late: 12},
      {sleep: 6.8, late: 9},{sleep: 7.1, late: 6},{sleep: 7.6, late: 4},
      {sleep: 8.0, late: 3},{sleep: 8.5, late: 2},{sleep: 9.0, late: 1}
    ]);
  });
})();
