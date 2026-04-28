<svelte:options runes={false} />

<script lang="ts">
    // @ts-nocheck
    import { onDestroy, onMount } from "svelte";
    import * as d3 from "d3";
    import { asset } from "$app/paths";
    import {
      selectedState,
      selectedVis3Mode,
      selectedAgeGroup
    } from "$lib/stores";
    export let storyStep: number | null = null;
    export let storyMode: boolean = false;
    export let storyProgress: number = 0;

    $: storyProgress;

    let showInstructions = false;
    
    type Vis3Mode = "overall" | "sex" | "race" | "county";
    type AgeGroup = "35+" | "35-64" | "65+";
  
    interface Vis3Row {
      state: string;
      year: number;
      view_mode: string;
      series_id: string;
      series_label: string;
      series_type: string;
      series_order: number;
      age_group: string;
      age_group_short: string;
      sex: string;
      race: string;
      county_name: string;
      location_id: string;
      mortality: number;
      unit: string;
      source: string;
      aggregation_method: string;
      available_counties: number | null;
      total_state_counties: number | null;
      coverage_ratio: number;
    }
  
    interface SeriesMeta {
      id: string;
      label: string;
      type: string;
      order: number;
      points: Vis3Row[];
      validPoints: Vis3Row[];
      latestMortality: number;
      meanMortality: number;
      countyName: string;
      locationId: string;
      firstValidPoint: Vis3Row | null;
      lastValidPoint: Vis3Row | null;
    }
  
    interface TooltipState {
      left: number;
      top: number;
      label: string;
      year: number;
      mortality: number;
      color: string;
      note: string;
    }
  
    interface EndLabel {
      id: string;
      text: string;
      color: string;
      sourceY: number;
      labelY: number;
      x1: number;
      x2: number;
      textX: number;
    }
  
    const YEARS = d3.range(1999, 2020) as number[];
    const MAX_VISIBLE_COUNTIES = 5;
  
    const CHART_WIDTH = 1080;
    const CHART_HEIGHT = 580;
  
    const margin = {
      top: 40,
      right: 190,
      bottom: 60,
      left: 82
    };
  
    const OFFICIAL_COLOR = "#9c7212";
    const BASELINE_COLOR = "#7a7a7a";
    const GRID_COLOR = "#e6e6e6";
    const TEXT_COLOR = "#333";
    const MUTED_TEXT_COLOR = "#666";
    const INACTIVE_COUNTY_COLOR = "#c7c7c7";
    const ACTIVE_COUNTY_PALETTE = ["#4e79a7", "#e15759", "#59a14f", "#f28e2b", "#76b7b2"];
    const STORY_LINE_DRAW_MS = 1180;
    const STORY_LINE_STAGGER_MS = 1100;
    const STORY_LINE_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
  
    const STATE_NAMES: Record<string, string> = {
      AL: "Alabama",
      AK: "Alaska",
      AZ: "Arizona",
      AR: "Arkansas",
      CA: "California",
      CO: "Colorado",
      CT: "Connecticut",
      DE: "Delaware",
      DC: "District of Columbia",
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
      WY: "Wyoming"
    };
  
    const sexColorMap: Record<string, string> = {
      Men: "#4e79a7",
      Women: "#e15759"
    };
  
    const raceColorMap: Record<string, string> = {
      White: "#4e79a7",
      "Black (Non-Hispanic)": "#e15759",
      Hispanic: "#f28e2b",
      "Asian/Pacific Islander": "#76b7b2",
      "American Indian/Alaska Native": "#59a14f"
    };
  
    let rawData: Vis3Row[] = [];
    let loading = true;
    let error: string | null = null;
  
    let activeSeriesIds: string[] = [];
    let countyToAdd = "";
    let tooltip: TooltipState | null = null;
    let containerEl: HTMLDivElement | null = null;
    let hoveredSeriesId: string | null = null;
  
    let countyColorAssignments: Record<string, string> = {};
    let lastViewKey = "";
    let lastStateForReset: string | null = null;
    let lastAppliedStoryStep = -1;
    let newlyAddedIds = new Set<string>();
    let storyTimers: number[] = [];

    function clearStoryTimers() {
      storyTimers.forEach((timerId) => window.clearTimeout(timerId));
      storyTimers = [];
    }

    onDestroy(() => {
      clearStoryTimers();
    });

    function buildRevealSequence(baseIds: string[], idsToAdd: string[], stagger = STORY_LINE_STAGGER_MS) {
      const stableBaseIds = Array.from(new Set(baseIds.filter(Boolean)));
      const revealIds = idsToAdd.filter((id) => id && !stableBaseIds.includes(id));
      const steps = [stableBaseIds];

      revealIds.forEach((_, index) => {
        steps.push([...stableBaseIds, ...revealIds.slice(0, index + 1)]);
      });

      return steps.map((ids, index) => ({
        ids,
        delay: index * stagger
      }));
    }

    function parseRow(d: d3.DSVRowString): Vis3Row {
      return {
        state: d.state,
        year: +d.year,
        view_mode: d.view_mode,
        series_id: d.series_id,
        series_label: d.series_label,
        series_type: d.series_type,
        series_order: +d.series_order,
        age_group: d.age_group,
        age_group_short: d.age_group_short,
        sex: d.sex,
        race: d.race,
        county_name: d.county_name,
        location_id: d.location_id,
        mortality: +d.mortality,
        unit: d.unit,
        source: d.source,
        aggregation_method: d.aggregation_method,
        available_counties: d.available_counties === "" ? null : +d.available_counties,
        total_state_counties: d.total_state_counties === "" ? null : +d.total_state_counties,
        coverage_ratio: d.coverage_ratio === "" ? NaN : +d.coverage_ratio
      };
    }
  
    function getStateName(code: string | null | undefined) {
      if (!code) return "";
      return STATE_NAMES[code] ?? code;
    }
  
    onMount(async () => {
      try {
        const data = await d3.csv(asset("/data/stroke_geo_vis3.csv"), parseRow);
        rawData = data.filter((d) => Number.isFinite(d.mortality));
      } catch (e) {
        error = "Failed to load vis3 data";
        console.error(e);
      } finally {
        loading = false;
      }
    });
    
    $: if (storyMode && storyStep != null && !loading && storyStep !== lastAppliedStoryStep) {
      clearStoryTimers();

      lastAppliedStoryStep = storyStep;
      countyToAdd = "";
      tooltip = null;
      hoveredSeriesId = null;
      countyColorAssignments = {};
      newlyAddedIds = new Set();

      function animateIn(steps: { ids: string[]; delay: number }[]) {
        steps.forEach(({ ids, delay }) => {
          const runStep = () => {
            const prev = new Set(activeSeriesIds);
            activeSeriesIds = ids;
            newlyAddedIds = new Set(ids.filter((id) => !prev.has(id)));
          };

          if (delay <= 0) {
            runStep();
            return;
          }

          const timerId = window.setTimeout(runStep, delay);
          storyTimers.push(timerId);
        });
      }

      if (storyStep === 8) {
        selectedVis3Mode.set("overall");
        selectedAgeGroup.set("35+");
        activeSeriesIds = referenceSeriesId ? [referenceSeriesId] : [];
        newlyAddedIds = new Set(activeSeriesIds);
      } else if (storyStep === 9) {
        selectedVis3Mode.set("sex");
        selectedAgeGroup.set("35-64");
        animateIn(
          buildRevealSequence(["sex_overall"], ["sex_men", "sex_women"])
        );
      } else if (storyStep === 10) {
        selectedVis3Mode.set("race");
        selectedAgeGroup.set("35-64");
        activeSeriesIds = ["race_overall"];
        newlyAddedIds = new Set(["race_overall"]);
      } else if (storyStep === 11) {
        selectedVis3Mode.set("race");
        selectedAgeGroup.set("35-64");
        animateIn(
          buildRevealSequence(
            ["race_overall"],
            [
              "race_white",
              "race_black_non_hispanic",
              "race_hispanic",
              "race_asian_pacific_islander",
              "race_american_indian_alaska_native"
            ]
          )
        );
      } else if (storyStep === 12) {
        selectedVis3Mode.set("county");
        selectedAgeGroup.set("35-64");
        activeSeriesIds = referenceSeriesId ? [referenceSeriesId] : [];
        countyColorAssignments = {};
        newlyAddedIds = new Set(activeSeriesIds);
      } else if (storyStep === 13) {
        selectedVis3Mode.set("county");
        selectedAgeGroup.set("35-64");

        const base = referenceSeriesId ? [referenceSeriesId] : [];
        const countyIds = suggestedCounties.slice(0, 5).map((d) => d.id);

        countyIds.forEach((id) => assignCountyColor(id));

        animateIn(buildRevealSequence(base, countyIds));
      }
    }

    $: if (!$selectedState) {
      lastStateForReset = null;
    }
  
    $: if ($selectedState && $selectedState !== lastStateForReset) {
      lastStateForReset = $selectedState;
      selectedVis3Mode.set("overall");
      selectedAgeGroup.set("35+");
    }
  
    function buildFullYearSeries(rows: Vis3Row[]): Vis3Row[] {
      const byYear = new Map(rows.map((d) => [d.year, d]));
      return YEARS.map((year) => {
        const found = byYear.get(year);
        if (found) return found;
  
        const base = rows[0];
        return {
          ...base,
          year,
          mortality: NaN
        };
      });
    }
  
    function setMode(mode: Vis3Mode) {
      selectedVis3Mode.set(mode);
  
      if (mode === "overall") {
        selectedAgeGroup.set("35+");
        return;
      }
  
      if ($selectedAgeGroup === "35+") {
        selectedAgeGroup.set("35-64");
      }
    }
  
    function setAge(age: AgeGroup) {
      selectedAgeGroup.set(age);
    }
  
    function getReferenceSeriesId(seriesList: SeriesMeta[]): string | null {
      if (!seriesList.length) return null;
  
      if ($selectedVis3Mode === "overall") {
        return seriesList[0]?.id ?? null;
      }
  
      if ($selectedVis3Mode === "county") {
        return (
          seriesList.find((d) => d.type === "state_average")?.id ??
          seriesList[0]?.id ??
          null
        );
      }
  
      return (
        seriesList.find((d) => d.label === "Overall")?.id ??
        seriesList[0]?.id ??
        null
      );
    }
  
    function assignCountyColor(id: string) {
      if (countyColorAssignments[id]) return countyColorAssignments[id];
  
      const usedColors = new Set(Object.values(countyColorAssignments));
      const nextColor =
        ACTIVE_COUNTY_PALETTE.find((color) => !usedColors.has(color)) ??
        ACTIVE_COUNTY_PALETTE[Object.keys(countyColorAssignments).length % ACTIVE_COUNTY_PALETTE.length];
  
      countyColorAssignments = {
        ...countyColorAssignments,
        [id]: nextColor
      };
  
      return nextColor;
    }
  
    function removeCountyColor(id: string) {
      const next = { ...countyColorAssignments };
      delete next[id];
      countyColorAssignments = next;
    }
  
    function resetComparison() {
      clearStoryTimers();
      activeSeriesIds = referenceSeriesId ? [referenceSeriesId] : [];
      countyToAdd = "";
      tooltip = null;
      hoveredSeriesId = null;
      countyColorAssignments = {};
      newlyAddedIds = new Set(activeSeriesIds);
    }
  
    function toggleSeries(id: string) {
      if (!id || id === referenceSeriesId) return;
  
      if (activeSeriesIds.includes(id)) {
        activeSeriesIds = activeSeriesIds.filter((d) => d !== id);
        newlyAddedIds = new Set();
      } else {
        activeSeriesIds = [...activeSeriesIds, id];
        hoveredSeriesId = id;
        newlyAddedIds = new Set([id]);
      }
  
      tooltip = null;
    }
  
    function addCounty(id: string) {
      if (!id || id === referenceSeriesId) return;
  
      const currentCountyIds = activeSeriesIds.filter((d) => d !== referenceSeriesId);
  
      if (currentCountyIds.includes(id)) {
        countyToAdd = "";
        return;
      }
  
      if (currentCountyIds.length >= MAX_VISIBLE_COUNTIES) {
        countyToAdd = "";
        return;
      }
  
      assignCountyColor(id);
  
      activeSeriesIds = referenceSeriesId
        ? [referenceSeriesId, ...currentCountyIds, id]
        : [...currentCountyIds, id];
  
      countyToAdd = "";
      hoveredSeriesId = id;
      newlyAddedIds = new Set([id]);
      tooltip = null;
    }
  
    function toggleCounty(id: string) {
      if (!id || id === referenceSeriesId) return;
  
      if (activeSeriesIds.includes(id)) {
        activeSeriesIds = activeSeriesIds.filter((d) => d !== id);
        removeCountyColor(id);
        hoveredSeriesId = null;
        newlyAddedIds = new Set();
      } else {
        addCounty(id);
      }
  
      tooltip = null;
    }
  
    function removeCounty(id: string) {
      if (!id || id === referenceSeriesId) return;
  
      activeSeriesIds = activeSeriesIds.filter((d) => d !== id);
      removeCountyColor(id);
      hoveredSeriesId = null;
      newlyAddedIds = new Set();
      tooltip = null;
    }
  
    function clearCounties() {
      resetComparison();
    }
  
    function formatMortality(value: number) {
      return d3.format(".1f")(value);
    }
  
    function getDisplayedSeriesLabel(series: SeriesMeta | null | undefined) {
      if (!series) return "";
      if ($selectedVis3Mode === "overall" && series.id === referenceSeriesId) return "Official state rate";
      if ($selectedVis3Mode === "county" && series.id === referenceSeriesId) return "State average";
      if (series.id === referenceSeriesId) return "State baseline";
      return series.label;
    }
  
    function getDirectLabelText(series: SeriesMeta | null | undefined) {
      if (!series) return "";
  
      if (series.id === referenceSeriesId) return "Baseline";
  
      if (series.label === "Black (Non-Hispanic)") return "Black";
      if (series.label === "Asian/Pacific Islander") return "Asian/PI";
      if (series.label === "American Indian/Alaska Native") return "AI/AN";
  
      return series.label;
    }
  
    function getCountyLineColor(id: string) {
      return countyColorAssignments[id] ?? INACTIVE_COUNTY_COLOR;
    }
  
    function getCountyChipColor(id: string) {
      return countyColorAssignments[id] ?? INACTIVE_COUNTY_COLOR;
    }
  
    function getSeriesColor(series: SeriesMeta | null | undefined): string {
      if (!series) return "#888";
  
      if ($selectedVis3Mode === "overall" && series.id === referenceSeriesId) {
        return OFFICIAL_COLOR;
      }
  
      if (series.id === referenceSeriesId || series.type === "state_average") {
        return BASELINE_COLOR;
      }
  
      if ($selectedVis3Mode === "sex") {
        return sexColorMap[series.label] ?? "#4e79a7";
      }
  
      if ($selectedVis3Mode === "race") {
        return raceColorMap[series.label] ?? "#4e79a7";
      }
  
      if ($selectedVis3Mode === "county") {
        return getCountyLineColor(series.id);
      }
  
      return "#4e79a7";
    }
  
    function getStrokeWidth(series: SeriesMeta) {
      if ($selectedVis3Mode === "county") {
        if (series.id === referenceSeriesId || series.type === "state_average") {
          return hoveredSeriesId === series.id ? 3.2 : 2.8;
        }

        if (series.id === countyFocusId) {
          return hoveredSeriesId === series.id ? 4.2 : 3.6;
        }

        return hoveredSeriesId ? 1.8 : 1.9;
      }

      if ($selectedVis3Mode === "race") {
        if (series.id === referenceSeriesId) {
          return hoveredSeriesId === series.id ? 3.2 : 2.8;
        }

        if (series.id === raceFocusId) {
          return hoveredSeriesId === series.id ? 4.1 : 3.5;
        }

        return hoveredSeriesId ? 1.9 : 2.05;
      }

      let width = 2.8;
  
      if ($selectedVis3Mode === "overall" && series.id === referenceSeriesId) {
        width = 4.6;
      } else if (series.id === referenceSeriesId) {
        width = 2.8;
      } else if (series.type === "county") {
        width = 2.3;
      }
  
      if (hoveredSeriesId === series.id) {
        width += 1.15;
      }
  
      return width;
    }
  
    function getStrokeDasharray(series: SeriesMeta): string | null {
      if ($selectedVis3Mode === "overall") return null;
      if (series.id === referenceSeriesId || series.type === "state_average") {
        return "7 5";
      }
      return null;
    }
  
    function getSeriesOpacity(series: SeriesMeta) {
      if ($selectedVis3Mode === "county") {
        if (!activeCountyIds.length) {
          return series.id === referenceSeriesId ? 0.88 : 0.5;
        }

        if (hoveredSeriesId) {
          if (series.id === hoveredSeriesId) return 1;
          if (series.id === referenceSeriesId) {
            return hoveredSeriesId === referenceSeriesId ? 0.96 : 0.54;
          }
          return 0.22;
        }

        if (series.id === countyFocusId) return 0.98;
        if (series.id === referenceSeriesId) return 0.66;
        return 0.28;
      }

      if ($selectedVis3Mode === "race") {
        if (!activeRaceIds.length) {
          return series.id === referenceSeriesId ? 0.9 : 0.5;
        }

        if (hoveredSeriesId) {
          if (series.id === hoveredSeriesId) return 1;
          if (series.id === referenceSeriesId) {
            return hoveredSeriesId === referenceSeriesId ? 0.96 : 0.58;
          }
          return 0.18;
        }

        if (series.id === raceFocusId) return 0.98;
        if (series.id === referenceSeriesId) return 0.7;
        return activeRaceIds.length <= 1 ? 0.96 : 0.3;
      }

      if (visibleSeries.length <= 1 || !hoveredSeriesId) {
        if (series.id === referenceSeriesId && $selectedVis3Mode !== "overall") return 0.78;
        return 0.97;
      }
  
      if (series.id === hoveredSeriesId) return 1;
      if (series.id === referenceSeriesId) return 0.34;
      return 0.16;
    }
  
    function getPointOpacity(series: SeriesMeta) {
      if ($selectedVis3Mode === "county") {
        if (!activeCountyIds.length) {
          return series.id === referenceSeriesId ? 0.72 : 0.32;
        }

        if (hoveredSeriesId) {
          if (series.id === hoveredSeriesId) return 1;
          if (series.id === referenceSeriesId) {
            return hoveredSeriesId === referenceSeriesId ? 0.82 : 0.34;
          }
          return 0.1;
        }

        if (series.id === countyFocusId) return 0.9;
        if (series.id === referenceSeriesId) return 0.44;
        return 0.12;
      }

      if ($selectedVis3Mode === "race") {
        if (!activeRaceIds.length) {
          return series.id === referenceSeriesId ? 0.78 : 0.32;
        }

        if (hoveredSeriesId) {
          if (series.id === hoveredSeriesId) return 1;
          if (series.id === referenceSeriesId) {
            return hoveredSeriesId === referenceSeriesId ? 0.84 : 0.36;
          }
          return 0.08;
        }

        if (series.id === raceFocusId) return 0.92;
        if (series.id === referenceSeriesId) return 0.5;
        return activeRaceIds.length <= 1 ? 0.9 : 0.14;
      }

      if (visibleSeries.length <= 1 || !hoveredSeriesId) {
        if (series.id === referenceSeriesId && $selectedVis3Mode !== "overall") return 0.62;
        return 0.88;
      }
  
      if (series.id === hoveredSeriesId) return 1;
      if (series.id === referenceSeriesId) return 0.34;
      return 0.12;
    }
  
    function getPointRadius(series: SeriesMeta) {
      if ($selectedVis3Mode === "county") {
        if (series.id === referenceSeriesId) return hoveredSeriesId === series.id ? 3.6 : 3.1;
        if (series.id === countyFocusId || hoveredSeriesId === series.id) return 3.7;
        return 1.8;
      }

      if ($selectedVis3Mode === "race") {
        if (series.id === referenceSeriesId) {
          return hoveredSeriesId === series.id ? 3.6 : 3.1;
        }
        if (series.id === raceFocusId || hoveredSeriesId === series.id) return 3.8;
        return 2;
      }

      if ($selectedVis3Mode === "overall" && series.id === referenceSeriesId) return 4;
      if (hoveredSeriesId === series.id) return 4;
      return series.type === "county" ? 2.4 : 2.8;
    }
  
    function showTooltip(event: MouseEvent, point: Vis3Row, series: SeriesMeta) {
      if (!containerEl) return;
  
      const rect = containerEl.getBoundingClientRect();
      const left = Math.min(
        Math.max(12, event.clientX - rect.left + 12),
        rect.width - 225
      );
      const top = Math.min(
        Math.max(12, event.clientY - rect.top - 12),
        rect.height - 96
      );
  
      tooltip = {
        left,
        top,
        label: getDisplayedSeriesLabel(series),
        year: point.year,
        mortality: point.mortality,
        color: getSeriesColor(series),
        note:
          $selectedVis3Mode === "overall"
            ? "Official state-level rate"
            : $selectedVis3Mode === "county" && series.id === referenceSeriesId
              ? "State average"
              : series.id === referenceSeriesId
                ? "State baseline"
                : series.type === "county"
                  ? "County"
                  : modeLabel
      };
  
      hoveredSeriesId = series.id;
    }
  
    function hideTooltip() {
      tooltip = null;
    }
  
    function setHoveredSeries(id: string | null) {
  hoveredSeriesId = id;
}

function applyDraw(node: SVGPathElement, shouldAnimate: boolean) {
  if (!shouldAnimate) return {};

  const originalDash = node.getAttribute("stroke-dasharray") || "";
  const length = node.getTotalLength();
  node.style.strokeDasharray = String(length);
  node.style.strokeDashoffset = String(length);
  node.style.opacity = "0.24";
  node.style.transition = "none";

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      node.style.transition = `stroke-dashoffset ${STORY_LINE_DRAW_MS}ms ${STORY_LINE_EASE}, opacity 280ms ease`;
      node.style.strokeDashoffset = "0";
      node.style.opacity = "";
    });
  });

  const onEnd = () => {
    node.style.transition = "";
    node.style.strokeDasharray = originalDash;
    node.style.strokeDashoffset = "";
    node.style.opacity = "";
  };

  node.addEventListener("transitionend", onEnd, { once: true });
  return {
    destroy() {
      node.removeEventListener("transitionend", onEnd);
      node.style.transition = "";
      node.style.strokeDasharray = originalDash;
      node.style.strokeDashoffset = "";
      node.style.opacity = "";
    }
  };
}

function getDirectConnectorOpacity(id: string) {
  if ($selectedVis3Mode === "race") {
    if (!activeRaceIds.length) return id === referenceSeriesId ? 0.72 : 0.84;

    if (hoveredSeriesId) {
      if (id === hoveredSeriesId) return 0.78;
      if (id === referenceSeriesId) {
        return hoveredSeriesId === referenceSeriesId ? 0.74 : 0.42;
      }
      return 0.14;
    }

    if (id === raceFocusId) return 0.76;
    if (id === referenceSeriesId) return 0.52;
    return activeRaceIds.length <= 1 ? 0.76 : 0.22;
  }

  return hoveredSeriesId && hoveredSeriesId !== id ? 0.18 : 0.72;
}

function getDirectLabelOpacity(id: string) {
  if ($selectedVis3Mode === "race") {
    if (!activeRaceIds.length) return id === referenceSeriesId ? 0.9 : 1;

    if (hoveredSeriesId) {
      if (id === hoveredSeriesId) return 1;
      if (id === referenceSeriesId) {
        return hoveredSeriesId === referenceSeriesId ? 0.96 : 0.56;
      }
      return 0.18;
    }

    if (id === raceFocusId) return 1;
    if (id === referenceSeriesId) return 0.72;
    return activeRaceIds.length <= 1 ? 1 : 0.34;
  }

  return hoveredSeriesId && hoveredSeriesId !== id ? 0.18 : 1;
}

function getDirectLabelWeight(id: string) {
  if ($selectedVis3Mode === "race") {
    if (hoveredSeriesId === id) return "700";
    if (!hoveredSeriesId && id === raceFocusId) return "700";
    return "600";
  }

  return hoveredSeriesId === id ? "700" : "600";
}
  
    function buildEndLabels(seriesList: SeriesMeta[]): EndLabel[] {
      if ($selectedVis3Mode !== "sex" && $selectedVis3Mode !== "race") return [];
      if (!seriesList.length) return [];
  
      const items = seriesList
        .filter((series) => series.lastValidPoint)
        .map((series) => ({
          id: series.id,
          text: getDirectLabelText(series),
          color: getSeriesColor(series),
          sourceY: yScale(series.lastValidPoint!.mortality),
          labelY: yScale(series.lastValidPoint!.mortality),
          x1: xScale(series.lastValidPoint!.year) + 5,
          x2: CHART_WIDTH - margin.right + 12,
          textX: CHART_WIDTH - margin.right + 16
        }))
        .filter((d) => d.text)
        .sort((a, b) => d3.ascending(a.sourceY, b.sourceY));
  
      const minGap = 16;
      const minY = margin.top + 10;
      const maxY = CHART_HEIGHT - margin.bottom - 10;
  
      let lastY = minY - minGap;
  
      for (const item of items) {
        item.labelY = Math.max(item.sourceY, lastY + minGap, minY);
        lastY = item.labelY;
      }
  
      if (items.length && items[items.length - 1].labelY > maxY) {
        let overflow = items[items.length - 1].labelY - maxY;
  
        for (let i = items.length - 1; i >= 0 && overflow > 0; i--) {
          const upperBound = i === 0 ? minY : items[i - 1].labelY + minGap;
          const available = items[i].labelY - upperBound;
          const shift = Math.min(available, overflow);
          items[i].labelY -= shift;
          overflow -= shift;
        }
      }
  
      return items;
    }
  
    $: stateData = $selectedState
      ? rawData.filter((d) => d.state === $selectedState)
      : [];
  
    $: modeData = !$selectedState
      ? []
      : $selectedVis3Mode === "overall"
        ? stateData.filter(
            (d) => d.view_mode === "overall" && d.age_group_short === "35+"
          )
        : stateData.filter(
            (d) =>
              d.view_mode === $selectedVis3Mode &&
              d.age_group_short === $selectedAgeGroup
          );
  
    $: seriesMeta = (
      Array.from(
        d3.group(modeData, (d: Vis3Row) => d.series_id),
        ([id, rows]: [string, Vis3Row[]]) => {
          const validRows = [...rows].sort((a, b) => d3.ascending(a.year, b.year));
          const points = buildFullYearSeries(validRows);
          const firstValid = validRows[0] ?? null;
          const lastValid = validRows[validRows.length - 1] ?? null;
          const meanMortality = d3.mean(validRows, (d) => d.mortality) ?? NaN;
  
          return {
            id,
            label: validRows[0].series_label,
            type: validRows[0].series_type,
            order: validRows[0].series_order ?? 99,
            points,
            validPoints: validRows,
            latestMortality: lastValid?.mortality ?? NaN,
            meanMortality,
            countyName: validRows[0].county_name,
            locationId: validRows[0].location_id,
            firstValidPoint: firstValid,
            lastValidPoint: lastValid
          };
        }
      ) as SeriesMeta[]
    ).sort(
      (a, b) =>
        d3.ascending(a.order, b.order) ||
        d3.ascending(a.label, b.label)
    );
  
    $: referenceSeriesId = getReferenceSeriesId(seriesMeta);
  
    $: subgroupLegendItems = seriesMeta.filter(
      (d) => d.id !== referenceSeriesId && d.label !== "Overall"
    );
  
    $: countyOptions = seriesMeta
      .filter((d) => d.type === "county")
      .sort((a, b) => d3.ascending(a.label, b.label));
  
    $: suggestedCounties = [...countyOptions]
      .sort((a, b) => d3.descending(a.latestMortality, b.latestMortality))
      .slice(0, 5);
  
    $: currentViewKey = `${$selectedState ?? "none"}|${$selectedVis3Mode}|${$selectedAgeGroup}`;
  
    $: if (!$selectedState) {
      clearStoryTimers();
      activeSeriesIds = [];
      countyToAdd = "";
      countyColorAssignments = {};
      lastViewKey = "";
      tooltip = null;
      hoveredSeriesId = null;
      newlyAddedIds = new Set();
    }
  
    $: if (
      $selectedState &&
      seriesMeta.length &&
      currentViewKey !== lastViewKey &&
      !storyMode
    ) {
      clearStoryTimers();
      lastViewKey = currentViewKey;
      activeSeriesIds = referenceSeriesId ? [referenceSeriesId] : [];
      countyToAdd = "";
      countyColorAssignments = {};
      tooltip = null;
      hoveredSeriesId = null;
      newlyAddedIds = new Set(activeSeriesIds);
    }
  
    $: activeCountyIds =
      $selectedVis3Mode === "county"
        ? activeSeriesIds.filter((d) => d !== referenceSeriesId)
        : [];
    $: countyLimitReached = activeCountyIds.length >= MAX_VISIBLE_COUNTIES;
    $: activeRaceIds =
      $selectedVis3Mode === "race"
        ? activeSeriesIds.filter((d) => d !== referenceSeriesId)
        : [];
  
    $: seriesById = new Map(seriesMeta.map((d) => [d.id, d]));
    $: activeCountySeries = activeCountyIds
      .map((id) => seriesById.get(id))
      .filter(Boolean);
  
    $: visibleSeries =
      $selectedVis3Mode === "county"
        ? [
            ...(referenceSeriesId && seriesById.get(referenceSeriesId)
              ? [seriesById.get(referenceSeriesId)]
              : []),
            ...activeCountySeries
          ]
        : seriesMeta.filter(
            (d) => d.id === referenceSeriesId || activeSeriesIds.includes(d.id)
          );

    $: countyFocusId =
      $selectedVis3Mode !== "county"
        ? null
        : hoveredSeriesId &&
            hoveredSeriesId !== referenceSeriesId &&
            activeCountyIds.includes(hoveredSeriesId)
          ? hoveredSeriesId
          : [...newlyAddedIds].find(
              (id) => id !== referenceSeriesId && activeCountyIds.includes(id)
            ) ?? activeCountyIds[activeCountyIds.length - 1] ?? null;

    $: raceFocusId =
      $selectedVis3Mode !== "race"
        ? null
        : hoveredSeriesId &&
            hoveredSeriesId !== referenceSeriesId &&
            activeRaceIds.includes(hoveredSeriesId)
          ? hoveredSeriesId
          : [...newlyAddedIds].find(
              (id) => id !== referenceSeriesId && activeRaceIds.includes(id)
            ) ?? activeRaceIds[activeRaceIds.length - 1] ?? null;

    $: comparisonFocusId =
      $selectedVis3Mode === "county"
        ? countyFocusId
        : $selectedVis3Mode === "race"
          ? raceFocusId
          : null;

    $: chartSeries =
      ($selectedVis3Mode === "county" || $selectedVis3Mode === "race") && visibleSeries.length
        ? [
            ...visibleSeries.filter((d) => d.id === referenceSeriesId),
            ...visibleSeries.filter(
              (d) => d.id !== referenceSeriesId && d.id !== comparisonFocusId
            ),
            ...visibleSeries.filter((d) => d.id === comparisonFocusId)
          ]
        : visibleSeries;
  
    $: visiblePoints = visibleSeries.flatMap((series) => series.validPoints);
  
    $: yMin = visiblePoints.length
      ? (d3.min(visiblePoints, (d: Vis3Row) => d.mortality) ?? 0)
      : 0;
  
    $: yMax = visiblePoints.length
      ? (d3.max(visiblePoints, (d: Vis3Row) => d.mortality) ?? 100)
      : 100;
  
    $: yPadding = Math.max(5, ((yMax ?? 0) - (yMin ?? 0)) * 0.08 || 5);
  
    $: yScale = d3
      .scaleLinear()
      .domain([
        Math.max(0, (yMin ?? 0) - yPadding),
        (yMax ?? 100) + yPadding
      ])
      .nice()
      .range([CHART_HEIGHT - margin.bottom, margin.top]);
  
    $: xScale = d3
      .scaleLinear()
      .domain([1999, 2019])
      .range([margin.left, CHART_WIDTH - margin.right]);
  
    $: yTicks = yScale.ticks(6);
    $: xTicks = [1999, 2003, 2007, 2011, 2015, 2019];
  
    $: lineGenerator = d3
      .line<Vis3Row>()
      .defined((d) => Number.isFinite(d.mortality))
      .x((d) => xScale(d.year))
      .y((d) => yScale(d.mortality));
  
    $: stateName = getStateName($selectedState);
  
    $: panelTitle = $selectedState
      ? `Stroke mortality trend in ${stateName}`
      : "Stroke mortality detail view";
  
    $: modeLabel =
      $selectedVis3Mode === "overall"
        ? "Overall"
        : $selectedVis3Mode === "sex"
          ? "Sex"
          : $selectedVis3Mode === "race"
            ? "Race"
            : "County";
  
    $: subtitle = !$selectedState
      ? "Click a state line in Visualization 1 to populate this detail view."
      : $selectedVis3Mode === "overall"
        ? `Official state-level trend for adults 35+ in ${stateName}. Unit: per 100,000.`
        : $selectedVis3Mode === "county"
          ? `County comparison in ${stateName}, ages ${$selectedAgeGroup}. Dashed gray line = state average. Unit: per 100,000.`
          : $selectedVis3Mode === "race"
            ? `Race comparison in ${stateName}, ages ${$selectedAgeGroup}. Dashed gray line = state baseline. Unit: per 100,000.`
            : `${modeLabel} comparison in ${stateName}, ages ${$selectedAgeGroup}. Dashed gray line = state baseline. Unit: per 100,000.`;
  
    $: yTickFormat =
      (yMax ?? 0) - (yMin ?? 0) < 20 ? d3.format(".1f") : d3.format(".0f");
  
    $: dataNote =
      $selectedVis3Mode === "overall"
        ? "Higher lines indicate higher stroke mortality per 100,000. The highlighted line is the official state-level rate."
        : $selectedVis3Mode === "county"
          ? "The dashed gray line shows the state average for the selected age group. The newest or hovered county stays emphasized, while the other counties remain muted for context. Breaks in a line indicate missing yearly values."
          : $selectedVis3Mode === "race"
            ? "The dashed gray line shows the selected state's baseline for the current age group. The newest or hovered race subgroup stays emphasized, while the other race lines remain muted for context. Breaks in a line indicate missing yearly values."
            : "The dashed gray line shows the selected state's baseline for the current age group. Solid colored lines show subgroup trends. Breaks in a line indicate missing yearly values.";
  
    $: directLabels = buildEndLabels(visibleSeries);
  
    $: takeawayText = (() => {
      if (!$selectedState || !visibleSeries.length) return "";
  
      const refSeries = visibleSeries.find((d) => d.id === referenceSeriesId) ?? visibleSeries[0];
  
      if ($selectedVis3Mode === "overall" && refSeries?.firstValidPoint && refSeries?.lastValidPoint) {
        const first = refSeries.firstValidPoint;
        const last = refSeries.lastValidPoint;
        const delta = last.mortality - first.mortality;
  
        if (Math.abs(delta) < 0.5) {
          return `${stateName}'s official state-level rate is broadly stable from ${first.year} to ${last.year}.`;
        }
  
        return delta < 0
          ? `${stateName}'s official state-level rate declines by ${formatMortality(Math.abs(delta))}, from ${formatMortality(first.mortality)} to ${formatMortality(last.mortality)} per 100,000 between ${first.year} and ${last.year}.`
          : `${stateName}'s official state-level rate increases by ${formatMortality(Math.abs(delta))}, from ${formatMortality(first.mortality)} to ${formatMortality(last.mortality)} per 100,000 between ${first.year} and ${last.year}.`;
      }
  
      const subgroupSeries = visibleSeries.filter(
        (d) => d.id !== referenceSeriesId && d.lastValidPoint
      );
  
      if (!subgroupSeries.length) {
        return $selectedVis3Mode === "county"
          ? `Add up to ${MAX_VISIBLE_COUNTIES} counties to compare them against the dashed state average in ${stateName}.`
          : `Add subgroup lines to compare categories against the dashed state baseline in ${stateName}.`;
      }
  
      const ranked = [...subgroupSeries].sort(
        (a, b) => d3.descending(a.lastValidPoint!.mortality, b.lastValidPoint!.mortality)
      );
  
      const highest = ranked[0];
      const lowest = ranked[ranked.length - 1];
  
      if (ranked.length === 1) {
        return `${getDisplayedSeriesLabel(highest)} is currently shown against the state baseline in ${stateName}.`;
      }
  
      const latestYear = d3.max(ranked, (d) => d.lastValidPoint?.year ?? 0) ?? 0;
  
      if ($selectedVis3Mode === "county") {
        return `Among the selected counties, ${highest.label} ends highest and ${lowest.label} ends lowest in the latest available year (${latestYear}).`;
      }
  
      return `Among the visible ${modeLabel.toLowerCase()} groups, ${highest.label} ends highest and ${lowest.label} ends lowest in the latest available year (${latestYear}).`;
    })();
  </script>
  
  <div class="detail-panel" bind:this={containerEl}>
  <div class="panel-header">
    <div>
      <h3 class="panel-title">{panelTitle}</h3>
      <p class="panel-subtitle">{subtitle}</p>
    </div>
    <div class="header-right">
      {#if $selectedState}
        <div class="state-chip">{stateName} ({$selectedState})</div>
      {/if}
      <button class="info-btn" onclick={() => showInstructions = !showInstructions}>ℹ</button>
    </div>
  </div>

  {#if showInstructions}
    <div class="instructions-popup">
      <button class="close-btn" onclick={() => showInstructions = false}>✕</button>
      <p>{subtitle}</p>
      <p><strong>How to use:</strong> select a state in Visualization 1, choose a comparison mode, then add subgroup lines with the legend or county selector.</p>
    </div>
  {/if}
  
    <div class="control-row">
      <div class="control-group">
        <span class="control-label">Compare by</span>
  
        <button
          type="button"
          aria-pressed={$selectedVis3Mode === "overall"}
          class:selected={$selectedVis3Mode === "overall"}
          class="mode-btn"
          onclick={() => setMode("overall")}
        >
          Overall
        </button>
  
        <button
          type="button"
          aria-pressed={$selectedVis3Mode === "sex"}
          class:selected={$selectedVis3Mode === "sex"}
          class="mode-btn"
          onclick={() => setMode("sex")}
        >
          Sex
        </button>
  
        <button
          type="button"
          aria-pressed={$selectedVis3Mode === "race"}
          class:selected={$selectedVis3Mode === "race"}
          class="mode-btn"
          onclick={() => setMode("race")}
        >
          Race
        </button>
  
        <button
          type="button"
          aria-pressed={$selectedVis3Mode === "county"}
          class:selected={$selectedVis3Mode === "county"}
          class="mode-btn"
          onclick={() => setMode("county")}
        >
          County
        </button>
      </div>
  
      {#if $selectedVis3Mode !== "overall"}
        <div class="control-group">
          <span class="control-label">Age group</span>
  
          <button
            type="button"
            aria-pressed={$selectedAgeGroup === "35-64"}
            class:selected={$selectedAgeGroup === "35-64"}
            class="mode-btn"
            onclick={() => setAge("35-64")}
          >
            35–64
          </button>
  
          <button
            type="button"
            aria-pressed={$selectedAgeGroup === "65+"}
            class:selected={$selectedAgeGroup === "65+"}
            class="mode-btn"
            onclick={() => setAge("65+")}
          >
            65+
          </button>
        </div>
      {/if}
  
      {#if $selectedState && $selectedVis3Mode !== "overall"}
        <div class="control-group push-right">
          <button
            type="button"
            class="clear-btn"
            onclick={resetComparison}
            disabled={activeSeriesIds.length <= 1}
          >
            Clear comparison
          </button>
        </div>
      {/if}
    </div>

    <div class="note-block">
      <p><strong>Reading note:</strong> {dataNote}</p>
      <p><strong>Current takeaway:</strong> {takeawayText || "Select a state to generate a comparison takeaway."}</p>
    </div>
  
    {#if loading}
      <div class="message-box">Loading vis3 data…</div>
    {:else if error}
      <div class="message-box error">{error}</div>
    {:else if !$selectedState}
      <div class="message-box">Please select a state from Visualization 1.</div>
    {:else if !seriesMeta.length}
      <div class="message-box">No data are available for this state and selection.</div>
    {:else}
  
      <div class="chart-area">

      <div class="chart-wrapper">
        <svg
          class="chart-svg"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {#each yTicks as tick}
            <line
              x1={margin.left}
              x2={CHART_WIDTH - margin.right}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke={GRID_COLOR}
              stroke-width="1"
            />
            <text
              x={margin.left - 10}
              y={yScale(tick)}
              dy="0.32em"
              text-anchor="end"
              font-size="12"
              fill={MUTED_TEXT_COLOR}
            >
              {yTickFormat(tick)}
            </text>
          {/each}
  
          <line
            x1={margin.left}
            x2={CHART_WIDTH - margin.right}
            y1={CHART_HEIGHT - margin.bottom}
            y2={CHART_HEIGHT - margin.bottom}
            stroke={TEXT_COLOR}
            stroke-width="1.5"
          />
  
          <line
            x1={margin.left}
            x2={margin.left}
            y1={margin.top}
            y2={CHART_HEIGHT - margin.bottom}
            stroke={TEXT_COLOR}
            stroke-width="1.5"
          />
  
          {#each xTicks as tick}
            <line
              x1={xScale(tick)}
              x2={xScale(tick)}
              y1={CHART_HEIGHT - margin.bottom}
              y2={CHART_HEIGHT - margin.bottom + 6}
              stroke={TEXT_COLOR}
              stroke-width="1"
            />
            <text
              x={xScale(tick)}
              y={CHART_HEIGHT - margin.bottom + 22}
              text-anchor="middle"
              font-size="12"
              fill={MUTED_TEXT_COLOR}
            >
              {tick}
            </text>
          {/each}
  
          <text
            x={(margin.left + CHART_WIDTH - margin.right) / 2}
            y={CHART_HEIGHT - 12}
            text-anchor="middle"
            font-size="13"
            fill={TEXT_COLOR}
          >
            Year
          </text>
  
          <text
            transform={`translate(20 ${(margin.top + CHART_HEIGHT - margin.bottom) / 2}) rotate(-90)`}
            text-anchor="middle"
            font-size="13"
            fill={TEXT_COLOR}
          >
            Mortality (per 100,000)
          </text>
  
          {#each chartSeries as series (series.id + "-hitbox")}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <path
              d={lineGenerator(series.points) || ""}
              fill="none"
              stroke="transparent"
              stroke-width={Math.max(getStrokeWidth(series) + 12, 14)}
              pointer-events="stroke"
              aria-hidden="true"
              role="presentation"
              onmouseenter={() => setHoveredSeries(series.id)}
              onmouseleave={() => setHoveredSeries(null)}
            />
          {/each}
  
          {#each chartSeries as series (series.id)}
  <path
    d={lineGenerator(series.points) || ""}
    fill="none"
    stroke={getSeriesColor(series)}
    stroke-width={getStrokeWidth(series)}
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-dasharray={getStrokeDasharray(series)}
    opacity={getSeriesOpacity(series)}
    pointer-events="none"
    use:applyDraw={newlyAddedIds.has(series.id)}
  />
{/each}
  
          {#if directLabels.length}
            {#each directLabels as label (label.id)}
              <line
                x1={label.x1}
                x2={label.x2}
                y1={label.sourceY}
                y2={label.labelY}
                stroke={label.color}
                stroke-width="1.2"
                opacity={getDirectConnectorOpacity(label.id)}
              />
              <text
                x={label.textX}
                y={label.labelY}
                dy="0.32em"
                font-size="12"
                font-weight={getDirectLabelWeight(label.id)}
                fill={label.color}
                opacity={getDirectLabelOpacity(label.id)}
              >
                {label.text}
              </text>
            {/each}
          {/if}
  
          {#each chartSeries as series (series.id + "-points")}
            {#each series.validPoints as point (`${series.id}-${point.year}`)}
              <circle
                role="img"
                aria-label={`${getDisplayedSeriesLabel(series)}, year ${point.year}, ${formatMortality(point.mortality)} per 100,000`}
                cx={xScale(point.year)}
                cy={yScale(point.mortality)}
                r={getPointRadius(series)}
                fill={getSeriesColor(series)}
                stroke="white"
                stroke-width="1"
                opacity={getPointOpacity(series)}
                onmouseenter={(event) => showTooltip(event, point, series)}
                onmousemove={(event) => showTooltip(event, point, series)}
                onmouseleave={() => {
                  hideTooltip();
                  setHoveredSeries(null);
                }}
              />
            {/each}
          {/each}
        </svg>
  
        {#if tooltip}
          <div
            class="tooltip"
            style={`left:${tooltip.left}px; top:${tooltip.top}px;`}
          >
            <div class="tooltip-title">
              <span class="swatch" style={`background:${tooltip.color};`}></span>
              {tooltip.label}
            </div>
            <div>Year: {tooltip.year}</div>
            <div>Mortality: {formatMortality(tooltip.mortality)} per 100,000</div>
            <div class="tooltip-note">{tooltip.note}</div>
          </div>
        {/if}
      </div>

      {#if $selectedVis3Mode === "sex" || $selectedVis3Mode === "race"}
        <div class="legend-panel">
          <div class="legend-title">
            {$selectedVis3Mode === "race"
              ? "Click subgroup labels to add or remove comparison lines. The dashed gray line remains as the state baseline, and the newest or hovered race subgroup is emphasized."
              : "Click subgroup labels to add or remove comparison lines. The dashed gray line remains as the state baseline."}
          </div>
  
          <div class="reference-note">
            <span class="line-swatch baseline"></span>
            <span>State baseline</span>
          </div>

          {#if $selectedVis3Mode === "race" && activeRaceIds.length > 1}
            <div class="focus-hint">
              The newest race line stays highlighted. Hover a subgroup label or line to bring that subgroup forward.
            </div>
          {/if}
  
          <div class="legend-items">
            {#each subgroupLegendItems as item (item.id)}
              <button
                type="button"
                aria-pressed={activeSeriesIds.includes(item.id)}
                class:selected={activeSeriesIds.includes(item.id)}
                class:focus-chip={$selectedVis3Mode === "race" && raceFocusId === item.id}
                class="legend-chip"
                onmouseenter={() => setHoveredSeries(item.id)}
                onmouseleave={() => setHoveredSeries(null)}
                onclick={() => toggleSeries(item.id)}
              >
                <span class="swatch" style={`background:${getSeriesColor(item)};`}></span>
                {item.label}
              </button>
            {/each}
          </div>
        </div>
      {/if}
  
      {#if $selectedVis3Mode === "county"}
        <div class="legend-panel">
          <div class="legend-title">
            Add up to {MAX_VISIBLE_COUNTIES} counties. The dashed gray line remains as the state average for the selected age group, and the newest or hovered county is emphasized.
          </div>
  
          <div class="reference-note">
            <span class="line-swatch baseline"></span>
            <span>State average</span>
          </div>
  
          <div class="county-toolbar">
            <div class="county-input-group">
              <label for="county-select">Add county</label>
              <select
                id="county-select"
                bind:value={countyToAdd}
                onchange={() => addCounty(countyToAdd)}
                disabled={countyLimitReached}
              >
                <option value="">Choose a county…</option>
                {#each countyOptions as county (county.id)}
                  <option value={county.id}>{county.label}</option>
                {/each}
              </select>
            </div>
  
            <button
              type="button"
              class="clear-btn"
              onclick={clearCounties}
              disabled={!activeCountyIds.length}
            >
              Clear counties
            </button>
          </div>
  
          <div class="selection-status">
            Showing {activeCountyIds.length} of {MAX_VISIBLE_COUNTIES} allowed counties
            {#if countyLimitReached}
              — remove one county to add another.
            {/if}
          </div>

          {#if activeCountyIds.length > 1}
            <div class="focus-hint">
              The newest county stays highlighted. Hover a county chip or line to bring that county forward.
            </div>
          {/if}
  
          <div class="suggestion-block">
            <span class="control-label">Suggested counties</span>
            <div class="legend-items">
              {#each suggestedCounties as county (county.id)}
                <button
                  type="button"
                  aria-pressed={activeSeriesIds.includes(county.id)}
                  class:selected={activeSeriesIds.includes(county.id)}
                  class:focus-chip={countyFocusId === county.id}
                  class="legend-chip"
                  onmouseenter={() => setHoveredSeries(county.id)}
                  onmouseleave={() => setHoveredSeries(null)}
                  onclick={() => toggleCounty(county.id)}
                  disabled={countyLimitReached && !activeSeriesIds.includes(county.id)}
                >
                  <span class="swatch" style={`background:${getCountyChipColor(county.id)};`}></span>
                  {county.label}
                </button>
              {/each}
            </div>
          </div>
  
          {#if activeCountyIds.length}
            <div class="suggestion-block">
              <span class="control-label">Visible counties</span>
              <div class="legend-items">
                {#each activeCountySeries as county (county.id)}
                  <button
                    type="button"
                    class:focus-chip={countyFocusId === county.id}
                    class="legend-chip selected"
                    onmouseenter={() => setHoveredSeries(county.id)}
                    onmouseleave={() => setHoveredSeries(null)}
                    onclick={() => removeCounty(county.id)}
                  >
                    <span class="swatch" style={`background:${getCountyLineColor(county.id)};`}></span>
                    {county.label} ×
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}

      
      </div>
  
      
    {/if}
  </div>
  
  <style>
    .detail-panel {
      border: 1px solid var(--story-border, #e8d2cb);
      border-radius: 18px;
      padding: 16px 20px 12px;
      background: linear-gradient(155deg, #fffdfb, var(--story-panel, #fff6f2));
      position: relative;
      height: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
  
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 14px;
      flex-wrap: wrap;
    }
  
    .panel-title {
      margin: 0;
      font-size: 1.75rem;
      line-height: 1.15;
      color: var(--story-text, #241419);
    }
  
    .panel-subtitle {
      margin: 8px 0 0;
      color: var(--story-muted, #6f5960);
      max-width: 920px;
      line-height: 1.45;
    }
  
    .state-chip {
      border: 1px solid var(--story-border, #e8d2cb);
      border-radius: 999px;
      padding: 8px 12px;
      background: #fffdfb;
      color: var(--story-accent-strong, #8e0f27);
      font-weight: 600;
      white-space: nowrap;
    }
  
    .control-row {
      display: flex;
      flex-wrap: wrap;
      gap: 18px;
      margin: 18px 0 16px;
      align-items: center;
    }
  
    .control-group {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
  
    .push-right {
      margin-left: auto;
    }
  
    .control-label {
      font-size: 0.95rem;
      color: var(--story-muted, #6f5960);
      font-weight: 600;
    }
  
    .mode-btn,
    .legend-chip,
    .clear-btn {
      border: 1px solid var(--story-border, #e8d2cb);
      border-radius: 12px;
      background: #fffdfb;
      padding: 8px 12px;
      font: inherit;
      cursor: pointer;
      transition: all 120ms ease;
      color: var(--story-text, #241419);
    }
  
    .mode-btn:hover,
    .legend-chip:hover,
    .clear-btn:hover:not(:disabled) {
      background: var(--story-accent-soft, #f6ddd8);
    }
  
    .mode-btn.selected,
    .legend-chip.selected {
      border-color: var(--story-border-strong, #cc5368);
      background: var(--story-accent-soft, #f6ddd8);
      font-weight: 600;
    }

    .legend-chip.focus-chip {
      border-color: var(--story-border-strong, #cc5368);
      background: #fffaf8;
      box-shadow: 0 0 0 2px rgba(204, 83, 104, 0.14);
      font-weight: 700;
    }
  
    .mode-btn:focus-visible,
    .legend-chip:focus-visible,
    .clear-btn:focus-visible,
    .county-input-group select:focus-visible {
      outline: 2px solid #4e79a7;
      outline-offset: 2px;
    }
  
    .legend-chip:disabled,
    .clear-btn:disabled,
    .county-input-group select:disabled {
      opacity: 0.48;
      cursor: not-allowed;
    }
  
    .legend-panel {
  border: 1px solid var(--story-border, #e8d2cb);
  border-radius: 12px;
  background: #fffdfb;
  padding: 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  align-self: stretch;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: #aaa #f0e8e6;
  box-sizing: border-box;
  width: 200px;
  flex-shrink: 0;
}
  
    .legend-title {
      font-size: 0.75rem;
      color: var(--story-muted, #6f5960);
      line-height: 1.3;
      word-break: break-word;
      max-width: 100%;
      flex-shrink: unset;
    }

    .focus-hint {
      margin-top: 8px;
      margin-bottom: 10px;
      font-size: 0.9rem;
      color: var(--story-muted, #6f5960);
      line-height: 1.4;
    }
  
    .reference-note {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--story-muted, #6f5960);
      font-size: 0.88rem;
      font-weight: 600;
      flex-shrink: 0;
      margin-bottom: 0;
    }
  
    .line-swatch {
      width: 28px;
      height: 0;
      border-top: 3px dashed #7a7a7a;
      display: inline-block;
      transform: translateY(-1px);
    }
  
    .line-swatch.baseline {
      border-top-color: #7a7a7a;
    }
  
    .swatch {
      width: 11px;
      height: 11px;
      border-radius: 999px;
      display: inline-block;
      flex: 0 0 auto;
    }
  
    .legend-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
  
    .county-input-group label {
      font-size: 0.92rem;
      color: var(--story-muted, #6f5960);
      font-weight: 600;
    }
  
    .selection-status {
      margin-top: 10px;
      color: var(--story-muted, #6f5960);
      font-size: 0.92rem;
    }
  
    .suggestion-block {
      margin-top: 12px;
    }
  
    .chart-wrapper {
      position: relative;
      flex: 1;
      min-height: 0;
      margin-top: 8px;
    }
  
    .chart-svg {
      width: 100%;
      height: 100%;
      display: block;
      border: 1px solid var(--story-border, #e8d2cb);
      border-radius: 12px;
      background: #fffdfb;
    }

    .chart-svg path,
    .chart-svg circle,
    .chart-svg text {
      transition:
        opacity 220ms ease,
        stroke-width 240ms ease,
        fill 220ms ease,
        stroke 220ms ease;
    }
  
    .tooltip {
      position: absolute;
      pointer-events: none;
      background: rgba(255, 253, 251, 0.97);
      border: 1px solid var(--story-border, #e8d2cb);
      border-radius: 14px;
      padding: 10px 12px;
      box-shadow: 0 10px 24px rgba(53, 18, 22, 0.12);
      font-size: 0.92rem;
      min-width: 176px;
    }
  
    .tooltip-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 700;
      margin-bottom: 4px;
    }
  
    .tooltip-note {
      color: var(--story-muted, #6f5960);
      margin-top: 4px;
      font-size: 0.86rem;
    }
  
    .note-block {
      margin-top: 14px;
      color: var(--story-text, #241419);
      line-height: 1.55;
      display: grid;
      gap: 6px;
      background: #fffdfb;
      border: 1px solid var(--story-border, #e8d2cb);
      border-radius: 12px;
      padding: 12px 14px;
    }

    .note-block p {
      margin: 0;
      color: var(--story-muted, #6f5960);
    }

    .note-block strong {
      color: var(--story-accent-strong, #8e0f27);
    }
  
    .message-box {
      border: 1px dashed var(--story-border, #e8d2cb);
      border-radius: 12px;
      padding: 18px;
      color: var(--story-muted, #6f5960);
      background: #fffdfb;
    }
  
    .message-box.error {
      color: #8a2b2b;
      background: #fff7f7;
      border-color: #e4b7b7;
    }

    .header-right {
  display: flex;
  align-items: center;
  gap: 10px;
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
  top: 52px;
  right: 20px;
  z-index: 20;
  background: #fffdfb;
  border: 1px solid var(--story-border, #e8d2cb);
  border-radius: 16px;
  padding: 16px 18px;
  box-shadow: 0 14px 32px rgba(61, 20, 24, 0.14);
  max-width: 340px;
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

.chart-area {
  display: flex;
  flex-direction: row;
  flex: 1;
  min-height: 0;
  gap: 12px;
}

.chart-wrapper {
  position: relative;
  flex: 1;
  min-height: 0;
  margin-top: 0;
}

.legend-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-wrap: nowrap;
}
.legend-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
}

.county-input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  width: 100%;
}

.county-input-group select {
  width: 100%;
  box-sizing: border-box;
  font-size: 0.8rem;
  border: 1px solid var(--story-border, #e8d2cb);
  border-radius: 10px;
  padding: 6px 8px;
  background: #fffdfb;
  font: inherit;
  cursor: pointer;
}
.county-toolbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: stretch;
}
  
    @media (max-width: 920px) {
      .detail-panel {
        padding: 16px;
      }
  
      .panel-title {
        font-size: 1.45rem;
      }
  
      .county-input-group {
        min-width: 100%;
      }
  
      .push-right {
        margin-left: 0;
      }
    }
  </style>
