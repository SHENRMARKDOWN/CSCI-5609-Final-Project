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

  

  interface MortalityRow { state: string; year: number; mortality: number; }
  interface Centroid { code: string; x: number; y: number; }
  interface TooltipState { left: number; top: number; code: string; name: string; mortality: number | null; percentile: number | null; }
  const S2C: Record<string,string> = {
    Alabama:"AL",Alaska:"AK",Arizona:"AZ",Arkansas:"AR",California:"CA",
    Colorado:"CO",Connecticut:"CT",Delaware:"DE","District of Columbia":"DC",
    Florida:"FL",Georgia:"GA",Hawaii:"HI",Idaho:"ID",Illinois:"IL",
    Indiana:"IN",Iowa:"IA",Kansas:"KS",Kentucky:"KY",Louisiana:"LA",
    Maine:"ME",Maryland:"MD",Massachusetts:"MA",Michigan:"MI",Minnesota:"MN",
    Mississippi:"MS",Missouri:"MO",Montana:"MT",Nebraska:"NE",Nevada:"NV",
    "New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY",
    "North Carolina":"NC","North Dakota":"ND",Ohio:"OH",Oklahoma:"OK",
    Oregon:"OR",Pennsylvania:"PA","Rhode Island":"RI","South Carolina":"SC",
    "South Dakota":"SD",Tennessee:"TN",Texas:"TX",Utah:"UT",Vermont:"VT",
    Virginia:"VA",Washington:"WA","West Virginia":"WV",Wisconsin:"WI",Wyoming:"WY"
  };
  const C2S: Record<string,string> = {};
  for (const [n,c] of Object.entries(S2C)) C2S[c] = n;
  let containerEl: HTMLDivElement;
  let mapFeatures: GeoJSON.Feature[] = [];
  let mortalityRows: MortalityRow[] = [];
  let centroids: Centroid[] = [];
  let loading = true;
  let error: string | null = null;
  let tooltip: TooltipState | null = null;
  const W = 1100, H = 700;
  const oX = 30, oY = 60;
  const formatM = d3.format(".1f");
  const fallbackYear = 2019;
  function getName(f: GeoJSON.Feature): string { return f?.properties?.name ?? f?.properties?.NAME ?? ""; }
  function getCode(f: GeoJSON.Feature): string | undefined { return S2C[getName(f)]; }
  function parseRow(d: d3.DSVRowString): MortalityRow { return { state: d.State, year: +d.Year, mortality: +d.mortality }; }
  function showTip(e: MouseEvent, code: string, mort: number|null, pct: number|null) {
    if (!containerEl) return;
    const b = containerEl.getBoundingClientRect();
    tooltip = { left: e.clientX - b.left + 14, top: e.clientY - b.top - 18, code, name: C2S[code]??code, mortality: mort, percentile: pct };
  }
  function clearTip() { tooltip = null; }
  function doClick(code: string) { selectedState.update(c => c === code ? null : code); }
  function arcPath(cx: number, cy: number, r: number, pct: number): string {
    if (pct <= 0) return "";
    const angle = Math.min(pct, 1) * 2 * Math.PI;
    const sa = -Math.PI / 2, ea = sa + angle;
    const x1 = cx + r * Math.cos(sa), y1 = cy + r * Math.sin(sa);
    const x2 = cx + r * Math.cos(ea), y2 = cy + r * Math.sin(ea);
    return `M${x1},${y1}A${r},${r},0,${angle > Math.PI ? 1 : 0},1,${x2},${y2}`;
  }
  let projection: d3.GeoProjection;
  let pathGen: d3.GeoPath;
  onMount(async () => {
    try {
      const [rows, usStates] = await Promise.all([
        d3.csv(asset("/data/stroke_geo_clean_state.csv"), parseRow),
        d3.json(asset("/data/us-states.geojson"))
      ]);
      mortalityRows = rows.filter(r => Number.isFinite(r.mortality));
      mapFeatures = (usStates as GeoJSON.FeatureCollection).features.filter(f => getName(f) !== "Puerto Rico");
      projection = d3.geoAlbersUsa().fitSize([W - 80, H - 120], { type: "FeatureCollection", features: mapFeatures });
      pathGen = d3.geoPath(projection);
      centroids = mapFeatures.map(f => {
        const code = getCode(f);
        if (!code) return null;
        const c = pathGen.centroid(f);
        if (!c || isNaN(c[0])) return null;
        return { code, x: c[0], y: c[1] };
      }).filter(Boolean) as Centroid[];
    } catch (e) { error = "Failed to load data."; console.error(e); }
    finally { loading = false; }
  });
  $: activeYear = $selectedYear ?? fallbackYear;

  $: msCentroid = centroids.find(c => c.code === "MS");

  $: if (storyMode && storyStep != null) {
  if (storyStep === 5) {
    selectedState.set(null);
    selectedYear.set(2019);
  }

  if (storyStep === 6 && msCentroid) {
    selectedState.set("MS");
    selectedYear.set(2019);

    const cx = msCentroid.x + oX;
    const cy = msCentroid.y + oY;

    const targetX = cx - boxW / 2;
    const targetY = cy - boxH / 2;
    
    const clampedX = Math.max(0, Math.min(W - boxW, targetX));
    const clampedY = Math.max(0, Math.min(H - boxH, targetY));
    
    boxX.set(clampedX);
    boxY.set(clampedY);
  }
}
  $: mortForYear = mortalityRows.filter(r => r.year === activeYear);
  $: mortMap = new Map(mortForYear.map(r => [r.state, r.mortality]));
  $: vals = mortForYear.map(r => r.mortality);
  $: minM = d3.min(vals) ?? 0;
  $: maxM = d3.max(vals) ?? 1;
  $: colorScale = d3.scaleSequential(d3.interpolateReds).domain([minM, maxM]);
  $: percentileMap = (() => {
    const sorted = [...mortForYear].sort((a, b) => a.mortality - b.mortality);
    const m = new Map<string, number>();
    sorted.forEach((r, i) => { m.set(r.state, (i + 1) / sorted.length); });
    return m;
  })();
  const tileGlyphR = 18, tileRingR = 24;
  // Draggable box
  const boxX = tweened(670, { duration: 600, easing: cubicOut });
  const boxY = tweened(60, { duration: 600, easing: cubicOut });
  
  let boxW = 220, boxH = 280;

  let dragging: "move"|"resize"|null = null;
  let dragStart = { mx: 0, my: 0, bx: 0, by: 0, bw: 0, bh: 0 };
  function svgPt(e: MouseEvent) {
    const b = containerEl.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  }
  function startMove(e: MouseEvent) {
    e.preventDefault(); e.stopPropagation(); dragging = "move";
    const p = svgPt(e);
    dragStart = { mx: p.x, my: p.y, bx: $boxX, by: $boxY, bw: boxW, bh: boxH };
    window.addEventListener("mousemove", onDrag); window.addEventListener("mouseup", endDrag);
  }
  function startResize(e: MouseEvent) {
    e.preventDefault(); e.stopPropagation(); dragging = "resize";
    const p = svgPt(e);
    dragStart = { mx: p.x, my: p.y, bx: $boxX, by: $boxY, bw: boxW, bh: boxH };
    window.addEventListener("mousemove", onDrag); window.addEventListener("mouseup", endDrag);
  }
  function onDrag(e: MouseEvent) {
    const p = svgPt(e), dx = p.x - dragStart.mx, dy = p.y - dragStart.my;
    if (dragging === "move") {
      boxX.set(Math.max(0, Math.min(W - boxW, dragStart.bx + dx)));
      boxY.set(Math.max(0, Math.min(H - boxH, dragStart.by + dy)));
    } else {
      boxW = Math.max(100, Math.min(550, dragStart.bw + dx));
      boxH = Math.max(100, Math.min(550, dragStart.bh + dy));
    }
  }
  function endDrag() { dragging = null; window.removeEventListener("mousemove", onDrag); window.removeEventListener("mouseup", endDrag); }
  $: insideStates = centroids
  .filter(c => {
    const cx = c.x + oX, cy = c.y + oY;
    return cx >= $boxX && cx <= $boxX + boxW && cy >= $boxY && cy <= $boxY + boxH;
  })

  $: panelPos = (() => {
    const tileCell = 68, tileGap = 5, tileStep = tileCell + tileGap;
    const cols = Math.min(4, Math.max(1, insideStates.length));
    const rows = Math.ceil(insideStates.length / cols);
    const pw = cols * tileStep + 28, ph = rows * tileStep + 42;
    const bcx = $boxX + boxW / 2;
    let px = bcx > W / 2 ? $boxX - pw - 24 : $boxX + boxW + 24;
    let py = $boxY + boxH / 2 - ph / 2;
    px = Math.max(8, Math.min(W - pw - 8, px));
    py = Math.max(8, Math.min(H - ph - 8, py));
    return { x: px, y: py, w: pw, h: ph, cols, tileStep, tileCell };
  })();
  $: connector = (() => {
    const pp = panelPos;
    if (pp.x > $boxX + boxW) return { x1: $boxX + boxW, y1: $boxY + boxH/2, x2: pp.x, y2: pp.y + pp.h/2 };
    return { x1: $boxX, y1: $boxY + boxH/2, x2: pp.x + pp.w, y2: pp.y + pp.h/2 };
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
    <p class="map-caption">
      {#if $selectedYear === null}
        Showing {fallbackYear} until a different year is chosen in Visualization 1.
      {:else}
        Year selected in Visualization 1: {$selectedYear}
      {/if}
    </p>

    <div class="map-container" bind:this={containerEl}>
      <svg width={W} height={H} aria-label="US stroke mortality interactive glyph map">
        <rect width={W} height={H} fill="#fff" />

        <text x={24} y={30} font-size="20" font-weight="700" fill="#333">Stroke Mortality by State, {activeYear}</text>
        <text x={24} y={48} font-size="11.5" fill="#666">
          Drag the selector to explore any region. States inside are shown with glyph detail.
        </text>

        <!-- Choropleth only — no glyphs on map -->
        <g transform="translate({oX},{oY})">
          {#each mapFeatures as feature}
            {@const code = getCode(feature)}
            {@const mort = code ? mortMap.get(code) ?? null : null}
            {@const isSel = code === $selectedState}
            {@const dim = $selectedState !== null && !isSel}
            <path
              d={pathGen(feature)}
              fill={mort !== null ? colorScale(mort) : "#f3d7d4"}
              stroke="#fff" stroke-width={isSel ? 2.5 : 0.8}
              opacity={dim ? 0.5 : 1}
              style="cursor:pointer;"
              on:mouseenter={e => code && showTip(e, code, mort, percentileMap.get(code)??null)}
              on:mousemove={e => code && showTip(e, code, mort, percentileMap.get(code)??null)}
              on:mouseleave={clearTip}
              on:click={() => code && doClick(code)}
            />
          {/each}
        </g>

        <!-- Selection box -->
        <rect
          x={$boxX} y={$boxY} width={boxW} height={boxH}
          fill="rgba(61,90,128,0.05)"
          stroke="#3d5a80" stroke-width="2"
          stroke-dasharray="8,4" rx="6"
          style="cursor:grab;"
          on:mousedown={startMove}
        />
        <g transform="translate({$boxX + boxW - 16},{$boxY + boxH - 16})" style="cursor:nwse-resize;" on:mousedown={startResize}>
          <rect width="18" height="18" fill="rgba(61,90,128,0.12)" rx="3" />
          <text x="4" y="14" font-size="12" fill="#3d5a80">◢</text>
        </g>
        <text x={$boxX + 6} y={$boxY - 6} font-size="10" fill="#3d5a80" font-weight="600">
          {insideStates.length} state{insideStates.length !== 1 ? "s" : ""} in view
        </text>

        <!-- Connector -->
        {#if insideStates.length > 0}
          <line x1={connector.x1} y1={connector.y1} x2={connector.x2} y2={connector.y2}
            stroke="#8ea8c3" stroke-width="1.5" stroke-dasharray="5,3" opacity="0.55" />
        {/if}

        <!-- Detail panel with glyphs -->
        {#if insideStates.length > 0}
          <g transform="translate({panelPos.x},{panelPos.y})">
            <rect x="-12" y="-30" width={panelPos.w} height={panelPos.h}
              rx="12" ry="12" fill="rgba(255,255,255,0.97)"
              stroke="#c0c0c0" stroke-width="1" filter="url(#pshadow)" />
            <text x="0" y="-12" font-size="11.5" font-weight="600" fill="#3d5a80">Region Detail</text>
            <text x="95" y="-12" font-size="9.5" fill="#999">sorted by mortality ↑</text>

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
              {@const dark = mort !== null && mort > (minM+maxM)*0.55}
              <g class="tile" style="cursor:pointer;" opacity={dim ? 0.4 : 1}
                on:mouseenter={e => showTip(e, st.code, mort, pct)}
                on:mousemove={e => showTip(e, st.code, mort, pct)}
                on:mouseleave={clearTip}
                on:click={() => doClick(st.code)}
              >
                <rect x={tx} y={ty} width={panelPos.tileCell} height={panelPos.tileCell}
                  rx="6" ry="6" fill="#f8f8f8"
                  stroke={isSel ? "#222" : "#e8e8e8"} stroke-width={isSel ? 2 : 1} />
                <circle cx={mx} cy={my} r={tileRingR} fill="none" stroke="#e0e0e0" stroke-width="4" />
                <path d={arcPath(mx, my, tileRingR, pct)} fill="none" stroke="#3d5a80" stroke-width="4" stroke-linecap="round" />
                {#if mort !== null}
                  <circle cx={mx} cy={my} r={tileGlyphR} fill={colorScale(mort)} stroke="#fff" stroke-width="1.5" />
                {/if}
                <text x={mx} y={my + 4} text-anchor="middle" font-size="10" font-weight="700"
                  fill={dark ? "#fff" : "#333"}>{st.code}</text>
                {#if mort !== null}
                  <text x={mx} y={ty + panelPos.tileCell - 3} text-anchor="middle" font-size="8" fill="#666">{formatM(mort)}</text>
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
              <stop offset="{stop * 100}%" stop-color={d3.interpolateReds(stop)} />
            {/each}
          </linearGradient>
        </defs>

        <!-- Color legend (bottom right) -->
        <text x={W - 270} y={H - 50} font-size="12" fill="#555">Mortality</text>
        <rect x={W - 270} y={H - 42} width="220" height="12" fill="url(#glg)" stroke="#d9d9d9" />
        <text x={W - 270} y={H - 16} font-size="11" fill="#666">{formatM(minM)}</text>
        <text x={W - 50} y={H - 16} font-size="11" fill="#666" text-anchor="end">{formatM(maxM)}</text>
      </svg>

      <!-- Glyph legend BELOW the SVG, never overlaps map -->
      <div class="glyph-legend">
        <div class="legend-title">How to read the glyph</div>
        <div class="legend-content">
          <svg width="56" height="56">
            <circle cx="28" cy="28" r="24" fill="none" stroke="#e0e0e0" stroke-width="4" />
            <path d={arcPath(28, 28, 24, 0.75)} fill="none" stroke="#3d5a80" stroke-width="4" stroke-linecap="round" />
            <circle cx="28" cy="28" r="17" fill={exColor} stroke="#fff" stroke-width="1.5" />
            <text x="28" y="32" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">XX</text>
          </svg>
          <div class="legend-labels">
            <div><span class="swatch" style="background:{exColor};"></span> fill = current mortality</div>
            <div><span class="swatch ring"></span> outer ring = national percentile</div>
            <div class="ring-ref">
              <svg width="110" height="12">
                <line x1="0" y1="6" x2="25" y2="6" stroke="#e0e0e0" stroke-width="3" />
                <text x="28" y="9" font-size="9" fill="#888">0%</text>
                <line x1="50" y1="6" x2="75" y2="6" stroke="#3d5a80" stroke-width="3" />
                <text x="78" y="9" font-size="9" fill="#888">100%</text>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {#if tooltip}
        <div class="tooltip" style:left={`${tooltip.left}px`} style:top={`${tooltip.top}px`}>
          <strong>{tooltip.name} ({tooltip.code})</strong>
          {#if tooltip.mortality !== null}<div>Mortality: {formatM(tooltip.mortality)}</div>{/if}
          {#if tooltip.percentile !== null}<div>Percentile: {Math.round(tooltip.percentile * 100)}%</div>{/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .map-shell { display:flex; flex-direction:column; gap:0.75rem; }
  .map-caption { margin:0; color:#555; font-size:0.95rem; }
  .map-container {
    position:relative; display:inline-block; max-width:100%;
    border:1px solid #d9d9d9; border-radius:14px; background:#fff; overflow:auto;
  }
  .glyph-legend {
    padding: 12px 20px 14px;
    border-top: 1px solid #eee;
  }
  .legend-title { font-size: 12px; font-weight: 600; color: #444; margin-bottom: 6px; }
  .legend-content { display: flex; align-items: center; gap: 14px; }
  .legend-labels { font-size: 11px; color: #555; line-height: 1.6; }
  .swatch { display:inline-block; width:12px; height:12px; border-radius:50%; vertical-align:middle; margin-right:4px; }
  .swatch.ring { background:none; border:3px solid #3d5a80; width:10px; height:10px; }
  .ring-ref { margin-top: 2px; }
  .tile { transition: opacity 0.15s ease; }
  .tile:hover rect { filter: brightness(0.95); }
  .tooltip {
    position:absolute; pointer-events:none; min-width:150px;
    padding:0.65rem 0.8rem; border-radius:10px;
    background:rgba(255,255,255,0.97); color:#333;
    border:1px solid #d5d5d5; box-shadow:0 4px 14px rgba(0,0,0,0.08);
    font-size:0.92rem; line-height:1.4; transform:translateY(-100%);
  }
  svg { display:block; }
</style>