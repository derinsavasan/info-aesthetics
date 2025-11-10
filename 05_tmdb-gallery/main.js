
// TMDB API example: Search for "Jack Reacher" and display results as an image gallery
// Docs: https://developer.themoviedb.org/reference/search

const token = "YOUR_TMDB_API_TOKEN_HERE";
const query = "Jack Reacher";
const url = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;
const options = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: `Bearer ${token}`
  }
};

fetch(url, options)
  .then(res => res.json())
  .then(json => {
    displayImages(json.results);
  })
  .catch(err => console.error(err));

// function to create all DOM elements

function displayImages(movies) {
  // select a <div> with an id of "app"; this is where all images will be added
  let app = d3.select('#app');

  // define "cards" for each movie
  let card = app.selectAll('div.card')
    .data(movies)
    .join('div')
    .attr('class', 'card');

  // create a div with a class of "image" and populate it with an <img/> tag that contains the poster path
  card.append('div')
    .attr('class', 'image')
    .append('img')
    .attr('src', d => {
      // TMDB poster images
      return d.poster_path ? `https://image.tmdb.org/t/p/w300${d.poster_path}` : '';
    });

  // create a paragraph that will hold the release date
  card.append('p')
    .attr('class', 'object-date')
    .text(d => d.release_date || '');

  // create a heading tag that will be the movie title
  card.append('h2')
    .attr('class', 'title')
    .text(d => d.title);
}