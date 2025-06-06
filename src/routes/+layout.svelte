<script>
	import "$styles/app.css";
	import Header from "$components/Header.svelte";
	import { onMount } from "svelte";

	let { children } = $props();
	let scrollY = $state(0);
	let innerHeight = $state(0);
	let documentHeight = $state(0);

	onMount(() => {
		function updateScroll() {
			scrollY = window.scrollY;
			innerHeight = window.innerHeight;
			// Force update document height on each scroll
			documentHeight = Math.max(
				document.body.scrollHeight,
				document.body.offsetHeight,
				document.documentElement.clientHeight,
				document.documentElement.scrollHeight,
				document.documentElement.offsetHeight
			);
		}

		// Initial setup
		updateScroll();
		
		// Set up event listeners
		window.addEventListener('scroll', updateScroll, { passive: true });
		window.addEventListener('resize', updateScroll);
		
		// Also update on load to catch dynamic content
		setTimeout(updateScroll, 100);

		return () => {
			window.removeEventListener('scroll', updateScroll);
			window.removeEventListener('resize', updateScroll);
		};
	});

	// Calculate background position based on scroll - adjusted for full page coverage
	let backgroundTransform = $derived(
		// Slower parallax to make the gradient last the entire scroll
		// With a 500vh gradient and -0.2 multiplier, it will cover about 15,000px of scroll
		`translateY(${scrollY * -0.2}px)`
	);
</script>

<div class="gradient-background" style="transform: {backgroundTransform}"></div>
<Header />
<main id="content">
	{@render children?.()}
</main>

<style>
	.gradient-background {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 500vh; /* Make it 5x the viewport height for full coverage */
		background: 
			radial-gradient(ellipse at 20% 90%, #667eea 0%, transparent 50%),
			radial-gradient(ellipse at 80% 70%, #ff6b6b 0%, transparent 60%),
			radial-gradient(ellipse at 40% 50%, #4ecdc4 0%, transparent 60%),
			radial-gradient(ellipse at 10% 30%, #764ba2 0%, transparent 50%),
			radial-gradient(ellipse at 90% 20%, #feca57 0%, transparent 60%),
			radial-gradient(ellipse at 60% 10%, #f093fb 0%, transparent 50%),
			linear-gradient(180deg, 
				#4facfe 0%,
				#feca57 20%,
				#4ecdc4 36%,
				#ff6b6b 52%,
				#f093fb 68%,
				#764ba2 84%,
				#667eea 100%
			);
		opacity: 0.9;
		z-index: -1;
		pointer-events: none;
		will-change: transform; /* Optimize for transform animations */
	}


</style>
