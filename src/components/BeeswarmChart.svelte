<script>
	import { onMount } from "svelte";
	import * as d3 from "d3";
	import { createEventDispatcher } from "svelte";

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
	let canvas;
	let svgOverlay;
	let containerDiv;
	let width = 700;
	let height = 280;
	let margin = { top: 30, right: 20, bottom: 50, left: 20 };
	let innerWidth = width - margin.left - margin.right;
	let innerHeight = height - margin.top - margin.bottom;
	let userVote = $state(null);
	let hasVoted = $state(false);
	let selectedComparisonGroup = $state(defaultComparisonGroup);
	let hasResponded = $state(false);
	const ENABLE_SINGLE_VOTE = true;
	let hoveredValue = $state(null);
	let dotRadius = 3;
	let beeswarmPoints = [];
	let isVoting = $state(false);
	let isLoadingComparison = $state(false);

	const comparisonGroups = [
		{ value: "friends", label: "your friends" },
		{ value: "country", label: "people in your country" },
		{ value: "world", label: "everyone in the world" }
	];

	// Update the derived state for whether voting is allowed
	let canVote = $derived((!hasResponded || isExample) && !hasVoted && !isVoting && !isLoadingComparison);

	// Function to get the current data file based on comparison group
	function getCurrentDataFile() {
		const baseName = dataFile.replace("_responses.json", "");
		return `${baseName}_${selectedComparisonGroup}_responses.json`;
	}

	// Function to get the vote key for localStorage
	function getVoteKey() {
		const type = getCurrentDataFile().replace("_responses.json", "");
		return type;
	}

	// Function to check if user has voted for current comparison group
	function checkVoteStatus() {
		const userVotes = JSON.parse(localStorage.getItem("userVotes") || "{}");
		const answeredQuestions = JSON.parse(
			localStorage.getItem("answeredQuestions") || "[]"
		);
		const voteKey = getVoteKey();

		if (userVotes[voteKey]) {
			userVote = userVotes[voteKey];
			hasVoted = true;
		} else {
			userVote = null;
			hasVoted = false;
		}

		if (ENABLE_SINGLE_VOTE && !isExample) {
			hasResponded = answeredQuestions.includes(voteKey);
		}
	}

	// Scale for the x-axis (0-100)
	const xScale = d3
		.scaleLinear()
		.domain([0, 100])
		.range([margin.left, width - margin.right]);

	// Helper: bin flat array of numbers into {value, count} objects
	function binResponsesToCounts(arr) {
		const counts = new Map();
		for (const v of arr) {
			const val = Math.round(Number(v));
			if (!isNaN(val)) {
				counts.set(val, (counts.get(val) || 0) + 1);
			}
		}
		return Array.from(counts.entries()).map(([value, count]) => ({
			value,
			count
		}));
	}

	// Calculate optimal dot radius based on data density
	function calculateOptimalRadius(totalPoints) {
		if (totalPoints <= 50) return 4;
		if (totalPoints <= 200) return 3;
		if (totalPoints <= 500) return 2.5;
		return 2;
	}

	// --- Stats logic from InteractiveHistogram ---
	// Only show stats after voting (except for examples)
	let statsData = $derived(hasVoted ? responses : []);

	let numericResponses = $derived(statsData.map((r) => Number(r)));
	let responseCount = $derived(numericResponses.length);
	let meanValue = $derived(
		numericResponses.length ? d3.mean(numericResponses) : 0
	);
	let medianValue = $derived(
		numericResponses.length ? d3.median(numericResponses) : 0
	);
	let stdDevValue = $derived(
		numericResponses.length ? d3.deviation(numericResponses) : 0
	);
	let userPercentileValue = $derived(
		userVote !== null && numericResponses.length
			? (numericResponses
					.sort((a, b) => a - b)
					.findIndex((r) => r >= userVote) /
					numericResponses.length) *
					100
			: 0
	);
	let meanVsMidpointDescription = $derived(
		!numericResponses.length
			? ""
			: (() => {
					const diff = meanValue - 50;
					if (Math.abs(diff) < 3)
						return "People generally think they are about average for this question.";
					if (diff >= 10)
						return "People generally think they are much better than average for this question.";
					if (diff >= 3)
						return "People generally think they are better than average for this question.";
					if (diff <= -10)
						return "People generally think they are much worse than average for this question.";
					if (diff <= -3)
						return "People generally think they are worse than average for this question.";
					return "";
				})()
	);

	// Optimized beeswarm simulation using a more efficient approach
	function createBeeswarm(data) {
		const totalVotes = data.reduce((sum, d) => sum + d.count, 0);
		dotRadius = calculateOptimalRadius(totalVotes);
		let points = [];
		let userDotMarked = false;

		// Create all points
		data.forEach((d) => {
			for (let i = 0; i < d.count; i++) {
				let isUser = false;
				if (!userDotMarked && d.value === userVote) {
					isUser = true;
					userDotMarked = true;
				}
				points.push({
					value: d.value,
					x: xScale(d.value),
					y: margin.top + innerHeight / 2, // Start at center
					r: dotRadius,
					isUser,
					finalX: xScale(d.value)
				});
			}
		});

		// Fast collision detection and positioning
		const centerY = margin.top + innerHeight / 2;
		const maxY = margin.top + innerHeight - dotRadius;
		const minY = margin.top + dotRadius;

		// Sort by x position for better collision detection
		points.sort((a, b) => a.x - b.x);

		// Position points to avoid collisions
		for (let i = 0; i < points.length; i++) {
			const point = points[i];
			let placed = false;
			let offset = 0;

			// Try to place the point without collisions
			while (!placed && offset < innerHeight / 2) {
				let collision = false;

				// Check positions above and below center
				const positions =
					offset === 0 ? [centerY] : [centerY - offset, centerY + offset];

				for (const testY of positions) {
					if (testY < minY || testY > maxY) continue;

					collision = false;
					// Check collision with previously placed points
					for (let j = 0; j < i; j++) {
						const other = points[j];
						const dx = point.x - other.x;
						const dy = testY - other.y;
						const distance = Math.sqrt(dx * dx + dy * dy);
						if (distance < dotRadius * 2 + 1) {
							collision = true;
							break;
						}
					}

					if (!collision) {
						point.y = testY;
						placed = true;
						break;
					}
				}

				offset += dotRadius * 1.5;
			}

			// If still not placed, just stack it
			if (!placed) {
				point.y = Math.min(maxY, centerY + (i % 10) * dotRadius * 2);
			}
		}

		return points;
	}

	// Face icon SVG logic (from InteractiveHistogram)
	function getFaceSVG(value) {
		if (value > 66) {
			// Green happy face
			return `M0,0 m-12,0 a12,12 0 1,0 24,0 a12,12 0 1,0 -24,0 M-5,-2 a2,2 0 1,0 4,0 M5,-2 a2,2 0 1,0 4,0 M-5,4 q5,5 10,0`;
		} else if (value >= 33) {
			// Yellow neutral face
			return `M0,0 m-12,0 a12,12 0 1,0 24,0 a12,12 0 1,0 -24,0 M-5,-2 a2,2 0 1,0 4,0 M5,-2 a2,2 0 1,0 4,0 M-5,7 h10`;
		} else {
			// Red sad face
			return `M0,0 m-12,0 a12,12 0 1,0 24,0 a12,12 0 1,0 -24,0 M-5,-2 a2,2 0 1,0 4,0 M5,-2 a2,2 0 1,0 4,0 M-5,10 q5,-5 10,0`;
		}
	}
	function getFaceColor(value) {
		if (value > 66) return "#27ae60"; // green
		if (value >= 33) return "#f1c40f"; // yellow
		return "#e74c3c"; // red
	}

	function updateChartSize() {
		if (!containerDiv) return;

		const containerWidth = containerDiv.clientWidth;
		// Use full container width but ensure chart content is centered
		width = containerWidth;

		// Calculate the actual chart width (limited to max of 700px)
		const chartWidth = Math.min(700, containerWidth - 40);
		const chartLeft = (width - chartWidth) / 2;
		const chartRight = chartLeft + chartWidth;

		// Update margins to center the chart content
		margin.left = chartLeft + 20;
		margin.right = width - chartRight + 20;
		innerWidth = width - margin.left - margin.right;

		// Update the x scale with new width
		xScale.range([margin.left, width - margin.right]);
	}

	function drawChart() {
		if (!canvas || !svgOverlay) return;

		// Update chart size based on container
		updateChartSize();

		// Determine what data to show based on voting state
		let dataToShow = [];
		if (hasVoted) {
			// Show all responses after voting
			dataToShow = responses;
		} else if (userVote !== null) {
			// Show only user's vote before seeing other responses
			dataToShow = [userVote];
		}

		// Bin responses for beeswarm
		const beeswarmData = binResponsesToCounts(dataToShow);
		beeswarmPoints = createBeeswarm(beeswarmData);

		// Draw on canvas
		drawCanvas();

		// Draw SVG overlay (axes, labels, interaction)
		drawSVGOverlay();
	}

	function drawCanvas() {
		const ctx = canvas.getContext("2d");
		const dpr = window.devicePixelRatio || 1;

		// Set canvas size accounting for device pixel ratio
		canvas.width = width * dpr;
		canvas.height = height * dpr;
		canvas.style.width = width + "px";
		canvas.style.height = height + "px";
		ctx.scale(dpr, dpr);

		// Clear canvas
		ctx.clearRect(0, 0, width, height);

		// Only draw dots if user has voted (or if it's an example)
		if (hasVoted || isExample) {
			beeswarmPoints.forEach((point) => {
				ctx.beginPath();
				ctx.arc(point.x, point.y, point.r, 0, 2 * Math.PI);

				if (point.isUser) {
					ctx.fillStyle = "#ff4444";
					ctx.strokeStyle = "#cc3333";
					ctx.lineWidth = 2;
				} else {
					ctx.fillStyle = "#357abd";
					ctx.strokeStyle = "#2c5f92";
					ctx.lineWidth = 1;
				}

				ctx.fill();
				ctx.stroke();
			});
		}
	}

	function drawSVGOverlay() {
		const svg = d3.select(svgOverlay);
		svg.selectAll("*").remove();

		svg.attr("width", width).attr("height", height);

		const g = svg.append("g");

		// Y position for the axis
		const axisY = height - margin.bottom + 20;

		// Draw face icon hover indicator if hovering
		if (hoveredValue !== null && canVote) {
			const faceGroup = g
				.append("g")
				.attr("transform", `translate(${xScale(hoveredValue)},${axisY + 32})`);
			faceGroup
				.append("path")
				.attr("d", getFaceSVG(hoveredValue))
				.attr("fill", "#fff")
				.attr("stroke", getFaceColor(hoveredValue))
				.attr("stroke-width", 2.5)
				.attr("filter", "drop-shadow(0 2px 6px #0002)");
			faceGroup
				.append("text")
				.attr("text-anchor", "middle")
				.attr("y", 32)
				.style("font-size", "14px")
				.style("fill", getFaceColor(hoveredValue))
				.text("You are here");
		}

		// Add x-axis with custom labels
		const xAxis = d3
			.axisBottom(xScale)
			.tickValues([0, 50, 100])
			.tickFormat((d, i) => {
				if (axisLabels && axisLabels.length === 3) {
					return axisLabels[i] ?? `${d}%`;
				}
				if (i === 0) return "the worst";
				if (i === 1) return "average";
				if (i === 2) return "the best";
				return `${d}%`;
			});

		g.append("g")
			.attr("transform", `translate(0,${axisY})`)
			.call(xAxis)
			.selectAll("text")
			.style("font-size", "14px")
			.style("fill", "#4a5568")
			.attr("dy", "0.8em")
			.attr("text-anchor", "middle")
			.each(function (d, i) {
				let label =
					axisLabels && axisLabels.length === 3
						? (axisLabels[i] ?? `${d}%`)
						: i === 0
							? "the worst"
							: i === 1
								? "average"
								: i === 2
									? "the best"
									: `${d}%`;
				if (typeof label === "string" && label.length > 30) {
					let splitIdx = label.lastIndexOf(" ", 30);
					if (splitIdx === -1) splitIdx = 30;
					const first = label.slice(0, splitIdx);
					const second = label.slice(splitIdx).trim();
					d3.select(this)
						.text(null)
						.append("tspan")
						.attr("x", 0)
						.attr("dy", "0em")
						.text(first)
						.append("tspan")
						.attr("x", 0)
						.attr("dy", "1.2em")
						.text(second);
				}
			});

		// Add axis line
		g.append("line")
			.attr("x1", margin.left)
			.attr("x2", width - margin.right)
			.attr("y1", axisY)
			.attr("y2", axisY)
			.attr("stroke", "#e2e8f0")
			.attr("stroke-width", 1);

		// Add transparent overlay for hover/click voting
		if (canVote) {
			g.append("rect")
				.attr("x", margin.left)
				.attr("y", margin.top)
				.attr("width", innerWidth)
				.attr("height", innerHeight)
				.attr("fill", "transparent")
				.style("cursor", "pointer")
				.on("mousemove", function (event) {
					const [xPos] = d3.pointer(event);
					let value = Math.round(xScale.invert(xPos));
					value = Math.max(0, Math.min(100, value));
					hoveredValue = value;
					drawSVGOverlay(); // Redraw to show hover indicator
				})
				.on("mouseleave", function () {
					hoveredValue = null;
					drawSVGOverlay(); // Redraw to hide hover indicator
				})
				.on("click", async function (event) {
					await handleVote(event);
				});
		}
	}

	async function handleVote(event) {
		// Prevent multiple simultaneous votes
		if (!canVote || isVoting) return;
		
		isVoting = true;

		try {
			const [xPos] = d3.pointer(event);
			let value = Math.round(xScale.invert(xPos));
			value = Math.max(0, Math.min(100, value));

			// Store old state for potential rollback
			const oldState = {
				userVote,
				hasVoted,
				responses: [...responses]
			};

			// Update state optimistically
			userVote = value;
			hasVoted = true;
			responses = [...responses, value];

			const type = getCurrentDataFile().replace("_responses.json", "");
			const voteKey = getVoteKey();

			// First save the vote to the server
			const saveResult = await fetch(`/api/responses?type=${type}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(responses)
			});

			if (!saveResult.ok) {
				throw new Error(`Failed to save response: ${saveResult.status}`);
			}

			// Then fetch the updated data after the save is complete
			const refreshResult = await fetch(`/api/responses?type=${type}`);
			if (refreshResult.ok) {
				responses = await refreshResult.json();
			}

			// Save user's vote to localStorage
			const userVotes = JSON.parse(localStorage.getItem("userVotes") || "{}");
			userVotes[voteKey] = value;
			localStorage.setItem("userVotes", JSON.stringify(userVotes));

			if (!isExample) {
				const answeredQuestions = JSON.parse(
					localStorage.getItem("answeredQuestions") || "[]"
				);
				if (!answeredQuestions.includes(voteKey)) {
					answeredQuestions.push(voteKey);
					localStorage.setItem(
						"answeredQuestions",
						JSON.stringify(answeredQuestions)
					);
					hasResponded = true;
				}
			}

			drawChart();
			dispatch("vote", { value });
		} catch (error) {
			console.error("Error saving response:", error);
			// Revert to old state on error
			userVote = oldState.userVote;
			hasVoted = oldState.hasVoted;
			responses = oldState.responses;
		} finally {
			isVoting = false;
		}
	}

	// Load existing responses and check if user has already responded
	onMount(async () => {
		try {
			const type = getCurrentDataFile().replace("_responses.json", "");
			console.log("Loading responses for type:", type);
			const response = await fetch(`/api/responses?type=${type}`);
			if (!response.ok) {
				throw new Error(
					`Failed to load responses: ${response.status} ${response.statusText}`
				);
			}
			const data = await response.json();
			console.log("Raw response data:", data);

			// Ensure we have an array of numbers
			responses = Array.isArray(data) ? data : [];
			console.log("Processed responses:", responses);

			// Check if user has already voted for this comparison group
			checkVoteStatus();

			drawChart();
		} catch (error) {
			console.error("Error loading responses:", error);
			responses = [];
			drawChart();
		}

		// Handle window resize
		function handleResize() {
			if (canvas && svgOverlay) {
				drawChart();
			}
		}

		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	});

	// Watch for changes in comparison group
	let lastLoadedGroup = $state(null);
	$effect(() => {
		if (selectedComparisonGroup && selectedComparisonGroup !== lastLoadedGroup) {
			loadComparisonGroupData();
		}
	});

	async function loadComparisonGroupData() {
		if (isLoadingComparison || isVoting) return;
		
		isLoadingComparison = true;
		
		try {
			const type = getCurrentDataFile().replace("_responses.json", "");
			console.log(
				"Loading responses for comparison group:",
				selectedComparisonGroup,
				"type:",
				type
			);
			
			const response = await fetch(`/api/responses?type=${type}`);
			if (!response.ok) {
				throw new Error(
					`Failed to load responses: ${response.status} ${response.statusText}`
				);
			}
			
			const data = await response.json();
			console.log("Loaded responses for comparison group:", data);
			responses = Array.isArray(data) ? data : [];
			lastLoadedGroup = selectedComparisonGroup; // Update tracking variable
			checkVoteStatus();
			drawChart();
		} catch (error) {
			console.error("Error loading responses:", error);
			responses = [];
			lastLoadedGroup = selectedComparisonGroup; // Update tracking variable even on error
			drawChart();
		} finally {
			isLoadingComparison = false;
		}
	}

	$effect(() => {
		if (responses && canvas && svgOverlay) {
			drawChart();
		}
	});
</script>

<div class="beeswarm-container">
	<div class="question-row">
		{#if !isExample}
			<span class="question-intro">Compared to</span>
			<select bind:value={selectedComparisonGroup} class="comparison-select">
				{#each comparisonGroups as group}
					<option value={group.value}>{group.label}</option>
				{/each}
			</select>,
		{/if}
		<span class="question-main"
			>{isExample ? question : question.charAt(0).toLowerCase() + question.slice(1)}</span
		>
		{#if !isExample}
			<span class="question-number"
				>(question {questionNumber}/{totalQuestions})</span
			>
		{/if}
	</div>

	{#if isExample && !hasVoted}
		<div class="subhead">
			Click anywhere to rate yourself
		</div>
	{/if}

	{#if !hasVoted && canVote && isExample}
		<div class="chart-message">
			Click anywhere on the chart below to rate yourself and see how you
			compare!
		</div>
	{/if}

	<div class="chart-container" bind:this={containerDiv}>
		<canvas bind:this={canvas} class="chart-canvas"></canvas>
		<svg bind:this={svgOverlay} class="chart-overlay"></svg>
	</div>

	<div class="stats-panel{!hasVoted ? ' fuzzed' : ''}">
		<p class="stats-summary">
			Of the <strong>{responseCount}</strong> responses to this question, the
			average answer was <strong>{meanValue?.toFixed(1) ?? "0.0"}</strong>,
			meaning that {meanVsMidpointDescription.toLowerCase()}
			{#if userVote !== null}
				You gave yourself a score of <strong>{userVote}</strong>, which is in
				the <strong>{userPercentileValue?.toFixed(1) ?? "0.0"}%</strong> percentile
				for all responses.
			{/if}
		</p>
	</div>
</div>

<style>
	.beeswarm-container {
		background: white;
		border-radius: 12px;
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.08);
		padding: 2.5rem;
		margin-bottom: 2.5rem;
		transition:
			transform 0.2s,
			box-shadow 0.2s;
		border: 1px solid #e2e8f0;
		width: 100%;
		max-width: 100%;
		box-sizing: border-box;
		overflow: hidden;
	}

	.beeswarm-container:hover {
		transform: translateY(-2px);
		box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
	}

	.question-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		font-family:
			"National",
			-apple-system,
			BlinkMacSystemFont,
			sans-serif;
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

	.comparison-select {
		display: inline-block;
		margin: 0 0.25rem;
		padding: 0.25rem 0.75rem;
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
		font-family:
			"National",
			-apple-system,
			BlinkMacSystemFont,
			sans-serif;
		font-weight: 500;
	}

	.chart-message {
		text-align: center;
		font-size: 1.15rem;
		color: #357abd;
		margin-bottom: 1rem;
		font-family:
			"National",
			-apple-system,
			BlinkMacSystemFont,
			sans-serif;
		font-weight: 500;
	}

	.chart-container {
		position: relative;
		width: 100%;
		height: 280px;
		margin: 1.5rem 0;
		overflow: hidden;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.chart-canvas {
		position: absolute;
		top: 0;
		left: 0;
		z-index: 1;
		width: 100%;
		border-radius: 8px;
	}

	.chart-overlay {
		position: absolute;
		top: 0;
		left: 0;
		z-index: 2;
		pointer-events: all;
		width: 100%;
	}

	.stats-panel {
		background: #f8fafc;
		border-radius: 12px;
		padding: 1.75rem;
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.06);
		border: 1px solid #e2e8f0;
		margin-top: 2rem;
		clear: both;
		width: 100%;
		box-sizing: border-box;
	}

	.stats-panel.fuzzed {
		filter: blur(4px) grayscale(0.7) opacity(0.7);
		pointer-events: none;
		user-select: none;
	}

	.stats-summary {
		font-size: 1.08rem;
		color: #1a202c;
		font-family:
			"National",
			-apple-system,
			BlinkMacSystemFont,
			sans-serif;
		line-height: 1.7;
		margin: 0;
		text-align: left;
	}

	.stats-summary strong {
		font-weight: 700;
		color: #357abd;
	}

	@media (max-width: 768px) {
		.beeswarm-container {
			padding: 1.5rem;
			margin-bottom: 1.5rem;
		}

		.question-row {
			flex-direction: column;
			align-items: center;
			gap: 0.5rem;
		}

		.comparison-select {
			width: 100%;
			margin: 0.75rem 0 0 0;
		}

		.chart-container {
			height: 250px;
			margin: 1rem 0;
		}

		.stats-panel {
			padding: 1.25rem;
			margin-top: 1.5rem;
		}
	}
</style>
