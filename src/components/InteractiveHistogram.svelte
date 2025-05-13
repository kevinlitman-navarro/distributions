<script>
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import { normalDistribution } from './helpers/statistics';
  import { fade } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  const { 
    question = "How would you rate yourself on a scale of 0-100?", 
    dataFile = "user_responses.json",
    questionNumber = 1,
    totalQuestions = 1,
    axisLabels = ["the worst", "average", "the best"],
    isExample = false,
    defaultComparisonGroup = "friends"
  } = $props();
  
  let responses = $state([]);
  let histogramContainer;
  let width = 800;
  let height = 300;
  let margin = { top: 48, right: 20, bottom: 70, left: 120 };
  let dotRadius = 4;
  let hoveredValue = $state(null);
  let hasResponded = $state(false);
  let userVote = $state(null);
  let hasVoted = $state(false);
  let selectedComparisonGroup = $state(defaultComparisonGroup);
  const ENABLE_SINGLE_VOTE = true;

  const comparisonGroups = [
    { value: 'friends', label: 'your friends' },
    { value: 'country', label: 'people in your country' },
    { value: 'world', label: 'everyone in the world' }
  ];

  // Update the derived state for whether voting is allowed
  let canVote = $derived((!hasResponded || isExample) && !hasVoted);

  // Reactive declarations for stats using $derived
  let numericResponses = $derived(responses.map(r => Number(r)));
  let responseCount = $derived(numericResponses.length);
  let meanValue = $derived(numericResponses.length ? d3.mean(numericResponses) : 0);
  let medianValue = $derived(numericResponses.length ? d3.median(numericResponses) : 0);
  let stdDevValue = $derived(numericResponses.length ? d3.deviation(numericResponses) : 0);
  let userPercentileValue = $derived(
    (userVote !== null && numericResponses.length) 
      ? (numericResponses.sort((a, b) => a - b).findIndex(r => r >= userVote) / numericResponses.length) * 100 
      : 0
  );

  // Add descriptive text for percentile placement
  let percentileDescription = $derived(
    userVote === null || !numericResponses.length 
      ? '' 
      : userPercentileValue >= 90 
        ? "You rated yourself higher than 90% of respondents!"
        : userPercentileValue >= 75 
          ? "You rated yourself higher than 75% of respondents."
          : userPercentileValue >= 50 
            ? "You rated yourself higher than 50% of respondents."
            : userPercentileValue >= 25 
              ? "You rated yourself higher than 25% of respondents."
              : "You rated yourself in the bottom 25% of respondents."
  );

  // Add descriptive text for mean vs midpoint
  let meanVsMidpointDescription = $derived(
    !numericResponses.length 
      ? "" 
      : (() => {
          const diff = meanValue - 50;
          if (Math.abs(diff) < 3) return "People generally think they are about average for this question.";
          if (diff >= 10) return "People generally think they are much better than average for this question.";
          if (diff >= 3) return "People generally think they are better than average for this question.";
          if (diff <= -10) return "People generally think they are much worse than average for this question.";
          if (diff <= -3) return "People generally think they are worse than average for this question.";
          return "";
        })()
  );

  // Function to get the current data file based on comparison group
  function getCurrentDataFile() {
    const baseName = dataFile.replace('_responses.json', '');
    return `${baseName}_${selectedComparisonGroup}_responses.json`;
  }

  // Function to get the vote key for localStorage
  function getVoteKey() {
    const type = getCurrentDataFile().replace('_responses.json', '');
    return type;
  }

  // Function to check if user has voted for current comparison group
  function checkVoteStatus() {
    const userVotes = JSON.parse(localStorage.getItem('userVotes') || '{}');
    const answeredQuestions = JSON.parse(localStorage.getItem('answeredQuestions') || '[]');
    const voteKey = getVoteKey();
    
    // Check if user has voted in this comparison group
    if (userVotes[voteKey]) {
      userVote = userVotes[voteKey];
      hasVoted = true;
    } else {
      userVote = null;
      hasVoted = false;
    }

    // Check if user has responded in this comparison group
    if (ENABLE_SINGLE_VOTE && !isExample) {
      hasResponded = answeredQuestions.includes(voteKey);
    }
  }

  function calculateStats() {
    if (responses.length === 0) {
      console.log('No responses to calculate stats');
      responseCount = 0;
      meanValue = 0;
      medianValue = 0;
      stdDevValue = 0;
      userPercentileValue = 0;
      return;
    }
    
    console.log('Calculating stats for responses:', responses);
    // Ensure responses are numbers
    const numericResponses = responses.map(r => Number(r));
    
    // Update individual reactive variables
    responseCount = numericResponses.length;
    meanValue = d3.mean(numericResponses) || 0;
    medianValue = d3.median(numericResponses) || 0;
    stdDevValue = d3.deviation(numericResponses) || 0;
    
    if (userVote !== null) {
      // Calculate percentile rank
      const sortedResponses = [...numericResponses].sort((a, b) => a - b);
      const userRank = sortedResponses.findIndex(r => r >= userVote);
      userPercentileValue = (userRank / numericResponses.length) * 100;
    }
    
    console.log('Calculated stats:', {
      count: responseCount,
      mean: meanValue,
      median: medianValue,
      stdDev: stdDevValue,
      userPercentile: userPercentileValue
    });
  }

  let selectEl;
  let measureSpanEl;

  // Update select width to match selected option
  function updateSelectWidth() {
    if (selectEl && measureSpanEl) {
      // Set the span's text to the selected option
      const selectedOption = comparisonGroups.find(g => g.value === selectedComparisonGroup)?.label.toLowerCase() || '';
      measureSpanEl.textContent = selectedOption;
      // Get the span's width
      const spanWidth = measureSpanEl.offsetWidth;
      // Add extra for dropdown arrow and padding
      selectEl.style.width = (spanWidth + 36) + 'px';
    }
  }

  $effect(() => {
    updateSelectWidth();
  });

  onMount(() => {
    updateSelectWidth();
  });

  // Load existing responses and check if user has already responded
  onMount(async () => {
    try {
      const type = getCurrentDataFile().replace('_responses.json', '');
      console.log('Loading responses for type:', type);
      const response = await fetch(`/api/responses?type=${type}`);
      const data = await response.json();
      console.log('Raw response data:', data);
      
      // Ensure we have an array of numbers
      responses = Array.isArray(data) ? data : [];
      console.log('Processed responses:', responses);
      
      // Check if user has already voted for this comparison group
      checkVoteStatus();
      
      calculateStats();
      drawHistogram();
    } catch (error) {
      console.error('Error loading responses:', error);
      responses = [];
      calculateStats();
    }
  });

  // Watch for changes in comparison group
  $effect(() => {
    if (selectedComparisonGroup) {
      const type = getCurrentDataFile().replace('_responses.json', '');
      fetch(`/api/responses?type=${type}`)
        .then(response => response.json())
        .then(data => {
          responses = Array.isArray(data) ? data : [];
          checkVoteStatus();
          calculateStats();
          drawHistogram();
        })
        .catch(error => {
          console.error('Error loading responses:', error);
          responses = [];
          calculateStats();
        });
    }
  });

  function drawHistogram() {
    if (!histogramContainer) return;

    // Clear previous content
    d3.select(histogramContainer).selectAll("*").remove();

    // Add extra bottom margin for x-axis labels
    const extraBottom = 48;
    const svg = d3.select(histogramContainer)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`);

    // Set up scales
    const x = d3.scaleLinear()
      .domain([0, 100])
      .range([0, width]);

    // Use d3.histogram to bin the data
    const histogram = d3.histogram()
      .domain([0, 100])
      .thresholds(x.ticks(50)); // 50 bins for granularity
    const bins = histogram(responses);
    const maxBinCount = d3.max(bins, d => d.length) || 1;

    // y scale: [0, maxBinCount] -> [height, 0]
    const y = d3.scaleLinear()
      .domain([0, maxBinCount])
      .range([height, 0]);

    // Add hover indicator group
    const indicatorGroup = svg.append("g")
      .attr("opacity", 0)
      .style("pointer-events", "none");

    // Add label above the icon
    indicatorGroup.append("text")
      .attr("text-anchor", "middle")
      .attr("y", -40)
      .style("font-size", "18px")
      .style("fill", hoveredValue > 50 ? "#27ae60" : "#e74c3c")
      .text("You are here");

    // Add happy/neutral/sad face SVG
    function getFaceSVG(value) {
      if (value > 66) {
        // Green happy face
        return `M0,0
          m-24,0
          a24,24 0 1,0 48,0
          a24,24 0 1,0 -48,0
          M-10,-5 a5,5 0 1,0 10,0
          M10,-5 a5,5 0 1,0 10,0
          M-10,8 q10,10 20,0`;
      } else if (value >= 33) {
        // Yellow neutral face
        return `M0,0
          m-24,0
          a24,24 0 1,0 48,0
          a24,24 0 1,0 -48,0
          M-10,-5 a5,5 0 1,0 10,0
          M10,-5 a5,5 0 1,0 10,0
          M-10,14 h20`;
      } else {
        // Red sad face
        return `M0,0
          m-24,0
          a24,24 0 1,0 48,0
          a24,24 0 1,0 -48,0
          M-10,-5 a5,5 0 1,0 10,0
          M10,-5 a5,5 0 1,0 10,0
          M-10,18 q10,-10 20,0`;
      }
    }
    function getFaceColor(value) {
      if (value > 66) return '#27ae60'; // green
      if (value >= 33) return '#f1c40f'; // yellow
      return '#e74c3c'; // red
    }
    indicatorGroup.append("path")
      .attr("d", getFaceSVG(hoveredValue))
      .attr("fill", "#fff")
      .attr("stroke", getFaceColor(hoveredValue))
      .attr("stroke-width", 3)
      .attr("transform", "scale(1.5)");

    // Mouse move handler for hover indicator
    if (canVote) {
      svg.on("mousemove", function(event) {
        const [xPos] = d3.pointer(event);
        const value = Math.round(x.invert(xPos - margin.left));
        if (value >= 0 && value <= 100) {
          indicatorGroup
            .attr("transform", `translate(${x(value) + margin.left},${height + margin.top})`)
            .attr("opacity", 1);
          // Update face and label color
          indicatorGroup.select("path")
            .attr("d", getFaceSVG(value))
            .attr("stroke", getFaceColor(value));
          indicatorGroup.select("text")
            .style("fill", getFaceColor(value));
        } else {
          indicatorGroup.attr("opacity", 0);
        }
      })
      .on("mouseleave", function() {
        indicatorGroup.attr("opacity", 0);
      });
    }

    // Add click handler to the SVG
    if (canVote) {
      svg.on("click", async function(event) {
        const [xPos] = d3.pointer(event);
        const value = Math.round(x.invert(xPos - margin.left));
        
        if (value >= 0 && value <= 100) {
          console.log('Setting user vote to:', value);
          
          try {
            const type = getCurrentDataFile().replace('_responses.json', '');
            const voteKey = getVoteKey();
            
            // Update state first
            userVote = value;
            hasVoted = true;
            responses = [...responses, value];
            
            // Save to server
            await fetch(`/api/responses?type=${type}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(responses)
            });

            // Save user's vote for both example and regular questions
            const userVotes = JSON.parse(localStorage.getItem('userVotes') || '{}');
            userVotes[voteKey] = value;
            localStorage.setItem('userVotes', JSON.stringify(userVotes));
            console.log('Updated userVotes in localStorage:', userVotes);

            if (!isExample) {
              // Save to answeredQuestions only for non-example questions
              const answeredQuestions = JSON.parse(localStorage.getItem('answeredQuestions') || '[]');
              if (!answeredQuestions.includes(voteKey)) {
                answeredQuestions.push(voteKey);
                localStorage.setItem('answeredQuestions', JSON.stringify(answeredQuestions));
                console.log('Updated answeredQuestions in localStorage:', answeredQuestions);
                hasResponded = true;
              }
            }
            
            // Refresh responses
            const response = await fetch(`/api/responses?type=${type}`);
            responses = await response.json();
            
            console.log('After fetch - hasVoted:', hasVoted);
            console.log('After fetch - userVote:', userVote);
            console.log('After fetch - responses:', responses);
            
            // Redraw histogram
            drawHistogram();
            
            // Dispatch vote event
            dispatch('vote', { value });
          } catch (error) {
            console.error('Error saving response:', error);
            // Revert state on error
            userVote = null;
            hasVoted = false;
            responses = responses.slice(0, -1);
          }
        }
      });
    }

    // Show data if user has voted OR if there are responses
    if (hasVoted) {
      // Draw bars (after hasVoted)
      svg.selectAll("rect")
        .data(bins)
        .join("rect")
        .attr("x", d => x(d.x0) + margin.left)
        .attr("y", d => y(d.length) + margin.top)
        .attr("width", d => x(d.x1) - x(d.x0) - 1)
        .attr("height", d => height - y(d.length))
        .attr("fill", d => d.some(v => v === userVote) ? "#ff4444" : "#4a90e2")
        .attr("opacity", 0.7)
        .style("cursor", "pointer");

      // Add hover events for highlighting
      if (canVote) {
        svg.selectAll("rect")
          .on("mouseover", function(event, d) {
            if (!d.some(v => v === userVote)) {
              hoveredValue = d.x0 + (d.x1 - d.x0) / 2;
              svg.selectAll("rect")
                .transition()
                .duration(200)
                .attr("fill", bar => {
                  if (bar.some(v => v === userVote)) return "#ff4444";
                  return bar.x0 + (bar.x1 - bar.x0) / 2 === hoveredValue ? "#357abd" : "#4a90e2";
                })
                .attr("opacity", bar => {
                  if (bar.some(v => v === userVote)) return 1;
                  return bar.x0 + (bar.x1 - bar.x0) / 2 === hoveredValue ? 0.9 : 0.7;
                });
            }
          })
          .on("mouseout", function() {
            hoveredValue = null;
            svg.selectAll("rect")
              .transition()
              .duration(200)
              .attr("fill", bar => bar.some(v => v === userVote) ? "#ff4444" : "#4a90e2")
              .attr("opacity", bar => bar.some(v => v === userVote) ? 1 : 0.7);
          });
      }

      // Draw normal distribution curve (scale to count-based y-axis)
      if (responses.length > 1) {
        const mean = d3.mean(responses);
        const stdDev = d3.deviation(responses);
        const normalData = normalDistribution(mean, stdDev, 100);
        const maxDensity = d3.max(normalData, d => d.y);
        const scaleFactor = maxBinCount / maxDensity;

        const line = d3.line()
          .x(d => x(d.x) + margin.left)
          .y(d => y(d.y * scaleFactor) + margin.top)
          .curve(d3.curveBasis);

        const area = d3.area()
          .x(d => x(d.x) + margin.left)
          .y0(y(0) + margin.top)
          .y1(d => y(d.y * scaleFactor) + margin.top)
          .curve(d3.curveBasis);

        svg.append("path")
          .datum(normalData)
          .attr("fill", "#666")
          .attr("opacity", 0.1)
          .attr("d", area);

        svg.append("path")
          .datum(normalData)
          .attr("fill", "none")
          .attr("stroke", "#666")
          .attr("stroke-width", 1.5)
          .attr("opacity", 0.5)
          .attr("d", line);
      }
    }

    // X axis (always draw)
    const xAxis = d3.axisBottom(x)
      .tickValues([0, 50, 100])
      .tickFormat((d, i) => {
        if (axisLabels && axisLabels.length === 3) {
          return axisLabels[i] ?? Math.round(d);
        }
        if (i === 0) return "the worst";
        if (i === 1) return "average";
        if (i === 2) return "the best";
        return Math.round(d);
      });

    svg.append("g")
      .attr("transform", `translate(${margin.left},${height + margin.top})`)
      .call(xAxis)
      .call(g => g.selectAll("text")
        .style("font-size", "0.95rem")
        .style("font-weight", "600")
        .attr("dy", "0.8em")
        .attr("text-anchor", "middle")
        .each(function(d, i) {
          let label = axisLabels && axisLabels.length === 3 ? axisLabels[i] ?? Math.round(d) : (i === 0 ? "the worst" : i === 1 ? "average" : i === 2 ? "the best" : Math.round(d));
          if (typeof label === 'string' && label.length > 30) {
            // Find nearest space before 30 chars
            let splitIdx = label.lastIndexOf(' ', 30);
            if (splitIdx === -1) splitIdx = 30;
            const first = label.slice(0, splitIdx);
            const second = label.slice(splitIdx).trim();
            d3.select(this).text(null)
              .append('tspan').attr('x', 0).attr('dy', '0em').text(first)
              .append('tspan').attr('x', 0).attr('dy', '1.2em').text(second);
          }
        })
      );

    // Y axis (only label the top tick)
    if (hasVoted && responses.length > 0) {
      const yAxis = d3.axisLeft(y)
        .ticks(5)
        .tickFormat((d, i, arr) => {
          if (d === maxBinCount) {
            return `${maxBinCount} responses`;
          }
          return '';
        });

      svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`)
        .call(yAxis)
        .call(g => g.selectAll("text")
          .style("font-size", "1.1rem")
          .style("font-weight", "600")
          .attr("dx", "0.5em")
        );
    }

    // Draw mean, midpoint, and distance annotations only after voting
    if (hasVoted) {
      // Draw mean line
      if (typeof meanValue === 'number') {
        svg.append('line')
          .attr('x1', x(meanValue) + margin.left)
          .attr('x2', x(meanValue) + margin.left)
          .attr('y1', margin.top)
          .attr('y2', height + margin.top)
          .attr('stroke', '#e67e22')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '4,2');

        // Add mean label with background
        const meanLabel = svg.append('g')
          .attr('transform', `translate(${x(meanValue) + margin.left},${margin.top - 25})`);

        meanLabel.append('rect')
          .attr('x', -40)
          .attr('y', -20)
          .attr('width', 80)
          .attr('height', 24)
          .attr('rx', 12)
          .attr('fill', '#e67e22')
          .attr('opacity', 0.15);

        meanLabel.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', -5)
          .style('font-size', '14px')
          .style('font-weight', '600')
          .style('fill', '#e67e22')
          .text('Mean');
      }

      // Draw midpoint line
      svg.append('line')
        .attr('x1', x(50) + margin.left)
        .attr('x2', x(50) + margin.left)
        .attr('y1', margin.top)
        .attr('y2', height + margin.top)
        .attr('stroke', '#27ae60')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '2,2');

      // Add midpoint label with background
      const midpointLabel = svg.append('g')
        .attr('transform', `translate(${x(50) + margin.left},${margin.top - 25})`);

      midpointLabel.append('rect')
        .attr('x', -50)
        .attr('y', -20)
        .attr('width', 100)
        .attr('height', 24)
        .attr('rx', 12)
        .attr('fill', '#27ae60')
        .attr('opacity', 0.15);

      midpointLabel.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', -5)
        .style('font-size', '14px')
        .style('font-weight', '600')
        .style('fill', '#27ae60')
        .text('Midpoint');

      // Draw distance indicator between mean and midpoint
      if (typeof meanValue === 'number') {
        // Add arrowhead marker definition
        svg.append('defs').append('marker')
          .attr('id', 'arrowhead')
          .attr('viewBox', '0 0 10 10')
          .attr('refX', 5)
          .attr('refY', 5)
          .attr('markerWidth', 8)
          .attr('markerHeight', 8)
          .attr('orient', 'auto')
          .append('path')
          .attr('d', 'M 0 0 L 10 5 L 0 10 z')
          .attr('fill', '#666');

        svg.append('line')
          .attr('x1', x(50) + margin.left)
          .attr('x2', x(meanValue) + margin.left)
          .attr('y1', margin.top - 8)
          .attr('y2', margin.top - 8)
          .attr('stroke', '#888')
          .attr('stroke-width', 3)
          .attr('marker-start', 'url(#arrowhead)')
          .attr('marker-end', 'url(#arrowhead)');
      }
    }
  }
</script>

<div class="histogram-container">
  <div class="question-row">
    <span class="question-intro">Compared to</span>
    <span class="select-measure" bind:this={measureSpanEl} aria-hidden="true"></span>
    <select 
      bind:value={selectedComparisonGroup}
      class="comparison-select"
      bind:this={selectEl}
      on:change={updateSelectWidth}
    >
      {#each comparisonGroups as group}
        <option value={group.value}>{group.label.toLowerCase()}</option>
      {/each}
    </select>,
    <span class="question-main">{question.charAt(0).toLowerCase() + question.slice(1)}</span>
    {#if !isExample}
      <span class="question-number">(question {questionNumber}/{totalQuestions})</span>
    {/if}
  </div>

  {#if isExample}
    <div class="subhead">
      {#if hasVoted}
        You already voted ({userVote}/100)
      {:else}
        Click on the line to rate yourself
      {/if}
    </div>
  {/if}

  <div class="content-wrapper">
    <div class="chart-wrapper">
      {#if !hasVoted}
        <div class="chart-message">Click anywhere on the line below to rate yourself and see how you compare!</div>
      {/if}
      <div
        bind:this={histogramContainer}
        class="histogram"
        style="width: 100%; height: {height}px;"
      ></div>
    </div>
  </div>

  <div class="stats-panel{!hasVoted ? ' fuzzed' : ''}" transition:fade>
    <p class="stats-summary">
      Of the <strong>{responseCount}</strong> responses to this question, the average answer was <strong>{meanValue?.toFixed(1) ?? '0.0'}</strong>, meaning that {meanVsMidpointDescription.toLowerCase()} 
      {#if userVote !== null}
        You gave yourself a score of <strong>{userVote}</strong>, which is in the <strong>{userPercentileValue?.toFixed(1) ?? '0.0'}%</strong> percentile for all responses.
      {/if}
    </p>
  </div>
</div>

<style>
  :global(body) {
    background: #f5ede3;
    color: #222;
  }
  :global(.histogram-container),
  :global(.content-wrapper),
  :global(.chart-wrapper),
  :global(.stats-panel) {
    box-sizing: border-box;
  }

  .histogram-container {
    background: white;
    border-radius: 12px;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.08);
    padding: 2.5rem;
    margin-bottom: 2.5rem;
    transition: transform 0.2s, box-shadow 0.2s;
    border: 1px solid #e2e8f0;
    overflow: visible;
  }

  .histogram-container:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
  }

  .question-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-family: 'National', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 1.2rem;
    font-weight: 500;
    color: #1a202c;
    margin-bottom: 1.5rem;
    line-height: 1.4;
    text-align: center;
    letter-spacing: -0.01em;
    flex-wrap: wrap;
  }
  .question-intro {
    font-weight: 600;
    color: #2c3e50;
    font-size: 1.1rem;
    margin-right: 0.25rem;
  }
  .select-measure {
    position: absolute;
    visibility: hidden;
    height: 0;
    overflow: hidden;
    white-space: pre;
    font-size: 1.1rem;
    font-family: inherit;
    font-weight: 400;
    padding: 0.25rem 0.75rem;
    border: 2px solid #cbd5e0;
    box-sizing: border-box;
  }
  .comparison-select {
    display: inline-block;
    margin: 0 0.25rem;
    padding: 0.25rem 0.75rem 0.25rem 0.75rem;
    border: 2px solid #cbd5e0;
    border-radius: 8px;
    font-size: 1.1rem;
    color: #1a202c;
    background: white;
    transition: all 0.2s;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%232d3748' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.5rem center;
    background-size: 1.1rem;
    width: auto;
    min-width: 0;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    font-family: inherit;
  }
  .comparison-select option {
    text-transform: lowercase;
    color: #1a202c;
    background: white;
  }
  .question-main {
    font-size: 1.1rem;
    color: #1a202c;
    font-weight: 500;
    margin-left: 0.25rem;
  }
  .question-number {
    font-size: 0.95rem;
    color: #4a5568;
    font-weight: 400;
    opacity: 0.8;
    margin-left: 0.5rem;
  }

  .subhead {
    text-align: center;
    color: #2d3748;
    margin-bottom: 2rem;
    font-size: 1.2rem;
    font-family: 'National', -apple-system, BlinkMacSystemFont, sans-serif;
    font-weight: 500;
  }

  .content-wrapper {
    display: block;
    width: 100%;
    margin-top: 1.5rem;
    background: none;
    box-sizing: border-box;
    overflow: visible;
    margin-bottom: 2.5rem;
  }

  .chart-wrapper {
    width: 100%;
    background: none;
    border-radius: 0;
    padding: 0;
    box-shadow: none;
    border: none;
    display: block;
    overflow: visible;
  }

  .histogram {
    width: 100%;
    min-width: 250px;
    border-radius: 8px;
    overflow: visible;
    background: none;
    height: auto;
    min-height: 350px;
    display: block;
    margin-bottom: 1.5rem;
  }

  .stats-panel {
    width: 100%;
    max-width: 100vw;
    background: #f8fafc;
    border-radius: 12px;
    padding: 1.75rem;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.06);
    border: 1px solid #e2e8f0;
    box-sizing: border-box;
    overflow: visible;
    display: block;
    margin: 2.5rem auto 1.5rem auto;
    clear: both;
    margin-top: 5rem;
  }

  .stats-panel.fuzzed {
    filter: blur(4px) grayscale(0.7) opacity(0.7);
    pointer-events: none;
    user-select: none;
  }

  .stats-summary {
    font-size: 1.08rem;
    color: #1a202c;
    font-family: 'National', -apple-system, BlinkMacSystemFont, sans-serif;
    line-height: 1.7;
    margin: 0;
    text-align: left;
  }

  .stats-summary strong {
    font-weight: 700;
    color: #357abd;
  }

  @media (max-width: 1024px) {
    .content-wrapper {
      flex-direction: column;
      align-items: center;
      gap: 2rem;
    }

    .stats-panel {
      width: 100%;
      max-width: 600px;
    }

    .chart-wrapper {
      width: 100%;
    }
  }

  @media (max-width: 768px) {
    .histogram-container {
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .question-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .comparison-select {
      width: 100%;
      margin: 0.75rem 0 0 0;
    }

    .stats-panel {
      padding: 1.25rem;
    }

    .stat-item {
      padding: 0.75rem 1rem;
    }
  }

  .chart-message {
    width: 100%;
    text-align: center;
    font-size: 1.15rem;
    color: #357abd;
    margin-bottom: 0.5rem;
    font-family: 'National', -apple-system, BlinkMacSystemFont, sans-serif;
  }
</style> 