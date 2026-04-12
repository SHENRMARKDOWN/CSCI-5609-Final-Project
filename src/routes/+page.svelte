<script lang="ts">
  import BumpChart from "$lib/components/BumpChart.svelte";
  import DetailLinePlot from "$lib/components/DetailLinePlot.svelte";
  import USStrokeMortalityMap from "$lib/components/USStrokeMortalityMap.svelte";
  import USStrokeMortalityCartogram from "$lib/components/USStrokeMortalityCartogram.svelte";

  let mapMode: "choropleth" | "cartogram" = "choropleth";
</script>

<h1>Stroke Mortality Final Project</h1>

<section id="v1">
  <h2>Visualization 1: Bump Chart</h2>
  <BumpChart />
</section>

<section id="v2" style="margin-top: 48px;">
  <h2>Visualization 2: US Choropleth Map</h2>
  <div style="margin-bottom: 0.5rem;">
    <button on:click={() => (mapMode = "choropleth")} style="font-weight: {mapMode === 'choropleth' ? 'bold' : 'normal'}">Geographic Map</button>
    <button on:click={() => (mapMode = "cartogram")} style="font-weight: {mapMode === 'cartogram' ? 'bold' : 'normal'}">Tile Grid Map</button>
  </div>
  {#if mapMode === "choropleth"}
    <USStrokeMortalityMap />
  {:else}
    <USStrokeMortalityCartogram />
  {/if}
</section>

<section id="v3" style="margin-top: 48px;">
  <h2>Visualization 3: Detail Line Plot</h2>
  <DetailLinePlot />
</section>