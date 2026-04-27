<script lang="ts">
  import { onMount, tick } from "svelte";
  import { fade, fly } from "svelte/transition";

  import BumpChart from "$lib/components/BumpChart.svelte";
  import DetailLinePlot from "$lib/components/DetailLinePlot.svelte";
  import USStrokeMortalityMapV2 from "$lib/components/USStrokeMortalityMapV2.svelte";
  import USStrokeMortalityMap3D from "$lib/components/USStrokeMortalityMap3D.svelte";

  import { selectedState, selectedYear } from "$lib/stores";

  const HANDOFF_STEP = 14;
  const INTRO_ENTRY_SCROLL = 60;
  const INTRO_RETURN_THRESHOLD = 28;
  const STEP13_EXPLODE_OFFSET = 40;
  const VIZ_STEP_TRANSITION_MS = 220;

  type StorySection = "vis1" | "vis2" | "vis3" | "user";
  type StoryStep = {
    step: number;
    section: StorySection;
    title: string;
    text: string;
    prompt?: string;
    highlight?: {
      label: string;
      value: string;
      caption: string;
    };
  };
  type StoryFinding = {
    label: string;
    value: string;
    detail: string;
  };
  type ThemeStop = {
    step: number;
    accent: string;
    accentStrong: string;
    accentSoft: string;
    bgTop: string;
    bgBottom: string;
    orbA: string;
    orbB: string;
    panel: string;
    panelStrong: string;
    border: string;
    borderStrong: string;
    text: string;
    muted: string;
  };

  const storySteps: StoryStep[] = [
    {
      step: 1,
      section: "vis1",
      title: "2019 Rank Overview",
      text: `<span class="hl">Stroke</span> is one of the leading causes of death around the world and in the United States. 
      According to the <a href="http://who.int/news-room/fact-sheets/detail/stroke" target="_blank" class="who-link">WHO</a>'s definition, a stroke is a medical emergency that occurs when blood flow to the brain is interrupted, either due to a blockage or bleeding.
      This lack of blood flow can lead to brain cell death and serious complications. Strokes can be fatal and need immediate treatment. 
      <br><br>Narrow down to U.S., let's explore the <a href="https://catalog.data.gov/dataset/stroke-mortality-data-among-us-adults-35-by-state-territory-and-county-2019-2021" target="_blank" class="dataset-link">Stroke Mortality Data Among US Adults (35+) by State/Territory and County</a> dataset. 
      <br><br><span class="hl">Mortality</span> refers to the frequency of death within a certain population. Mortality rate is the number of deaths per 100,000(this number could vary).In this project, the stroke mortality explicitly refers to the how many people died of stroke per 100,000 in a given year. `,
      prompt: "Key question: Which states has the highest stroke mortality in 2019?",
    },
    {
      step: 2,
      section: "vis1",
      title: "From Snapshot to Trend",
      text: `With one scroll from <span class="hl">Step 1</span>, that static ranking expands into a <span class="hl">bump chart</span> from 1999-2019. The chart now tells a story of changing ranks of state mortality over time.
      <br><br>As we can see in the chart, there is a clear reginal and geographic pattern in stroke mortality. The highest rates are concentrated in the <span class="hl">Southeast</span>, while the lowest rates are in the <span class="hl">Northeast</span>. 
      This pattern is stable over time, with most states maintaining their relative positions. Some states do show movement, such as <span class="hl">North Carolina</span> and <span class="hl">Iowa</span>. However, certain state like <span class="hl">Mississippi</span> has a growing trend within recent years, and stay the first for many years.`,
      prompt: "Watch for: states that move, and states that stay near the top.",
    },
    {
      step: 3,
      section: "vis1",
      title: "Prepare a State to Focus",
      text: `The national level <span class="hl">bump chart</span> shows us the national geographic pattern. Aside from the fact that <span class="hl">Southeast</span> states have higher mortality, another fact is that this overall bump chart is overwhelming.
      <br><br> This is the time to introduce the <span class="hl">select buttons</span> which allow the viewer to focus on a specific region and look at the trend or rank in this region.
      <br><br>Scrolling down and the next movement is a state selection. This makes the transition from national comparison to a state-level view.`,
      prompt: "Next: we move from overview to one state-level anchor.",
    },
    {
      step: 4,
      section: "vis1",
      title: "Mississippi Becomes the Guide",
      text: `Regional level visualization shows a more clear picture of the trend and rank than the national level. However, it is still somehow too broad fo details. Could we be more specific to a state and get much more detailed information?
      <br><br> Luckily, Yes! We can choose a state by clicking on the line and it will be highlighted in the chart.
      <br><br> Remember we mentione <span class="hl">Mississippi</span> in the previous <span class="hl">Step 3</span>? Let's explore this one. The chosen state anchors the rest of the <span class="hl">author-driven story</span>.`,
      prompt: "Story anchor: Mississippi remains highlighted in the next views.",
      highlight: {
        label: "Selected state",
        value: "Mississippi",
        caption: "This state remains the narrative anchor across the map and detail views.",
      },
    },
    {
      step: 5,
      section: "vis2",
      title: "Map the 2019 Landscape",
      text: `Both the <span class="hl">bar chart</span> and <span class="hl">bump chart</span> show the abstract trends or ranks. In this <span class="hl">Step 5</span>, we zoom into a <span class="hl">map</span> that spatializes the <span class="hl">2019 mortality rates with a choropleth</span>.
      <br><br>The <span class="hl">map</span> on the right is now in the default setting, which shows all the states in the U.S. and their stroke mortality rates in 2019. All the settings could be adjusted by the user later in the <span class="hl">User-driven mode</span>.
      <br><br>The <span class="hl">select box</span> on the <span class="hl">map</span> allows the user to drag and select a random area. The mortaliy of the states in this area will be presented as glyphs on the side.`,
      prompt: "Look for: whether Mississippi is isolated or part of a broader regional pattern.",
    },
    {
      step: 6,
      section: "vis2",
      title: "Animate National Change",
      text: `Now, let's go back to our story and focus on the <span class="hl">Mississippi</span> state. We have already decided to focus on this state and selected the correpsonding line in the <span class="hl">bump chart</span>. 
      <br><br>Now the map opens on the 2019 national distribution with Mississippi still highlighted, preserving continuity while shifting from rank to geography. 
      <br><br>The scroll will animates the choropleth from 1999 to 2019 to enable the audience sees spatial change over time.`,
      prompt: "Watch the year label: the map moves from 1999 to 2019.",
      highlight: {
        label: "Animated window",
        value: "1999 → 2019",
        caption: "This sweep shows change through time before the story zooms back into a single-year reading.",
      },
    },
    {
      step: 7,
      section: "vis2",
      title: "See It in 3D",
      text: `Welcome to the <span class="hl">3D visualization</span>! 
      <br><br> The <span class="hl">3D visualization</span> now replays yearly change from 1999 to 2019. State height and color both encode mortality, while the strip below lets the viewer anchor a start year, drag out a time window, and compare the selected state against the national average.
      <br><br> From the animation we could clearly see the overall moratlity trend is dropping, but the regional pattern remains the same.`,
      prompt: "Interaction: click any state to highlight it. Drag to rotate. Click or drag on the strip below to define a year window while scroll continues inside it.",
    },
    {
      step: 8,
      section: "vis3",
      title: "Mississippi Baseline",
      text: `After viewing the national and regional trends and ranks, we come to the last chart and will break down the data. This is a <span class="hl">detailed line chart</span> showing the mortality of different subgroups within the state. 
      <br><br>This chart starts with <span class="hl">Mississippi's overall mortality trend</span> as a single line. That clean baseline makes each later comparison easier to read.`,
      prompt: "Baseline: this line is the reference for every later comparison.",
      highlight: {
        label: "Reference line",
        value: "Mississippi overall",
        caption: "Every later subgroup comparison is introduced against this state-level baseline.",
      },
    },
    {
      step: 9,
      section: "vis3",
      title: "Sex 35-64: Full Comparison",
      text: `People between 35-64 are not the necessary the subgroup with higheset mortality, but with the change of lifestyle, this group is facing higher and higehr risks. Let's take a look!
      <br><br>The chart shows the mortality trends for people between 35-64 by sex groups. Lines for overall, men, and women appear one by one to build the gender comparison gradually.`,
      prompt: "Watch for: whether male and female trends separate or converge.",
    },
    {
      step: 10,
      section: "vis3",
      title: "Race 35-64: Overall",
      text: `Aside from the sex group, race group may also have different mortality trends. Let's see how the racial subgroups look like.
      <br><br>We remove the view of mortality trends for people between 35-64 by sex groups and reset to the baseline for ages 35-64, starting from the overall line.
      <br><br>We can see there is a clear gap between the overall line and the line for male and female. <span class="hl">Male tend to have higher mortality than female</span>.`,
      prompt: "Reset: begin with the overall line before adding racial subgroups.",
    },
    {
      step: 11,
      section: "vis3",
      title: "Race 35-64: Full Comparison",
      text: `Now we will guide you through seeing the racial subgroups. Racial subgroup lines appear one by one, and the newest or hovered subgroup stays emphasized so the comparison remains readable as the full set comes in.
      <br><br> You can hover on any subgroup line to keep it emphasized while the others fade into the background. This interaction allows you to focus on one comparison at a time even when all lines are visible.
       <br><br>From the comparison we can see there is a clear gap between different racial groups. <span class="hl">Black or African American(Non-Hispanic) group tend to have higher mortality than any other group</span>. The other groups, <span class="hl">American Indian or Alaska Native, White, Hispanic and Asian or Pacific Islander</span> have lower mortality than the overall line. However, <span class="hl">the American Indian or Alaska Native group has fluctuating trend.</span>`,
      prompt: "Interaction: hover a subgroup line to keep it emphasized.",
    },
    {
      step: 12,
      section: "vis3",
      title: "County 35-64: State Average",
      text: `Aside from the racial group, geographic location may also have different mortality trends. Let's see how the geographic location look like.
      <br><br>We remove the view of mortality trends for people between 35-64 by geographic location and reset to the baseline for ages 35-64, starting from the overall line.`,
      prompt: "Baseline: the state average becomes the comparison line for counties.",
    },
    {
      step: 13,
      section: "vis3",
      title: "County 35-64: Full Comparison",
      text: `There is two issues with the county level visualization. A state will have typically over 30 or 40 counties, it will be a challenge to visualize all of them. Also, it's hard to tell what are the names of the counties in a state you don't familiar with.
      <br><br>To solve this problem, we will not provide the visualization of all counties by default, but offering some suggested counties that are worth to look at. Here, for the <span class="hl">Mississippi</span> state, the five suggested counties are <span class="hl">Bolivar, Leflore, Humphreys, Hinds and Sunflower</span>.
      <br><br>They each revealed one by one against the state average, completing the guided county comparison.`,
      prompt: "Watch for: which counties sit above or below the state average.",
    },
    {
      step: 14,
      section: "user",
      title: "Hand Off to User-Driven Mode",
      text: `The guided sequence ends here. So far we only showed a small part of this data. Please feel free to explore the user-driven dashboard for more in-depth analysis.`,
      prompt: "Now explore freely: use the controls to change state, year, and subgroup.",
    },
  ];

  const introHighlights = [
    {
      label: "Regional signal",
      value: "Southeast stays highest",
      caption: "The national rank view repeatedly clusters the heaviest burden in the Southeast.",
    },
    {
      label: "Story anchor",
      value: "Mississippi remains central",
      caption: "One high-burden state carries the audience from overview into geographic and subgroup detail.",
    },
    {
      label: "Subgroup gap",
      value: "Disparities persist within states",
      caption: "The state average hides meaningful differences by sex, race, and county.",
    },
  ];

  const themeStops: ThemeStop[] = [
    {
      step: 0,
      accent: "#cc5368",
      accentStrong: "#8e0f27",
      accentSoft: "#f6ddd8",
      bgTop: "#23030b",
      bgBottom: "#651826",
      orbA: "#cf4c5f",
      orbB: "#f2a17f",
      panel: "#fff5f2",
      panelStrong: "#fffaf7",
      border: "#eac5bd",
      borderStrong: "#cc5368",
      text: "#241419",
      muted: "#72515a",
    },
    {
      step: 4,
      accent: "#d45a58",
      accentStrong: "#94161f",
      accentSoft: "#f7dfd6",
      bgTop: "#420810",
      bgBottom: "#8b2430",
      orbA: "#dc695e",
      orbB: "#efbf8f",
      panel: "#fff6f2",
      panelStrong: "#fffaf7",
      border: "#edcec5",
      borderStrong: "#d45a58",
      text: "#261518",
      muted: "#775356",
    },
    {
      step: 7,
      accent: "#d96d4c",
      accentStrong: "#a12622",
      accentSoft: "#f9e4d8",
      bgTop: "#62161d",
      bgBottom: "#bf554e",
      orbA: "#e3865d",
      orbB: "#f0c89d",
      panel: "#fff7f3",
      panelStrong: "#fffaf8",
      border: "#edd2c7",
      borderStrong: "#d96d4c",
      text: "#291617",
      muted: "#7a5a58",
    },
    {
      step: 11,
      accent: "#c95d72",
      accentStrong: "#9d2442",
      accentSoft: "#f8e4e3",
      bgTop: "#8e3036",
      bgBottom: "#efb0a2",
      orbA: "#d77d89",
      orbB: "#f3d0af",
      panel: "#fff9f6",
      panelStrong: "#fffdfb",
      border: "#ecd4ce",
      borderStrong: "#c95d72",
      text: "#2b181c",
      muted: "#7b5f63",
    },
    {
      step: 14,
      accent: "#b94962",
      accentStrong: "#92213d",
      accentSoft: "#f8e8e5",
      bgTop: "#f4cbc6",
      bgBottom: "#fff1ed",
      orbA: "#d78a93",
      orbB: "#f5d8ba",
      panel: "#fffaf8",
      panelStrong: "#fffefe",
      border: "#e8d6d2",
      borderStrong: "#b94962",
      text: "#2a1b20",
      muted: "#725d62",
    },
  ];

  const totalSteps = storySteps.length;
  const vis3StartStep = 8;

  let currentStep = 0;
  let stepProgress = 0;
  let frame = 0;

  let stepEls: Array<HTMLDivElement | null> = [];
  let storyBodyEl: HTMLDivElement | null = null;
  let textColumnEl: HTMLDivElement | null = null;
  let vizScrollEl: HTMLDivElement | null = null;
  let exploding = false;
  let introHidden = false;
  let introTimer = 0;
  let vizTransitioning = false;
  let vizTransitionDirection: "forward" | "backward" = "forward";
  let vizTransitionTimer = 0;
  let pendingStoryStateToken = 0;

  let userMode = false;
  let mounted = false;
  let userModeSettled = false;
  let userModeSettledTimer = 0;

  function clamp(value: number, min = 0, max = 1) {
    return Math.min(max, Math.max(min, value));
  }

  function getVizComponentKey(step: number) {
    if (step >= 1 && step <= 4) return "bump";
    if (step >= 5 && step <= 6) return "map2d";
    if (step === 7) return "map3d";
    if (step >= 8 && step <= 13) return "detail-line";
    return "handoff";
  }

  function getVizMeta(step: number) {
    if (step >= 1 && step <= 4) {
      return {
        tag: "VIS1",
        title: "Bump Chart Story",
        subtitle:
          step === 1
            ? "2019 ranking bar chart"
            : step === 2
              ? "Transition into the 1999-2019 bump chart"
              : step === 3
                ? "Pause before state selection"
                : "Mississippi selected and highlighted",
      };
    }

    if (step >= 5 && step <= 6) {
      return {
        tag: "VIS2",
        title: "U.S. Stroke Mortality Map",
        subtitle:
          step === 5
            ? "2019 choropleth with Mississippi highlighted"
            : "Animated national change from 1999 to 2019",
      };
    }

    if (step === 7) {
      return {
        tag: "VIS2",
        title: "U.S. Stroke Mortality Map",
        subtitle: "Guided 3D relief with brush-driven time playback",
      };
    }

    if (step >= 8 && step <= 13) {
      const current = storySteps.find((item) => item.step === step);
      return {
        tag: "VIS3",
        title: "Mississippi Detail Story",
        subtitle: current?.title ?? "Guided subgroup comparison",
      };
    }

    return {
      tag: "FREE",
      title: "User-Driven Exploration",
      subtitle: "Switch from guided storytelling to free exploration",
    };
  }

  function getThemeClass(step: number) {
    if (step >= 1 && step <= 4) return "theme-vis1";
    if (step >= 5 && step <= 7) return "theme-vis2";
    if (step >= vis3StartStep && step <= 13) return "theme-vis3";
    return "theme-user";
  }

  function hexToRgb(hex: string) {
    const normalized = hex.replace("#", "");
    const safeHex =
      normalized.length === 3
        ? normalized
            .split("")
            .map((char) => `${char}${char}`)
            .join("")
        : normalized;

    const value = Number.parseInt(safeHex, 16);

    return {
      r: (value >> 16) & 255,
      g: (value >> 8) & 255,
      b: value & 255,
    };
  }

  function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
    return `#${[r, g, b]
      .map((channel) =>
        Math.round(channel).toString(16).padStart(2, "0")
      )
      .join("")}`;
  }

  function mixColor(a: string, b: string, t: number) {
    const start = hexToRgb(a);
    const end = hexToRgb(b);

    return rgbToHex({
      r: start.r + (end.r - start.r) * t,
      g: start.g + (end.g - start.g) * t,
      b: start.b + (end.b - start.b) * t,
    });
  }

  function interpolateTheme(step: number, progress: number) {
    const position = clamp(step + progress, 0, HANDOFF_STEP);
    const nextIndex = themeStops.findIndex((stop) => stop.step >= position);

    if (nextIndex <= 0) return themeStops[0];
    if (nextIndex === -1) return themeStops[themeStops.length - 1];

    const previous = themeStops[nextIndex - 1];
    const next = themeStops[nextIndex];
    const range = Math.max(1, next.step - previous.step);
    const t = clamp((position - previous.step) / range);

    return {
      step: position,
      accent: mixColor(previous.accent, next.accent, t),
      accentStrong: mixColor(previous.accentStrong, next.accentStrong, t),
      accentSoft: mixColor(previous.accentSoft, next.accentSoft, t),
      bgTop: mixColor(previous.bgTop, next.bgTop, t),
      bgBottom: mixColor(previous.bgBottom, next.bgBottom, t),
      orbA: mixColor(previous.orbA, next.orbA, t),
      orbB: mixColor(previous.orbB, next.orbB, t),
      panel: mixColor(previous.panel, next.panel, t),
      panelStrong: mixColor(previous.panelStrong, next.panelStrong, t),
      border: mixColor(previous.border, next.border, t),
      borderStrong: mixColor(previous.borderStrong, next.borderStrong, t),
      text: mixColor(previous.text, next.text, t),
      muted: mixColor(previous.muted, next.muted, t),
    };
  }

  function getThemeStyle(step: number, progress: number) {
    const theme = interpolateTheme(step, progress);

    return [
      `--story-accent: ${theme.accent}`,
      `--story-accent-strong: ${theme.accentStrong}`,
      `--story-accent-soft: ${theme.accentSoft}`,
      `--story-bg-top: ${theme.bgTop}`,
      `--story-bg-bottom: ${theme.bgBottom}`,
      `--story-orb-a: ${theme.orbA}`,
      `--story-orb-b: ${theme.orbB}`,
      `--story-panel: ${theme.panel}`,
      `--story-panel-strong: ${theme.panelStrong}`,
      `--story-border: ${theme.border}`,
      `--story-border-strong: ${theme.borderStrong}`,
      `--story-text: ${theme.text}`,
      `--story-muted: ${theme.muted}`,
    ].join("; ");
  }

  function getFinding(step: number): StoryFinding | null {
    const findings: Record<number, StoryFinding> = {
      1: {
        label: "Key finding",
        value: "2019 mortality is not evenly distributed",
        detail: "High-burden states already cluster before the story introduces time or interaction.",
      },
      2: {
        label: "Pattern",
        value: "The Southeast stays near the top",
        detail: "The rank trajectories move, but the regional structure remains remarkably stable.",
      },
      4: {
        label: "Anchor",
        value: "Mississippi becomes the narrative guide",
        detail: "A single state now links rank, geography, and subgroup detail into one readable story.",
      },
      6: {
        label: "Time signal",
        value: "The U.S. map gets lighter, but the regional pattern holds",
        detail: "Across states, mortality generally declines over time, yet the same high-burden regions still stand out.",
      },
      7: {
        label: "Comparison",
        value: "National decline and local persistence coexist",
        detail: "The brush view makes it easier to compare Mississippi against the U.S. average over time.",
      },
      8: {
        label: "Baseline",
        value: "State averages hide subgroup variation",
        detail: "The single Mississippi line works best as a reference, not the end of the story.",
      },
      9: {
        label: "Subgroup",
        value: "Men tend to sit above women in 35-64",
        detail: "The staged reveal makes the sex gap readable without overwhelming the panel.",
      },
      11: {
        label: "Disparity",
        value: "Black adults remain visibly above other race groups",
        detail: "The strongest subgroup gap in Mississippi persists across the time series.",
      },
      13: {
        label: "Local detail",
        value: "County stories diverge around the state average",
        detail: "Suggested counties reveal which places consistently sit above Mississippi's baseline.",
      },
      14: {
        label: "Next step",
        value: "Test whether the story holds elsewhere",
        detail: "The guided path ends here; free exploration should validate or challenge the chosen narrative.",
      },
    };

    return findings[step] ?? null;
  }

  function getInteractionChips(step: number) {
    if (step >= 1 && step <= 4) {
      return ["Click year labels", "Select a state line", "Filter by region"];
    }

    if (step >= 5 && step <= 6) {
      return ["Drag the selection box", "Click any state", "Read the glyph panel"];
    }

    if (step === 7) {
      return ["Drag to rotate", "Click a state", "Brush a year window"];
    }

    if (step >= 8 && step <= 13) {
      return ["Switch subgroup mode", "Hover lines to focus", "Add suggested counties"];
    }

    return ["Change state", "Change year", "Compare subgroups"];
  }

  function getBridge(step: number) {
    const bridges: Record<number, { text: string; height: number }> = {
      1: {
        height: 35,
        text: "We begin with a snapshot on 2019 ranking bar chart so the audience first sees where stroke mortality is highest before any motion is introduced.<br><br>Keep this ranking in mind: it gives us a starting order, but not a trajectory. The next view asks whether high-ranked states stayed high across time.",
      },
      2: {
        height: 55,
        text: "Before choosing one state, pause on the movement. Some states shift position, while others remain near the top. A guided case study will make the national pattern more concrete.",
      },
      3: {
        height: 40,
        text: "Rather than ask the viewer to choose randomly, the story selects one consistently high-burden state so every later view has a clear anchor.",
      },
      4: {
        height: 45,
        text: "Mississippi now becomes the reference point. The next question is geographic: where does this state sit within the national landscape?",
      },
      5: {
        height: 50,
        text: "The 2019 map shows where the burden remains. But a single map cannot show whether the country has improved over time.",
      },
      6: {
        height: 90,
        text: "By the end of the animation, much of the U.S. map is lighter than it was in 1999. The important question becomes: even after overall improvement, which states or regions still stand out?",
      },
      7: {
        height: 78,
        text: "The 3D view is still the same mortality signal, but now time is explicit: the brush shows the national average against the selected state, and scroll advances the playhead through that range.",
      },
      8: {
        height: 45,
        text: "Mississippi’s state-average line sets the baseline. The next question asks whether that average hides differences between groups.",
      },
      9: {
        height: 70,
        text: "The sex comparison gives one slice of disparity. Now we keep the same age group and ask whether racial subgroup patterns tell a different story.",
      },
      10: {
        height: 50,
        text: "Start with the overall race view first, then let the subgroup lines enter gradually so the comparison does not become visual noise.",
      },
      11: {
        height: 70,
        text: "Once all race subgroup lines are visible, look for whether the gap narrows, persists, or changes shape over time.",
      },
      12: {
        height: 50,
        text: "The county view moves from subgroup identity to place within Mississippi. The state average becomes a baseline for local comparison.",
      },
      13: {
        height: 80,
        text: "The guided story has built from national rank to local detail. The final handoff keeps the same encodings, but gives control back to the viewer.",
      },
    };

    return bridges[step] ?? null;
  }

  function getStepMinHeight(step: number) {
    const pacing: Record<number, number> = {
      1: 85,
      2: 105,
      3: 85,
      4: 95,
      5: 95,
      6: 130,
      7: 150,
      8: 95,
      9: 125,
      10: 95,
      11: 125,
      12: 95,
      13: 135,
      14: 100,
    };

    return pacing[step] ?? 90;
  }

  function clearIntroTimer() {
    if (!introTimer) return;
    window.clearTimeout(introTimer);
    introTimer = 0;
  }

  function clearVizTransitionTimer() {
    if (!vizTransitionTimer) return;
    window.clearTimeout(vizTransitionTimer);
    vizTransitionTimer = 0;
  }

  function clearUserModeSettledTimer() {
    if (!userModeSettledTimer) return;
    window.clearTimeout(userModeSettledTimer);
    userModeSettledTimer = 0;
  }

  function triggerVizTransition(previousStep: number, nextStep: number) {
    clearVizTransitionTimer();
    vizTransitionDirection = nextStep > previousStep ? "forward" : "backward";
    vizTransitioning = true;

    vizTransitionTimer = window.setTimeout(() => {
      vizTransitioning = false;
      vizTransitionTimer = 0;
    }, VIZ_STEP_TRANSITION_MS);
  }

  function syncStoryState(nextStep: number, previousStep: number) {
    const token = ++pendingStoryStateToken;
    const previousKey = getVizComponentKey(previousStep);
    const nextKey = getVizComponentKey(nextStep);

    if (previousKey === nextKey || previousStep <= 0) {
      applyStoryState(nextStep);
      return;
    }

    void tick().then(() => {
      if (token !== pendingStoryStateToken) return;
      if (currentStep !== nextStep) return;
      applyStoryState(nextStep);
    });
  }

  function resetToIntro() {
    clearIntroTimer();
    clearVizTransitionTimer();
    clearUserModeSettledTimer();

    currentStep = 0;
    stepProgress = 0;
    introHidden = false;
    exploding = false;
    vizTransitioning = false;
    userMode = false;
    userModeSettled = false;

    if (textColumnEl) {
      textColumnEl.scrollTop = 0;
    }

    if (vizScrollEl) {
      vizScrollEl.scrollTop = 0;
    }

    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function startStoryFromIntro() {
    if (currentStep !== 0) return;

    clearIntroTimer();
    clearVizTransitionTimer();
    clearUserModeSettledTimer();

    currentStep = 1;
    stepProgress = 0;
    exploding = false;
    userMode = false;
    userModeSettled = false;

    applyStoryState(1);
    vizTransitioning = false;

    if (textColumnEl) {
      textColumnEl.scrollTop = 0;
    }

    if (vizScrollEl) {
      vizScrollEl.scrollTop = 0;
    }

    introTimer = window.setTimeout(() => {
      introHidden = true;
      introTimer = 0;
    }, 400);

    scheduleUpdate();
  }

  function applyStoryState(step: number) {
    if (step <= 0) return;

    if (step >= 1 && step <= 4) {
      if (step === 1) {
        selectedYear.set(2019);
        selectedState.set(null);
      }

      if (step === 2 || step === 3) {
        selectedYear.set(null);
        selectedState.set(null);
      }

      if (step === 4) {
        selectedYear.set(null);
        selectedState.set("MS");
      }

      return;
    }

    if (step >= 5 && step <= 7) {
      selectedState.set("MS");

      if (step === 5) selectedYear.set(2019);
      else if (step === 6) selectedYear.set(null);
      else selectedYear.set(2019);

      return;
    }

    if (step >= 8 && step <= 13) {
      selectedState.set("MS");
      selectedYear.set(2019);
      return;
    }

    if (step === HANDOFF_STEP) {
      selectedState.set("MS");
      selectedYear.set(null);
    }
  }

  function scheduleUpdate() {
    if (frame) return;

    frame = requestAnimationFrame(() => {
      frame = 0;
      updateScrollState();
    });
  }

  function getRenderedStepEls() {
    if (!textColumnEl) return [];
    return Array.from(
      textColumnEl.querySelectorAll<HTMLDivElement>(".step[data-step]")
    );
  }

  function updateScrollState() {
    if (currentStep === 0 || !textColumnEl) return;

    const validStepEls = getRenderedStepEls();
    if (validStepEls.length === 0) return;

    const scrollTop = textColumnEl.scrollTop;
    const viewH = textColumnEl.clientHeight || window.innerHeight;
    const triggerY = scrollTop + viewH * 0.55;

    let activeIndex = 0;

    for (let i = 0; i < validStepEls.length; i += 1) {
      const top = validStepEls[i].offsetTop;
      const nextTop = validStepEls[i + 1]?.offsetTop ?? Number.POSITIVE_INFINITY;

      if (triggerY >= top && triggerY < nextTop) {
        activeIndex = i;
        break;
      }

      if (triggerY >= top) {
        activeIndex = i;
      }
    }

    const activeEl = validStepEls[activeIndex];
    const nextEl = validStepEls[activeIndex + 1];

    const start = activeEl.offsetTop;
    const end =
      nextEl?.offsetTop ??
      activeEl.offsetTop + activeEl.offsetHeight + textColumnEl.clientHeight * 0.8;

    stepProgress = clamp((triggerY - start) / Math.max(1, end - start), 0, 1);

    const nextStep = storySteps[activeIndex]?.step ?? 1;

    if (nextStep !== currentStep) {
      const previousStep = currentStep;
      currentStep = nextStep;
      syncStoryState(nextStep, previousStep);

      if (getVizComponentKey(previousStep) !== getVizComponentKey(nextStep)) {
        triggerVizTransition(previousStep, nextStep);
      }

      if (vizScrollEl) {
        vizScrollEl.scrollTop = 0;
      }
    }

    const lastStepEl = validStepEls[validStepEls.length - 1];
    const lastStepBottom =
      (lastStepEl?.offsetTop ?? 0) + (lastStepEl?.offsetHeight ?? 0);

    exploding =
      nextStep === HANDOFF_STEP &&
      scrollTop + viewH > lastStepBottom + STEP13_EXPLODE_OFFSET;

    if (exploding && !userMode) {
      userMode = true;
      clearUserModeSettledTimer();
      userModeSettledTimer = window.setTimeout(() => {
        userModeSettled = true;
        const userSection = document.getElementById("user-section");
        if (userSection) {
          userSection.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    }
  }

  function maybeReturnToIntro(deltaY: number) {
    if (currentStep !== 1 || !textColumnEl) return false;
    if (deltaY >= 0) return false;
    if (textColumnEl.scrollTop > INTRO_RETURN_THRESHOLD) return false;

    resetToIntro();
    return true;
  }

  function shouldUseUnifiedWheel() {
    if (!storyBodyEl) return false;
    return window.getComputedStyle(storyBodyEl).position === "fixed";
  }

  function handleUnifiedWheel(event: WheelEvent) {
    if (currentStep === 0 || !textColumnEl) return;
    if (!shouldUseUnifiedWheel()) return;

    const target = event.target as HTMLElement;

    if (target.closest(".text-column")) {
      return;
    }

    if (userModeSettled) {
      return;
    }

    event.preventDefault();

    if (maybeReturnToIntro(event.deltaY)) return;

    textColumnEl.scrollTop = Math.max(0, textColumnEl.scrollTop + event.deltaY);
    scheduleUpdate();
  }

  function handleTextColumnWheelForIntro(event: WheelEvent) {
    if (!textColumnEl) return;

    if (
      currentStep === 1 &&
      event.deltaY < 0 &&
      textColumnEl.scrollTop <= INTRO_RETURN_THRESHOLD
    ) {
      event.preventDefault();
      maybeReturnToIntro(event.deltaY);
    }
  }

  function handleWindowScroll() {
    if (currentStep === 0 && window.scrollY > INTRO_ENTRY_SCROLL) {
      startStoryFromIntro();
    }
  }

  function handleUserSectionScroll() {
    if (userMode && userModeSettled && window.scrollY < 50) {
      resetToIntro();
    }
  }

  onMount(() => {
    mounted = true;
    window.scrollTo(0, 0);

    void tick().then(() => {
      scheduleUpdate();
    });

    textColumnEl?.addEventListener("scroll", scheduleUpdate, { passive: true });
    textColumnEl?.addEventListener("wheel", handleTextColumnWheelForIntro, {
      passive: false,
    });
    storyBodyEl?.addEventListener("wheel", handleUnifiedWheel, {
      passive: false,
    });

    window.addEventListener("scroll", handleWindowScroll, { passive: true });
    window.addEventListener("scroll", handleUserSectionScroll, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      clearIntroTimer();
      clearVizTransitionTimer();
      clearUserModeSettledTimer();
      if (frame) cancelAnimationFrame(frame);

      textColumnEl?.removeEventListener("scroll", scheduleUpdate);
      textColumnEl?.removeEventListener("wheel", handleTextColumnWheelForIntro);
      storyBodyEl?.removeEventListener("wheel", handleUnifiedWheel);

      window.removeEventListener("scroll", handleWindowScroll);
      window.removeEventListener("scroll", handleUserSectionScroll);
      window.removeEventListener("resize", scheduleUpdate);
    };
  });
</script>

<div class="story-shell" style={getThemeStyle(currentStep, stepProgress)}>
  <div class={`story-page ${getThemeClass(currentStep)}`}>
    <section class="intro-section" class:hidden={introHidden} data-step="0">
      <div class="intro-box">
        <p class="eyebrow" in:fade={{ duration: 420, delay: 80 }}>
          Author-Driven Story
        </p>
        <h1 class="intro-title" in:fly={{ y: 22, duration: 620, delay: 120 }}>
          Stroke Mortality in the U.S.
        </h1>
        <p class="intro-copy" in:fade={{ duration: 520, delay: 260 }}>
          This version follows one editorial arc: a national burden map, a
          Mississippi case study, and a gradual reveal of disparities hidden
          inside the state average.
        </p>

        <div class="intro-highlight-grid" in:fade={{ duration: 520, delay: 340 }}>
          {#each introHighlights as item}
            <article class="intro-highlight-card">
              <p class="intro-highlight-label">{item.label}</p>
              <h2 class="intro-highlight-value">{item.value}</h2>
              <p class="intro-highlight-caption">{item.caption}</p>
            </article>
          {/each}
        </div>

        <p class="hint" in:fade={{ duration: 520, delay: 420 }}>
          Scroll down to start the guided story
        </p>
      </div>
    </section>

    <div
      class="story-body"
      class:exploding
      class:active={currentStep > 0}
      class:user-mode={userMode}
      bind:this={storyBodyEl}
    >
      <div class="text-column" bind:this={textColumnEl}>
        {#each storySteps as item, i}
          {@const bridge = getBridge(item.step)}
          <div
            class="step"
            data-step={item.step}
            bind:this={stepEls[i]}
            style={`--step-min-height: ${getStepMinHeight(item.step)}vh;`}
          >
            <div
              class="step-card step-card-scroll"
              class:active={currentStep === item.step}
              class:past={currentStep > item.step}
            >
              <div class="step-index">{item.step}</div>
              <p class="section-tag">{item.section.toUpperCase()}</p>
              <h2 class="step-title">{item.title}</h2>
              <p class="step-copy">{@html item.text}</p>

              {#if item.highlight}
                <div class="key-highlight">
                  <p class="highlight-label">{item.highlight.label}</p>
                  <p class="highlight-value">{item.highlight.value}</p>
                  <p class="highlight-caption">{item.highlight.caption}</p>
                </div>
              {/if}

              {#if item.prompt}
                <p class="interaction-prompt">{item.prompt}</p>
              {/if}
            </div>
          </div>

          {#if bridge}
            <div
              class="step-bridge"
              style={`--bridge-height: ${bridge.height}vh;`}
            >
              <p class="bridge-label">Transition</p>
              <p class="bridge-text">{@html bridge.text}</p>
            </div>
          {/if}
        {/each}

        <div style="height: 60vh;"></div>
      </div>

      <div class="viz-panel">
        <div class="viz-box">
          <div class="panel-glow" aria-hidden="true"></div>
          <div class="viz-scroll" bind:this={vizScrollEl}>
            <div class="viz-header">
              <div class="viz-header-content">
                <div class="viz-title-block">
                  <p class="viz-tag">{getVizMeta(currentStep).tag}</p>
                  <h3>{getVizMeta(currentStep).title}</h3>
                </div>
                <div class="viz-meta">
                  <p class="viz-progress">Step {currentStep} / {totalSteps}</p>
                  <p class="viz-subtitle">{getVizMeta(currentStep).subtitle}</p>
                </div>
              </div>

              {#if getFinding(currentStep)}
                {@const finding = getFinding(currentStep) ?? {
                  label: "",
                  value: "",
                  detail: "",
                }}
                <div class="viz-finding-card">
                  <p class="viz-finding-label">{finding.label}</p>
                  <p class="viz-finding-value">{finding.value}</p>
                  <p class="viz-finding-detail">{finding.detail}</p>
                </div>
              {/if}

              <div class="viz-action-row">
                {#each getInteractionChips(currentStep) as chip}
                  <span class="viz-action-chip">{chip}</span>
                {/each}
              </div>
            </div>

            <div
              class="viz-transition-layer"
              class:viz-step-transitioning={vizTransitioning}
              class:transition-forward={vizTransitionDirection === "forward"}
              class:transition-backward={vizTransitionDirection === "backward"}
            >
              {#key getVizComponentKey(currentStep)}
                <div class="viz-stage">
                  {#if currentStep >= 1 && currentStep <= 4}
                    <div class="chart-shell">
                      <BumpChart
                        storyStep={currentStep}
                        storyMode={true}
                        storyProgress={stepProgress}
                      />
                    </div>
                  {:else if currentStep >= 5 && currentStep <= 6}
                    <div class="chart-shell">
                      <USStrokeMortalityMapV2
                        storyStep={currentStep}
                        storyMode={true}
                        storyProgress={stepProgress}
                      />
                    </div>
                  {:else if currentStep === 7}
                    <div class="chart-shell">
                      <USStrokeMortalityMap3D
                        storyMode={true}
                        showYearSlider={false}
                        storyProgress={stepProgress}
                      />
                    </div>
                  {:else if currentStep >= 8 && currentStep <= 13}
                    <div class="chart-shell">
                      <DetailLinePlot
                        storyStep={currentStep}
                        storyMode={true}
                        storyProgress={stepProgress}
                      />
                    </div>
                  {:else if currentStep === HANDOFF_STEP}
                    <div class="handoff-card">
                      <p class="handoff-label">Free Exploration</p>
                      <h4>Scroll down to continue with the full dashboard.</h4>
                      <p>
                        The story keeps the same views, but removes the guided
                        path so you can test other states and years yourself.
                      </p>
                    </div>
                  {/if}
                </div>
              {/key}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div style="height: 200vh; pointer-events: none;" aria-hidden="true"></div>
  </div>

  {#if mounted && userMode}
    <section id="user-section" class="user-section">
      <div class="user-section-inner">
        <div class="user-mode-hero">
          <p class="eyebrow">User-Driven Mode</p>
          <h2>Explore Beyond the Guided Mississippi Story</h2>
          <p>
            Change state, year, region, and subgroup controls to see whether
            the same patterns hold elsewhere or break in interesting ways.
          </p>
          <div class="user-mode-chips">
            <span>test another state</span>
            <span>compare years</span>
            <span>inspect subgroup gaps</span>
          </div>
        </div>

        <BumpChart storyMode={false} />
        <USStrokeMortalityMapV2 storyMode={false} />
        <USStrokeMortalityMap3D storyMode={false} />
        <DetailLinePlot storyMode={false} />
      </div>
    </section>

    <footer class="site-footer">
      <div class="footer-inner">
        <div class="footer-block">
          <h4>Data Sources</h4>
          <ul>
            <li>
              <a href="https://catalog.data.gov/dataset/stroke-mortality-data-among-us-adults-35-by-state-territory-and-county-2019-2021" target="_blank">
                CDC Stroke Mortality Data Among US Adults (35+) by State/Territory and County
              </a>
            </li>
            <li>
              <a href="https://www.who.int/news-room/fact-sheets/detail/stroke" target="_blank">
                WHO — Stroke
              </a>
            </li>
          </ul>
        </div>
        <div class="footer-block">
          <h4>Contributors</h4>
          <ul>
            <li>Lechen Shen</li>
            <li>Songlin Shang</li>
            <li>Ruixing Lu</li>
            <li>Jacob Sun</li>
            <li>Chenzhi Zhao</li>
          </ul>
        </div>
      </div>
    </footer>
  {/if}
</div>

<style>
  .story-shell {
    position: relative;
    min-height: 100vh;
    background:
      radial-gradient(circle at top center, var(--story-bg-bottom), transparent 58%),
      linear-gradient(180deg, var(--story-bg-top) 0%, var(--story-bg-bottom) 52%, #fff4ef 100%);
    color: var(--story-text);
    overflow-x: clip;
    transition:
      background 480ms ease,
      color 240ms ease;
  }

  .story-shell::before,
  .story-shell::after {
    content: "";
    position: fixed;
    inset: auto;
    border-radius: 999px;
    filter: blur(24px);
    pointer-events: none;
    z-index: 0;
    opacity: 0.9;
  }

  .story-shell::before {
    top: 6%;
    right: -4%;
    width: 420px;
    height: 420px;
    background: radial-gradient(circle, var(--story-orb-a) 0%, transparent 68%);
    animation: arterialDrift 18s ease-in-out infinite alternate;
  }

  .story-shell::after {
    bottom: 4%;
    left: -5%;
    width: 460px;
    height: 460px;
    background: radial-gradient(circle, var(--story-orb-b) 0%, transparent 70%);
    animation: pulseBloom 15s ease-in-out infinite;
  }

  .story-page {
    width: 100%;
    min-height: 100vh;
    position: relative;
  }

  @keyframes arterialDrift {
    0% {
      transform: translate3d(0, 0, 0) scale(1);
    }
    100% {
      transform: translate3d(-36px, 28px, 0) scale(1.12);
    }
  }

  @keyframes pulseBloom {
    0%,
    100% {
      transform: scale(0.94);
      opacity: 0.7;
    }
    50% {
      transform: scale(1.08);
      opacity: 0.95;
    }
  }

  .intro-section {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    box-sizing: border-box;
    z-index: 20;
    pointer-events: auto;
    transition: opacity 400ms ease;
  }

  .intro-section.hidden {
    opacity: 0;
    pointer-events: none;
  }

  .intro-box {
    text-align: center;
    max-width: 1080px;
    padding: 50px 44px;
    border-radius: 32px;
    background:
      linear-gradient(160deg, var(--story-panel-strong), var(--story-panel));
    border: 1px solid var(--story-border);
    box-shadow:
      0 28px 70px rgba(41, 16, 20, 0.22),
      inset 0 1px 0 rgba(255, 255, 255, 0.55);
    backdrop-filter: blur(14px);
  }

  .eyebrow {
    margin: 0 0 14px 0;
    color: var(--story-accent-strong);
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .intro-box h1 {
    margin: 0 0 18px 0;
    font-size: clamp(2.8rem, 6vw, 5rem);
    line-height: 0.94;
    font-weight: 800;
    color: var(--story-text);
  }

  .intro-box p {
    font-size: 1.08rem;
    line-height: 1.72;
    color: var(--story-muted);
  }

  .intro-title {
    text-wrap: balance;
  }

  .intro-copy {
    max-width: 760px;
    margin-left: auto;
    margin-right: auto;
  }

  .intro-highlight-grid {
    margin-top: 30px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    text-align: left;
  }

  .intro-highlight-card {
    padding: 18px 18px 16px;
    border-radius: 20px;
    background:
      linear-gradient(145deg, #ffffff, var(--story-panel));
    border: 1px solid var(--story-border);
    box-shadow: 0 12px 28px rgba(73, 24, 29, 0.09);
  }

  .intro-highlight-label {
    margin: 0 0 8px;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--story-accent-strong);
  }

  .intro-highlight-value {
    margin: 0;
    font-size: 1.3rem;
    line-height: 1.1;
    color: var(--story-text);
  }

  .intro-highlight-caption {
    margin: 10px 0 0;
    font-size: 0.92rem;
    line-height: 1.52;
    color: var(--story-muted);
  }

  .hint {
    margin-top: 24px;
    color: var(--story-accent-strong);
    font-weight: 750;
  }

  :global(.who-link),
  :global(.dataset-link),
  :global(.hl) {
    color: var(--story-accent-strong);
    font-weight: 800;
    text-decoration: none;
    background-color: var(--story-accent-soft);
    padding: 1px 5px;
    border-radius: 999px;
  }

  .story-body {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh;
    display: flex;
    z-index: 1;
    opacity: 0;
    pointer-events: none;
    transition: opacity 400ms ease;
  }

  .story-body.active {
    opacity: 1;
    pointer-events: auto;
    z-index: 15;
  }

  .story-body.user-mode {
    opacity: 0;
    pointer-events: none;
    z-index: 0;
  }

  .text-column {
    width: 27%;
    height: 100vh;
    overflow-y: auto;
    overflow-x: hidden;
    box-sizing: border-box;
    padding: 0 16px 0 28px;
    flex-shrink: 0;
    scroll-behavior: auto;
    overscroll-behavior-y: contain;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 245, 240, 0.26) transparent;
    transition:
      width 500ms cubic-bezier(0.4, 0, 0.2, 1),
      opacity 400ms ease,
      padding 500ms ease;
  }

  .story-body.exploding .text-column {
    width: 0;
    opacity: 0;
    padding: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .step {
    min-height: var(--step-min-height, 90vh);
    display: flex;
    align-items: center;
    padding: 24px 12px;
    box-sizing: border-box;
  }

  .step-bridge {
    min-height: var(--bridge-height, 40vh);
    display: flex;
    flex-direction: column;
    justify-content: center;
    margin: 0 14px 0 10px;
    padding: 18px 20px 22px;
    box-sizing: border-box;
    border-radius: 20px;
    background: linear-gradient(
      145deg,
      rgba(255, 251, 249, 0.84),
      rgba(255, 246, 241, 0.58)
    );
    border: 1px solid rgba(185, 73, 98, 0.14);
    box-shadow:
      0 14px 28px rgba(68, 18, 27, 0.07),
      inset 0 1px 0 rgba(255, 255, 255, 0.36);
  }

  .bridge-label {
    margin: 0 0 8px;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--story-accent-strong);
  }

  .bridge-text {
    margin: 0;
    font-size: 0.96rem;
    line-height: 1.74;
    color: var(--story-muted);
  }

  .step-card {
    width: 100%;
    position: relative;
    background: linear-gradient(155deg, var(--story-panel), var(--story-panel-strong));
    border: 1px solid var(--story-border);
    border-radius: 24px;
    padding: 28px;
    box-sizing: border-box;
    box-shadow:
      0 18px 40px rgba(31, 13, 16, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.52);
    backdrop-filter: blur(8px);
    transform: translateY(0) scale(1);
    transition:
      transform 300ms cubic-bezier(0.22, 1, 0.36, 1),
      box-shadow 300ms ease,
      border-color 300ms ease,
      background 300ms ease,
      opacity 280ms ease;
  }

  .step-card-scroll {
    visibility: visible;
    pointer-events: auto;
    opacity: 0.48;
  }

  .step-card.active {
    border-color: var(--story-border-strong);
    box-shadow:
      0 30px 62px rgba(43, 14, 18, 0.22),
      inset 0 1px 0 rgba(255, 255, 255, 0.58);
    transform: translateY(-6px) scale(1.01);
    opacity: 1;
  }

  .step-card.past {
    opacity: 0.26;
  }

  .step-index {
    position: absolute;
    top: 18px;
    right: 18px;
    width: 36px;
    height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: #f3e4df;
    color: var(--story-accent-strong);
    font-size: 0.88rem;
    font-weight: 800;
    transition:
      background 260ms ease,
      color 260ms ease,
      transform 260ms ease;
  }

  .step-card.active .step-index {
    background: linear-gradient(135deg, var(--story-accent-strong) 0%, var(--story-accent) 100%);
    color: #fffaf8;
    transform: scale(1.06);
  }

  .section-tag {
    margin: 0 0 12px 0;
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.13em;
    color: var(--story-accent-strong);
  }

  .step-title {
    margin: 0 0 16px 0;
    font-size: 2rem;
    line-height: 1.02;
    font-weight: 800;
    color: var(--story-text);
    opacity: 0.84;
    transition: opacity 320ms ease;
  }

  .step-copy {
    margin: 0;
    font-size: 1.02rem;
    line-height: 1.82;
    color: var(--story-muted);
    opacity: 0.88;
    transition: opacity 360ms ease;
    transition-delay: 20ms;
  }

  .step-card.active .step-title,
  .step-card.active .step-copy {
    opacity: 1;
  }

  .step-card.active .step-copy {
    transition-delay: 40ms;
  }

  .key-highlight {
    margin-top: 18px;
    padding: 15px 16px;
    border-radius: 18px;
    background: #fffdfb;
    border: 1px solid var(--story-border);
  }

  .highlight-label {
    margin: 0 0 6px;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--story-accent-strong);
  }

  .highlight-value {
    margin: 0;
    font-size: 1.42rem;
    font-weight: 850;
    color: var(--story-text);
  }

  .highlight-caption {
    margin: 6px 0 0;
    font-size: 0.9rem;
    line-height: 1.5;
    color: var(--story-muted);
  }

  .interaction-prompt {
    margin: 18px 0 0;
    padding-top: 14px;
    border-top: 1px solid var(--story-border);
    font-size: 0.92rem;
    line-height: 1.55;
    color: var(--story-accent-strong);
    font-weight: 700;
  }

  .viz-panel {
    flex: 1;
    height: 100vh;
    padding: 24px 24px 24px 10px;
    box-sizing: border-box;
    z-index: 10;
    transition: padding 500ms cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
  }

  .story-body.exploding .viz-panel {
    padding: 16px;
  }

  .viz-box {
    width: 100%;
    height: 100%;
    position: relative;
    background: linear-gradient(160deg, var(--story-panel-strong), var(--story-panel));
    border: 1px solid var(--story-border-strong);
    border-radius: 30px;
    box-sizing: border-box;
    box-shadow:
      0 24px 56px rgba(30, 12, 16, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.56);
    overflow: hidden;
    backdrop-filter: blur(12px);
  }

  .panel-glow {
    position: absolute;
    inset: 0;
    border-radius: 30px;
    background:
      radial-gradient(circle at top right, var(--story-accent-soft) 0%, transparent 44%),
      linear-gradient(135deg, rgba(255, 255, 255, 0.36), transparent 32%);
    pointer-events: none;
    z-index: 0;
    opacity: 0.56;
  }

  .viz-scroll {
    position: relative;
    height: 100%;
    padding: 0 18px;
    box-sizing: border-box;
    overflow: hidden;
    overscroll-behavior-y: contain;
    z-index: 1;
    display: flex;
    flex-direction: column;
  }

  .viz-header {
    position: sticky;
    top: 0;
    margin: -18px -18px 16px;
    padding: 18px 18px 14px;
    background: linear-gradient(180deg, var(--story-panel-strong) 78%, transparent 100%);
    backdrop-filter: blur(10px);
    z-index: 3;
  }

  .viz-header-content {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px;
  }

  .viz-title-block {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .viz-tag {
    margin: 0 0 6px 0;
    font-size: 0.76rem;
    font-weight: 800;
    letter-spacing: 0.13em;
    color: var(--story-accent-strong);
  }

  .viz-header h3 {
    margin: 0;
    font-size: 1.55rem;
    font-weight: 800;
    color: var(--story-text);
  }

  .viz-meta {
    text-align: right;
  }

  .viz-progress {
    margin: 0 0 4px 0;
    color: var(--story-accent-strong);
    font-size: 0.82rem;
    font-weight: 700;
  }

  .viz-subtitle {
    margin: 0;
    color: var(--story-muted);
    font-size: 0.94rem;
    line-height: 1.45;
  }

  .viz-finding-card {
    margin-top: 14px;
    padding: 14px 16px;
    border-radius: 18px;
    background: #fffdfb;
    border: 1px solid var(--story-border);
    box-shadow: 0 8px 24px rgba(62, 18, 24, 0.08);
  }

  .viz-finding-label {
    margin: 0 0 5px;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--story-accent-strong);
  }

  .viz-finding-value {
    margin: 0;
    font-size: 1.08rem;
    line-height: 1.35;
    font-weight: 800;
    color: var(--story-text);
  }

  .viz-finding-detail {
    margin: 5px 0 0;
    color: var(--story-muted);
    font-size: 0.88rem;
    line-height: 1.5;
  }

  .viz-action-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
  }

  .viz-action-chip {
    display: inline-flex;
    align-items: center;
    padding: 7px 11px;
    border-radius: 999px;
    background: var(--story-accent-soft);
    border: 1px solid var(--story-border);
    color: var(--story-accent-strong);
    font-size: 0.77rem;
    font-weight: 750;
  }

  .viz-stage {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    position: relative;
    z-index: 1;
  }

  .viz-transition-layer {
    opacity: 1;
    transform: translateY(0);
    transition: none;
    will-change: auto;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .chart-shell {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .handoff-card {
    margin: auto;
    max-width: 540px;
    padding: 32px;
    border-radius: 24px;
    background: linear-gradient(155deg, #fffdfb, var(--story-panel));
    border: 1px solid var(--story-border);
    text-align: center;
    box-shadow: 0 18px 40px rgba(38, 14, 18, 0.12);
  }

  .handoff-label {
    margin: 0 0 8px;
    color: var(--story-accent-strong);
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .handoff-card h4 {
    margin: 0;
    font-size: 1.6rem;
    color: var(--story-text);
  }

  .handoff-card p {
    margin: 10px 0 0;
    color: var(--story-muted);
    line-height: 1.62;
  }

  .user-section {
    min-height: 100vh;
    padding: 48px 32px;
    box-sizing: border-box;
    background:
      linear-gradient(180deg, rgba(255, 250, 248, 0.68), rgba(255, 246, 241, 0.96));
    display: block;
  }

  .user-section-inner {
    display: grid;
    gap: 32px;
    max-width: 1400px;
    margin: 0 auto;
  }

  .user-mode-hero {
    padding: 28px 30px;
    border-radius: 26px;
    background: linear-gradient(155deg, var(--story-panel-strong), var(--story-panel));
    border: 1px solid var(--story-border);
    box-shadow: 0 16px 38px rgba(56, 18, 22, 0.09);
  }

  .user-mode-hero h2 {
    margin: 0 0 10px;
    font-size: clamp(2rem, 4vw, 3rem);
    line-height: 0.98;
    color: var(--story-text);
  }

  .user-mode-hero p {
    margin: 0;
    max-width: 760px;
    color: var(--story-muted);
    line-height: 1.7;
  }

  .user-mode-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 18px;
  }

  .user-mode-chips span {
    display: inline-flex;
    align-items: center;
    padding: 8px 12px;
    border-radius: 999px;
    background: #fffdfb;
    border: 1px solid var(--story-border);
    color: var(--story-accent-strong);
    font-size: 0.82rem;
    font-weight: 750;
  }

  .site-footer {
    background: linear-gradient(180deg, #351017 0%, #22070d 100%);
    color: #ead7d4;
    padding: 42px 32px;
  }

  .footer-inner {
    max-width: 1400px;
    margin: 0 auto;
    display: flex;
    gap: 60px;
    flex-wrap: wrap;
  }

  .footer-block h4 {
    color: #fff5f2;
    font-size: 0.95rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    margin: 0 0 12px 0;
  }

  .footer-block ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 0.9rem;
  }

  .footer-block a {
    color: #ffd4cb;
    text-decoration: none;
  }

  .footer-block a:hover {
    text-decoration: underline;
  }

  @media (max-width: 1120px) {
    .intro-highlight-grid {
      grid-template-columns: 1fr;
    }

    .viz-header-content {
      flex-direction: column;
      align-items: flex-start;
    }

    .viz-meta {
      text-align: left;
    }
  }

  @media (max-width: 920px) {
    .story-shell::before,
    .story-shell::after {
      width: 250px;
      height: 250px;
    }

    .story-body {
      display: block;
      padding: 0 16px 32px;
      height: auto;
      min-height: 100vh;
      position: relative;
    }

    .text-column {
      width: 100%;
      height: auto;
      overflow: visible;
      padding: 0;
    }

    .step {
      min-height: 70vh;
      padding: 14px 0;
    }

    .step-bridge {
      margin: 0 2px;
    }

    .viz-panel {
      position: relative;
      width: 100%;
      height: auto;
      margin-top: 24px;
      padding: 0;
    }

    .viz-box {
      min-height: 420px;
      height: auto;
    }

    .viz-scroll {
      height: auto;
      overflow: visible;
      display: block;
    }

    .viz-header {
      position: relative;
      top: auto;
      margin: 0 0 16px;
      padding: 0 0 8px;
      background: transparent;
      backdrop-filter: none;
    }

    .intro-box {
      padding: 38px 24px;
    }
  }
</style>
