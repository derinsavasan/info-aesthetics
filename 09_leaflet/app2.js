// Data sources:
// - Tiles: https://leaflet-extras.github.io/leaflet-providers/preview/
// - GeoJSON: https://datahub.io/core/geo-countries
// - Population: World Bank Open Data API - https://data.worldbank.org/indicator/SP.POP.TOTL

// Initialize map
const map = L.map('map', { 
    preferCanvas: true, 
    maxZoom: 13, 
    minZoom: 2 
}).setView([0, 0], 2)

// Load data sources
const geojson = await fetch('./countries.geojson').then(res => res.json())

// Fetch population data from World Bank API (2023 data)
const worldBankData = await fetch('https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?date=2023&format=json&per_page=300')
    .then(res => res.json())

// Extract country codes from GeoJSON
const countries = geojson.features.map(feature => feature.properties.ISO_A3)

// Create Map of country code → 2023 population
const population = d3.rollup(
    worldBankData[1].filter(row => row.value !== null), 
    v => parseFloat(v[0].value), 
    d => d.countryiso3code
)

// Calculate population range for color scale using quintiles (5 bins)
const popValues = Array.from(population.values()).sort((a, b) => a - b)
const minPop = popValues[0]
const q20 = d3.quantile(popValues, 0.20)  // 20th percentile
const q40 = d3.quantile(popValues, 0.40)  // 40th percentile
const q60 = d3.quantile(popValues, 0.60)  // 60th percentile
const q80 = d3.quantile(popValues, 0.80)  // 80th percentile

// Add NASA Blue Marble tile layer
L.tileLayer(
    'https://map1.vis.earthdata.nasa.gov/wmts-webmerc/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg',
    {
        attribution: '',
        noWrap: true
    }
).addTo(map)

// Color scale: 5 bins with quintile boundaries
// Bin 1: minPop→q20, Bin 2: q20→q40, Bin 3: q40→q60, Bin 4: q60→q80, Bin 5: q80+
const color_scale = d3
    .scaleLinear()
    .domain([minPop, q20, q40, q60, q80])
    .range(['green', 'lightyellow', 'orange', 'plum', 'purple'])

// Add countries as GeoJSON layer with population-based colors
const geo_layer = L.geoJSON(geojson, {
    style: function(feature) {
        const code = feature.properties.ISO_A3
        const pop = population.get(code)
        const fill = color_scale(pop)
        const hasData = pop !== undefined
        
        return {
            stroke: true,
            weight: 1,
            color: fill,
            opacity: hasData ? 0.8 : 0.0,
            fillColor: fill,
            fillOpacity: hasData ? 0.5 : 0.0,
        }
    },
    onEachFeature: function (feature, layer) {
        const name = feature.properties.ADMIN
        const code = feature.properties.ISO_A3
        const pop = population.get(code)
        
        // Add popup with country name and population
        layer.bindPopup(`${name}: ${pop?.toLocaleString() || 'No data'}`)
    }
}).addTo(map)