// Netflix Titles World Map - Production Countries
// Maps Netflix content by production country using TMDB API data

const TMDB_TOKEN = "YOUR_TMDB_API_TOKEN_HERE"

// Load GeoJSON and Netflix data
const geojson = await d3.json('./countries.geojson')
const moviesData = await d3.csv('./data/NetflixMovies_added.csv')
const tvData = await d3.csv('./data/NetflixTV_added.csv')

console.log(`Loaded ${moviesData.length} movies, ${tvData.length} TV shows`)

// Fetch production countries from TMDB
// Note: production_countries represents where content was produced/filmed
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
        
        const results = findData.movie_results?.length > 0 
            ? findData.movie_results 
            : findData.tv_results
        
        if (!results || results.length === 0) return null
        
        const tmdbId = results[0].id
        const mediaType = findData.movie_results?.length > 0 ? 'movie' : 'tv'
        
        const detailsUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}`
        const detailsResponse = await fetch(detailsUrl, options)
        const details = await detailsResponse.json()
        
        return {
            productionCountries: details.production_countries || [] // Array of {iso_3166_1, name}
        }
    } catch (error) {
        console.error(`Error fetching ${imdbId}:`, error)
        return null
    }
}

// Fetch country data for titles
async function fetchTitlesWithCountries(data, maxCount, type) {
    const enrichedData = []
    
    for (let i = 0; i < maxCount; i++) {
        const title = data[i]
        const imdbId = title.tconst || title['externals.imdb']
        
        document.getElementById('loader-text').textContent = `Loading ${type}: ${i + 1} / ${maxCount}`
        
        if (!imdbId) continue
        
        const countryInfo = await fetchProductionCountries(imdbId)
        
        if (countryInfo?.productionCountries.length > 0) {
            enrichedData.push({
                title: title.Title || title.name,
                countries: countryInfo.productionCountries.map(c => c.name)
            })
        }
        
        await new Promise(resolve => setTimeout(resolve, 25))
    }
    
    return enrichedData
}

// Fetch data
const movieTitles = await fetchTitlesWithCountries(moviesData, 100, 'movies')
const tvTitles = await fetchTitlesWithCountries(tvData, 100, 'TV shows')

console.log(`✅ ${movieTitles.length} movies, ${tvTitles.length} TV shows`)
document.getElementById('loader').classList.add('hidden')

// Group titles by country
function groupByCountry(titles) {
    const map = new Map()
    titles.forEach(item => {
        item.countries.forEach(country => {
            if (!map.has(country)) map.set(country, [])
            map.get(country).push(item.title)
        })
    })
    return map
}

// Color scale: D3 interpolatePuRd (light to dark purple-red)
const colorScale = d3.scaleSequential()
    .domain([0, 50])
    .interpolator(d3.interpolatePuRd)
    .clamp(true)

// Initialize map
const map = L.map('map').setView([20, 0], 2)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map)

let geoJsonLayer = null

// Render map
function renderMap(mode) {
    const titlesToMap = mode === 'movies' ? movieTitles : mode === 'tv' ? tvTitles : [...movieTitles, ...tvTitles]
    const titlesByCountry = groupByCountry(titlesToMap)
    
    console.log(`${mode}: ${titlesToMap.length} titles, ${titlesByCountry.size} countries`)
    if (geoJsonLayer) map.removeLayer(geoJsonLayer)
    
    geoJsonLayer = L.geoJSON(geojson, {
        style: feature => {
            const titles = titlesByCountry.get(feature.properties.ADMIN) || []
            return {
                fillColor: titles.length > 0 ? colorScale(titles.length) : '#f0f0f0',
                weight: 1,
                color: '#666',
                fillOpacity: titles.length > 0 ? 0.7 : 0.3
            }
        },
        onEachFeature: (feature, layer) => {
            const titles = titlesByCountry.get(feature.properties.ADMIN) || []
            if (titles.length > 0) {
                const list = titles.slice(0, 20).map(t => `<li>${t}</li>`).join('')
                const more = titles.length > 20 ? `<li><em>+${titles.length - 20} more</em></li>` : ''
                layer.bindTooltip(`
                    <h3>${feature.properties.ADMIN}</h3>
                    <div class="count">${titles.length} title${titles.length !== 1 ? 's' : ''}</div>
                    <ul>${list}${more}</ul>
                `, { sticky: true })
            }
        }
    }).addTo(map)
}

// Initial render
renderMap('all')

// Button controls
function setActive(btn, mode) {
    document.querySelectorAll('#controls button').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    renderMap(mode)
}

document.getElementById('btn-all').addEventListener('click', e => setActive(e.target, 'all'))
document.getElementById('btn-movies').addEventListener('click', e => setActive(e.target, 'movies'))
document.getElementById('btn-tv').addEventListener('click', e => setActive(e.target, 'tv'))
