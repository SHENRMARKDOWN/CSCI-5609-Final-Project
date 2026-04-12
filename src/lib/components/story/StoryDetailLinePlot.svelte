<svelte:options runes={false} />

<script lang="ts">
  // @ts-nocheck
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import { asset } from '$app/paths';

  export let storyStep: number = 7;

  type Row = {
    state: string;
    year: number;
    view_mode: string;
    series_id: string;
    series_label: string;
    series_type: string;
    series_order: number;
    age_group_short: string;
    county_name: string;
    mortality: number;
  };

  type StoryConfig = {
    title: string;
    mode: 'overall' | 'sex' | 'race' | 'county';
    age: '35+' | '35-64' | '65+';
    ids: string[];
  };

  const width = 1080;
  const height = 580;
  const margin = { top: 42, right: 220, bottom: 56, left: 80 };
  const xTicks = [1999, 2003, 2007, 2011, 2015, 2019];
  const STATE = 'MS';
  const countyPalette = ['#2563eb', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6'];

  const sexColors: Record<string, string> = {
    Overall: '#64748b',
    Men: '#2563eb',
    Women: '#ef4444'
  };

  const raceColors: Record<string, string> = {
    Overall: '#64748b',
    White: '#2563eb',
    'Black (Non-Hispanic)': '#ef4444',
    Hispanic: '#f59e0b',
    'Asian/Pacific Islander': '#0ea5e9',
    'American Indian/Alaska Native': '#10b981'
  };

  let rows: Row[] = [];
  let loading = true;

  function parseRow(d: d3.DSVRowString): Row {
    return {
      state: d.state,
      year: +d.year,
      view_mode: d.view_mode,
      series_id: d.series_id,
      series_label: d.series_label,
      series_type: d.series_type,
      series_order: +d.series_order,
      age_group_short: d.age_group_short,
      county_name: d.county_name,
      mortality: +d.mortality
    };
  }

  function buildStoryConfig(step: number, countyIds: string[]): StoryConfig {
    const countyVisible = (count: number) => ['county_state_average', ...countyIds.slice(0, count)];

    if (step === 7) {
      return {
        title: 'Mississippi overall mortality trend',
        mode: 'overall',
        age: '35+',
        ids: ['state_overall']
      };
    }

    if (step === 8) return { title: 'Sex comparison, ages 35-64', mode: 'sex', age: '35-64', ids: ['sex_overall'] };
    if (step === 9) return { title: 'Sex comparison, ages 35-64', mode: 'sex', age: '35-64', ids: ['sex_overall', 'sex_men'] };
    if (step === 10) return { title: 'Sex comparison, ages 35-64', mode: 'sex', age: '35-64', ids: ['sex_overall', 'sex_men', 'sex_women'] };
    if (step === 11) return { title: 'Sex comparison, ages 65+', mode: 'sex', age: '65+', ids: ['sex_overall'] };
    if (step === 12) return { title: 'Sex comparison, ages 65+', mode: 'sex', age: '65+', ids: ['sex_overall', 'sex_men'] };
    if (step === 13) return { title: 'Sex comparison, ages 65+', mode: 'sex', age: '65+', ids: ['sex_overall', 'sex_men', 'sex_women'] };
    if (step === 14) return { title: 'Race comparison, ages 35-64', mode: 'race', age: '35-64', ids: ['race_overall'] };
    if (step === 15) return { title: 'Race comparison, ages 35-64', mode: 'race', age: '35-64', ids: ['race_overall', 'race_white'] };
    if (step === 16) return { title: 'Race comparison, ages 35-64', mode: 'race', age: '35-64', ids: ['race_overall', 'race_white', 'race_black_non_hispanic'] };
    if (step === 17) return { title: 'Race comparison, ages 35-64', mode: 'race', age: '35-64', ids: ['race_overall', 'race_white', 'race_black_non_hispanic', 'race_hispanic'] };
    if (step === 18) return { title: 'Race comparison, ages 35-64', mode: 'race', age: '35-64', ids: ['race_overall', 'race_white', 'race_black_non_hispanic', 'race_hispanic', 'race_asian_pacific_islander'] };
    if (step === 19) return { title: 'Race comparison, ages 35-64', mode: 'race', age: '35-64', ids: ['race_overall', 'race_white', 'race_black_non_hispanic', 'race_hispanic', 'race_asian_pacific_islander', 'race_american_indian_alaska_native'] };
    if (step === 20) return { title: 'County comparison, ages 35-64', mode: 'county', age: '35-64', ids: countyVisible(0) };
    if (step === 21) return { title: 'County comparison, ages 35-64', mode: 'county', age: '35-64', ids: countyVisible(1) };
    if (step === 22) return { title: 'County comparison, ages 35-64', mode: 'county', age: '35-64', ids: countyVisible(2) };
    if (step === 23) return { title: 'County comparison, ages 35-64', mode: 'county', age: '35-64', ids: countyVisible(3) };
    if (step === 24) return { title: 'County comparison, ages 35-64', mode: 'county', age: '35-64', ids: countyVisible(4) };

    return { title: 'County comparison, ages 35-64', mode: 'county', age: '35-64', ids: countyVisible(5) };
  }

  function seriesColor(series, index: number) {
    if (config.mode === 'overall') return '#a16207';
    if (config.mode === 'sex') return sexColors[series.label] ?? '#2563eb';
    if (config.mode === 'race') return raceColors[series.label] ?? '#2563eb';
    if (series.id === 'county_state_average') return '#64748b';
    return countyPalette[Math.max(index - 1, 0) % countyPalette.length];
  }

  function isBaseline(series) {
    return config.mode === 'overall'
      ? false
      : config.mode === 'county'
        ? series.id === 'county_state_average'
        : series.label === 'Overall';
  }

  onMount(async () => {
    const data = await d3.csv(asset('/data/stroke_geo_vis3.csv'), parseRow);
    rows = data.filter((d) => d.state === STATE && Number.isFinite(d.mortality));
    loading = false;
  });

  $: countySuggestions = rows
    .filter((d) => d.view_mode === 'county' && d.age_group_short === '35-64' && d.year === 2019 && d.series_id !== 'county_state_average')
    .sort((a, b) => d3.descending(a.mortality, b.mortality))
    .slice(0, 5)
    .map((d) => d.series_id);

  $: config = buildStoryConfig(storyStep, countySuggestions);
  $: modeRows =
    config.mode === 'overall'
      ? rows.filter((d) => d.view_mode === 'overall' && d.age_group_short === '35+')
      : rows.filter((d) => d.view_mode === config.mode && d.age_group_short === config.age);

  $: grouped = Array.from(
    d3.group(modeRows, (d) => d.series_id),
    ([id, values]) => ({
      id,
      label: values[0].series_label,
      countyName: values[0].county_name,
      order: values[0].series_order,
      values: [...values].sort((a, b) => a.year - b.year)
    })
  );

  $: visibleSeries = config.ids
    .map((id) => grouped.find((series) => series.id === id))
    .filter(Boolean);

  $: allVisiblePoints = visibleSeries.flatMap((series) => series.values);
  $: yMin = d3.min(allVisiblePoints, (d) => d.mortality) ?? 0;
  $: yMax = d3.max(allVisiblePoints, (d) => d.mortality) ?? 100;
  $: yPadding = Math.max(4, (yMax - yMin) * 0.08 || 4);
  $: xScale = d3.scaleLinear().domain([1999, 2019]).range([margin.left, width - margin.right]);
  $: yScale = d3
    .scaleLinear()
    .domain([Math.max(0, yMin - yPadding), yMax + yPadding])
    .nice()
    .range([height - margin.bottom, margin.top]);
  $: yTicks = yScale.ticks(6);
  $: lineGenerator = d3
    .line<Row>()
    .x((d) => xScale(d.year))
    .y((d) => yScale(d.mortality));
  $: endLabels = visibleSeries.map((series, index) => {
    const point = series.values[series.values.length - 1];
    return {
      id: series.id,
      text: series.countyName || series.label,
      x: xScale(point.year) + 10,
      y: yScale(point.mortality),
      color: seriesColor(series, index)
    };
  });
</script>

{#if loading}
  <div class="message-box">Loading Visualization 3...</div>
{:else}
  <div class="panel">
    <div class="panel-copy">
      <div>
        <h4>{config.title}</h4>
        <p>
          {#if config.mode === 'overall'}
            The story begins with one Mississippi line only, establishing the baseline before any subgroup is added.
          {:else if config.mode === 'county'}
            Suggested counties are introduced one at a time against the Mississippi state average.
          {:else}
            The baseline stays dashed while each new subgroup line is added one scroll at a time.
          {/if}
        </p>
      </div>
      <div class="state-chip">Mississippi</div>
    </div>

    <div class="legend-row">
      {#each visibleSeries as series, index}
        <div class="legend-chip">
          <span
            class:baseline={isBaseline(series)}
            class="swatch"
            style={`background:${seriesColor(series, index)}; border-color:${seriesColor(series, index)};`}
          ></span>
          <span>{series.countyName || series.label}</span>
        </div>
      {/each}
    </div>

    <div class="svg-shell">
      <svg viewBox={`0 0 ${width} ${height}`} class="chart-svg">
        {#each yTicks as tick}
          <line x1={margin.left} x2={width - margin.right} y1={yScale(tick)} y2={yScale(tick)} stroke="#e2e8f0" />
          <text x={margin.left - 10} y={yScale(tick)} dy="0.33em" text-anchor="end" font-size="11" fill="#64748b">
            {d3.format((yMax - yMin) < 20 ? '.1f' : '.0f')(tick)}
          </text>
        {/each}

        {#each xTicks as tick}
          <line x1={xScale(tick)} x2={xScale(tick)} y1={margin.top} y2={height - margin.bottom} stroke="#e2e8f0" />
          <text x={xScale(tick)} y={height - 20} text-anchor="middle" font-size="11" fill="#64748b">
            {tick}
          </text>
        {/each}

        {#each visibleSeries as series, index}
          <path
            d={lineGenerator(series.values) ?? ''}
            fill="none"
            stroke={seriesColor(series, index)}
            stroke-width={isBaseline(series) ? '3.2' : '3.6'}
            stroke-dasharray={isBaseline(series) ? '7 5' : null}
            stroke-linecap="round"
            stroke-linejoin="round"
            opacity={isBaseline(series) ? '0.88' : '0.98'}
          />

          {#each series.values as point}
            <circle
              cx={xScale(point.year)}
              cy={yScale(point.mortality)}
              r={isBaseline(series) ? '2.6' : '3'}
              fill={seriesColor(series, index)}
              opacity={isBaseline(series) ? '0.75' : '0.95'}
            />
          {/each}
        {/each}

        {#each endLabels as label}
          <text x={label.x} y={label.y} dy="0.33em" font-size="12" font-weight="600" fill={label.color}>
            {label.text}
          </text>
        {/each}

        <text x={(margin.left + width - margin.right) / 2} y={height - 8} text-anchor="middle" font-size="13" fill="#334155">
          Year
        </text>
        <text
          transform={`translate(20 ${(margin.top + height - margin.bottom) / 2}) rotate(-90)`}
          text-anchor="middle"
          font-size="13"
          fill="#334155"
        >
          Mortality (per 100,000)
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

  .panel-copy {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 14px;
  }

  .panel-copy h4 {
    margin: 0 0 6px 0;
    font-size: 1.1rem;
  }

  .panel-copy p {
    margin: 0;
    color: #475569;
    line-height: 1.6;
  }

  .state-chip {
    padding: 10px 14px;
    border-radius: 999px;
    background: #eff6ff;
    color: #1d4ed8;
    font-weight: 700;
  }

  .legend-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 14px;
  }

  .legend-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 999px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    font-size: 0.92rem;
    color: #334155;
  }

  .swatch {
    width: 12px;
    height: 12px;
    border-radius: 999px;
    border: 2px solid transparent;
    display: inline-block;
  }

  .swatch.baseline {
    background: transparent !important;
    border-style: dashed;
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
