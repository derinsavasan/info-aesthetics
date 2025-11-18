


d3.csv('./data/NetflixTV_added.csv')
  .then(csv => {
    displayMetadata(csv);
  });

// function to create all DOM elements
function displayMetadata(csv) {
  // select a <div> with an id of "app"; this is where all images will be added
  let app = d3.select('#app');


  // Filter by genre 'Anime'
  let data = csv.filter(d => d.genres && d.genres.includes('Anime'));

  // Sort the data; date descending
  data = data.sort((a, b) => (b['Release Date'] > a['Release Date']) ? 1 : -1);

  // define "cards" for each item
  let card = app.selectAll('div.card')
    .data(data)
    .join('div')
    .attr('class', 'card');

  // ...existing code... (image removed)

  // create a paragraph that will hold the genre label
  card.append('p')
    .attr('class', 'genre-label')
    .text(d => d.genres || '');

  // create a heading tag that will be the object title
  card.append('h2')
    .attr('class', 'title')
    .text(d => d.name);

  // create a paragraph with original date string
  card.append('p')
    .attr('class', 'original-date')
    .text(d => d['Release Date'] || '');

  // create a paragraph with summary in small text
  card.append('p')
    .attr('class', 'summary')
    .style('font-size', '0.8em')
    .text(d => d.summary || '');

  // create a heading tag that will be the object title
  card.append('h2')
    .attr('class', 'title')
    .text(d => d.title);
}