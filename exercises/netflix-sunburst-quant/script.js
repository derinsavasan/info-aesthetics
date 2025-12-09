/* Netflix Sunburst
   Data: two CSVs (movies + tv). Value = Hours Viewed by default.

   Customize:
   - VALUE_MODE: "hours" | "views"
   - SPLIT_MULTI_GENRES: false | true (if true, split titles across all listed genres)
*/


// Global State & Controls
let VALUE_MODE = "hours"; // "hours" | "views"
let SPLIT_MULTI_GENRES = true; // Default to true for full splitting
const ENABLE_ZOOM = false; // Set to true to enable zoom functionality

// Color scale
const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
let typeScale, genreScale, languageScale;

// Field Normalization
const valueFields = {
  hours: ["Hours Viewed", "hours_viewed", "HoursViewed"],
  views: ["Views", "views"]
};
const languageFields = ["language", "Language", "originalLanguage"];
const genreFields = ["genres", "Genres"];
const genreMap = {
  "sci-fi": "Science Fiction",
  "sci fi": "Science Fiction",
  "scifi": "Science Fiction",
  "science": "Science Fiction",
  "fiction": "Science Fiction",
  "science fiction": "Science Fiction",
  "science-fiction": "Science Fiction",
  // Add more mappings as needed
};

function cleanGenre(g) {
  return g.replace(/[().,;!?']/g, '').trim();
}

function normalizeRow(row, type) {
  // Pick language: prioritize originalLanguage, then language/Language
  let lang = undefined;
  // Primary: originalLanguage
  if (row.originalLanguage && row.originalLanguage.trim()) {
    lang = row.originalLanguage.trim();
  } else {
    // Fallback to language or Language
    for (const f of ["language", "Language"]) {
      if (row[f] && row[f].trim()) { lang = row[f].trim(); break; }
    }
  }
  // If still missing, infer from title
  if (!lang && row.title) {
    const title = row.title.toLowerCase();
    if (title.includes("spanish") || /español|méxico|argentina|colombia/i.test(title)) lang = "Spanish";
    else if (title.includes("french") || /français|québec|canada/i.test(title)) lang = "French";
    else if (title.includes("german") || /deutsch|österreich/i.test(title)) lang = "German";
    else if (title.includes("korean") || /한국어|korea/i.test(title)) lang = "Korean";
    else if (title.includes("japanese") || /日本語|japan/i.test(title)) lang = "Japanese";
    else if (title.includes("chinese") || /中文|china/i.test(title)) lang = "Chinese";
    else if (title.includes("italian") || /italiano|italia/i.test(title)) lang = "Italian";
    else if (title.includes("portuguese") || /português|brasil/i.test(title)) lang = "Portuguese";
    else if (title.includes("hindi") || /हिन्दी|india/i.test(title)) lang = "Hindi";
    else if (title.includes("russian") || /русский|russia/i.test(title)) lang = "Russian";
    else if (title.includes("arabic") || /العربية|arab/i.test(title)) lang = "Arabic";
    // Check for non-English scripts (basic heuristic)
    else if (/[^\x00-\x7F]/.test(row.title)) lang = "Non-English"; // If title has non-ASCII, assume non-English
  }
  // Default to "English" for major markets if still unknown
  if (!lang) lang = "English";

  // Pick genres (unchanged)
  let rawGenres = undefined;
  for (const f of genreFields) {
    if (row[f] && row[f].trim()) { rawGenres = row[f]; break; }
  }
  if (!rawGenres) rawGenres = "Unspecified";
  const genres = String(rawGenres).split(/\s*[,|\/;]\s*/).map(s => s.trim()).filter(Boolean).map(g => {
    const cleaned = cleanGenre(g);
    const lower = cleaned.toLowerCase();
    return genreMap[lower] || cleaned;
  });
  const primaryGenre = genres.length ? genres[0] : "Unspecified";

  // Pick value (unchanged)
  let vField = (VALUE_MODE === "hours" ? valueFields.hours : valueFields.views).find(k => row[k] !== undefined);
  let rawVal = vField ? row[vField] : undefined;
  let num = toNumber(rawVal);
  if (!isFinite(num) || num < 0) num = 0;

  return {
    Type: type,
    Language: lang,
    Genres: genres,
    PrimaryGenre: primaryGenre,
    Value: num
  };
}

function toNumber(x) {
  if (x === undefined || x === null || x === "") return NaN;
  const s = String(x).replace(/,/g, "").trim();
  const m = s.match(/^([0-9.]+)$/);
  if (m) return +m[1];
  return +s; // fallback
}

// Aggregate to leaf tuples
function aggregateLeafTuples(rows) {
  // Map: "Type|Genre|Language" => sum (switched order to put Genre first)
  const map = new Map();
  for (const r of rows) {
    const key = `${r.Type}|${r.PrimaryGenre}|${r.Language}`;
    map.set(key, (map.get(key) || 0) + r.Value);
  }
  // Filter out zero or negative sums
  for (const [key, sum] of map.entries()) {
    if (sum <= 0) map.delete(key);
  }
  return map;
}

// Convert tuples to sequence CSV rows
function tuplesToSequences(map) {
  // Returns [ ["Type-Genre-Language-end", sum], ... ] (switched order)
  const out = [];
  for (const [key, sum] of map.entries()) {
    const [Type, Genre, Language] = key.split("|");
    out.push([`${Type}-${Genre}-${Language}-end`, sum]);
  }
  return out;
}

// Build Rodden-style hierarchy from sequence CSV rows
function buildHierarchy(csvRows) {
  const root = { name: "root", children: [] };
  for (const [seq, size] of csvRows) {
    const parts = seq.split("-");
    let node = root;
    for (let i = 0; i < parts.length; ++i) {
      const name = parts[i];
      if (name === "end") {
        // Set value on the previous node (Language) instead of creating "end" node
        node.value = (node.value || 0) + size;
        break;
      }
      let child = node.children.find(c => c.name === name);
      if (!child) {
        child = { name, children: [] };
        node.children.push(child);
      }
      node = child;
    }
  }
  // Prune empty branches
  pruneEmptyBranches(root);
  return root;
}

function pruneEmptyBranches(node) {
  if (node.children) {
    node.children = node.children.filter(child => {
      pruneEmptyBranches(child);
      return (child.children && child.children.length > 0) || (child.value && child.value > 0);
    });
  }
}



const files = [
  { path: "data/NetflixMovies_added.csv", type: "Movie" },
  { path: "data/NetflixTV_added.csv", type: "TV" }
];

async function init() {
  // Load CSVs
  const datasets = await Promise.all(
    files.map(async f => {
      const rows = await d3.csv(f.path);
      return rows.map(r => normalizeRow(r, f.type));
    })
  );
  const allRows = datasets.flat();
  const fullTotal = d3.sum(allRows, r => r.Value);

  // Handle SPLIT_MULTI_GENRES
  const expandedRows = SPLIT_MULTI_GENRES
    ? allRows.flatMap(r => r.Genres.map(g => ({ ...r, PrimaryGenre: g })))
    : allRows;

  // Aggregate to leaf tuples
  const aggMap = aggregateLeafTuples(expandedRows);

  // Convert to sequences
  const sequences = tuplesToSequences(aggMap);

  // Build hierarchy
  const root = buildHierarchy(sequences);

  // Show filtered total
  const filteredTotal = d3.sum(expandedRows, r => r.Value);
  const percentage = fullTotal > 0 ? (100 * filteredTotal / fullTotal).toFixed(1) : 100;
  d3.select("#filteredTotal").text(`Showing ${percentage}% of total data (${formatValue(filteredTotal)})`);

  // Render
  renderSunburst(root);
  // Expose for resize
  window.__netflixSunburstRoot = root;
}

// Only initialize when d3 is present (avoids Node/CI runtime errors)
if (typeof d3 !== 'undefined') {
  init();
  setupControls();
}

function setupControls() {
  // Now hook up events
  d3.selectAll('input[name="valueMode"]').on("change", function() {
    VALUE_MODE = this.value;
    init();
  });
  d3.select("#splitGenres").on("change", function() {
    SPLIT_MULTI_GENRES = this.checked;
    init();
  });
}

function renderSunburst(data) {
  const container = d3.select("#chart");
  container.selectAll("*").remove();

  const width = Math.min(window.innerWidth, window.innerHeight) * 0.9;
  const radius = width / 2;

  const svg = container.append("svg")
    .attr("width", width)
    .attr("height", width)
    .append("g")
    .attr("transform", `translate(${width/2},${width/2})`);

  // Rodden-style partition: size [2π, r²] for area correctness
  const partition = data =>
    d3.partition().size([2 * Math.PI, radius * radius])(
      d3.hierarchy(data)
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value)
    );

  const root = partition(data);

  // Set color scales
  typeScale = d3.scaleOrdinal().domain(["Movie", "TV"]).range(["#E50914", "#B81D24"]); // Netflix red and darker red
  genreScale = d3.scaleOrdinal(["#DC143C", "#CD5C5C", "#F08080", "#FA8072", "#E9967A", "#FFB6C1", "#FFC0CB", "#FF7F50"]); // Unique lighter red shades for genres
  languageScale = d3.scaleOrdinal(["#800000", "#8B0000", "#A0522D", "#A52A2A", "#C71585", "#FF0000", "#FF6347", "#FF4500", "#FF1493", "#8B4513", "#A0522D", "#B22222"]); // Unique darker red shades for languages
  const genres = new Set();
  root.descendants().forEach(d => {
    if (d.depth >= 2) {
      let node = d;
      while (node.depth > 2) node = node.parent;
      genres.add(node.data.name);
    }
  });
  genreScale.domain(Array.from(genres).sort());

  // Set color scale domain to all unique names (for legend if needed)
  const allNames = new Set();
  root.descendants().forEach(d => allNames.add(d.data.name));
  colorScale.domain(Array.from(allNames).sort());

  // Create legend
  const legend = d3.select("#legend");
  legend.selectAll("*").remove();
  const layers = [
    "Center: Format",
    "Middle: Genre", 
    "Outer: Language"
  ];
  layers.forEach(layer => {
    legend.append("span").text(layer).style("margin-right", "15px");
  });

  // Arc generators with sqrt radii and minimum width
  const minArcWidth = 2; // Minimum pixels for arc thickness
  const arc = d3.arc()
    .startAngle(d => d.x0)
    .endAngle(d => d.x1)
    .padAngle(1 / radius)
    .padRadius(radius)
    .innerRadius(d => Math.sqrt(d.y0))
    .outerRadius(d => Math.max(Math.sqrt(d.y0) + minArcWidth, Math.sqrt(d.y1) - 1));

  const mousearc = d3.arc()
    .startAngle(d => d.x0)
    .endAngle(d => d.x1)
    .innerRadius(d => Math.sqrt(d.y0))
    .outerRadius(radius);

  const centerLabel = svg.append("g").attr("class", "center-label");
  centerLabel.append("text").attr("class", "center-title").attr("text-anchor", "middle").attr("dy", "-10");
  centerLabel.append("text").attr("class", "center-sub").attr("text-anchor", "middle").attr("dy", "10");
  // Initial center text
  centerLabel.select('.center-title').text("Netflix");
  centerLabel.select('.center-sub').text(formatValue(root.value));

  const tooltip = d3.select("#tooltip");
  const breadcrumb = d3.select("#breadcrumb");

  // Visible arcs
  const nodes = svg.append("g")
    .selectAll("path")
    .data(root.descendants().filter(d => d.depth))
    .join("path")
    .attr("fill", d => colorForNode(d))
    .attr("fill-opacity", 1.0)
    .attr("d", arc);

  // Invisible mouse layer
  svg.append("g")
    .selectAll("path")
    .data(root.descendants().filter(d => d.depth))
    .join("path")
    .attr("fill", "none")
    .attr("pointer-events", "all")
    .attr("d", mousearc)
    .on("mouseenter", function(event, d) {
      // Dim non-ancestors
      nodes.attr("fill-opacity", n => d.ancestors().includes(n) ? 1.0 : 0.3);
      // Show center sequence and percentage
      const sequence = d.ancestors().reverse().slice(1).filter(n => n.data.name !== 'end').map(n => n.data.name);
      const percentage = (100 * d.value / root.value).toFixed(1);
      centerLabel.select('.center-title').text(`${percentage}%`);
      centerLabel.select('.center-sub').text(sequence.join(" → "));
      // Update breadcrumb
      updateBreadcrumb(d);
      // Show tooltip with full path contribution
      const pathStr = sequence.join(" → ");
      const valueLabel = VALUE_MODE === "hours" ? "Hours Viewed" : "Views";
      let left = event.pageX + 10;
      let top = event.pageY + 10;
      tooltip
        .classed("show", true)
        .style("left", `${left}px`)
        .style("top", `${top}px`)
        .html(`${valueLabel}: ${formatValue(d.value)}`);
      
      // Adjust position if tooltip goes out of viewport
      const tooltipNode = tooltip.node();
      const tooltipWidth = tooltipNode.offsetWidth;
      const tooltipHeight = tooltipNode.offsetHeight;
      if (left + tooltipWidth > window.innerWidth) {
        left = event.pageX - 10 - tooltipWidth;
      }
      if (top + tooltipHeight > window.innerHeight) {
        top = event.pageY - 10 - tooltipHeight;
      }
      if (left < 0) left = 10;
      if (top < 0) top = 10;
      tooltip
        .style("left", `${left}px`)
        .style("top", `${top}px`);
    })
    .on("mouseleave", function(event, d) {
      // Restore opacity
      nodes.attr("fill-opacity", 1.0);
      // Hide center
      centerLabel.select('.center-title').text("Netflix");
      centerLabel.select('.center-sub').text(formatValue(root.value));
      // Clear breadcrumb
      breadcrumb.html("");
      // Hide tooltip
      tooltip.classed("show", false);
    });

  // Bring center label to front
  centerLabel.raise();

  // Optional zoom
  if (ENABLE_ZOOM) {
    const zoomButton = svg.append("circle")
      .attr("r", radius * 0.18)
      .attr("fill", "#181820")
      .attr("stroke", "#2a2b33")
      .attr("stroke-width", 1.5)
      .style("cursor", "pointer")
      .on("click", () => zoomTo(root));

    svg.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("fill", "#9a9aa3")
      .attr("font-size", 12)
      .text("zoom out")
      .style("pointer-events", "none");

    function zoomTo(p) {
      // Similar to old zoom logic
      const t = svg.transition().duration(700);
      nodes.transition(t).attrTween("d", function(d) {
        const xd = d3.interpolate([d.x0, d.x1], [
          Math.max(0, (d.x0 - p.x0) / (p.x1 - p.x0)) * 2 * Math.PI,
          Math.max(0, (d.x1 - p.x0) / (p.x1 - p.x0)) * 2 * Math.PI
        ]);
        const yd = d3.interpolate([d.y0, d.y1], [
          Math.max(0, (d.y0 - p.y0) / (p.y1 - p.y0)) * radius,
          Math.max(0, (d.y1 - p.y0) / (p.y1 - p.y0)) * radius
        ]);
        return function(t) {
          const x = xd(t);
          const y = yd(t);
          return arc({x0: x[0], x1: x[1], y0: y[0], y1: y[1]});
        };
      });
    }
  }

  function updateBreadcrumb(d) {
    const sequence = d.ancestors().reverse().slice(1).filter(n => n.data.name !== 'end').map(n => n.data.name);
    const percentage = (100 * d.value / root.value).toFixed(1);
    breadcrumb.selectAll("*").remove(); // Clear previous
    const svgBread = breadcrumb.append("svg").attr("width", 800).attr("height", 40); // Increased width
    let xOffset = 0;
    sequence.forEach((step, i) => {
      const textContent = i === sequence.length - 1 ? `${step} (${percentage}%)` : step;
      const width = textContent.length * 6 + 20; // Better width calculation
      const height = 30;
      const points = [
        [xOffset, 0],
        [xOffset + width - 10, 0],
        [xOffset + width, height / 2],
        [xOffset + width - 10, height],
        [xOffset, height]
      ];
      let fillColor;
      if (i === 0) fillColor = typeScale(step); // Type
      else if (i === 1) fillColor = genreScale(step); // Genre
      else fillColor = languageScale(step); // Language
      svgBread.append("polygon")
        .attr("points", points.map(p => p.join(",")).join(" "))
        .attr("fill", fillColor)
        .attr("stroke", "#fff")
        .attr("stroke-width", 1);
      svgBread.append("text")
        .attr("x", xOffset + width / 2)
        .attr("y", height / 2 + 5)
        .attr("text-anchor", "middle")
        .attr("fill", "#fff")
        .attr("font-size", 12)
        .text(textContent);
      xOffset += width - 5; // Overlap slightly
    });
  }
}

// re-render on resize using cached root (only in browser)
if (typeof window !== 'undefined') {
  let _resizeTimer = null;
  window.addEventListener('resize', () => {
    if (!window.__netflixSunburstRoot) return;
    if (_resizeTimer) clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => renderSunburst(window.__netflixSunburstRoot), 250);
  });
}

function formatValue(v) {
  if (!isFinite(v) || v <= 0) return "0";
  if (v >= 1e9) return (v/1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v/1e6).toFixed(2) + "M";
  if (v >= 1e3) return (v/1e3).toFixed(2) + "K";
  return String(Math.round(v));
}

// Type/language/genre coloring
function colorForNode(d) {
  if (d.depth === 1) return typeScale(d.data.name);
  if (d.depth === 2) return genreScale(d.data.name);
  if (d.depth === 3) return languageScale(d.data.name);
  return "#fff";
}
