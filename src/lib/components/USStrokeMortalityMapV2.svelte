<script lang="ts">
  // @ts-nocheck
  import { onMount } from "svelte";
  import * as d3 from "d3";
  import { asset } from "$app/paths";
  import { selectedState, selectedYear } from "$lib/stores";

  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";

  export let storyStep: number | null = null;
  export let storyMode: boolean = false;
  export let storyProgress: number = 0;

  $: storyProgress;

  let showInstructions = false;

  interface MortalityRow {
    state: string;
    year: number;
    mortality: number;
  }
  interface Centroid {
    code: string;
    x: number;
    y: number;
  }
  interface TooltipState {
    left: number;
    top: number;
    code: string;
    name: string;
    mortality: number | null;
    percentile: number | null;
  }
  const S2C: Record<string, string> = {
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
    Wyoming: "WY",
  };
  const C2S: Record<string, string> = {};
  for (const [n, c] of Object.entries(S2C)) C2S[c] = n;
  let containerEl: HTMLDivElement;
  let mapFeatures: GeoJSON.Feature[] = [];
  let mortalityRows: MortalityRow[] = [];
  let centroids: Centroid[] = [];
  let loading = true;
  let error: string | null = null;
  let tooltip: TooltipState | null = null;
  let mortalityByYear = new Map<number, MortalityRow[]>();
  let lastAppliedStoryStep = -1;
  const W = 1100, H = 560;
  const oX = 30,
    oY = 60;
  const formatM = d3.format(".1f");
  const fallbackYear = 2019;
  const DEFAULT_GUIDED_BOX_X = 670;
  const DEFAULT_GUIDED_BOX_Y = 60;
  function getName(f: GeoJSON.Feature): string {
    return f?.properties?.name ?? f?.properties?.NAME ?? "";
  }
  function getCode(f: GeoJSON.Feature): string | undefined {
    return S2C[getName(f)];
  }
  function parseRow(d: d3.DSVRowString): MortalityRow {
    return { state: d.State, year: +d.Year, mortality: +d.mortality };
  }
  function showTip(
    e: MouseEvent,
    code: string,
    mort: number | null,
    pct: number | null,
  ) {
    if (!containerEl) return;
    const b = containerEl.getBoundingClientRect();
    tooltip = {
      left: e.clientX - b.left + 14,
      top: e.clientY - b.top - 18,
      code,
      name: C2S[code] ?? code,
      mortality: mort,
      percentile: pct,
    };
  }
  function clearTip() {
    tooltip = null;
  }
  function doClick(code: string) {
    selectedState.update((c) => (c === code ? null : code));
  }
  function handleStateKeydown(event: KeyboardEvent, code: string | undefined) {
    if (!code) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    doClick(code);
  }
  function arcPath(cx: number, cy: number, r: number, pct: number): string {
    if (pct <= 0) return "";

    // full circle special case
    if (pct >= 0.999) {
      const xTop = cx;
      const yTop = cy - r;
      const xBottom = cx;
      const yBottom = cy + r;
      return [
        `M${xTop},${yTop}`,
        `A${r},${r},0,1,1,${xBottom},${yBottom}`,
        `A${r},${r},0,1,1,${xTop},${yTop}`,
      ].join(" ");
    }

    const angle = pct * 2 * Math.PI;
    const sa = -Math.PI / 2;
    const ea = sa + angle;

    const x1 = cx + r * Math.cos(sa);
    const y1 = cy + r * Math.sin(sa);
    const x2 = cx + r * Math.cos(ea);
    const y2 = cy + r * Math.sin(ea);

    return `M${x1},${y1} A${r},${r},0,${angle > Math.PI ? 1 : 0},1,${x2},${y2}`;
  }
  let projection: d3.GeoProjection;
  let pathGen: d3.GeoPath;
  onMount(async () => {
    try {
      const [rows, usStates] = await Promise.all([
        d3.csv(asset("/data/stroke_geo_clean_state.csv"), parseRow),
        d3.json(asset("/data/us-states.geojson")),
      ]);
      mortalityRows = rows.filter((r) => Number.isFinite(r.mortality));
      mortalityByYear = new Map(
        Array.from(d3.group(mortalityRows, (row) => row.year))
      );
      mapFeatures = (usStates as GeoJSON.FeatureCollection).features.filter(
        (f) => getName(f) !== "Puerto Rico",
      );
      projection = d3
      .geoAlbersUsa()
      .fitSize([W - 80, H - 150], {
          type: "FeatureCollection",
          features: mapFeatures,
        });
      pathGen = d3.geoPath(projection);
      centroids = mapFeatures
        .map((f) => {
          const code = getCode(f);
          if (!code) return null;
          const c = pathGen.centroid(f);
          if (!c || isNaN(c[0])) return null;
          return { code, x: c[0], y: c[1] };
        })
        .filter(Boolean) as Centroid[];
    } catch (e) {
      error = "Failed to load data.";
      console.error(e);
    } finally {
      loading = false;
    }
  });
  $: activeYear = $selectedYear ?? fallbackYear;

  $: msCentroid = centroids.find((c) => c.code === "MS");

  $: if (!storyMode) {
    lastAppliedStoryStep = -1;
  }
  $: if (storyMode && storyStep != null && storyStep !== lastAppliedStoryStep) {
    lastAppliedStoryStep = storyStep;
    if (storyStep === 5 && !dragging) {
      moveSelectionBox(DEFAULT_GUIDED_BOX_X, DEFAULT_GUIDED_BOX_Y, true);
    }
  }
  $: if (storyMode && storyStep === 6 && msCentroid && !dragging) {
    const target = getCenteredBoxCoordinates(msCentroid);
    const progress = cubicOut(
      Math.min(1, Math.max(0, (storyProgress - 0.04) / 0.58))
    );
    moveSelectionBox(
      DEFAULT_GUIDED_BOX_X + (target.x - DEFAULT_GUIDED_BOX_X) * progress,
      DEFAULT_GUIDED_BOX_Y + (target.y - DEFAULT_GUIDED_BOX_Y) * progress,
      true
    );
  }
  $: mortForYear = mortalityByYear.get(activeYear) ?? [];
  $: mortMap = new Map(mortForYear.map((r) => [r.state, r.mortality]));
  $: vals = mortForYear.map((r) => r.mortality);
  $: minM = d3.min(vals) ?? 0;
  $: maxM = d3.max(vals) ?? 1;
  $: colorScale = d3.scaleSequential(d3.interpolateReds).domain([minM, maxM]);
  $: percentileMap = (() => {
    const sorted = [...mortForYear].sort((a, b) => a.mortality - b.mortality);
    const m = new Map<string, number>();
    sorted.forEach((r, i) => {
      m.set(r.state, (i + 1) / sorted.length);
    });
    return m;
  })();
  const tileGlyphR = 18,
    tileRingR = 24;
  // Draggable box
  const boxX = tweened(DEFAULT_GUIDED_BOX_X, { duration: 600, easing: cubicOut });
  const boxY = tweened(DEFAULT_GUIDED_BOX_Y, { duration: 600, easing: cubicOut });

  let boxW = 220,
    boxH = 280;

  let dragging: "move" | "resize" | null = null;
  let dragStart = { mx: 0, my: 0, bx: 0, by: 0, bw: 0, bh: 0 };
  function svgPt(e: MouseEvent) {
    const b = containerEl.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  }
  function startMove(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragging = "move";
    const p = svgPt(e);
    dragStart = { mx: p.x, my: p.y, bx: $boxX, by: $boxY, bw: boxW, bh: boxH };
    window.addEventListener("mousemove", onDrag);
    window.addEventListener("mouseup", endDrag);
  }
  function startResize(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragging = "resize";
    const p = svgPt(e);
    dragStart = { mx: p.x, my: p.y, bx: $boxX, by: $boxY, bw: boxW, bh: boxH };
    window.addEventListener("mousemove", onDrag);
    window.addEventListener("mouseup", endDrag);
  }
  function onDrag(e: MouseEvent) {
    const p = svgPt(e),
      dx = p.x - dragStart.mx,
      dy = p.y - dragStart.my;
    if (dragging === "move") {
      boxX.set(Math.max(0, Math.min(W - boxW, dragStart.bx + dx)));
      boxY.set(Math.max(0, Math.min(H - boxH, dragStart.by + dy)));
    } else {
      boxW = Math.max(100, Math.min(550, dragStart.bw + dx));
      boxH = Math.max(100, Math.min(550, dragStart.bh + dy));
    }
  }
  function endDrag() {
    dragging = null;
    window.removeEventListener("mousemove", onDrag);
    window.removeEventListener("mouseup", endDrag);
  }

  function moveSelectionBox(
    x: number,
    y: number,
    instant = false,
    durationOverride?: number
  ) {
    const duration = instant ? 0 : (durationOverride ?? 600);
    boxX.set(x, { duration, easing: cubicOut });
    boxY.set(y, { duration, easing: cubicOut });
  }

  function getCenteredBoxCoordinates(centroid: Centroid) {
    const cx = centroid.x + oX;
    const cy = centroid.y + oY;

    const targetX = cx - boxW / 2;
    const targetY = cy - boxH / 2;

    return {
      x: Math.max(0, Math.min(W - boxW, targetX)),
      y: Math.max(0, Math.min(H - boxH, targetY)),
    };
  }

  function centerSelectionBoxOnState(
    centroid: Centroid,
    instant = false,
    durationOverride?: number
  ) {
    const { x, y } = getCenteredBoxCoordinates(centroid);
    moveSelectionBox(x, y, instant, durationOverride);
  }
  $: insideStates = centroids
    .filter((c) => {
      const cx = c.x + oX,
        cy = c.y + oY;
      return (
        cx >= $boxX && cx <= $boxX + boxW && cy >= $boxY && cy <= $boxY + boxH
      );
    })
    .sort((a, b) => {
      const ma = mortMap.get(a.code) ?? Number.POSITIVE_INFINITY;
      const mb = mortMap.get(b.code) ?? Number.POSITIVE_INFINITY;
      return d3.ascending(ma, mb) || d3.ascending(a.code, b.code);
    });

  $: panelPos = (() => {
    const tileCell = 68,
      tileGap = 5,
      tileStep = tileCell + tileGap;
    const cols = Math.min(4, Math.max(1, insideStates.length));
    const rows = Math.ceil(insideStates.length / cols);
    const pw = cols * tileStep + 28,
      ph = rows * tileStep + 42;
    const bcx = $boxX + boxW / 2;
    let px = bcx > W / 2 ? $boxX - pw - 24 : $boxX + boxW + 24;
    let py = $boxY + boxH / 2 - ph / 2;
    px = Math.max(8, Math.min(W - pw - 8, px));
    py = Math.max(8, Math.min(H - ph - 8, py));
    return { x: px, y: py, w: pw, h: ph, cols, tileStep, tileCell };
  })();
  $: connector = (() => {
    const pp = panelPos;
    if (pp.x > $boxX + boxW)
      return {
        x1: $boxX + boxW,
        y1: $boxY + boxH / 2,
        x2: pp.x,
        y2: pp.y + pp.h / 2,
      };
    return {
      x1: $boxX,
      y1: $boxY + boxH / 2,
      x2: pp.x + pp.w,
      y2: pp.y + pp.h / 2,
    };
  })();
  // Glyph legend example color
  $: exColor = colorScale((minM + maxM) * 0.6);
</script>

{#if loading}
  <p>Loading visualization...</p>
{:else if error}
  <p>{error}</p>
{:else}
  <div class="map-shell">
    <div class="map-header-row">
  <p class="map-caption">
    {#if $selectedYear === null}
      Showing {fallbackYear} until a different year is chosen in Visualization 1.
    {:else}
      Year selected in Visualization 1: {$selectedYear}
    {/if}
  </p>
  <button class="info-btn" onclick={() => showInstructions = !showInstructions}>ℹ</button>
</div>

{#if showInstructions}
  <div class="instructions-popup">
    <button class="close-btn" onclick={() => showInstructions = false}>✕</button>
    <p>Each state in the selector box is shown as a glyph: fill color = mortality rate, outer ring = national percentile.</p>
    <p>Drag the blue selector box to explore any region. States inside are shown with glyph detail.</p>
    <p>Click any state to highlight it.</p>
  </div>
{/if}

    <div class="map-container" bind:this={containerEl}>
      <svg
      viewBox="0 0 {W} {H}"
      preserveAspectRatio="xMidYMid meet"
      style="width:100%; height:auto; display:block;"
      aria-label="US stroke mortality interactive glyph map"
      >
        <rect width={W} height={H} fill="#fff" />

        <text x={24} y={30} font-size="20" font-weight="700" fill="#333"
          >Stroke Mortality by State, {activeYear}</text
        >
        

        <!-- Choropleth only — no glyphs on map -->
        <g transform="translate({oX},{oY})">
          {#each mapFeatures as feature}
            {@const code = getCode(feature)}
            {@const mort = code ? (mortMap.get(code) ?? null) : null}
            {@const isSel = code === $selectedState}
            {@const dim = $selectedState !== null && !isSel}
            <path
              d={pathGen(feature)}
              fill={mort !== null ? colorScale(mort) : "#f3d7d4"}
              stroke="#fff"
              stroke-width={isSel ? 2.5 : 0.8}
              opacity={dim ? 0.5 : 1}
              role="button"
              tabindex="0"
              aria-label={code ? `Select ${C2S[code] ?? code}` : "Select state"}
              style="cursor:pointer;"
              onmouseenter={(e) =>
                code && showTip(e, code, mort, percentileMap.get(code) ?? null)}
              onmousemove={(e) =>
                code && showTip(e, code, mort, percentileMap.get(code) ?? null)}
              onmouseleave={clearTip}
              onclick={() => code && doClick(code)}
              onkeydown={(e) => handleStateKeydown(e, code)}
            />
          {/each}
        </g>

        <!-- Selection box -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <rect
          x={$boxX}
          y={$boxY}
          width={boxW}
          height={boxH}
          fill="rgba(61,90,128,0.05)"
          stroke="#3d5a80"
          stroke-width="2"
          stroke-dasharray="8,4"
          rx="6"
          aria-hidden="true"
          style="cursor:grab;"
          onmousedown={startMove}
        />
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <g
          transform="translate({$boxX + boxW - 16},{$boxY + boxH - 16})"
          aria-hidden="true"
          style="cursor:nwse-resize;"
          onmousedown={startResize}
        >
          <rect width="18" height="18" fill="rgba(61,90,128,0.12)" rx="3" />
          <text x="4" y="14" font-size="12" fill="#3d5a80">◢</text>
        </g>
        <text
          x={$boxX + 6}
          y={$boxY - 6}
          font-size="10"
          fill="#3d5a80"
          font-weight="600"
        >
          {insideStates.length} state{insideStates.length !== 1 ? "s" : ""} in view
        </text>

        <!-- Connector -->
        {#if insideStates.length > 0}
          <line
            x1={connector.x1}
            y1={connector.y1}
            x2={connector.x2}
            y2={connector.y2}
            stroke="#8ea8c3"
            stroke-width="1.5"
            stroke-dasharray="5,3"
            opacity="0.55"
          />
        {/if}

        <!-- Detail panel with glyphs -->
        {#if insideStates.length > 0}
          <g transform="translate({panelPos.x},{panelPos.y})">
            <rect
              x="-12"
              y="-30"
              width={panelPos.w}
              height={panelPos.h}
              rx="12"
              ry="12"
              fill="rgba(255,255,255,0.97)"
              stroke="#c0c0c0"
              stroke-width="1"
              filter="url(#pshadow)"
            />
            <text
              x="0"
              y="-12"
              font-size="11.5"
              font-weight="600"
              fill="#3d5a80">Region Detail</text
            >
            <text x="95" y="-12" font-size="9.5" fill="#999"
              >sorted by mortality ↑</text
            >

            {#each insideStates as st, i}
              {@const col = i % panelPos.cols}
              {@const row = Math.floor(i / panelPos.cols)}
              {@const mort = mortMap.get(st.code) ?? null}
              {@const pct = percentileMap.get(st.code) ?? 0}
              {@const tx = col * panelPos.tileStep}
              {@const ty = row * panelPos.tileStep}
              {@const mx = tx + panelPos.tileCell / 2}
              {@const my = ty + panelPos.tileCell / 2}
              {@const isSel = $selectedState === st.code}
              {@const dim = $selectedState !== null && !isSel}
              {@const dark = mort !== null && mort > (minM + maxM) * 0.55}
              <g
                class="tile"
                role="button"
                tabindex="0"
                aria-label={`Highlight ${C2S[st.code] ?? st.code}`}
                style="cursor:pointer;"
                opacity={dim ? 0.4 : 1}
                onmouseenter={(e) => showTip(e, st.code, mort, pct)}
                onmousemove={(e) => showTip(e, st.code, mort, pct)}
                onmouseleave={clearTip}
                onclick={() => doClick(st.code)}
                onkeydown={(e) => handleStateKeydown(e, st.code)}
              >
                <rect
                  x={tx}
                  y={ty}
                  width={panelPos.tileCell}
                  height={panelPos.tileCell}
                  rx="6"
                  ry="6"
                  fill="#f8f8f8"
                  stroke={isSel ? "#222" : "#e8e8e8"}
                  stroke-width={isSel ? 2 : 1}
                />
                <circle
                  cx={mx}
                  cy={my}
                  r={tileRingR}
                  fill="none"
                  stroke="#e0e0e0"
                  stroke-width="4"
                />
                <path
                  d={arcPath(mx, my, tileRingR, pct)}
                  fill="none"
                  stroke="#3d5a80"
                  stroke-width="4"
                  stroke-linecap="round"
                />
                {#if mort !== null}
                  <circle
                    cx={mx}
                    cy={my}
                    r={tileGlyphR}
                    fill={colorScale(mort)}
                    stroke="#fff"
                    stroke-width="1.5"
                  />
                {/if}
                <text
                  x={mx}
                  y={my + 4}
                  text-anchor="middle"
                  font-size="10"
                  font-weight="700"
                  fill={dark ? "#fff" : "#333"}>{st.code}</text
                >
                {#if mort !== null}
                  <text
                    x={mx}
                    y={ty + panelPos.tileCell - 3}
                    text-anchor="middle"
                    font-size="8"
                    fill="#666">{formatM(mort)}</text
                  >
                {/if}
              </g>
            {/each}
          </g>
        {/if}

        <defs>
          <filter id="pshadow" x="-8%" y="-8%" width="120%" height="120%">
            <feDropShadow dx="0" dy="3" stdDeviation="6" flood-opacity="0.12" />
          </filter>
          <linearGradient id="glg" x1="0%" x2="100%" y1="0%" y2="0%">
            {#each d3.range(0, 1.01, 0.1) as stop}
              <stop
                offset="{stop * 100}%"
                stop-color={d3.interpolateReds(stop)}
              />
            {/each}
          </linearGradient>
        </defs>

        <!-- Color legend (bottom right) -->
        <text x={W - 270} y={H - 100} font-size="12" fill="#555">Mortality</text>
        <rect
          x={W - 270}
          y={H - 85}
          width="220"
          height="12"
          fill="url(#glg)"
          stroke="#d9d9d9"
        />
        <text x={W - 270} y={H - 60} font-size="11" fill="#666"
          >{formatM(minM)}</text
        >
        <text x={W - 50} y={H - 60} font-size="11" fill="#666" text-anchor="end"
          >{formatM(maxM)}</text
        >
       </svg>
      {#if tooltip}
        <div
          class="tooltip"
          style:left={`${tooltip.left}px`}
          style:top={`${tooltip.top}px`}
        >
          <strong>{tooltip.name} ({tooltip.code})</strong>
          {#if tooltip.mortality !== null}<div>
              Mortality: {formatM(tooltip.mortality)}
            </div>{/if}
          {#if tooltip.percentile !== null}<div>
              Percentile: {Math.round(tooltip.percentile * 100)}%
            </div>{/if}
        </div>
      {/if}
    </div> 

      <!-- Glyph legend BELOW the SVG, never overlaps map -->
      <div class="glyph-legend">
        <div class="legend-title">How to read the glyph</div>
        <div class="legend-content">
          <svg width="56" height="56">
            <circle
              cx="28"
              cy="28"
              r="24"
              fill="none"
              stroke="#e0e0e0"
              stroke-width="4"
            />
            <path
              d={arcPath(28, 28, 24, 0.75)}
              fill="none"
              stroke="#3d5a80"
              stroke-width="4"
              stroke-linecap="round"
            />
            <circle
              cx="28"
              cy="28"
              r="17"
              fill={exColor}
              stroke="#fff"
              stroke-width="1.5"
            />
            <text
              x="28"
              y="32"
              text-anchor="middle"
              font-size="9"
              font-weight="700"
              fill="#fff">XX</text
            >
          </svg>
          <div class="legend-labels">
            <div>
              <span class="swatch" style="background:{exColor};"></span> fill = current
              mortality
            </div>
            <div>
              <span class="swatch ring"></span> outer ring = national percentile
            </div>
            <div class="ring-ref">
              <svg width="110" height="12">
                <line
                  x1="0"
                  y1="6"
                  x2="25"
                  y2="6"
                  stroke="#e0e0e0"
                  stroke-width="3"
                />
                <text x="28" y="9" font-size="9" fill="#888">0%</text>
                <line
                  x1="50"
                  y1="6"
                  x2="75"
                  y2="6"
                  stroke="#3d5a80"
                  stroke-width="3"
                />
                <text x="78" y="9" font-size="9" fill="#888">100%</text>
              </svg>
            </div>
          </div>
        </div>
      </div>

</div> 
{/if}




<style>
.map-shell {
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 8px;
  color: var(--story-text, #241419);
}

  .map-caption {
    margin: 0;
    color: var(--story-muted, #6f5960);
    font-size: 0.95rem;
  }
  .map-container {
  position: relative;
  flex: 1;
  min-height: 0;
  max-height: 80%;
  border: 1px solid var(--story-border, #e8d2cb);
  border-radius: 18px;
  background: #fffdfb;
  overflow: hidden;
}


  .glyph-legend {
    padding: 12px 20px 14px;
    border-top: 1px solid var(--story-border, #e8d2cb);
  }
  .legend-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--story-text, #241419);
    margin-bottom: 6px;
  }
  .legend-content {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .legend-labels {
    font-size: 11px;
    color: var(--story-muted, #6f5960);
    line-height: 1.6;
  }
  .swatch {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    vertical-align: middle;
    margin-right: 4px;
  }
  .swatch.ring {
    background: none;
    border: 3px solid #3d5a80;
    width: 10px;
    height: 10px;
  }
  .ring-ref {
    margin-top: 2px;
  }
  .tile {
    transition: opacity 0.15s ease;
  }
  .tile:hover rect {
    filter: brightness(0.95);
  }
  .tooltip {
    position: absolute;
    pointer-events: none;
    min-width: 150px;
    padding: 0.65rem 0.8rem;
    border-radius: 14px;
    background: rgba(255, 253, 251, 0.97);
    color: var(--story-text, #241419);
    border: 1px solid var(--story-border, #e8d2cb);
    box-shadow: 0 10px 24px rgba(53, 18, 22, 0.12);
    font-size: 0.92rem;
    line-height: 1.4;
    transform: translateY(-100%);
  }
  svg {
    display: block;
  }
  .map-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  z-index: 5;
}

.info-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--story-border-strong, #cc5368);
  background: #fff8f6;
  color: var(--story-accent-strong, #8e0f27);
  cursor: pointer;
  font-size: 14px;
  flex-shrink: 0;
}

.instructions-popup {
  position: absolute;
  top: 36px;
  right: 0;
  z-index: 20;
  background: #fffdfb;
  border: 1px solid var(--story-border, #e8d2cb);
  border-radius: 16px;
  padding: 16px 18px;
  box-shadow: 0 14px 32px rgba(61, 20, 24, 0.14);
  max-width: 320px;
  font-size: 0.88rem;
  line-height: 1.6;
  color: var(--story-muted, #6f5960);
}

.instructions-popup p { margin: 0 0 8px 0; }

.close-btn {
  position: absolute;
  top: 8px;
  right: 10px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 13px;
  color: var(--story-accent-strong, #8e0f27);
}
</style>
