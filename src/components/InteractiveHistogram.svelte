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
  let height = 400;
  let margin = { top: 48, right: 20, bottom: 30, left: 40 };
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

    const svg = d3.select(histogramContainer)
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    const x = d3.scaleLinear()
      .domain([0, 100])
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain([0, 100])
      .range([height - margin.bottom, margin.top]);

    // Add star icon group
    const starGroup = svg.append("g")
      .attr("opacity", 0)
      .style("pointer-events", "none");
    
    // Add "You are here" label
    starGroup.append("text")
      .attr("text-anchor", "middle")
      .attr("y", -25)
      .style("font-size", "12px")
      .style("fill", "#ff4444")
      .text("You are here");
    
    // Add star icon with corrected path and centered position
    starGroup.append("path")
      .attr("d", "M0,-8 L2.5,0 L5,-2.5 L7.5,0 L10,-8 L5,2.5 L0,-8")
      .attr("fill", "#ff4444")
      .attr("transform", "translate(0, 0)");

    // Add mouse move handler for hover dot
    if (canVote) {
      svg.on("mousemove", function(event) {
        const [xPos] = d3.pointer(event);
        const value = Math.round(x.invert(xPos));
        
        // Only show dot if within valid range
        if (value >= 0 && value <= 100) {
          starGroup
            .attr("transform", `translate(${xPos},${height - margin.bottom - 4})`)
            .attr("opacity", 1);
        } else {
          starGroup.attr("opacity", 0);
        }
      })
      .on("mouseleave", function() {
        starGroup.attr("opacity", 0);
      });
    }

    // Add click handler to the SVG
    if (canVote) {
      svg.on("click", async function(event) {
        const [xPos] = d3.pointer(event);
        const value = Math.round(x.invert(xPos));
        
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
      // Group responses by value and calculate counts
      const valueGroups = d3.group(responses, d => d);
      const data = [];
      
      // Calculate maximum count for y-axis scaling
      let maxCount = 0;
      valueGroups.forEach((responses) => {
        maxCount = Math.max(maxCount, responses.length);
      });
      
      // Create data array for bars
      valueGroups.forEach((responses, value) => {
        data.push({
          value: Number(value),
          count: responses.length,
          isUserVote: Number(value) === userVote
        });
      });

      // Update y scale domain based on maxCount
      y.domain([0, maxCount]);

      // Draw bars
      const bars = svg.selectAll("rect")
        .data(data)
        .join("rect")
        .attr("x", d => x(d.value) - 2) // Center the bar on the value
        .attr("y", d => y(d.count))
        .attr("width", 4)
        .attr("height", d => height - margin.bottom - y(d.count))
        .attr("fill", d => {
          if (d.isUserVote) return "#ff4444";
          if (hoveredValue === d.value) return "#357abd";
          return "#4a90e2";
        })
        .attr("opacity", d => {
          if (d.isUserVote) return 1;
          if (hoveredValue === d.value) return 0.9;
          return 0.7;
        })
        .style("cursor", "pointer")
        .style("transition", "opacity 0.2s, fill 0.2s");

      // Add hover events for highlighting
      if (canVote) {
        bars
          .on("mouseover", function(event, d) {
            if (!d.isUserVote) {
              hoveredValue = d.value;
              bars
                .transition()
                .duration(200)
                .attr("fill", bar => {
                  if (bar.isUserVote) return "#ff4444";
                  return bar.value === d.value ? "#357abd" : "#4a90e2";
                })
                .attr("opacity", bar => {
                  if (bar.isUserVote) return 1;
                  return bar.value === d.value ? 0.9 : 0.7;
                });
            }
          })
          .on("mouseout", function() {
            hoveredValue = null;
            bars
              .transition()
              .duration(200)
              .attr("fill", bar => bar.isUserVote ? "#ff4444" : "#4a90e2")
              .attr("opacity", bar => bar.isUserVote ? 1 : 0.7);
          });
      }

      // Draw normal distribution curve
      if (responses.length > 1) {
        const mean = d3.mean(responses);
        const stdDev = d3.deviation(responses);
        const normalData = normalDistribution(mean, stdDev, 100);

        // Scale the normal distribution to match our data
        const maxDensity = d3.max(normalData, d => d.y);
        const scaleFactor = maxCount / maxDensity;

        const line = d3.line()
          .x(d => x(d.x))
          .y(d => y(d.y * scaleFactor))
          .curve(d3.curveBasis);

        // Add area under the curve
        const area = d3.area()
          .x(d => x(d.x))
          .y0(height - margin.bottom)
          .y1(d => y(d.y * scaleFactor))
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

      // Show y-axis only after voting
      svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y));
    }

    // Add axes
    const xAxis = d3.axisBottom(x)
      .tickValues([0, 50, 100])
      .tickFormat((d, i) => {
        if (axisLabels && axisLabels.length === 3) {
          return axisLabels[i] ?? d;
        }
        if (i === 0) return "the worst";
        if (i === 1) return "average";
        if (i === 2) return "the best";
        return d;
      });

    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(xAxis);

    // Draw mean, midpoint, and distance annotations only after voting
    if (hasVoted) {
      // Draw mean line
      if (typeof meanValue === 'number') {
        svg.append('line')
          .attr('x1', x(meanValue))
          .attr('x2', x(meanValue))
          .attr('y1', margin.top)
          .attr('y2', height - margin.bottom)
          .attr('stroke', '#e67e22')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '4,2');
        svg.append('text')
          .attr('x', x(meanValue))
          .attr('y', margin.top - 18)
          .attr('text-anchor', 'middle')
          .style('font-size', '12px')
          .style('fill', '#e67e22')
          .text('Mean');
      }

      // Draw midpoint line (x=50)
      svg.append('line')
        .attr('x1', x(50))
        .attr('x2', x(50))
        .attr('y1', margin.top)
        .attr('y2', height - margin.bottom)
        .attr('stroke', '#27ae60')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '2,2');
      svg.append('text')
        .attr('x', x(50))
        .attr('y', margin.top - 18)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('fill', '#27ae60')
        .text('Midpoint');

      // Draw distance indicator between mean and midpoint
      if (typeof meanValue === 'number') {
        svg.append('line')
          .attr('x1', x(50))
          .attr('x2', x(meanValue))
          .attr('y1', margin.top - 8)
          .attr('y2', margin.top - 8)
          .attr('stroke', '#888')
          .attr('stroke-width', 2)
          .attr('marker-start', 'url(#arrowhead)')
          .attr('marker-end', 'url(#arrowhead)');
        // Add arrowhead marker definition
        svg.append('defs').append('marker')
          .attr('id', 'arrowhead')
          .attr('viewBox', '0 0 10 10')
          .attr('refX', 5)
          .attr('refY', 5)
          .attr('markerWidth', 6)
          .attr('markerHeight', 6)
          .attr('orient', 'auto')
          .append('path')
          .attr('d', 'M 0 0 L 10 5 L 0 10 z')
          .attr('fill', '#888');
      }
    }
  }
</script>

<div class="histogram-container">
  
    <h3>{question} 
      {#if !isExample} <span class="question-number">(question {questionNumber}/{totalQuestions})</span> {/if}
      <div class="comparison-group">
        compared to 
        <select 
          bind:value={selectedComparisonGroup}
          class="comparison-select"
        >
          {#each comparisonGroups as group}
            <option value={group.value}>{group.label}</option>
          {/each}
        </select>
      </div>
    </h3>
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
  <div
    bind:this={histogramContainer}
    class="histogram"
    style="width: {width}px; height: {height}px;"
  ></div>
    </div>

    {#if hasVoted}
      <div class="stats-panel" transition:fade>
        <h4>Statistics</h4>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">Responses:</span>
            <span class="stat-value">{responseCount}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Mean:</span>
            <span class="stat-value">{meanValue?.toFixed(1) ?? '0.0'}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Median:</span>
            <span class="stat-value">{medianValue?.toFixed(1) ?? '0.0'}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Std Dev:</span>
            <span class="stat-value">{stdDevValue?.toFixed(1) ?? '0.0'}</span>
          </div>
          {#if userVote !== null}
            <div class="stat-item user-stat">
              <span class="stat-label">Your percentile:</span>
              <span class="stat-value">{userPercentileValue?.toFixed(1) ?? '0.0'}%</span>
            </div>
            <div class="percentile-description">
              {percentileDescription}
            </div>
          {/if}
          <div class="mean-vs-midpoint-description">{meanVsMidpointDescription}</div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .histogram-container {
    font-family: system-ui, -apple-system, sans-serif;
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
  }

  .content-wrapper {
    display: flex;
    gap: 2rem;
    align-items: flex-start;
    justify-content: center;
    margin-top: 20px;
    width: 100%;
    max-width: 1140px;
    margin-left: auto;
    margin-right: auto;
  }

  .chart-wrapper {
    width: 800px;
    flex-shrink: 0;
  }

  .histogram {
    display: flex;
    justify-content: center;
    width: 100%;
  }

  h3 {
    text-align: center;
    color: #333;
    margin-bottom: 1rem;
    width: 100%;
  }

  h4 {
    margin: 0 0 1rem 0;
    color: #333;
    font-size: 1.1em;
  }

  .question-number {
    font-size: 0.9em;
    color: #666;
    font-weight: normal;
  }

  .stats-panel {
    padding: 1.5rem;
    background: #f5f5f5;
    border-radius: 8px;
    width: 300px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    flex-shrink: 0;
  }

  .stats-grid {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .stat-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
  }

  .stat-label {
    color: #666;
    font-size: 0.9em;
  }

  .stat-value {
    font-weight: 500;
    color: #333;
  }

  .user-stat {
    background: #fff;
    border-radius: 4px;
    margin-top: 0.5rem;
    border: 1px solid #ddd;
  }

  .percentile-description {
    margin-top: 1rem;
    padding: 0.75rem;
    background: #fff;
    border-radius: 4px;
    border: 1px solid #ddd;
    font-size: 0.9em;
    color: #333;
    text-align: center;
    line-height: 1.4;
  }

  .subhead {
    font-size: 1.1em;
    color: #666;
    margin-bottom: 1.5rem;
    text-align: center;
  }

  .mean-vs-midpoint-description {
    margin-top: 1rem;
    font-size: 0.95em;
    color: #555;
    text-align: center;
    line-height: 1.4;
  }

  .comparison-group {
    display: inline-block;
    margin-left: 0.5rem;
    font-size: 0.9em;
    color: #666;
  }

  .comparison-select {
    margin-left: 0.25rem;
    padding: 0.25rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: white;
    font-size: 0.9em;
    color: #333;
  }

  .comparison-select:focus {
    outline: none;
    border-color: #4a90e2;
  }
</style> 