// Load the Frankenstein text file
// Source: Project Gutenberg - https://www.gutenberg.org/ebooks/84
// Mary Shelley, Frankenstein; Or, The Modern Prometheus (1818)
const data = await d3.text('./frankenstein.txt')

// https://winkjs.org/
import winkSentiment from 'wink-sentiment'

// Split into sentences (on period, exclamation, question mark followed by space)
const sentences = data
    .split(/[.!?]+\s+/)
    .filter(s => s.trim().length > 0)

// Analyze sentiment for each sentence using wink-sentiment
const analyzed = sentences.map(sentence => {
    const result = winkSentiment(sentence)
    return {
        text: sentence.trim(),
        score: result.score
    }
})

// Create container div for sentences
const app = d3.select('#app')
const container = d3.create('div')

// Font scale - maps sentiment score to font size
// More extreme scores (positive or negative) get larger fonts
const font_scale = d3
    .scaleLinear()
    .domain([d3.min(analyzed, d => Math.abs(d.score)), d3.max(analyzed, d => Math.abs(d.score))])
    .range([0.6, 3])

// Color scale - negative = red, neutral = gray, positive = green
const color_scale = d3
    .scaleLinear()
    .domain([d3.min(analyzed, d => d.score), 0, d3.max(analyzed, d => d.score)])
    .range(['#d73027', '#999', '#1a9850'])

// Style container as flexbox
container
    .style('display', 'flex')
    .style('flex-direction', 'column')
    .style('gap', '1em')
    .style('padding', '2em')

// Create paragraph elements for each sentence
// Font size based on sentiment intensity, color based on positive/negative
container 
    .selectAll('p')
    .data(analyzed)
    .join('p')
    .text(d => d.text)
    .style('margin', '0')
    .style('font-size', d => font_scale(Math.abs(d.score)) + 'rem')
    .style('color', d => color_scale(d.score))
    .style('line-height', '1.4')
    .attr('title', d => `Sentiment score: ${d.score}`)

// Append to app
app.append(() => container.node())
