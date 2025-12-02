// Netflix Titles Globe (Mapbox)
// Maps Netflix content by production country using TMDB API data + Mapbox GL globe

const TMDB_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJiZWQ2M2FiODE2N2Q3ZDI4YzczNGJmZjc2YjdiMzhlNSIsIm5iZiI6MTc1OTg0NTM3Ny4xMDIwMDAyLCJzdWIiOiI2OGU1MWMwMWYyZjMzMjQxZjZiZDlmODQiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.yGsOVmYZVsVwCkCd7YWBwtDMYdKHWwRGEY0LMmuhcB0"
const MAPBOX_TOKEN = "pk.eyJ1IjoiZGVyaW5zYXZhc2FuIiwiYSI6ImNtaHhxcXRrMjA0aW4ybG9zZzM3cTlyYjcifQ.VnKQfPgNROZ1cMw6ADvZtA"

mapboxgl.accessToken = MAPBOX_TOKEN

const loader = document.getElementById('loader')
const legend = document.getElementById('legend-scale')

// Load GeoJSON and Netflix data
const geojson = await d3.json('./countries.geojson')
const moviesData = await d3.csv('./data/NetflixMovies_added.csv')
const tvData = await d3.csv('./data/NetflixTV_added.csv')

console.log(`Loaded ${moviesData.length} movies, ${tvData.length} TV shows`)

// Process all data before initializing the map
const movieTitles = await fetchTitlesWithCountries(moviesData, 100, 'movies')
const tvTitles = await fetchTitlesWithCountries(tvData, 100, 'TV shows')

console.log(`✅ ${movieTitles.length} movies, ${tvTitles.length} TV shows`)
console.log('Sample movie titles:', movieTitles.slice(0, 3))
console.log('Sample TV titles:', tvTitles.slice(0, 3))

// Now initialize the map and UI only after all data is ready
initializeApp()

async function fetchProductionCountries(imdbId) {
    const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id`
    const options = {
        method: 'GET',
        headers: {
            accept: 'application/json',
            Authorization: `Bearer ${TMDB_TOKEN}`
        }
    }
    
    try {
        const findResponse = await fetch(findUrl, options)
        const findData = await findResponse.json()
        console.log(`TMDB response for ${imdbId}:`, findData)
        
        const results = findData.movie_results?.length > 0 
            ? findData.movie_results 
            : findData.tv_results
        
        if (!results || results.length === 0) return null
        
        const tmdbId = results[0].id
        const mediaType = findData.movie_results?.length > 0 ? 'movie' : 'tv'
        
        const detailsUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}`
        const detailsResponse = await fetch(detailsUrl, options)
        const details = await detailsResponse.json()
        console.log(`Details for ${imdbId}:`, details)
        
        return {
            productionCountries: details.production_countries || []
        }
    } catch (error) {
        console.error(`Error fetching ${imdbId}:`, error)
        return null
    }
}

async function fetchTitlesWithCountries(data, maxCount, type) {
    const enrichedData = []
    
    for (let i = 0; i < Math.min(maxCount, data.length); i++) {
        const title = data[i]
        const imdbId = title.tconst || title['externals.imdb']
        
        document.getElementById('loader-text').textContent = `Loading ${type}: ${i + 1} / ${Math.min(maxCount, data.length)}`
        if (!imdbId) continue
        
        const countryInfo = await fetchProductionCountries(imdbId)
        
        if (countryInfo?.productionCountries.length > 0) {
            enrichedData.push({
                title: title.Title || title.name,
                countries: countryInfo.productionCountries.map(c => c.name),
                views: parseInt(title.Views) || 0,
                hoursViewed: parseInt(title['Hours Viewed']) || 0
            })
        }
        
        await new Promise(resolve => setTimeout(resolve, 25))
    }
    
    return enrichedData
}

function groupByCountry(titles) {
    const map = new Map()
    titles.forEach(title => {
        title.countries.forEach(country => {
            if (!map.has(country)) {
                map.set(country, {
                    titles: [],
                    totalViews: 0,
                    totalHoursViewed: 0
                })
            }
            const countryData = map.get(country)
            countryData.titles.push(title.title)
            countryData.totalViews += title.views
            countryData.totalHoursViewed += title.hoursViewed
        })
    })
    return map
}

function computeExportStrength(allTitles) {
    const map = new Map()
    allTitles.forEach(title => {
        title.countries.forEach(country => {
            if (!map.has(country)) {
                map.set(country, {
                    titles: [],
                    totalViews: 0
                })
            }
            const countryData = map.get(country)
            countryData.titles.push(title.title)
            countryData.totalViews += title.views
        })
    })
    
    // Compute export strength for each country
    for (const [country, data] of map) {
        const titlesCount = data.titles.length
        const exportStrength = titlesCount > 0 ? data.totalViews / titlesCount : 0
        data.exportStrength = exportStrength
    }
    
    return map
}

async function initializeApp() {
    const colorScaleViews = d3.scaleSequential()
        .domain([0, 500000000])  // For view counts
        .interpolator(d3.interpolatePuRd)
        .clamp(true)
    
    const colorScaleExport = d3.scaleSequential()
        .domain([0, 50000000])  // For export strength (views per title)
        .interpolator(d3.interpolatePuRd)
        .clamp(true)
    
    let currentColorScale = colorScaleViews

    function updateLegend(mode = 'views') {
        let scale, minValue, maxValue, title
        
        if (mode === 'export') {
            scale = colorScaleExport
            minValue = 0
            maxValue = 50000000
            title = 'Export Strength (views per title)'
        } else {
            scale = colorScaleViews
            minValue = 0
            maxValue = 500000000
            title = 'Total View Count'
        }
        
        // Create gradient stops for the color scale
        const gradientStops = []
        for (let i = 0; i <= 100; i += 5) {
            const value = minValue + (maxValue - minValue) * (i / 100)
            const color = scale(value)
            gradientStops.push(`${color} ${i}%`)
        }
        
        // Create tick marks at key intervals
        const ticks = [0, 25, 50, 75, 100]
        const tickLabels = ticks.map(percent => {
            const value = minValue + (maxValue - minValue) * (percent / 100)
            const formatted = value >= 1000000 ? `${(value/1000000).toFixed(0)}M` : 
                            value >= 1000 ? `${(value/1000).toFixed(0)}K` : value.toString()
            return `<div class="tick" style="left: ${percent}%">
                        <div class="tick-line"></div>
                        <div class="tick-label">${formatted}</div>
                    </div>`
        }).join('')
        
        legend.innerHTML = `
            <h4>${title}</h4>
            <div class="gradient-container">
                <div class="gradient-bar" style="background: linear-gradient(to right, ${gradientStops.join(', ')})"></div>
                <div class="ticks">${tickLabels}</div>
            </div>
        `
    }

    updateLegend('views')  // Initial legend for views mode

    function createFeatureCollection(countryData, mode = 'views') {
        return {
            type: 'FeatureCollection',
            features: geojson.features.map(feature => {
                const countryName = feature.properties.ADMIN
                const data = countryData.get(countryName)
                const titles = data ? data.titles : []
                const totalViews = data ? data.totalViews : 0
                const totalHoursViewed = data ? data.totalHoursViewed : 0
                const exportStrength = data ? data.exportStrength : 0
                const id = feature.properties.ISO_A3 || feature.properties.ADM0_A3 || countryName

                // Debug log for mapping
                if (titles.length > 0) {
                    console.log(`[MAPPING] ${countryName}: ${titles.length} titles`)
                } else {
                    console.log(`[MAPPING] ${countryName}: NO TITLES`)
                }

                let colorValue
                if (mode === 'export') {
                    colorValue = exportStrength > 0 ? colorScaleExport(exportStrength) : '#dcdcdc'
                } else {
                    colorValue = totalViews > 0 ? colorScaleViews(totalViews) : '#dcdcdc'
                }

                return {
                    type: 'Feature',
                    geometry: feature.geometry,
                    id,
                    properties: {
                        ...feature.properties,
                        titles,
                        count: titles.length,
                        totalViews,
                        totalHoursViewed,
                        exportStrength,
                        color: colorValue
                    }
                }
            })
        }
    }

    const initialTitles = [...movieTitles, ...tvTitles]
    let currentMode = 'all'
    let currentFeatureCollection = createFeatureCollection(groupByCountry(initialTitles))

    const map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/light-v11',
        projection: 'globe',
        center: [0, 20],
        zoom: 1.1,
        pitch: 0,
        antialias: true
    })

    // map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), 'top-left')

    map.on('style.load', () => {
        map.setFog({
            'color': '#d6e4ff',
            'high-color': '#c0d1ff',
            'space-color': '#010b19',
            'horizon-blend': 0.1
        })
    })

    // Function to update title overlay appearance based on zoom level
    function updateTitleOverlayAppearance() {
        const zoom = map.getZoom()
        const titleOverlay = document.getElementById('title-overlay')
        
        // When zoomed out (space view), use dark theme
        if (zoom < 2.5) {
            titleOverlay.classList.add('space-view')
            titleOverlay.classList.remove('world-view')
        } 
        // When zoomed in (world view), use light theme
        else {
            titleOverlay.classList.add('world-view')
            titleOverlay.classList.remove('space-view')
        }
    }

    // Function to update controls and legend appearance based on zoom level
    function updateControlsAndLegendAppearance() {
        const zoom = map.getZoom()
        const controls = document.getElementById('controls')
        const legend = document.getElementById('legend')
        
        // When zoomed out (space view), use dark theme
        if (zoom < 2.5) {
            controls.classList.add('space-view')
            controls.classList.remove('world-view')
            legend.classList.add('space-view')
            legend.classList.remove('world-view')
        } 
        // When zoomed in (world view), use light theme
        else {
            controls.classList.add('world-view')
            controls.classList.remove('space-view')
            legend.classList.add('world-view')
            legend.classList.remove('space-view')
        }
    }

    let hoveredId = null
    let mapReady = false
    const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 12 })

    function resetHoverState() {
        if (hoveredId !== null && mapReady) {
            map.setFeatureState({ source: 'countries', id: hoveredId }, { hover: false })
            hoveredId = null
        }
        popup.remove()
    }

    function updateMapSource(data) {
        currentFeatureCollection = data
        if (!mapReady) return
        const source = map.getSource('countries')
        if (source) {
            source.setData(currentFeatureCollection)
            resetHoverState()
        }
    }

    function renderMap(mode) {
        currentMode = mode
        let titlesToMap, countryData, collection

        // Update title overlay text based on mode
        const titleOverlay = document.getElementById('title-overlay')
        if (mode === 'export') {
            titleOverlay.innerHTML = `
                <h1>Export Strength</h1>
                <p>Shows which countries make work that actually travels. Some produce endlessly and it barely moves. Others make a few titles and the world watches every scrap. South Korea is a good example.</p>
            `
            titlesToMap = [...movieTitles, ...tvTitles]
            countryData = computeExportStrength(titlesToMap)
            collection = createFeatureCollection(countryData, 'export')
        } else {
            titleOverlay.innerHTML = `
                <h1>Netflix Views Globe</h1>
                <p>Interactive map showing Netflix viewership by production country</p>
            `
            titlesToMap = mode === 'movies' ? movieTitles : mode === 'tv' ? tvTitles : [...movieTitles, ...tvTitles]
            countryData = groupByCountry(titlesToMap)
            collection = createFeatureCollection(countryData, 'views')
        }

        updateMapSource(collection)
        updateLegend(mode === 'export' ? 'export' : 'views')
        console.log(`${mode}: ${titlesToMap.length} titles, ${countryData.size} countries`)
    }

    // Initial appearance check
    map.on('load', () => {
        updateTitleOverlayAppearance()
        updateControlsAndLegendAppearance()
    })

    // Update appearance on zoom changes
    map.on('zoom', () => {
        updateTitleOverlayAppearance()
        updateControlsAndLegendAppearance()
    })

    map.on('load', () => {
        console.log('Map loaded successfully')
        map.addSource('countries', {
            type: 'geojson',
            data: currentFeatureCollection
        })
        
        console.log('Added source with features:', currentFeatureCollection.features.length)
        
        map.addLayer({
            id: 'country-fill',
            type: 'fill',
            source: 'countries',
            paint: {
                'fill-color': ['get', 'color'],
                'fill-opacity': [
                    'case',
                    ['>', ['get', 'count'], 0],
                    0.9,
                    0.4
                ]
            }
        })
        
        map.addLayer({
            id: 'country-outline',
            type: 'line',
            source: 'countries',
            paint: {
                'line-color': '#4a4a4a',
                'line-width': [
                    'case',
                    ['boolean', ['feature-state', 'hover'], false],
                    1.2,
                    0.4
                ]
            }
        })
        
        console.log('Layers added')
        
        map.on('mousemove', 'country-fill', e => {
            console.log('Mouse move event fired', e.features)
            if (!e.features?.length) {
                resetHoverState()
                return
            }
            const feature = e.features[0]
            console.log('Feature:', feature)
            if (!feature?.id) return
            if (hoveredId !== feature.id) {
                resetHoverState()
                hoveredId = feature.id
                map.setFeatureState({ source: 'countries', id: hoveredId }, { hover: true })
            }
            const titles = feature.properties.titles || []
            console.log('Titles for', feature.properties.ADMIN, ':', titles)
            if (titles.length === 0) {
                popup.remove()
            } else {
                const list = titles.slice(0, 12).map(t => `<li>${t}</li>`).join('')
                const more = titles.length > 12 ? `<li><em>+${titles.length - 12} more</em></li>` : ''
                const totalViews = feature.properties.totalViews || 0
                const viewsFormatted = totalViews > 1000000 ? `${(totalViews/1000000).toFixed(1)}M` : totalViews > 1000 ? `${(totalViews/1000).toFixed(0)}K` : totalViews.toLocaleString()
                const exportStrength = feature.properties.exportStrength || 0
                const exportFormatted = exportStrength > 1000000 ? `${(exportStrength/1000000).toFixed(1)}M` : exportStrength > 1000 ? `${(exportStrength/1000).toFixed(0)}K` : exportStrength.toLocaleString()
                
                const metricDisplay = currentMode === 'export' 
                    ? `<div class="views">Export Strength: ${exportFormatted}</div>`
                    : `<div class="views">${viewsFormatted}</div>`
                
                popup
                    .setLngLat(e.lngLat)
                    .setHTML(`
                        <h3>${feature.properties.ADMIN}</h3>
                        <div class="count">${titles.length} title${titles.length !== 1 ? 's' : ''}</div>
                        ${metricDisplay}
                        <ul>${list}${more}</ul>
                    `)
                    .addTo(map)
            }
            map.getCanvas().style.cursor = 'pointer'
        })
        
        map.on('mouseleave', 'country-fill', () => {
            map.getCanvas().style.cursor = ''
            resetHoverState()
        })
        
        mapReady = true
        loader.classList.add('hidden')  // Only hide loader when everything is ready
        document.getElementById('title-overlay').classList.remove('hidden')  // Show title overlay when ready
        document.getElementById('controls').classList.remove('hidden')  // Show controls when ready
        document.getElementById('legend').classList.remove('hidden')  // Show legend when ready
    })

    renderMap('all')

    function setActive(btn, mode) {
        document.querySelectorAll('#controls button').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        if (!mapReady) return
        renderMap(mode)
    }

    document.getElementById('btn-all').addEventListener('click', e => setActive(e.target, 'all'))
    document.getElementById('btn-movies').addEventListener('click', e => setActive(e.target, 'movies'))
    document.getElementById('btn-tv').addEventListener('click', e => setActive(e.target, 'tv'))
    document.getElementById('btn-export').addEventListener('click', e => setActive(e.target, 'export'))
}
