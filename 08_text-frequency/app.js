;(async () => {
    
    // Load the Frankenstein text file
    // Source: Project Gutenberg - https://www.gutenberg.org/ebooks/84
    // Mary Shelley, Frankenstein; Or, The Modern Prometheus (1818)
    const data = await d3.text('./frankenstein.txt')

    // Create a word bank by:
    // 1. Splitting text by whitespace
    // 2. Removing non-alphabetic characters
    // 3. Converting to uppercase
    // 4. Filtering out empty strings
    const words = data
        .split(/\s/g)
        .map(i => i.replace(/[^A-Za-z]/g, '').toUpperCase())
        .filter(i => i.length > 0)

    // Manual word counting using an object (older approach)
    const word_count = {}

    words.forEach(word => {
        if(!word_count[word]){
            word_count[word] = [word]
        } else {
            word_count[word].push(word)
        }
    })

    // Manual word counting using a Map (newer approach)
    const word_map = new Map()

    words.forEach(word => {
        if(!word_map.has(word)){
            word_map.set(word, [word])
        } else {
            word_map.set(word, word_map.get(word).concat(word))
        }
    })

    // D3 grouping - groups words together
    const d3word_count = d3.group(words, d => d)

    // D3 rollup - creates a Map with word as key and count as value
    const d3word_rollup = d3
        .rollup(words, v => v.length, d => d)

    console.log(d3word_rollup)

    // Create SVG element for bar chart
    const svg = d3.create('svg')
    const app = d3.select('#app')

    // Set SVG dimensions
    svg
        .attr('viewBox', [0,0,1000,300])

    // Create groups for each word (for bar chart)
    const g = svg
        .selectAll('g')
        .data(Array.from(d3word_rollup))
        .join('g')

    // X scale - maps words to horizontal positions (sorted by frequency)
    const x_scale = d3
        .scaleBand()
        .domain(Array.from(d3word_rollup).sort((a,b)=>d3.descending(a[1], b[1])).map(d => d[0]))
        // .domain(d3.groupSort(words, g => -g.length, d => d))
        .range([0, 6000])

    // Y scale - maps word counts to bar heights
    const y_scale = d3.scaleLinear()
        .domain([0,d3.max(d3word_rollup, d => d[1])])
        .range([0, 300])

    // Create bars for each word with hover tooltip
    g 
        .append('rect')
        .attr('x', d => x_scale(d[0]))
        .attr('height', d => y_scale(d[1]))
        .attr('y', d => y_scale.range()[1] - y_scale(d[1]) )
        .attr('width', x_scale.bandwidth)
        .append('title')
        .text(d => `${d[0]}: ${d[1]}`)

    // Create container div for word cloud tags
    const tags = d3.create('div')

    // Font scale - maps word count to font size
    const font_scale = d3
        .scaleLinear()
        .domain([0,d3.max(d3word_rollup, d => d[1])])
        .range([0.4, 5])

    // Style the tags container as a flexbox
    tags
        .style('display', 'flex')
        .style('flex-wrap', 'wrap')
        .style('align-items', 'center')

    // Create span elements for each word (font size based on frequency)
    tags 
        .selectAll('span')
        .data(Array.from(d3word_rollup))
        // .data(d3.groupSort(words, g => -g.length, d => d).map(word => [word, d3word_rollup.get(word)]))
        .join('span')
        .text(d => d[0])
        .style('padding', '1em')
        .style('font-size', d => font_scale(d[1]) + 'rem')

    // Append both visualizations to the app container
    app.append(()=>svg.node())
    app.append(()=>tags.node())

})()