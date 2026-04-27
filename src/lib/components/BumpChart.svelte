<script lang="ts">
  // @ts-nocheck
  import { onMount } from "svelte";
  import * as d3 from "d3";
  import { get } from "svelte/store";
  import { selectedState, selectedYear } from "$lib/stores";
  import { asset } from "$app/paths";
  let { storyStep = null, storyMode = false } = $props();
  
  let svg: SVGSVGElement;
  let selectedRegion = $state("All"); //place holder for selected region, default to "All"
  let originalData = $state([]); // raw data from CSV
  let legendStates = $state([]); // states to show in legend, depends on selected region
  let lastAppliedStoryStep = -1;
  let showInstructions = $state(false);// APR 26

  $effect(() => {
  if (!storyMode) return;
  if (storyStep == null) return;
  if (originalData.length === 0) return;
  if (storyStep === lastAppliedStoryStep) return;

  lastAppliedStoryStep = storyStep;

  if (storyStep === 1) {
    selectedRegion = "All";
    selectedState.set(null);
    selectedYear.set(2019);
  }

  if (storyStep === 2) {
    selectedRegion = "All";
    selectedState.set(null);
    selectedYear.set(null);
  }

  if (storyStep === 3) {
    selectedRegion = "All";
    selectedState.set(null);
    selectedYear.set(null);
  }

  if (storyStep === 4) {
    selectedRegion = "All";
    selectedState.set("MS");
    selectedYear.set(null);
  }

  redraw();
});



  onMount(() => {
    const unsubscribeState = selectedState.subscribe(() => {
      if (originalData.length > 0) redraw();
    });

    const unsubscribeYear = selectedYear.subscribe(() => {
      if (originalData.length > 0) redraw();
    });

    (async () => {
      const raw = await d3.csv(
        asset("/data/stroke_geo_clean_state.csv"),
        (d) => ({
          state: d.State,
          year: +d.Year,
          mortality: +d.mortality,
        }),
      );

      originalData = raw;
      selectedYear.update((curr) => curr ?? 2019);
      redraw();
    })();

    return () => {
      unsubscribeState();
      unsubscribeYear();
    };
  });

  // Mapping of states to regions
  const regionMap: Record<string, string> = {
    // Northeast
    CT: "Northeast",
    ME: "Northeast",
    MA: "Northeast",
    NH: "Northeast",
    RI: "Northeast",
    VT: "Northeast",
    NJ: "Northeast",
    NY: "Northeast",
    PA: "Northeast",

    // Southeast
    DE: "Southeast",
    MD: "Southeast",
    DC: "Southeast",
    AL: "Southeast",
    AR: "Southeast",
    FL: "Southeast",
    GA: "Southeast",
    KY: "Southeast",
    LA: "Southeast",
    MS: "Southeast",
    NC: "Southeast",
    SC: "Southeast",
    TN: "Southeast",
    VA: "Southeast",
    WV: "Southeast",

    // Midwest
    IL: "Midwest",
    IN: "Midwest",
    IA: "Midwest",
    KS: "Midwest",
    MI: "Midwest",
    MN: "Midwest",
    MO: "Midwest",
    NE: "Midwest",
    ND: "Midwest",
    OH: "Midwest",
    SD: "Midwest",
    WI: "Midwest",

    // Southwest
    AZ: "Southwest",
    NM: "Southwest",
    OK: "Southwest",
    TX: "Southwest",

    // West
    AK: "West",
    CA: "West",
    CO: "West",
    HI: "West",
    ID: "West",
    MT: "West",
    NV: "West",
    OR: "West",
    UT: "West",
    WA: "West",
    WY: "West",
  };

  // Full state names for labels
  const stateFullName: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia"
};

  // Color schemes for each region
  const regionColorSchemes: Record<string, readonly string[]> = {
    Northeast: d3.schemeBlues[6],
    Southeast: d3.schemeOranges[6],
    Midwest: d3.schemeGreens[6],
    Southwest: d3.schemeYlOrBr[6],
    West: d3.schemeReds[6],
  };

  // Higher mortality gets a better (smaller) rank number
  function computeRankWithinRegion(data, region) {
    const filtered =
      region === "All"
        ? data
        : data.filter((d) => regionMap[d.state] === region);

    const grouped = d3.group(filtered, (d) => d.year);
    const result = [];

    grouped.forEach((values) => {
      const sorted = [...values].sort((a, b) =>
        d3.descending(a.mortality, b.mortality),
      );

      sorted.forEach((d, i) => {
        result.push({
          ...d,
          rank: i + 1,
        });
      });
    });

    return result;
  }

  // Get color for a state based on its region and the selected region filter
  function getStateColor(state: string): string {
    const region = regionMap[state];

    if (!region) return "#777";

    if (selectedRegion === "All") {
    const regionBaseColor = {
      Northeast: "#4C78A8",
      Southeast: "#F58518",
      Midwest: "#54A24B",
      Southwest: "#ECA82C",
      West: "#E45756",
    };
    return regionBaseColor[region] || "#777";
  }

    const statesInRegion = Object.keys(regionMap)
      .filter((s) => regionMap[s] === region)
      .sort();

    const colorRange = regionColorSchemes[region];
    const colorScale = d3
      .scaleQuantize<string>()
      .domain([0, statesInRegion.length - 1])
      .range([...colorRange]);

    const index = statesInRegion.indexOf(state);
    return colorScale(index);
  }

  function draw(data) {
    if (!svg || data.length === 0) return;

    const currentSelectedState = get(selectedState);
    const currentSelectedYear = get(selectedYear);
    const margin = { top: 50, right: 80, bottom: 30, left: 180 };// adjust left margin for state labels

    const width = 1200;
    const height = 750;

    d3.select(svg).selectAll("*").remove();

    const svgEl = d3.select(svg);

    const yearExtent = d3.extent(data, (d) => d.year);
    const maxRank = d3.max(data, (d) => d.rank) ?? 1;
    const minYear = d3.min(data, (d) => d.year);

    const x = d3
      .scaleLinear()
      .domain(yearExtent)
      .range([margin.left, width - margin.right]); // adjust for left margin
    const y = d3
      .scaleLinear()
      .domain([maxRank, 1])
      .range([height - margin.bottom, margin.top]); // adjust for top margin

    const barX = d3
    .scaleLinear()
    .domain([0, d3.max(data, d => d.mortality) ?? 200])
    .range([margin.left, width - margin.right]);

    const xAxis = currentSelectedYear !== null
  ? d3.axisBottom(barX).ticks(6).tickFormat(d3.format(".1f"))
  : d3.axisBottom(x)
      .tickValues(d3.range(yearExtent[0], yearExtent[1] + 1))
      .tickFormat(d3.format("d"));


    const ranks = d3.range(1, maxRank + 1);
    //const firstPoints = data.filter((d) => d.year === minYear);
    const labelYear = currentSelectedYear ?? minYear;
    const labelPoints = data
    .filter((d) => d.year === labelYear)
    .sort((a, b) => a.rank - b.rank);

    svgEl
      .selectAll(".grid-line")
      .data(ranks)
      .enter()
      .append("line")
      .attr("class", "grid-line")
      .attr("x1", margin.left)
      .attr("x2", width - margin.right)
      .attr("y1", (d) => y(d))
      .attr("y2", (d) => y(d))
      .attr("stroke", "#ccc")
      .attr("stroke-width", 0.5)
      .attr("opacity", 0.5);

    //if (currentSelectedYear !== null) {
      //const bandWidth = 20;

      //svgEl
        //.append("rect")
        //.attr("x", x(currentSelectedYear) - bandWidth / 2)
        //.attr("y", margin.top)
        //.attr("width", bandWidth)
        //.attr("height", height - margin.top - margin.bottom)
        //.attr("fill", "#ccc")
        //.attr("opacity", 0.2);
    //}

    svgEl
      .selectAll(".state-label")
      .data(labelPoints)
      .enter()
      .append("text")
      .attr("class", "state-label")
      .attr("x", margin.left - 10)
      .attr("y", (d) => y(d.rank))
      .attr("dy", "0.35em")
      .text((d) => `${stateFullName[d.state] || d.state} (${d.rank})`)
      .attr("font-size", "10px")
      .attr("fill", "#333")
      .attr("text-anchor", "end").style("cursor", "pointer")  
      .on("click", function (event, d) {
        event.stopPropagation();
        selectedState.update((curr) =>
        curr === d.state ? null : d.state
      );
  })
  .attr("font-weight", (d) =>
  currentSelectedState === d.state ? "bold" : "normal")
  .attr("fill", (d) =>
  currentSelectedState === d.state ? "black" : "#666");
  


const xAxisG = svgEl
  .append("g")
  .attr("transform", `translate(0, ${height - margin.bottom})`)
  .call(xAxis);

    xAxisG.select(".domain").attr("stroke", "#666");
    xAxisG.selectAll("line").attr("stroke", "#999");
    xAxisG.selectAll("text").attr("font-size", "10px").attr("fill", "#444");

    if (currentSelectedYear === null) {
  xAxisG
    .selectAll(".tick")
    .style("cursor", "pointer")
    .on("click", function (event, d) {
      event.stopPropagation();
      selectedYear.update((curr) => (curr === d ? null : d));
    });
}

    svgEl
      .append("text")
      .attr("x", width / 2)
      .attr("y", height - 10)
      .attr("text-anchor", "middle")
      .attr("font-size", "20px")
      .attr("fill", "#333")
      .text(currentSelectedYear !== null ? "Mortality Rate" : "Year");

      if (currentSelectedYear !== null) {
        svgEl
        .append("text")
        .attr("x", width / 2)
        .attr("y", margin.top - 35) 
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("fill", "#333")
        .text(`Stroke Mortality by State — ${currentSelectedYear}`);
      }

    svgEl
      .append("text")
      .attr("x", margin.left-120)
      .attr("y", margin.top - 20)
      .attr("text-anchor", "start")
      .attr("font-size", "20px")
      .attr("fill", "#333")
      .text("State"); // Y-axis label

    const line = d3
      .line()
      .x((d) => x(d.year))
      .y((d) => y(d.rank));

    const grouped = d3.group(data, (d) => d.state);

    legendStates = [...(
      selectedRegion !== "All"
      ? Object.keys(regionMap)
      .filter((s) => regionMap[s] === selectedRegion)
      .sort()
      : ["Northeast", "Southeast", "Midwest", "Southwest", "West"]
    
    )];

    grouped.forEach((values, state) => {
      const sortedValues = [...values].sort((a, b) =>
        d3.ascending(a.year, b.year),
      );
      const isSelected =
        currentSelectedState === null || currentSelectedState === state;

      svgEl
        .append("path")
        .datum(sortedValues)
        .attr("class", `line-${state}`)
        .attr("fill", "none")
        .attr("stroke", getStateColor(state))
        .attr("stroke-width", currentSelectedState === state ? 10 : 6)
        .attr("opacity", currentSelectedYear ? 0 : (isSelected ? 1 : 0.1))
        .attr("d", line)
        .style("cursor", "pointer")
        .on("click", function (event) {
          event.stopPropagation();
          selectedState.update((curr) => (curr === state ? null : state));
        });

        if (currentSelectedYear !== null) {
          const yearData = sortedValues.find(
            (d) => d.year === currentSelectedYear);
            if (yearData) {
              svgEl
              .append("rect")
              .attr("x", margin.left)
              .attr("y", y(yearData.rank) - 6)
              .attr("width", barX(yearData.mortality) - margin.left)
              .attr("height", 12)
              .attr("fill", getStateColor(state))
              .attr("opacity", 1);

              svgEl
              .append("text")
              .attr("x", barX(yearData.mortality) - 6)   
              .attr("y", y(yearData.rank))
              .attr("dy", "0.35em")
              .attr("text-anchor", "end")              
              .attr("font-size", "10px")
              .attr("fill", "white")                  
              .attr("font-weight", "600")
              .text(d3.format(".1f")(yearData.mortality));
            }
        }
          

      svgEl
      .selectAll(`.dot-${state}`)
      .data(sortedValues)
      .enter()
      .append("circle")
      .attr("cx", (d) => x(d.year))
      .attr("cy", (d) => y(d.rank))
      .attr("fill", getStateColor(state))
      .attr("opacity", currentSelectedYear !== null ? 0 : (isSelected ? 1 : 0.1))
      .attr("r", currentSelectedState === state ? 12 : 8)
      .attr("class", `dot dot-${state}`)
      
  
  ;
    });

    svgEl.on("click", () => {
      selectedState.set(null);
      selectedYear.set(null);
    });
  }

  function redraw() {
    if (!svg) return;
    if (originalData.length === 0) return;

    const ranked = computeRankWithinRegion(originalData, selectedRegion);
    draw(ranked);
  }
</script>

<div class="vis-container">
  <div class="vis-header">

  <div class="header-row">
  <h2>Stroke mortality bump chart</h2>
  <button class="info-btn" on:click={() => showInstructions = !showInstructions}>ℹ</button>
</div>

{#if showInstructions}
  <div class="instructions-popup">
    <button class="close-btn" on:click={() => showInstructions = false}>✕</button>
    <p>This bump chart shows the stroke mortality rank of U.S. states. Higher ranks indicate higher mortality.</p>
    <p>The default view is set to 2019. Click year labels or empty space to return to the full trend view.</p>
    <p>Click on state labels or lines to filter by state. Click on years to highlight a specific year.</p>
  </div>
{/if}

    <div class="filter-buttons">
      <button on:click={() => {selectedRegion = "All";redraw();}}
      class:selected={selectedRegion === "All"}>
      Overall
    </button>

      <button on:click={() => {selectedRegion = selectedRegion === "Midwest" ? "All" : "Midwest";redraw();}}
      class:selected={selectedRegion === "Midwest"}>
      Midwest
    </button>

      <button on:click={() => {selectedRegion = selectedRegion === "Northeast" ? "All" : "Northeast";redraw();}}
      class:selected={selectedRegion === "Northeast"}>
      Northeast
    </button>

      <button on:click={() => {selectedRegion = selectedRegion === "Southeast" ? "All" : "Southeast";redraw();}}
      class:selected={selectedRegion === "Southeast"}>
      Southeast
    </button>

      <button on:click={() => {selectedRegion = selectedRegion === "Southwest" ? "All" : "Southwest";redraw();}}
      class:selected={selectedRegion === "Southwest"}>
      Southwest
    </button>

      <button on:click={() => {selectedRegion = selectedRegion === "West" ? "All" : "West";redraw();}}
      class:selected={selectedRegion === "West"}>
      West
    </button>
    </div>
    
    <div class="vis-row">
    <div class="svg-wrapper">
      <svg bind:this={svg} viewBox="0 0 1200 750" preserveAspectRatio="xMidYMid meet" style="width:100%; height:100%; display:block;"></svg>
    </div>
      <div class="legend-container">
        {#if selectedRegion === "All"}
        {#each legendStates as region}
        <div class="legend-item">
          <span
          class="legend-color"
          style="background:{{
          Northeast: '#4C78A8',
          Southeast: '#F58518',
          Midwest: '#54A24B',
          Southwest: '#ECA82C',
          West: '#E45756'
          }[region]}"></span>
          {region}
        </div>
        {/each}
        {:else}
        {#each legendStates as state}
        <div class="legend-item">
          <span
          class="legend-color"
          style="background:{getStateColor(state)}"
          ></span>
          {stateFullName[state] || state}
        </div>
        {/each}
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
.vis-container {
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.vis-header h2 {
  margin: 0 0 6px 0;
}

.vis-header p {
  margin: 0 0 12px 0;
  color: #555;
}

.filter-buttons {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.filter-buttons button {
  padding: 6px 12px;
  border-radius: 10px;
  border: 1px solid #ccc;
  background: #f0f0f0;
  cursor: pointer;
  font-size: 14px;
}

.filter-buttons button:hover {
  background: #e0e0e0;
}

.filter-buttons button.selected {
  background: white;
  border: 2px solid #333;
  font-weight: bold;
}

.hint {
  font-weight: bold;
  color: #333;  
}

.vis-row {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  flex: 1;
  min-height: 0;
}

.legend-container {
  margin-left: 20px;
  width: 180px;
  max-height: 800px;
  overflow-y: auto;   
  font-size: 12px;
  border-left: 1px solid #ddd;
  padding-left: 10px;
}

.legend-item {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
}

.legend-color {
  width: 12px;
  height: 12px;
  margin-right: 8px;
  border-radius: 2px;
}
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.info-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1.5px solid #999;
  background: #f5f5f5;
  cursor: pointer;
  font-size: 14px;
}
.instructions-popup {
  position: absolute;
  top: 36px;
  right: 0;
  z-index: 20;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  padding: 16px 18px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  max-width: 340px;
  font-size: 0.88rem;
  line-height: 1.6;
}
.close-btn {
  position: absolute;
  top: 8px;
  right: 10px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 13px;
  color: #888;
}
.vis-header {
  position: relative;
}
.svg-wrapper {
  flex: 1;
  min-width: 0;
}

.svg-wrapper svg {
  width: 100%;
  height: auto;
  display: block;
}
</style>