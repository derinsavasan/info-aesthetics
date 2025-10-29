// Config
const CONFIG = {
  VALUE_MODE: "hours",
  SPLIT_MULTI_GENRES: true,
  valueFields: {
    hours: ["Watch Time", "watch_time", "WatchTime", "Hours Viewed", "hours_viewed", "HoursViewed"],
    views: ["View Count", "view_count", "ViewCount", "Views", "views"]
  },
  languageFields: ["language", "Language", "originalLanguage"],
  genreFields: ["genres", "Genres"],
  genreMap: {
    "sci-fi": "sci-fi", "sci fi": "sci-fi", "scifi": "sci-fi",
    "science": "sci-fi", "fiction": "sci-fi", "science fiction": "sci-fi",
    "science-fiction": "sci-fi"
  },
  languageInfers: {
    spanish: "Spanish", french: "French", german: "German", korean: "Korean",
    japanese: "Japanese", chinese: "Chinese", italian: "Italian", portuguese: "Portuguese",
    hindi: "Hindi", russian: "Russian", arabic: "Arabic"
  },
  files: [
    { path: "data/NetflixMovies_added.csv", type: "Movie" },
    { path: "data/NetflixTV_added.csv", type: "TV" }
  ]
};

// Global State
let VALUE_MODE = CONFIG.VALUE_MODE;
let SPLIT_MULTI_GENRES = CONFIG.SPLIT_MULTI_GENRES;
let typeScale, genreScale, languageScale;

// Utility Functions
const cleanGenre = g => g.replace(/[().,;!?']/g, '').trim();
const toNumber = x => {
  if (!x || x === "") return NaN;
  const s = String(x).replace(/,/g, "").trim();
  return +s.match(/^([0-9.]+)$/)?.[1] || +s;
};
const formatValue = v => {
  if (!isFinite(v) || v <= 0) return "0";
  let divisor, suffix;
  if (v >= 1e9) { divisor = 1e9; suffix = "B"; }
  else if (v >= 1e6) { divisor = 1e6; suffix = "M"; }
  else if (v >= 1e3) { divisor = 1e3; suffix = "K"; }
  else return String(Math.round(v));
  let str = (v / divisor).toFixed(2);
  str = str.replace(/(\.\d*?)0+$/, '$1');
  return str + suffix;
};
const pluralize = word => {
  if (!word) return '';
  if (word.toLowerCase() === 'comedy') return 'comedies';
  if (word.toLowerCase() === 'tv') return 'TV shows';
  if (word.toLowerCase() === 'sci-fi') return 'sci-fi';
  if (word.toLowerCase() === 'espionage') return 'espionage';
  if (word.endsWith('y') && !/[aeiou]y$/i.test(word)) return word.slice(0, -1) + 'ies';
  if (word.endsWith('s')) return word + 'es';
  return word + 's';
};
const formatType = word => word.toLowerCase() === 'tv' ? 'TV' : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

// Data Processing
function normalizeRow(row, type) {
  let lang = row.originalLanguage?.trim() ||
             row.language?.trim() ||
             row.Language?.trim();
  if (!lang && row.title) {
    const title = row.title.toLowerCase();
    for (const [key, val] of Object.entries(CONFIG.languageInfers)) {
      if (title.includes(key) || new RegExp(val.toLowerCase(), 'i').test(title)) {
        lang = val; break;
      }
    }
    if (!lang && /[^\x00-\x7F]/.test(row.title)) lang = "Non-English";
  }
  lang ||= "English";

  let rawGenres = row.genres?.trim() || row.Genres?.trim() || "Unspecified";
  const genres = String(rawGenres).split(/\s*[,|\/;]\s*/).map(s => s.trim()).filter(Boolean).map(g => {
    const cleaned = cleanGenre(g);
    return CONFIG.genreMap[cleaned.toLowerCase()] || cleaned;
  });
  const primaryGenre = genres[0] || "Unspecified";

  let vField = CONFIG.valueFields[VALUE_MODE].find(k => row[k] !== undefined);
  let num = toNumber(vField ? row[vField] : undefined);
  num = isFinite(num) && num >= 0 ? num : 0;

  return { Type: type, Language: lang, Genres: genres, PrimaryGenre: primaryGenre, Value: num };
}

function aggregateLeafTuples(rows) {
  const map = new Map();
  rows.forEach(r => {
    const key = `${r.Type}|${r.PrimaryGenre}|${r.Language}`;
    map.set(key, (map.get(key) || 0) + r.Value);
  });
  for (const [key, sum] of map.entries()) if (sum <= 0) map.delete(key);
  return map;
}

function tuplesToSequences(map) {
  return Array.from(map.entries()).map(([key, sum]) => {
    const [Type, Genre, Language] = key.split("|");
    return [`${Type}|${Genre}|${Language}|end`, sum];
  });
}

function buildHierarchy(csvRows) {
  const root = { name: "root", children: [] };
  csvRows.forEach(([seq, size]) => {
    const parts = seq.split("|");
    let node = root;
    for (let i = 0; i < parts.length; ++i) {
      const name = parts[i];
      if (name === "end") {
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
  });
  pruneEmptyBranches(root);
  return root;
}

function pruneEmptyBranches(node) {
  if (node.children) {
    node.children = node.children.filter(child => {
      pruneEmptyBranches(child);
      return (child.children?.length > 0) || (child.value > 0);
    });
  }
}

// Main Init
async function init() {
  const datasets = await Promise.all(CONFIG.files.map(async f => {
    const rows = await d3.csv(f.path);
    return rows.map(r => normalizeRow(r, f.type));
  }));
  const allRows = datasets.flat();
  const expandedRows = SPLIT_MULTI_GENRES ? allRows.flatMap(r => r.Genres.map(g => ({ ...r, PrimaryGenre: g }))) : allRows;
  const aggMap = aggregateLeafTuples(expandedRows);
  const sequences = tuplesToSequences(aggMap);
  const root = buildHierarchy(sequences);
  const totalValue = d3.sum(expandedRows, r => r.Value);
  let totalText;
  if (VALUE_MODE === 'hours') {
    totalText = `Total data: ${formatValue(totalValue).replace('B', ' billion')} hours`;
  } else {
    totalText = `Total data: ${formatValue(totalValue).replace('B', ' billion')} streams`;
  }
  d3.select("#filteredTotal").text(totalText);
  renderSunburst(root);
  window.__netflixSunburstRoot = root;
}

// Controls
function setupControls() {
  const filterExplanation = document.getElementById('filter-explanation');
  if (filterExplanation) filterExplanation.innerHTML = 'Use the toggle to switch between what people committed time to and what they were curious enough to try.';
  const explanations = {
    hours: 'Measures the total amount of time viewers spent watching a title. Calculated in total hours viewed across all viewers.',
    views: 'Counts how many times a title was started. Each press of “play” counts as one view, no matter how long someone watched it for.'
  };
  d3.selectAll('input[name="valueMode"]').on("change", function() {
    VALUE_MODE = this.value;
    if (filterExplanation) filterExplanation.innerHTML = explanations[VALUE_MODE] || '';
    init();
  }).on("click", function() {
    if (filterExplanation) filterExplanation.innerHTML = explanations[this.value] || '';
  });
}

// Rendering
// Rendering Helpers
function createPartitionAndRoot(data, radius) {
  const partition = d3.partition().size([2 * Math.PI, radius * radius]);
  const root = partition(d3.hierarchy(data).sum(d => d.value).sort((a, b) => b.value - a.value));
  return root;
}

function setupColorScales(root) {
  typeScale = d3.scaleOrdinal().domain(["Movie", "TV"]).range(["#E50914", "#B81D24"]);
  genreScale = d3.scaleOrdinal(["#DC143C", "#CD5C5C", "#F08080", "#FA8072", "#E9967A", "#FFB6C1", "#FFC0CB", "#FF7F50"]);
  languageScale = d3.scaleOrdinal(["#800000", "#8B0000", "#A0522D", "#A52A2A", "#C71585", "#FF0000", "#FF6347", "#FF4500", "#FF1493", "#8B4513", "#A0522D", "#B22222"]);
  const genres = new Set();
  root.descendants().forEach(d => {
    if (d.depth >= 2) {
      let node = d;
      while (node.depth > 2) node = node.parent;
      genres.add(node.data.name);
    }
  });
  genreScale.domain(Array.from(genres).sort());
}

function createArcs(radius) {
  const minArcWidth = 2;
  const arc = d3.arc().startAngle(d => d.x0).endAngle(d => d.x1).padAngle(1 / radius).padRadius(radius)
    .innerRadius(d => Math.sqrt(d.y0)).outerRadius(d => Math.max(Math.sqrt(d.y0) + minArcWidth, Math.sqrt(d.y1) - 1));
  const mousearc = d3.arc().startAngle(d => d.x0).endAngle(d => d.x1).innerRadius(d => Math.sqrt(d.y0)).outerRadius(radius);
  return { arc, mousearc };
}

function setupCenterLabel(svg) {
  const centerLabel = svg.append("g").attr("class", "center-label");
  centerLabel.append("text").attr("class", "center-pct").attr("text-anchor", "middle").attr("y", -8).attr("font-family", "'Helvetica Neue', Helvetica, Arial, sans-serif").text("");
  centerLabel.append("text").attr("class", "center-desc").attr("text-anchor", "middle").attr("y", 20).attr("font-family", "'Helvetica Neue', Helvetica, Arial, sans-serif").text("");
  return centerLabel;
}

function setupTooltip() {
  return d3.select("#tooltip");
}

function setupBreadcrumb() {
  return d3.select("#breadcrumb");
}

function renderNodes(svg, root, arc, mousearc) {
  const nodes = svg.append("g").selectAll("path").data(root.descendants().filter(d => d.depth)).join("path")
    .attr("fill", d => colorForNode(d)).attr("fill-opacity", 1.0).attr("d", arc);
  const mouseLayer = svg.append("g").selectAll("path").data(root.descendants().filter(d => d.depth)).join("path")
    .attr("fill", "none").attr("pointer-events", "all").attr("d", mousearc);
  return { nodes, mouseLayer };
}

function setupMouseEvents(mouseLayer, nodes, root, centerLabel, tooltip, breadcrumb, VALUE_MODE) {
  mouseLayer
    .on("mouseenter", function(event, d) {
      nodes.attr("fill-opacity", n => d.ancestors().includes(n) ? 1.0 : 0.3);
      d3.select("#title-overlay").style("opacity", 0);
      const pct = (100 * d.value / root.value).toFixed(1);
      centerLabel.select('.center-pct').text(`${pct}%`);
      const desc = formatCenterDesc(d, root, VALUE_MODE);
      const descEl = centerLabel.select('.center-desc');
      descEl.selectAll('tspan').remove();
      descEl.text("");
      const splitPhrase = VALUE_MODE === 'hours' ? ' went to ' : ' came from ';
      const parts = desc.split(splitPhrase);
      if (parts.length > 1) {
        descEl.append('tspan').text(parts[0] + splitPhrase).attr('x', 0).attr('dy', 0);
        descEl.append('tspan').text(parts[1]).attr('x', 0).attr('dy', '1.2em');
      } else {
        descEl.text(desc);
      }
      updateBreadcrumb(d, breadcrumb, root);
      const valueLabel = VALUE_MODE === "hours" ? "Watch Time" : "View Count";
      let left = event.pageX + 5, top = event.pageY + 5;
      tooltip.classed("show", true).style("left", `${left}px`).style("top", `${top}px`).html(`${valueLabel}: ${formatValue(d.value)}`);
      // Adjust position...
      const tooltipNode = tooltip.node();
      if (tooltipNode) {
        const tooltipWidth = tooltipNode.offsetWidth, tooltipHeight = tooltipNode.offsetHeight;
        if (left + tooltipWidth > window.innerWidth) left = event.pageX - 10 - tooltipWidth;
        if (top + tooltipHeight > window.innerHeight) top = event.pageY - 10 - tooltipHeight;
        if (left < 0) left = 10; if (top < 0) top = 10;
        tooltip.style("left", `${left}px`).style("top", `${top}px`);
      }
    })
    .on("mouseleave", function(event, d) {
      nodes.attr("fill-opacity", 1.0);
      d3.select("#title-overlay").style("opacity", 1);
      centerLabel.select('.center-pct').text('100%');
      const descEl = centerLabel.select('.center-desc');
      if (VALUE_MODE === 'hours') {
        descEl.selectAll('tspan').remove();
        descEl.text("");
        descEl.text(`${formatValue(root.value).replace('B', ' billion')} hours were spent on Netflix.`);
      } else {
        descEl.selectAll('tspan').remove();
        descEl.text("");
        descEl.text(`${formatValue(root.value).replace('B', ' billion')} streams were logged on Netflix.`);
      }
      breadcrumb.html("");
      tooltip.classed("show", false);
    });
}

function updateBreadcrumb(d, breadcrumb, root) {
  const sequence = d.ancestors().reverse().slice(1).filter(n => n.data.name !== 'end').map(n => n.data.name);
  const percentage = (100 * d.value / root.value).toFixed(1);
  breadcrumb.selectAll("*").remove();
  const svgBread = breadcrumb.append("svg").attr("width", 800).attr("height", 40);
  let xOffset = 0;
  sequence.forEach((step, i) => {
    const displayStep = step === 'sci-fi' ? 'Sci-Fi' : step;
    const textContent = i === sequence.length - 1 ? `${displayStep} (${percentage}%)` : displayStep;
    const width = textContent.length * 6 + 20, height = 30;
    const points = [[xOffset, 0], [xOffset + width - 10, 0], [xOffset + width, height / 2], [xOffset + width - 10, height], [xOffset, height]];
    let fillColor = i === 0 ? typeScale(step) : i === 1 ? genreScale(step) : languageScale(step);
    svgBread.append("polygon").attr("points", points.map(p => p.join(",")).join(" ")).attr("fill", fillColor).attr("stroke", "#fff").attr("stroke-width", 1);
    svgBread.append("text").attr("x", xOffset + width / 2).attr("y", height / 2 + 5).attr("text-anchor", "middle").attr("fill", "#fff").attr("font-size", 12).text(textContent);
    xOffset += width - 5;
  });
}

function renderSunburst(data) {
  const container = d3.select("#chart");
  container.selectAll("*").remove();
  const size = Math.min(window.innerWidth, window.innerHeight) * 0.9;
  const radius = size / 2;
  const svg = container.append("svg").style("display", "block").style("margin", "auto")
    .append("g").attr("transform", `translate(${size/2},${size/2})`);

  const root = createPartitionAndRoot(data, radius);
  setupColorScales(root);
  const { arc, mousearc } = createArcs(radius);
  const centerLabel = setupCenterLabel(svg);
  const tooltip = setupTooltip();
  const breadcrumb = setupBreadcrumb();
  const { nodes, mouseLayer } = renderNodes(svg, root, arc, mousearc);
  setupMouseEvents(mouseLayer, nodes, root, centerLabel, tooltip, breadcrumb, VALUE_MODE);
  centerLabel.raise();
}

// Helpers
function formatCenterDesc(d, root, VALUE_MODE) {
  const path = d.ancestors().reverse().slice(1).filter(n => n.data.name !== 'end');
  let type = path[0]?.data.name, genre = path[1]?.data.name, language = path[2]?.data.name;
  const phrase = VALUE_MODE === 'hours' ? 'of all viewing time went to ' : 'of all streams came from ';
  const genreLower = genre ? genre.toLowerCase() : '';
  let cat = '';
  if (type && genre && language) {
    if (genreLower === 'children') {
      if (formatType(type) === 'TV') cat = `${language} children's TV`;
      else if (formatType(type) === 'Movie') cat = `${language} children's movies`;
      else cat = `${language} ${genreLower} ${pluralize(formatType(type))}`;
    } else {
      if (formatType(type) === 'TV') cat = `${language} TV ${pluralize(genreLower)}`;
      else if (formatType(type) === 'Movie') cat = `${language} ${genreLower} movies`;
      else cat = `${language} ${genreLower} ${pluralize(formatType(type))}`;
    }
  } else if (type && genre) {
    if (formatType(type) === 'TV') cat = `TV ${pluralize(genreLower)}`;
    else if (formatType(type) === 'Movie') cat = `${genreLower} movies`;
    else cat = `${genreLower} ${pluralize(formatType(type))}`;
  } else if (type && language) {
    if (formatType(type) === 'TV') cat = `${language} TV shows`;
    else if (formatType(type) === 'Movie') cat = `${language} movies`;
    else cat = `${language} ${pluralize(formatType(type))}`;
  } else if (type) {
    if (formatType(type) === 'TV') cat = 'TV shows';
    else if (formatType(type) === 'Movie') cat = 'movies';
    else cat = pluralize(formatType(type));
  } else if (genre) cat = pluralize(genreLower);
  else if (language) cat = `${language} titles`;
  return phrase + (cat.charAt(0) === cat.charAt(0).toLowerCase() ? cat : cat.charAt(0).toUpperCase() + cat.slice(1)) + '.';
}

function formatTotalLine(root, VALUE_MODE) {
  const total = formatValue(root.value);
  return VALUE_MODE === 'hours' ? `100% of total watch time: ${total}` : `100% of total view count: ${total}`;
}

function colorForNode(d) {
  if (d.depth === 1) return typeScale(d.data.name);
  if (d.depth === 2) return genreScale(d.data.name);
  if (d.depth === 3) return languageScale(d.data.name);
  return "#fff";
}

// Resize
if (typeof window !== 'undefined') {
  let _resizeTimer = null;
  window.addEventListener('resize', () => {
    if (!window.__netflixSunburstRoot) return;
    if (_resizeTimer) clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => renderSunburst(window.__netflixSunburstRoot), 250);
  });
}

// Init
if (typeof d3 !== 'undefined') {
  init();
  setupControls();
}