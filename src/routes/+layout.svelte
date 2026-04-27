<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Stroke Mortality in the U.S.</title>
	<meta
		name="description"
		content="An interactive story about U.S. stroke mortality patterns across states, time, and subgroups."
	/>
	<meta name="theme-color" content="#5d1523" />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700;9..144,800&family=Manrope:wght@400;500;600;700;800&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

{@render children()}

<style>
	:global(html) {
		scroll-behavior: smooth;
	}

	:global(body) {
		margin: 0;
		font-family: 'Manrope', sans-serif;
		background: #14050b;
		color: #21161a;
	}

	:global(h1),
	:global(h2),
	:global(h3),
	:global(h4) {
		font-family: 'Fraunces', serif;
		letter-spacing: -0.02em;
	}

	:global(*) {
		box-sizing: border-box;
	}
</style>
