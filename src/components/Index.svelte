<script>
	import { getContext } from "svelte";
	import Footer from "$components/Footer.svelte";
	import InteractiveHistogram from "./InteractiveHistogram.svelte";
	import DemographicSurvey from './DemographicSurvey.svelte';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	let questions = $state([]);
	let hasCompletedSurvey = $state(false);

	const exampleQuestion = $state({
		question: "How good are you at driving?",
		dataFile: "example_responses.json",
		axisLabels: ["Below average", "Average", "Above average"]
	});

	// Function to load questions from CSV
	async function loadQuestions() {
		try {
			const response = await fetch('/data/questions.csv');
			if (!response.ok) {
				throw new Error(`Failed to load questions: ${response.status} ${response.statusText}`);
			}
			const csvText = await response.text();
			
			// Parse CSV
			const rows = csvText.split('\n')
				.slice(1) // Skip header row
				.filter(row => row.trim()) // Remove empty rows
				.map(row => {
					const [question, lowLabel, averageLabel, highLabel, include, dataFile, notes, comparisonGroup] = row.split(',').map(field => field.trim());
					return {
						question,
						lowLabel,
						averageLabel,
						highLabel,
						include: include === 'TRUE',
						dataFile: `${dataFile}_responses.json`,
						notes,
						comparisonGroup: comparisonGroup || 'friends' // Default to 'friends' if not specified
					};
				})
				.filter(q => q.include); // Only include questions marked as TRUE

			questions = rows;
			
			// Create empty JSON files for each question
			for (const q of questions) {
				const baseName = q.dataFile.replace('_responses.json', '');
				for (const group of ['friends', 'country', 'world']) {
					const type = `${baseName}_${group}`;
					try {
						const response = await fetch(`/api/responses?type=${type}`);
						
						if (!response.ok) {
							console.log(`Creating new data file for ${type}`);
							// If file doesn't exist, create it with empty array
							await fetch(`/api/responses?type=${type}`, {
								method: 'POST',
								headers: {
									'Content-Type': 'application/json',
								},
								body: JSON.stringify([])
							});
						}
					} catch (error) {
						console.error(`Error creating/checking JSON file for ${type}_responses.json:`, error);
					}
				}
			}
		} catch (error) {
			console.error('Error loading questions:', error);
		}
	}

	// Function to check if all questions are answered
	function checkAllQuestionsAnswered() {
		const answeredQuestions = JSON.parse(localStorage.getItem('answeredQuestions') || '[]');
		const expectedQuestions = questions.flatMap(q => {
			const baseName = q.dataFile.replace('_responses.json', '');
			return ['friends', 'country', 'world'].map(group => `${baseName}_${group}`);
		});
		
		return expectedQuestions.every(q => answeredQuestions.includes(q));
	}

	function handleVote() {
		if (checkAllQuestionsAnswered()) {
			hasCompletedSurvey = true;
		}
	}

	function handleDemographicsComplete(event) {
		const responseData = event.detail;
		console.log('Survey complete with data:', responseData);
		hasCompletedSurvey = true;
	}

	onMount(() => {
		loadQuestions();
	});
</script>

<div class="container">
	<h1>How do you rate yourself?</h1>
	
	<div class="context">
		<p>
			There's a <a href="https://www.sciencedirect.com/science/article/abs/pii/0001691881900056">famous scientific study</a> 
			showing that most people think they're above average drivers. Let's see if that's true among a highly unscientific sample
			— esteemed readers of The Pudding.
		</p>

		<div class="example-histogram">
			<InteractiveHistogram 
				question={exampleQuestion.question}
				dataFile={exampleQuestion.dataFile}
				axisLabels={exampleQuestion.axisLabels}
				isExample={true}
			/>
		</div>

		<p>
			There you have it! Let's see what else you guys are wrong about.
		</p>
	</div>

	<div class="histograms">
		{#each questions as question, i}
			<InteractiveHistogram
				question={question.question}
				dataFile={question.dataFile}
				questionNumber={i + 1}
				totalQuestions={questions.length}
				axisLabels={[question.lowLabel, question.averageLabel, question.highLabel]}
				defaultComparisonGroup={question.comparisonGroup}
			/>
		{/each}
	</div>

	{#if !hasCompletedSurvey}
		<div class="demographic-section">
			<h2>Optional: Tell us about yourself</h2>
			<p class="demographic-intro">
				If you'd like to help us understand how different groups of people rate themselves, 
				you can optionally share some information about yourself below.
			</p>
			<DemographicSurvey on:complete={handleDemographicsComplete} />
		</div>
	{:else}
		<div class="completion-message">
			<h2>Thank you for your responses!</h2>
			<p>Your data has been recorded.</p>
		</div>
	{/if}
</div>

<style>
	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	h1 {
		text-align: center;
		margin-bottom: 2rem;
	}

	.context {
		max-width: 800px;
		margin: 0 auto 4rem auto;
		text-align: center;
		color: #444;
		line-height: 1.6;
	}

	.context p {
		margin-bottom: 1rem;
	}

	.context p:last-child {
		margin-bottom: 0;
	}

	.histograms {
		display: flex;
		flex-direction: column;
		gap: 4rem;
		width: 100%;
		max-width: 1200px;
		margin: 0 auto;
		margin-bottom: 4rem;
	}

	.demographic-section {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem;
		background: #f8f9fa;
		border-radius: 8px;
	}

	.demographic-section h2 {
		text-align: center;
		color: #333;
		margin-bottom: 1rem;
	}

	.demographic-intro {
		text-align: center;
		color: #666;
		margin-bottom: 2rem;
	}

	.completion-message {
		text-align: center;
		padding: 3rem;
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0,0,0,0.1);
	}

	.completion-message h2 {
		color: #333;
		margin-bottom: 1rem;
	}

	.completion-message p {
		color: #666;
	}
</style>

<svelte:boundary onerror={(e) => console.error(e)}>
	<!-- <Footer recirc={true} /> -->
</svelte:boundary>
