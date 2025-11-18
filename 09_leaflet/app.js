// Initialize Leaflet map centered at [0,0] with zoom level 2
const map = L.map('map', { 
    preferCanvas: true, 
    maxZoom: 13, 
    minZoom: 2 
}).setView([0, 0], 2)

// Add NASA Blue Marble tile layer as base map
L.tileLayer(
    'https://map1.vis.earthdata.nasa.gov/wmts-webmerc/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg',
    {
        attribution: '',
        noWrap: true
    }
).addTo(map)

// Load country boundaries GeoJSON
const geojson = await d3.json('./countries.geojson')

// Map ISO country codes to continents for color coding
function getContinent(iso) {
    const continents = {
        // Africa
        africa: ['DZA', 'AGO', 'BEN', 'BWA', 'BFA', 'BDI', 'CMR', 'CPV', 'CAF', 'TCD', 'COM', 'COG', 'COD', 'CIV', 'DJI', 'EGY', 'GNQ', 'ERI', 'ETH', 'GAB', 'GMB', 'GHA', 'GIN', 'GNB', 'KEN', 'LSO', 'LBR', 'LBY', 'MDG', 'MWI', 'MLI', 'MRT', 'MUS', 'MAR', 'MOZ', 'NAM', 'NER', 'NGA', 'RWA', 'STP', 'SEN', 'SYC', 'SLE', 'SOM', 'ZAF', 'SSD', 'SDN', 'SWZ', 'TZA', 'TGO', 'TUN', 'UGA', 'ZMB', 'ZWE'],
        // Asia
        asia: ['AFG', 'ARM', 'AZE', 'BHR', 'BGD', 'BTN', 'BRN', 'KHM', 'CHN', 'GEO', 'IND', 'IDN', 'IRN', 'IRQ', 'ISR', 'JPN', 'JOR', 'KAZ', 'KWT', 'KGZ', 'LAO', 'LBN', 'MYS', 'MDV', 'MNG', 'MMR', 'NPL', 'PRK', 'OMN', 'PAK', 'PSE', 'PHL', 'QAT', 'SAU', 'SGP', 'KOR', 'LKA', 'SYR', 'TWN', 'TJK', 'THA', 'TLS', 'TUR', 'TKM', 'ARE', 'UZB', 'VNM', 'YEM'],
        // Europe
        europe: ['ALB', 'AND', 'AUT', 'BLR', 'BEL', 'BIH', 'BGR', 'HRV', 'CYP', 'CZE', 'DNK', 'EST', 'FIN', 'FRA', 'DEU', 'GRC', 'HUN', 'ISL', 'IRL', 'ITA', 'XKX', 'LVA', 'LIE', 'LTU', 'LUX', 'MKD', 'MLT', 'MDA', 'MCO', 'MNE', 'NLD', 'NOR', 'POL', 'PRT', 'ROU', 'RUS', 'SMR', 'SRB', 'SVK', 'SVN', 'ESP', 'SWE', 'CHE', 'UKR', 'GBR', 'VAT'],
        // North America
        northAmerica: ['ATG', 'BHS', 'BRB', 'BLZ', 'CAN', 'CRI', 'CUB', 'DMA', 'DOM', 'SLV', 'GRD', 'GTM', 'HTI', 'HND', 'JAM', 'MEX', 'NIC', 'PAN', 'KNA', 'LCA', 'VCT', 'TTO', 'USA'],
        // South America
        southAmerica: ['ARG', 'BOL', 'BRA', 'CHL', 'COL', 'ECU', 'GUY', 'PRY', 'PER', 'SUR', 'URY', 'VEN'],
        // Oceania
        oceania: ['AUS', 'FJI', 'KIR', 'MHL', 'FSM', 'NRU', 'NZL', 'PLW', 'PNG', 'WSM', 'SLB', 'TON', 'TUV', 'VUT']
    }
    
    for (const [continent, codes] of Object.entries(continents)) {
        if (codes.includes(iso)) return continent
    }
    return 'other'
}

// Color palette for continents
const continentColors = {
    africa: '#e41a1c',
    asia: '#377eb8',
    europe: '#4daf4a',
    northAmerica: '#984ea3',
    southAmerica: '#ff7f00',
    oceania: '#ffff33',
    other: '#999999'
}

// Add countries as GeoJSON layer colored by continent
const geo_layer = L.geoJSON(geojson, {
    style: function (feature) {
        const continent = getContinent(feature.properties.ISO_A3)
        const color = continentColors[continent]
        
        // France includes French Guiana in this dataset - shows as European (green) outlier in South America
        return {
            color: color,
            opacity: 0.4,
            fillColor: color,
            fillOpacity: 0.2
        }
    }
}).addTo(map)