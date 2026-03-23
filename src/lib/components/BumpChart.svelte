<script lang="ts">
  import { onMount } from "svelte";
  import * as d3 from "d3";

  let svg: SVGSVGElement;
  let selectedRegion = $state("Midwest");
  let originalData = $state<any[]>([]);
  let selectedState = $state<string | null>(null);
    
    let selectedYear = $state<number | null>(null);

// Load and process data on component mount
onMount(async () => {
  const raw = await d3.csv("/data/stroke_geo_clean_state.csv", d => ({
    state: d.State,
    year: +d.Year,
    mortality: +d.mortality
  }));

  originalData = raw;
  redraw();
});

// Mapping of states to regions，all the regions and state relationships 
//in this project should be based on this set
  const regionMap: Record<string, string> = {
  // Northeast
  CT: "Northeast", // Connecticut
  ME: "Northeast", // Maine
  MA: "Northeast", // Massachusetts
  NH: "Northeast", // New Hampshire
  RI: "Northeast", // Rhode Island
  VT: "Northeast", // Vermont
  NJ: "Northeast", // New Jersey
  NY: "Northeast", // New York
  PA: "Northeast", // Pennsylvania
  DE: "Southeast", // Delaware
  MD: "Southeast", // Maryland

  // Southeast
  AL: "Southeast", // Alabama
  AR: "Southeast", // Arkansas
  FL: "Southeast", // Florida
  GA: "Southeast", // Georgia
  KY: "Southeast", // Kentucky
  LA: "Southeast", // Louisiana
  MS: "Southeast", // Mississippi
  NC: "Southeast", // North Carolina
  SC: "Southeast", // South Carolina
  TN: "Southeast", // Tennessee
  VA: "Southeast", // Virginia
  WV: "Southeast", // West Virginia

  // Midwest
  IL: "Midwest", // Illinois
  IN: "Midwest", // Indiana
  IA: "Midwest", // Iowa
  KS: "Midwest", // Kansas
  MI: "Midwest", // Michigan
  MN: "Midwest", // Minnesota
  MO: "Midwest", // Missouri
  NE: "Midwest", // Nebraska
  ND: "Midwest", // North Dakota
  OH: "Midwest", // Ohio
  SD: "Midwest", // South Dakota
  WI: "Midwest", // Wisconsin

  // Southwest
  AZ: "Southwest", // Arizona
  NM: "Southwest", // New Mexico
  OK: "Southwest", // Oklahoma  
  TX: "Southwest", // Texas

  // West
  AK: "West", // Alaska
  CA: "West", // California
  CO: "West", // Colorado
  HI: "West", // Hawaii
  ID: "West", // Idaho
  MT: "West", // Montana
  NV: "West", // Nevada
  OR: "West", // Oregon
  UT: "West", // Utah
  WA: "West", // Washington
  WY: "West" // Wyoming
};

// Define color schemes for each region using D3's categorical color schemes
const regionColorSchemes: Record<string, readonly string[]> = {
  Northeast: d3.schemeBlues[6],
  Southeast: d3.schemeOranges[6],
  Midwest: d3.schemeGreens[6],
  Southwest: d3.schemeYlOrBr[6],
  West: d3.schemeReds[6]
};

// compute the rank of each state for each year based on mortality
// the lower the mortality, the higher the rank
  function computeRank(data) {
    const grouped = d3.group(data, d => d.year);

    let result = [];

    grouped.forEach((values) => {
      const sorted = values.sort((a, b) =>
        d3.descending(a.mortality, b.mortality)
      );

      sorted.forEach((d, i) => {
        result.push({
          ...d,
          rank: i + 1
        });
      });
    });

    return result;
  }

  // compute the rank of each state IN THEIR REGION for each year based on mortality
  // the lower the mortality, the higher the rank
  function computeRankWithinRegion(data, region) {
  const filtered =
    region === "All"
      ? data
      : data.filter(d => regionMap[d.state] === region);

  const grouped = d3.group(filtered, d => d.year);

  let result = [];

  grouped.forEach(values => {
    const sorted = values.sort((a, b) =>
      d3.descending(a.mortality, b.mortality)
    );

    sorted.forEach((d, i) => {
      result.push({
        ...d,
        rank: i + 1
      });
    });
  });

  return result;
}

// get the color for a state based on its region
  function getStateColor(state: string): string {
  const region = regionMap[state];

  const statesInRegion = Object.keys(regionMap)
    .filter((s) => regionMap[s] === region)
    .sort();

  const colorRange = regionColorSchemes[region];
  const colorScale = d3
    .scaleQuantize<string>()
    .domain([0, statesInRegion.length - 1])
    .range(colorRange);

  const index = statesInRegion.indexOf(state);
  return colorScale(index);
}

  function draw(data) {
    const width = 1200;
    const height = 800;

    d3.select(svg).selectAll("*").remove();

    const svgEl = d3.select(svg);

    const x = d3.scaleLinear()
      .domain(d3.extent(data, d => d.year))
      .range([50, width - 50]);

    const y = d3.scaleLinear()
      .domain([d3.max(data, d => d.rank), 1])
      .range([height - 50, 50]);

    const xAxis = d3.axisBottom(x)
    .tickValues(d3.range(1999, 2020))
    .tickFormat(d3.format("d"));

    const ranks = d3.range(1, d3.max(data, d => d.rank) + 1);

    const minYear = d3.min(data, d => d.year);
    const firstPoints = data.filter(d => d.year === minYear);
    


    svgEl.selectAll(".grid-line")
    .data(ranks)
    .enter()
    .append("line")
    .attr("class", "grid-line")
    .attr("x1", 50)
    .attr("x2", width - 50)
    .attr("y1", d => y(d))
    .attr("y2", d => y(d))
    .attr("stroke", "#ccc")
    .attr("stroke-width", 0.5)
    .attr("opacity", 0.5);

    if (selectedYear !== null) {
        const bandWidth = 20;
        
        svgEl.append("rect")
    .attr("x", x(selectedYear) - bandWidth / 2)
    .attr("y", 50)
    .attr("width", bandWidth)
    .attr("height", height - 100)
    .attr("fill", "#ccc")
    .attr("opacity", 0.2);
}


    svgEl.selectAll(".state-label")
    .data(firstPoints)
    .enter()
    .append("text")
    .attr("class", "state-label")
    .attr("x", 40)  
    .attr("y", d => y(d.rank))
    .attr("dy", "0.35em")
    .text(d => `${d.state} (${d.rank})`)
    .attr("font-size", "10px")
    .attr("fill", "#333")
    .attr("text-anchor", "end");

    const xAxisG = svgEl.append("g")
    .attr("transform", `translate(0, ${height - 50})`)
    .call(xAxis);
    
    xAxisG.select(".domain").attr("stroke", "#666");
    xAxisG.selectAll("line").attr("stroke", "#999");
    xAxisG.selectAll("text")
    .attr("font-size", "10px")
    .attr("fill", "#444");
    
    xAxisG.selectAll(".tick")
    .on("click", function (event, d) {
        event.stopPropagation();
        if (selectedYear === d) {
            selectedYear = null;
        } else {
            selectedYear = d;}

    redraw();
  });

    svgEl.append("text")
    .attr("x", width / 2)
    .attr("y", height - 10)
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .attr("fill", "#333")
    .text("Year");

    const line = d3.line<any>()
      .x(d => x(d.year))
      .y(d => y(d.rank));

    const grouped = d3.group(data, d => d.state);

    grouped.forEach((values, state) => {
        values = values.sort((a, b) => d3.ascending(a.year, b.year));

        const isSelected = selectedState === null || selectedState === state;
        
        svgEl.append("path")
        .datum(values)
        .attr("class", `line-${state}`)
        .attr("fill", "none")
        .attr("stroke", getStateColor(state))
        .attr("stroke-width", selectedState === state ? 10 : 6)
        .attr("opacity", isSelected ? 1 : 0.1)
        .attr("d", line)

        .on("click", function () {
            event.stopPropagation();
            if (selectedState === state) {
                selectedState = null; 
            } else {
                selectedState = state;
            }
            redraw();
});
        
        svgEl.selectAll(`.dot-${state}`)
        .data(values)
        .enter()
        .append("circle")
        .attr("cx", d => x(d.year))
        .attr("cy", d => y(d.rank))
        .attr("fill", getStateColor(state))
        .attr("opacity", d => {
            if (selectedYear === null) return isSelected ? 1 : 0.1;
            return d.year === selectedYear ? 1 : 0.05;
        })
        .attr("r", selectedState === state ? 12 : 8)
        .attr("class", `dot dot-${state}`);
    });

    svgEl.on("click", () => {
    selectedState = null;
    redraw();
});

svgEl.on("click", () => {
    selectedYear = null;
    redraw();
});



}

function redraw() {
  if (!svg) return;
  if (originalData.length === 0) return;

  const ranked = computeRankWithinRegion(originalData, selectedRegion);

  console.log("selectedRegion:", selectedRegion);
  console.log("data length:", ranked.length);

  draw(ranked);
}
</script>


<select
  bind:value={selectedRegion}
  onchange={() => redraw()}
>

  <option value="Midwest">Midwest</option>
  <option value="Northeast">Northeast</option>
  <option value="Southeast">Southeast</option>
  <option value="Southwest">Southwest</option>
  <option value="West">West</option>
  <option value="All">All Regions</option>
</select>

<svg bind:this={svg} width="1200" height="800"></svg>