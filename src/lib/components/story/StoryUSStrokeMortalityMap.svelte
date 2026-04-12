<svelte:options runes={false} />

<script lang="ts">
  // @ts-nocheck
  import { onDestroy, onMount } from 'svelte';
  import * as d3 from 'd3';
  import { asset } from '$app/paths';

  export let storyStep: number = 5;

  type MortalityRow = {
    state: string;
    year: number;
    mortality: number;
  };

  const width = 1100;
  const height = 700;
  const formatMortality = d3.format('.1f');
  const STATE_NAME_TO_CODE: Record<string, string> = {
    Alabama: 'AL',
    Alaska: 'AK',
    Arizona: 'AZ',
    Arkansas: 'AR',
    California: 'CA',
    Colorado: 'CO',
    Connecticut: 'CT',
    Delaware: 'DE',
    'District of Columbia': 'DC',
    Florida: 'FL',
    Georgia: 'GA',
    Hawaii: 'HI',
    Idaho: 'ID',
    Illinois: 'IL',
    Indiana: 'IN',
    Iowa: 'IA',
    Kansas: 'KS',
    Kentucky: 'KY',
    Louisiana: 'LA',
    Maine: 'ME',
    Maryland: 'MD',
    Massachusetts: 'MA',
    Michigan: 'MI',
    Minnesota: 'MN',
    Mississippi: 'MS',
    Missouri: 'MO',
    Montana: 'MT',
    Nebraska: 'NE',
    Nevada: 'NV',
    'New Hampshire': 'NH',
    'New Jersey': 'NJ',
    'New Mexico': 'NM',
    'New York': 'NY',
    'North Carolina': 'NC',
    'North Dakota': 'ND',
    Ohio: 'OH',
    Oklahoma: 'OK',
    Oregon: 'OR',
    Pennsylvania: 'PA',
    'Rhode Island': 'RI',
    'South Carolina': 'SC',
    'South Dakota': 'SD',
    Tennessee: 'TN',
    Texas: 'TX',
    Utah: 'UT',
    Vermont: 'VT',
    Virginia: 'VA',
    Washington: 'WA',
    'West Virginia': 'WV',
    Wisconsin: 'WI',
    Wyoming: 'WY'
  };

  let features: GeoJSON.Feature[] = [];
  let rows: MortalityRow[] = [];
  let projectionPath: Record<string, string> = {};
  let activeYear = 2019;
  let loading = true;
  let timer: ReturnType<typeof setInterval> | null = null;
  let startDelayTimer: ReturnType<typeof setTimeout> | null = null;
  const animationStartDelay = 900;
  const animationStepDuration = 220;

  function featureName(feature: GeoJSON.Feature) {
    const properties = feature.properties ?? {};
    return properties.name ?? properties.NAME ?? '';
  }

  function featureCode(feature: GeoJSON.Feature) {
    return STATE_NAME_TO_CODE[featureName(feature)];
  }

  function clearTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function clearStartDelayTimer() {
    if (startDelayTimer) {
      clearTimeout(startDelayTimer);
      startDelayTimer = null;
    }
  }

  function startAnimation() {
    clearStartDelayTimer();
    clearTimer();
    activeYear = 1999;

    startDelayTimer = setTimeout(() => {
      timer = setInterval(() => {
        if (activeYear >= 2019) {
          clearTimer();
          return;
        }

        activeYear += 1;
      }, animationStepDuration);
    }, animationStartDelay);
  }

  onMount(async () => {
    const [mortality, geojson] = await Promise.all([
      d3.csv(asset('/data/stroke_geo_clean_state.csv'), (d) => ({
        state: d.State,
        year: +d.Year,
        mortality: +d.mortality
      })),
      d3.json(asset('/data/us-states.geojson'))
    ]);

    rows = mortality.filter((d) => Number.isFinite(d.mortality));
    features = (geojson.features ?? []).filter((feature) => featureName(feature) !== 'Puerto Rico');

    const projection = d3.geoAlbersUsa().fitSize(
      [width - 40, height - 60],
      {
        type: 'FeatureCollection',
        features
      }
    );
    const path = d3.geoPath(projection);

    projectionPath = Object.fromEntries(
      features.map((feature) => [featureName(feature), path(feature) ?? ''])
    );

    loading = false;
  });

  onDestroy(() => {
    clearStartDelayTimer();
    clearTimer();
  });

  $: if (!loading) {
    if (storyStep === 5) {
      clearStartDelayTimer();
      clearTimer();
      activeYear = 2019;
    } else if (storyStep === 6) {
      startAnimation();
    }
  }

  $: rowsForYear = rows.filter((row) => row.year === activeYear);
  $: mortalityByState = new Map(rowsForYear.map((row) => [row.state, row.mortality]));
  $: values = rowsForYear.map((row) => row.mortality);
  $: colorScale = d3
    .scaleSequential(d3.interpolateReds)
    .domain([d3.min(values) ?? 0, d3.max(values) ?? 1]);
  $: legendTicks = colorScale.ticks ? colorScale.ticks(4) : [d3.min(values) ?? 0, d3.max(values) ?? 1];
</script>

{#if loading}
  <div class="message-box">Loading Visualization 2...</div>
{:else}
  <div class="panel">
    <div class="copy-row">
      <div>
        <h4>{storyStep === 5 ? '2019 map view' : 'Animated 1999-2019 map'}</h4>
        <p>
          {#if storyStep === 5}
            Mississippi stays highlighted while the story shifts from rank to geography.
          {:else}
            The fill colors animate year by year to show how mortality changes across the country over time.
          {/if}
        </p>
      </div>

      <div class="year-chip">{activeYear}</div>
    </div>

    <div class="svg-shell">
      <svg viewBox={`0 0 ${width} ${height}`} class="chart-svg">
        <text x="24" y="30" font-size="20" font-weight="700" fill="#0f172a">
          U.S. stroke mortality by state
        </text>
        <text x="24" y="50" font-size="12" fill="#64748b">
          Mississippi remains highlighted as the story moves from ranking to spatial context.
        </text>

        <g transform="translate(20 18)">
          {#each features as feature}
            {@const code = featureCode(feature)}
            {@const name = featureName(feature)}
            {@const mortality = code ? mortalityByState.get(code) : null}
            <path
              d={projectionPath[name]}
              fill={mortality === null || mortality === undefined ? '#fee2e2' : colorScale(mortality)}
              stroke={code === 'MS' ? '#9f1239' : '#ffffff'}
              stroke-width={code === 'MS' ? '2.8' : '1'}
              opacity={code === 'MS' ? '1' : '0.92'}
            />
          {/each}
        </g>

        <rect x="804" y="610" width="232" height="12" rx="6" fill="url(#story-map-gradient)" />
        <defs>
          <linearGradient id="story-map-gradient" x1="0%" x2="100%">
            {#each d3.range(0, 1.01, 0.1) as stop}
              <stop offset={`${stop * 100}%`} stop-color={d3.interpolateReds(stop)} />
            {/each}
          </linearGradient>
        </defs>
        <text x="804" y="600" font-size="12" fill="#475569">Mortality</text>
        <text x="804" y="640" font-size="11" fill="#64748b">
          {formatMortality(d3.min(values) ?? 0)}
        </text>
        <text x="1036" y="640" text-anchor="end" font-size="11" fill="#64748b">
          {formatMortality(d3.max(values) ?? 0)}
        </text>

        <rect x="24" y="610" width="210" height="52" rx="14" fill="#fff7ed" stroke="#fdba74" />
        <text x="40" y="632" font-size="12" font-weight="700" fill="#9a3412">Story focus</text>
        <text x="40" y="650" font-size="12" fill="#9a3412">
          Mississippi
          {#if mortalityByState.get('MS') !== undefined}
            : {formatMortality(mortalityByState.get('MS'))}
          {/if}
        </text>
      </svg>
    </div>
  </div>
{/if}

<style>
  .panel {
    border: 1px solid #dbe3ee;
    border-radius: 18px;
    padding: 18px;
    background: #fff;
  }

  .copy-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
    margin-bottom: 14px;
  }

  .copy-row h4 {
    margin: 0 0 6px 0;
    font-size: 1.1rem;
  }

  .copy-row p {
    margin: 0;
    color: #475569;
    line-height: 1.6;
  }

  .year-chip {
    padding: 10px 14px;
    border-radius: 999px;
    background: #eff6ff;
    color: #1d4ed8;
    font-weight: 700;
    min-width: 68px;
    text-align: center;
  }

  .svg-shell {
    overflow: auto;
    border: 1px solid #e5e7eb;
    border-radius: 16px;
  }

  .chart-svg {
    width: 100%;
    height: auto;
    display: block;
    background: #fff;
  }

  .message-box {
    border: 1px dashed #cbd5e1;
    border-radius: 16px;
    padding: 18px;
    background: #fff;
    color: #475569;
  }
</style>
