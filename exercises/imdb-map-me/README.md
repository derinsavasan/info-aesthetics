# Netflix Titles World Map

Interactive geographic visualization showing where Netflix content is produced.

## Overview

This project maps Netflix movies and TV shows by their production countries using data from The Movie Database (TMDB) API. An interactive Leaflet map displays countries colored by the number of titles produced, with the ability to filter between movies and TV shows.

## Features

- Interactive world map with country-level production data
- Three view modes: All titles, Movies only, TV shows only
- Color scale using [D3 interpolatePuRd](https://d3js.org/d3-scale-chromatic/sequential#interpolatePuRd) (light to dark purple-red)
- Click any country to see list of titles produced there
- Real-time data fetching with progress indicator

## Data Sources

- **Netflix Data**: CSV files containing Netflix catalog with IMDb IDs
- **TMDB API**: Production country information for each title
  - [TMDB API Documentation](https://developer.themoviedb.org/docs)
  - [Find by External ID endpoint](https://developer.themoviedb.org/reference/find-by-id)
- **GeoJSON**: World country boundaries for map rendering

## Technical Details

- Fetches 200 titles total (100 movies + 100 TV shows)
- Rate limited to 40 requests/second
- Loading time: ~5 seconds
- Built with [Leaflet.js](https://leafletjs.com/) and [D3.js](https://d3js.org/)
- Uses ES6 modules with top-level await
