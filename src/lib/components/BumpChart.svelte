<script lang="ts">
  // @ts-nocheck
  import { onMount } from "svelte";
  import * as d3 from "d3";
  import { get } from "svelte/store";
  import { selectedState, selectedYear } from "$lib/stores";
  import { asset } from "$app/paths";

  let svg: SVGSVGElement;
  let selectedRegion = $state("All");
  let originalData = $state([]);

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

  function getStateColor(state: string): string {
    const region = regionMap[state];

    if (!region || !regionColorSchemes[region]) {
      return "#777";
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

    const width = 1200;
    const height = 800;

    d3.select(svg).selectAll("*").remove();

    const svgEl = d3.select(svg);

    const yearExtent = d3.extent(data, (d) => d.year);
    const maxRank = d3.max(data, (d) => d.rank) ?? 1;
    const minYear = d3.min(data, (d) => d.year);

    const x = d3
      .scaleLinear()
      .domain(yearExtent)
      .range([50, width - 50]);
    const y = d3
      .scaleLinear()
      .domain([maxRank, 1])
      .range([height - 50, 50]);

    const xAxis = d3
      .axisBottom(x)
      .tickValues(d3.range(yearExtent[0], yearExtent[1] + 1))
      .tickFormat(d3.format("d"));

    const ranks = d3.range(1, maxRank + 1);
    const firstPoints = data.filter((d) => d.year === minYear);

    svgEl
      .selectAll(".grid-line")
      .data(ranks)
      .enter()
      .append("line")
      .attr("class", "grid-line")
      .attr("x1", 50)
      .attr("x2", width - 50)
      .attr("y1", (d) => y(d))
      .attr("y2", (d) => y(d))
      .attr("stroke", "#ccc")
      .attr("stroke-width", 0.5)
      .attr("opacity", 0.5);

    if (currentSelectedYear !== null) {
      const bandWidth = 20;

      svgEl
        .append("rect")
        .attr("x", x(currentSelectedYear) - bandWidth / 2)
        .attr("y", 50)
        .attr("width", bandWidth)
        .attr("height", height - 100)
        .attr("fill", "#ccc")
        .attr("opacity", 0.2);
    }

    svgEl
      .selectAll(".state-label")
      .data(firstPoints)
      .enter()
      .append("text")
      .attr("class", "state-label")
      .attr("x", 40)
      .attr("y", (d) => y(d.rank))
      .attr("dy", "0.35em")
      .text((d) => `${d.state} (${d.rank})`)
      .attr("font-size", "10px")
      .attr("fill", "#333")
      .attr("text-anchor", "end");

    const xAxisG = svgEl
      .append("g")
      .attr("transform", `translate(0, ${height - 50})`)
      .call(xAxis);

    xAxisG.select(".domain").attr("stroke", "#666");
    xAxisG.selectAll("line").attr("stroke", "#999");
    xAxisG.selectAll("text").attr("font-size", "10px").attr("fill", "#444");

    xAxisG
      .selectAll(".tick")
      .style("cursor", "pointer")
      .on("click", function (event, d) {
        event.stopPropagation();
        selectedYear.update((curr) => (curr === d ? null : d));
      });

    svgEl
      .append("text")
      .attr("x", width / 2)
      .attr("y", height - 10)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("fill", "#333")
      .text("Year");

    const line = d3
      .line()
      .x((d) => x(d.year))
      .y((d) => y(d.rank));

    const grouped = d3.group(data, (d) => d.state);

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
        .attr("opacity", isSelected ? 1 : 0.1)
        .attr("d", line)
        .style("cursor", "pointer")
        .on("click", function (event) {
          event.stopPropagation();
          selectedState.update((curr) => (curr === state ? null : state));
        });

      svgEl
        .selectAll(`.dot-${state}`)
        .data(sortedValues)
        .enter()
        .append("circle")
        .attr("cx", (d) => x(d.year))
        .attr("cy", (d) => y(d.rank))
        .attr("fill", getStateColor(state))
        .attr("opacity", (d) => {
          if (currentSelectedYear === null) return isSelected ? 1 : 0.1;
          return d.year === currentSelectedYear ? 1 : 0.05;
        })
        .attr("r", currentSelectedState === state ? 12 : 8)
        .attr("class", `dot dot-${state}`);
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

<select bind:value={selectedRegion} onchange={() => redraw()}>
  <option value="All">All Regions</option>
  <option value="Midwest">Midwest</option>
  <option value="Northeast">Northeast</option>
  <option value="Southeast">Southeast</option>
  <option value="Southwest">Southwest</option>
  <option value="West">West</option>
</select>

<svg bind:this={svg} width="1200" height="800"></svg>
