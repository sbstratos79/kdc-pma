<script>
	import { onMount, onDestroy, tick } from 'svelte';

	// Speed in pixels per second
	export let speed = 50;

	let container;
	let contentWrap;
	let animationFrame;
	let scrollPos = 0;
	let maxScroll = 0;
	let numItems = 0;
	let isPaused = false;

	async function init() {
		// Wait for slot content to be rendered
		await tick();
		const children = Array.from(contentWrap.children);
		numItems = children.length;
		if (numItems < 2) return;

		// Duplicate content for seamless scroll
		const html = contentWrap.innerHTML;
		contentWrap.innerHTML = html + html;

		await tick();
		maxScroll = contentWrap.scrollWidth / 2;
		startScroll();
	}

	function step() {
		if (!isPaused) {
			scrollPos += speed / 60;
			if (scrollPos >= maxScroll) {
				scrollPos -= maxScroll;
			}
			container.scrollLeft = scrollPos;
		}
		animationFrame = requestAnimationFrame(step);
	}

	function startScroll() {
		if (!animationFrame) {
			animationFrame = requestAnimationFrame(step);
		}
	}

	function stopScroll() {
		isPaused = true;
	}

	function resumeScroll() {
		isPaused = false;
	}

	onMount(() => {
		init();
		// Pause on hover
		container.addEventListener('mouseenter', () => stopScroll());
		container.addEventListener('mouseleave', () => resumeScroll());
	});

	onDestroy(() => {
		cancelAnimationFrame(animationFrame);
		container.removeEventListener('mouseenter', () => stopScroll());
		container.removeEventListener('mouseleave', () => resumeScroll());
	});
</script>

<div class="carousel" bind:this={container}>
	<div class="inner" bind:this={contentWrap}>
		<slot />
	</div>
</div>

<style>
	.carousel {
		overflow: hidden;
		position: relative;
		width: 100%;
	}
	.inner {
		display: flex;
		flex-wrap: nowrap;
	}
	/* ensure each item keeps its width */
	.inner > * {
		flex-shrink: 0;
	}
</style>
