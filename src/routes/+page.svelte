<!--script lang="ts">
//  import BumpChart from "$lib/components/BumpChart.svelte";
// import DetailLinePlot from "$lib/components/DetailLinePlot.svelte";
//  import USStrokeMortalityMap from "$lib/components/USStrokeMortalityMap.svelte";
  
</script-->

<!--h1>Stroke Mortality Final Project</h1-->


<!--section id="v1">
  <h2>Visualization 1: Bump Chart</h2>
  <BumpChart />
</section>

<section id="v2" style="margin-top: 48px;">
  <h2>Visualization 2: US Choropleth Map</h2>
  <USStrokeMortalityMap />
</section>

<section id="v3" style="margin-top: 48px;">
  <h2>Visualization 3: Detail Line Plot</h2>
  <DetailLinePlot />
</section-->

<script lang="ts">
  import StoryWrapper from '$lib/components/story/StoryWrapperV2.svelte';
</script>

<StoryWrapper />