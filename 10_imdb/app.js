// Netflix Titles by Country using TMDB API
// Fetches production countries for Netflix movies and TV shows using IMDb IDs

const TMDB_TOKEN = "YOUR_TMDB_API_TOKEN_HERE"

// Load Netflix datasets
const moviesData = await d3.csv('./data/NetflixMovies_added.csv')
const tvData = await d3.csv('./data/NetflixTV_added.csv')

console.log(`Loaded ${moviesData.length} movies, ${tvData.length} TV shows`)

// Fetch production countries from TMDB using IMDb ID
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
        
        if (!results || results.length === 0) {
            console.log(`No match for ${imdbId}`)
            return null
        }
        
        const tmdbId = results[0].id
        const mediaType = findData.movie_results?.length > 0 ? 'movie' : 'tv'
        
        // Fetch detailed info for production countries and overview
        const detailsUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}`
        const detailsResponse = await fetch(detailsUrl, options)
        const details = await detailsResponse.json()
        
        return {
            productionCountries: details.production_countries || [],
            originCountry: details.origin_country || [],
            overview: details.overview || ''
        }
    } catch (error) {
        console.error(`Error fetching ${imdbId}:`, error)
        return null
    }
}

// Fetch and display function
async function fetchAndDisplay(data, maxCount, containerId, sectionTitle) {
    const sample = data.slice(0, maxCount)
    const enrichedData = []
    
    console.log(`Fetching ${sectionTitle}...`)
    
    const notFound = []
    
    for (let i = 0; i < sample.length; i++) {
        const title = sample[i]
        // Movies use 'tconst', TV shows use 'externals.imdb'
        const imdbId = title.tconst || title['externals.imdb']
        
        if (!imdbId) {
            notFound.push({ title: title.Title || title.name, reason: 'No IMDb ID' })
            continue
        }
        
        const countryInfo = await fetchProductionCountries(imdbId)
        
        if (countryInfo) {
            enrichedData.push({
                ...title,
                productionCountries: countryInfo.productionCountries,
                originCountry: countryInfo.originCountry,
                overview: countryInfo.overview
            })
        } else {
            notFound.push({ title: title.Title || title.name, imdbId: imdbId })
        }
        
        // 40 req/sec rate limit
        await new Promise(resolve => setTimeout(resolve, 25))
    }
    
    console.log(`✅ Fetched ${enrichedData.length} ${sectionTitle}`)
    if (notFound.length > 0) {
        console.log(`❌ ${notFound.length} ${sectionTitle} not found in TMDB:`)
        notFound.forEach(item => {
            console.log(`  - ${item.title} (${item.imdbId || item.reason})`)
        })
    }
    
    // Render gallery
    const container = d3.select(containerId)
    const cards = container.selectAll('div.card')
        .data(enrichedData)
        .join('div')
        .attr('class', 'card')
    
    cards.append('p')
        .attr('class', 'genre-label')
        .text(d => d.genres || '')
    
    cards.append('h2')
        .attr('class', 'title')
        .text(d => d.Title || d.name)
    
    cards.append('p')
        .attr('class', 'original-date')
        .text(d => d['Release Date'] || '')
    
    cards.append('p')
        .attr('class', 'countries')
        .html(d => {
            const countries = d.productionCountries.map(c => c.name).join(', ')
            return countries ? `🌍 ${countries}` : '🌍 Country unavailable'
        })
    
    // Add collapsible description
    const details = cards.append('details')
    
    details.append('summary')
        .text('Description')
    
    details.append('p')
        .attr('class', 'overview')
        .text(d => d.overview || 'No description available')
}

// Fetch 50 movies and 50 TV shows
await fetchAndDisplay(moviesData, 50, '#movies', 'movies')
await fetchAndDisplay(tvData, 50, '#tv-shows', 'TV shows')
