<script lang="ts">
  // @ts-nocheck
  import { onMount } from "svelte";
  import * as d3 from "d3";
  import { asset } from "$app/paths";
  import { selectedState, selectedYear } from "$lib/stores";

  interface MortalityRow {
    state: string;
    year: number;
    mortality: number;
  }

  interface TooltipState {
    left: number;
    top: number;
    stateName: string;
    mortality: number;
  }

  const STATE_NAME_TO_CODE: Record<string, string> = {
    Alabama: "AL",
    Alaska: "AK",
    Arizona: "AZ",
    Arkansas: "AR",
    California: "CA",
    Colorado: "CO",
    Connecticut: "CT",
    Delaware: "DE",
    "District of Columbia": "DC",
    Florida: "FL",
    Georgia: "GA",
    Hawaii: "HI",
    Idaho: "ID",
    Illinois: "IL",
    Indiana: "IN",
    Iowa: "IA",
    Kansas: "KS",
    Kentucky: "KY",
    Louisiana: "LA",
    Maine: "ME",
    Maryland: "MD",
    Massachusetts: "MA",
    Michigan: "MI",
    Minnesota: "MN",
    Mississippi: "MS",
    Missouri: "MO",
    Montana: "MT",
    Nebraska: "NE",
    Nevada: "NV",
    "New Hampshire": "NH",
    "New Jersey": "NJ",
    "New Mexico": "NM",
    "New York": "NY",
    "North Carolina": "NC",
    "North Dakota": "ND",
    Ohio: "OH",
    Oklahoma: "OK",
    Oregon: "OR",
    Pennsylvania: "PA",
    "Rhode Island": "RI",
    "South Carolina": "SC",
    "South Dakota": "SD",
    Tennessee: "TN",
    Texas: "TX",
    Utah: "UT",
    Vermont: "VT",
    Virginia: "VA",
    Washington: "WA",
    "West Virginia": "WV",
    Wisconsin: "WI",
    Wyoming: "WY"
  };

  let svg: SVGSVGElement;
  let containerEl: HTMLDivElement;
  let geoData: GeoJSON.FeatureCollection | null = null;
  let mapFeatures: GeoJSON.Feature[] = [];
  let mortalityRows: MortalityRow[] = [];
  let loading = true;
  let error: string | null = null;
  let tooltip: TooltipState | null = null;

  const width = 1100;
  const height = 700;
  const formatMortality = d3.format(".1f");
  const fallbackYear = 2019;

  function getFeatureName(feature: GeoJSON.Feature | null | undefined): string {
    const properties = feature?.properties ?? {};
    return properties.name ?? properties.NAME ?? "";
  }

  function getFeatureStateCode(feature: GeoJSON.Feature | null | undefined): string | undefined {
    const name = getFeatureName(feature);
    return STATE_NAME_TO_CODE[name];
  }

  function parseRow(d: d3.DSVRowString): MortalityRow {
    return {
      state: d.State,
      year: +d.Year,
      mortality: +d.mortality
    };
  }

  function updateTooltip(
    event: MouseEvent,
    feature: GeoJSON.Feature,
    mortality: number | null
  ) {
    if (!containerEl || mortality === null) return;

    const bounds = containerEl.getBoundingClientRect();
    tooltip = {
      left: event.clientX - bounds.left + 14,
      top: event.clientY - bounds.top - 18,
      stateName: getFeatureName(feature) || "Unknown",
      mortality
    };
  }

  function clearTooltip() {
    tooltip = null;
  }

  function draw() {
    if (!svg || !geoData || mapFeatures.length === 0 || mortalityRows.length === 0) return;

    const activeYear = $selectedYear ?? fallbackYear;
    const mortalityForYear = mortalityRows.filter((row) => row.year === activeYear);

    const mortalityByState = new Map(
      mortalityForYear.map((row) => [row.state, row.mortality])
    );

    const values = mortalityForYear.map((row) => row.mortality);
    const minMortality = d3.min(values) ?? 0;
    const maxMortality = d3.max(values) ?? 1;

    console.log("[Vis2] activeYear", activeYear);
    console.log("[Vis2] mortalityForYear", mortalityForYear);

    const colorScale = d3
      .scaleSequential(d3.interpolateReds)
      .domain([minMortality, maxMortality]);

    const projection = d3
      .geoAlbersUsa()
      .fitSize([width - 40, height - 40], {
        type: "FeatureCollection",
        features: mapFeatures
      });

    const path = d3.geoPath(projection);
    const svgEl = d3.select(svg);

    svgEl.selectAll("*").remove();

    svgEl
      .append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "#ffffff");

    svgEl
      .append("text")
      .attr("x", 24)
      .attr("y", 34)
      .attr("font-size", 20)
      .attr("font-weight", 700)
      .attr("fill", "#333")
      .text(`Stroke Mortality by State, ${activeYear}`);

    svgEl
      .append("text")
      .attr("x", 24)
      .attr("y", 56)
      .attr("font-size", 12)
      .attr("fill", "#666")
      .text("Hover a state to inspect mortality.");

    svgEl
      .append("g")
      .attr("transform", "translate(20, 24)")
      .selectAll("path")
      .data(mapFeatures)
      .enter()
      .append("path")
      .attr("d", (feature) => {
        const pathData = path(feature);
        console.log("[Vis2] path feature", getFeatureName(feature), {
          code: getFeatureStateCode(feature),
          pathExists: Boolean(pathData)
        });
        return pathData;
      })
      .attr("fill", (feature) => {
        const code = getFeatureStateCode(feature);
        const mortality = code ? mortalityByState.get(code) : undefined;
        console.log("[Vis2] state fill", getFeatureName(feature), {
          code,
          mortality,
          fill: mortality === undefined ? "#f3d7d4" : colorScale(mortality)
        });
        return mortality === undefined ? "#f3d7d4" : colorScale(mortality);
      })
      .attr("stroke", "#ffffff")
      .attr("stroke-width", (feature) => {
        const code = getFeatureStateCode(feature);
        return code && code === $selectedState ? 2.5 : 1;
      })
      .attr("opacity", (feature) => {
        if (!$selectedState) return 1;
        const code = getFeatureStateCode(feature);
        return code === $selectedState ? 1 : 0.55;
      })
      .style("cursor", "pointer")
      .on("mouseenter", function (event, feature) {
        const code = getFeatureStateCode(feature);
        const mortality = code ? mortalityByState.get(code) ?? null : null;
        updateTooltip(event, feature, mortality);
      })
      .on("mousemove", function (event, feature) {
        const code = getFeatureStateCode(feature);
        const mortality = code ? mortalityByState.get(code) ?? null : null;
        updateTooltip(event, feature, mortality);
      })
      .on("mouseleave", clearTooltip)
      .on("click", function (event, feature) {
        event.stopPropagation();
        const code = getFeatureStateCode(feature);
        if (!code) return;
        selectedState.update((current) => (current === code ? null : code));
      });

    const legendWidth = 220;
    const legendHeight = 12;
    const legendX = width - legendWidth - 36;
    const legendY = height - 58;
    const legendId = "vis2-legend-gradient";

    const defs = svgEl.append("defs");
    const gradient = defs
      .append("linearGradient")
      .attr("id", legendId)
      .attr("x1", "0%")
      .attr("x2", "100%")
      .attr("y1", "0%")
      .attr("y2", "0%");

    d3.range(0, 1.01, 0.1).forEach((stop) => {
      gradient
        .append("stop")
        .attr("offset", `${stop * 100}%`)
        .attr("stop-color", d3.interpolateReds(stop));
    });

    svgEl
      .append("rect")
      .attr("x", legendX)
      .attr("y", legendY)
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .attr("fill", `url(#${legendId})`)
      .attr("stroke", "#d9d9d9");

    svgEl
      .append("text")
      .attr("x", legendX)
      .attr("y", legendY - 8)
      .attr("font-size", 12)
      .attr("fill", "#555")
      .text("Mortality");

    svgEl
      .append("text")
      .attr("x", legendX)
      .attr("y", legendY + 28)
      .attr("font-size", 11)
      .attr("fill", "#666")
      .text(formatMortality(minMortality));

    svgEl
      .append("text")
      .attr("x", legendX + legendWidth)
      .attr("y", legendY + 28)
      .attr("font-size", 11)
      .attr("fill", "#666")
      .attr("text-anchor", "end")
      .text(formatMortality(maxMortality));
  }

  onMount(async () => {
    try {
      const [rows, usStates] = await Promise.all([
        d3.csv(asset("/data/stroke_geo_clean_state.csv"), parseRow),
        d3.json(asset("/data/us-states.geojson"))
      ]);

      mortalityRows = rows.filter((row) => Number.isFinite(row.mortality));
      geoData = usStates as GeoJSON.FeatureCollection;
      mapFeatures = (geoData.features ?? [])
        .filter((feature) => getFeatureName(feature) !== "Puerto Rico")
        .map((feature) => ({
          ...feature,
          properties: {
            ...(feature.properties ?? {})
          }
        }));

      console.log("[Vis2] loaded geojson", {
        featureCount: mapFeatures.length,
        sampleFeatures: mapFeatures.slice(0, 5).map((feature) => ({
          name: getFeatureName(feature),
          geometryType: feature.geometry?.type
        }))
      });
    } catch (e) {
      error = "Failed to load visualization 2 data.";
      console.error(e);
    } finally {
      loading = false;
    }
  });

  $: if (!loading && svg && geoData && mapFeatures.length > 0 && mortalityRows.length > 0) {
    $selectedYear;
    $selectedState;
    draw();
  }
</script>

{#if loading}
  <p>Loading visualization 2...</p>
{:else if error}
  <p>{error}</p>
{:else}
  <div class="map-shell">
    <p class="map-caption">
      {#if $selectedYear === null}
        Showing {fallbackYear} until a different year is chosen in Visualization 1.
      {:else}
        Year selected in Visualization 1: {$selectedYear}
      {/if}
    </p>

    <div class="map-container" bind:this={containerEl}>
      <svg bind:this={svg} width={width} height={height} aria-label="US stroke mortality choropleth map"></svg>

      {#if tooltip}
        <div
          class="tooltip"
          style:left={`${tooltip.left}px`}
          style:top={`${tooltip.top}px`}
        >
          <strong>{tooltip.stateName}</strong>
          <div>Mortality: {formatMortality(tooltip.mortality)}</div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .map-shell {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .map-caption {
    margin: 0;
    color: #555;
    font-size: 0.95rem;
  }

  .map-container {
    position: relative;
    display: inline-block;
    max-width: 100%;
    border: 1px solid #d9d9d9;
    border-radius: 14px;
    background: #fff;
    overflow: auto;
  }

  .tooltip {
    position: absolute;
    pointer-events: none;
    min-width: 140px;
    padding: 0.65rem 0.8rem;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.97);
    color: #333;
    border: 1px solid #d5d5d5;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
    font-size: 0.92rem;
    line-height: 1.35;
    transform: translateY(-100%);
  }
  svg {
    display: block;
  }
</style>
