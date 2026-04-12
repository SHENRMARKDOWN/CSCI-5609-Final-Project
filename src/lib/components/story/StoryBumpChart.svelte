<svelte:options runes={false} />

<script lang="ts">
  // @ts-nocheck
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import { asset } from '$app/paths';

  export let storyStep: number = 1;

  type Row = {
    state: string;
    year: number;
    mortality: number;
    rank: number;
  };

  const width = 1120;
  const height = 820;
  const barHeight = 980;
  const margin = { top: 44, right: 96, bottom: 54, left: 208 };

  const regionMap: Record<string, string> = {
    CT: 'Northeast',
    ME: 'Northeast',
    MA: 'Northeast',
    NH: 'Northeast',
    RI: 'Northeast',
    VT: 'Northeast',
    NJ: 'Northeast',
    NY: 'Northeast',
    PA: 'Northeast',
    DE: 'Southeast',
    MD: 'Southeast',
    DC: 'Southeast',
    AL: 'Southeast',
    AR: 'Southeast',
    FL: 'Southeast',
    GA: 'Southeast',
    KY: 'Southeast',
    LA: 'Southeast',
    MS: 'Southeast',
    NC: 'Southeast',
    SC: 'Southeast',
    TN: 'Southeast',
    VA: 'Southeast',
    WV: 'Southeast',
    IL: 'Midwest',
    IN: 'Midwest',
    IA: 'Midwest',
    KS: 'Midwest',
    MI: 'Midwest',
    MN: 'Midwest',
    MO: 'Midwest',
    NE: 'Midwest',
    ND: 'Midwest',
    OH: 'Midwest',
    SD: 'Midwest',
    WI: 'Midwest',
    AZ: 'Southwest',
    NM: 'Southwest',
    OK: 'Southwest',
    TX: 'Southwest',
    AK: 'West',
    CA: 'West',
    CO: 'West',
    HI: 'West',
    ID: 'West',
    MT: 'West',
    NV: 'West',
    OR: 'West',
    UT: 'West',
    WA: 'West',
    WY: 'West'
  };

  const stateNames: Record<string, string> = {
    AL: 'Alabama',
    AK: 'Alaska',
    AZ: 'Arizona',
    AR: 'Arkansas',
    CA: 'California',
    CO: 'Colorado',
    CT: 'Connecticut',
    DE: 'Delaware',
    DC: 'District of Columbia',
    FL: 'Florida',
    GA: 'Georgia',
    HI: 'Hawaii',
    ID: 'Idaho',
    IL: 'Illinois',
    IN: 'Indiana',
    IA: 'Iowa',
    KS: 'Kansas',
    KY: 'Kentucky',
    LA: 'Louisiana',
    ME: 'Maine',
    MD: 'Maryland',
    MA: 'Massachusetts',
    MI: 'Michigan',
    MN: 'Minnesota',
    MS: 'Mississippi',
    MO: 'Missouri',
    MT: 'Montana',
    NE: 'Nebraska',
    NV: 'Nevada',
    NH: 'New Hampshire',
    NJ: 'New Jersey',
    NM: 'New Mexico',
    NY: 'New York',
    NC: 'North Carolina',
    ND: 'North Dakota',
    OH: 'Ohio',
    OK: 'Oklahoma',
    OR: 'Oregon',
    PA: 'Pennsylvania',
    RI: 'Rhode Island',
    SC: 'South Carolina',
    SD: 'South Dakota',
    TN: 'Tennessee',
    TX: 'Texas',
    UT: 'Utah',
    VT: 'Vermont',
    VA: 'Virginia',
    WA: 'Washington',
    WV: 'West Virginia',
    WI: 'Wisconsin',
    WY: 'Wyoming'
  };

  const regionColors: Record<string, string> = {
    Northeast: '#3b82f6',
    Southeast: '#f97316',
    Midwest: '#22c55e',
    Southwest: '#f59e0b',
    West: '#ef4444'
  };

  let loading = true;
  let rows: Row[] = [];

  function getColor(state: string) {
    return regionColors[regionMap[state]] ?? '#64748b';
  }

  function computeRanks(data: Omit<Row, 'rank'>[]) {
    const grouped = d3.group(data, (d) => d.year);
    const ranked: Row[] = [];

    grouped.forEach((values) => {
      [...values]
        .sort((a, b) => d3.descending(a.mortality, b.mortality))
        .forEach((value, index) => {
          ranked.push({
            ...value,
            rank: index + 1
          });
        });
    });

    return ranked;
  }

  onMount(async () => {
    const raw = await d3.csv(asset('/data/stroke_geo_clean_state.csv'), (d) => ({
      state: d.State,
      year: +d.Year,
      mortality: +d.mortality
    }));

    rows = computeRanks(raw.filter((d) => Number.isFinite(d.mortality)));
    loading = false;
  });

  $: year2019 = rows.filter((d) => d.year === 2019).sort((a, b) => a.rank - b.rank);
  $: groupedByState = d3.group(rows, (d) => d.state);
  $: barY = d3
    .scaleBand()
    .domain(year2019.map((d) => d.state))
    .range([margin.top, barHeight - margin.bottom])
    .padding(0.18);
  $: barX = d3
    .scaleLinear()
    .domain([0, d3.max(year2019, (d) => d.mortality) ?? 200])
    .nice()
    .range([margin.left, width - margin.right]);
  $: bumpX = d3.scaleLinear().domain([1999, 2019]).range([margin.left, width - margin.right]);
  $: bumpY = d3.scaleLinear().domain([51, 1]).range([height - margin.bottom, margin.top]);
  $: lineGenerator = d3
    .line<Row>()
    .x((d) => bumpX(d.year))
    .y((d) => bumpY(d.rank));
  $: tickYears = [1999, 2003, 2007, 2011, 2015, 2019];
  $: rankTicks = [1, 10, 20, 30, 40, 51];
</script>

{#if loading}
  <div class="message-box">Loading Visualization 1...</div>
{:else}
  <div class="panel">
    <div class="chart-copy">
      <h4>{storyStep === 1 ? '2019 rank view' : '1999-2019 bump chart view'}</h4>
      <p>
        {#if storyStep === 1}
          States are ordered by 2019 mortality. This gives the audience one clear starting snapshot before the trend view appears.
        {:else if storyStep === 4}
          Mississippi is highlighted so the story can carry one state from rank, to map, to subgroup detail.
        {:else}
          Once the trend view appears, each line tracks how a state moves through the mortality ranking over time.
        {/if}
      </p>
    </div>

    {#if storyStep === 1}
      <div class="svg-shell">
        <svg viewBox={`0 0 ${width} ${barHeight}`} class="chart-svg">
          {#each barX.ticks(5) as tick}
            <line
              x1={barX(tick)}
              x2={barX(tick)}
              y1={margin.top}
              y2={barHeight - margin.bottom}
              stroke="#e2e8f0"
            />
            <text
              x={barX(tick)}
              y={barHeight - 18}
              text-anchor="middle"
              font-size="11"
              fill="#64748b"
            >
              {tick}
            </text>
          {/each}

          {#each year2019 as row}
            <rect
              x={margin.left}
              y={barY(row.state)}
              width={barX(row.mortality) - margin.left}
              height={barY.bandwidth()}
              rx="6"
              fill={getColor(row.state)}
              opacity="0.88"
            />
            <text
              x={margin.left - 12}
              y={(barY(row.state) ?? 0) + barY.bandwidth() / 2}
              dy="0.33em"
              text-anchor="end"
              font-size="11"
              fill="#334155"
            >
              {row.rank}. {stateNames[row.state] ?? row.state}
            </text>
            <text
              x={barX(row.mortality) + 8}
              y={(barY(row.state) ?? 0) + barY.bandwidth() / 2}
              dy="0.33em"
              font-size="11"
              fill="#475569"
            >
              {d3.format('.1f')(row.mortality)}
            </text>
          {/each}

          <text
            x={margin.left}
            y={22}
            font-size="20"
            font-weight="700"
            fill="#0f172a"
          >
            U.S. state mortality rank in 2019
          </text>
          <text
            x={margin.left}
            y={40}
            font-size="12"
            fill="#64748b"
          >
            Horizontal bars provide the opening ranking snapshot before the trend view appears.
          </text>
        </svg>
      </div>
    {:else}
      <div class="svg-shell">
        <svg viewBox={`0 0 ${width} ${height}`} class="chart-svg">
          {#each rankTicks as tick}
            <line
              x1={margin.left}
              x2={width - margin.right}
              y1={bumpY(tick)}
              y2={bumpY(tick)}
              stroke="#e2e8f0"
            />
            <text
              x={margin.left - 12}
              y={bumpY(tick)}
              dy="0.33em"
              text-anchor="end"
              font-size="11"
              fill="#64748b"
            >
              {tick}
            </text>
          {/each}

          {#each tickYears as year}
            <line
              x1={bumpX(year)}
              x2={bumpX(year)}
              y1={margin.top}
              y2={height - margin.bottom}
              stroke="#e2e8f0"
            />
            <text
              x={bumpX(year)}
              y={height - 18}
              text-anchor="middle"
              font-size="11"
              fill="#64748b"
            >
              {year}
            </text>
          {/each}

          {#each Array.from(groupedByState) as [state, values]}
            {@const isFocus = storyStep === 4 && state === 'MS'}
            <path
              d={lineGenerator([...values].sort((a, b) => a.year - b.year)) ?? ''}
              fill="none"
              stroke={getColor(state)}
              stroke-width={isFocus ? 6.5 : 2.5}
              opacity={storyStep === 4 ? (isFocus ? 1 : 0.14) : 0.52}
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          {/each}

          {#each year2019 as row}
            {@const isFocus = storyStep === 4 && row.state === 'MS'}
            <circle
              cx={bumpX(2019)}
              cy={bumpY(row.rank)}
              r={isFocus ? 6 : 2.8}
              fill={getColor(row.state)}
              opacity={storyStep === 4 ? (isFocus ? 1 : 0.18) : 0.85}
            />
            {#if row.rank <= 8 || isFocus}
              <text
                x={bumpX(2019) + 10}
                y={bumpY(row.rank)}
                dy="0.33em"
                font-size="11"
                font-weight={isFocus ? '700' : '500'}
                fill={isFocus ? '#9f1239' : '#475569'}
                opacity={storyStep === 4 ? (isFocus ? 1 : 0.18) : 0.95}
              >
                {stateNames[row.state] ?? row.state}
              </text>
            {/if}
          {/each}

          <text
            x={margin.left}
            y={22}
            font-size="20"
            font-weight="700"
            fill="#0f172a"
          >
            State rank trajectories from 1999 to 2019
          </text>
          <text
            x={margin.left}
            y={40}
            font-size="12"
            fill="#64748b"
          >
            Lower rank numbers indicate higher mortality. The story narrows to Mississippi before leaving this view.
          </text>
        </svg>
      </div>
    {/if}
  </div>
{/if}

<style>
  .panel {
    border: 1px solid #dbe3ee;
    border-radius: 18px;
    padding: 18px;
    background: #fff;
  }

  .chart-copy h4 {
    margin: 0 0 6px 0;
    font-size: 1.1rem;
  }

  .chart-copy p {
    margin: 0 0 14px 0;
    color: #475569;
    line-height: 1.6;
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
