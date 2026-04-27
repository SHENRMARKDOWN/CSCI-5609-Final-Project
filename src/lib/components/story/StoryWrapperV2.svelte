<script lang="ts">
  import { onMount } from "svelte";
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

  const storySteps: StoryStep[] = [
    {
      step: 1,
      section: "vis1",
      title: "2019 Rank Overview",
      text: `Stroke is one of the leading causes of death around the world and in the United States. 
      According to the <a href="http://who.int/news-room/fact-sheets/detail/stroke" target="_blank" class="who-link">WHO</a>'s definition, a stroke is a medical emergency that occurs when blood flow to the brain is interrupted, either due to a blockage or bleeding.
      This lack of blood flow can lead to brain cell death and serious complications. Strokes can be fatal and need immediate treatment. 
      <br><br>Narrow down to U.S., let's explore the <a href="https://catalog.data.gov/dataset/stroke-mortality-data-among-us-adults-35-by-state-territory-and-county-2019-2021" target="_blank" class="dataset-link">Stroke Mortality Data Among US Adults (35+) by State/Territory and County</a> dataset. 
      <br><br>Mortality refers to the frequency of death within a certain population. Mortality rate is the number of deaths per 100,000(this number could vary).In this project, the stroke mortality explicitly refers to the how many people died of stroke per 100,000 in a given year. `,
      prompt: "Key question: Which states has the highest stroke mortality in 2019?",
    },
    {
      step: 2,
      section: "vis1",
      title: "From Snapshot to Trend",
      text: `One scroll later, that static ranking expands into a bump chart for 1999-2019.The chart now tells a story of changing positions rather than a single-year order.
      <br><br>As we can see on the bump chart, there is a clear reginal and geographic pattern in stroke mortality. The highest rates are concentrated in the Southeast, while the lowest rates are in the Northeast. This pattern is stable over time, with most states maintaining their relative positions. Some states do show movement, such as North Carolina and Iowa, which have consistently high rates but show some fluctuation in their rankings. However, certain state like Mississippi has a growing trend within recent years, and stay the first for many years.`,
      prompt: "Watch for: states that move, and states that stay near the top.",
    },
    {
      step: 3,
      section: "vis1",
      title: "Prepare a State Focus",
      text: `The national level bump chart shows us the national geographic pattern. Aside from the fact that Southeast states have higher mortality, another fact is that this overall bump chart is overwhelming.
      <br><br> This is the time to introduce the select options above the chart, which allow the viewer to focus on a specific region and look at the trend or rank in this region.
      <br><br>A pop-up pauses the viewer and signals that the next move is a state selection. This makes the transition from national comparison to case study feel deliberate.`,
      prompt: "Next: we move from overview to one state-level anchor.",
    },
    {
      step: 4,
      section: "vis1",
      title: "Mississippi Becomes the Guide",
      text: `Regional level visualization shows a more clear picture of the trend and rank than the national level. However, it is still somehow too broad fo details. Could we be more specific to a state and get much more detailed information?
      <br><br> Luckily, Yes! We can choose a state by clicking on the line and it will be highlighted in the chart.
      <br><br>Remember we mentione Mississippi in the previous step? Let's explore this one. The chosen state anchors the rest of the author-driven story.`,
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
      text: `Both the bar chart and bump chart are too abstract to show geographic patterns clearly. The story now zooms into a map view that spatializes the 2019 mortality rates with a choropleth.
      <br><br>The map on the right is now in the default setting, which shows all the states in the U.S. and their stroke mortality rates in 2019. The year could be adjusted by the user later in the user-driven mode.
      <br><br>The select box on the map allows the user to drag and select a random area. The mortaliy of the states in this area will be presented as glyphs on the side.`,
      prompt: "Look for: whether Mississippi is isolated or part of a broader regional pattern.",
    },
    {
      step: 6,
      section: "vis2",
      title: "Animate National Change",
      text: `Now, let's go back to our story. We have already decided to focus on the Mississippi state and selected the correpsonding line in the bump chart. 
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
      text: `Welcome to the 3D visualization! 
      <br><br>The 3D relief now replays yearly change from 1999 to 2019.State height and color both encode mortality, while the strip below lets the viewer anchor a start year, drag out a time window, and compare the selected state against the national average.`,
      prompt: "Interaction: click any state to highlight it. Drag to rotate. Click or drag on the strip below to define a year window while scroll continues inside it.",
    },
    {
      step: 8,
      section: "vis3",
      title: "Mississippi Baseline",
      text: `After viewing the national and regional trend and rank, we come to the last chart. This is a detailed line chart showing the mortality of different subgroups within the state. 
      <br><br>The last chart starts with Mississippi's overall mortality trend as a single line. That clean baseline makes each later comparison easier to read.`,
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
      <br><br>The plot the mortality trends for people between 35-64 by sex groups. Lines for overall, men, and women appear one by one to build the gender comparison gradually.`,
      prompt: "Watch for: whether male and female trends separate or converge.",
    },
    {
      step: 10,
      section: "vis3",
      title: "Race 35-64: Overall",
      text: `Aside from the sex group, race group may also have different mortality trends. Let's see how the racial subgroups look like.
      <br><br>We remove the view of mortality trends for people between 35-64 by sex groups and reset to the baseline for ages 35-64, starting from the overall line.`,
      prompt: "Reset: begin with the overall line before adding racial subgroups.",
    },
    {
      step: 11,
      section: "vis3",
      title: "Race 35-64: Full Comparison",
      text: `Now we can see the racial subgroups. Race subgroup lines appear one by one, and the newest or hovered subgroup stays emphasized so the comparison remains readable as the full set comes in.
      <br><br> You can hover on any subgroup line to keep it emphasized while the others fade into the background. This interaction allows you to focus on one comparison at a time even when all lines are visible.`,
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
      <br><br>To solve this problem, we will not provide the visualization of all counties by default, but offering some suggested counties that are worth to look at. Here, for the Mississippi state, the five suggested counties are Bolivar, Leflore, Humphreys, Hinds and Sunflower.
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
        text: "By the end of the animation, the country is lighter than it was in 1999. The important question becomes: even after improvement, which places still stand out?",
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

  function updateScrollState() {
    if (currentStep === 0 || !textColumnEl) return;

    const validStepEls = stepEls.filter(Boolean) as HTMLDivElement[];
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
      applyStoryState(nextStep);
      currentStep = nextStep;

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

    scheduleUpdate();

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
        This version uses scroll to reveal one guided narrative arc: national
        rank, geographic context, then Mississippi subgroup detail.
      </p>
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
          </div>

<div
  class="viz-transition-layer"
  class:viz-step-transitioning={vizTransitioning}
  class:transition-forward={vizTransitionDirection === "forward"}
  class:transition-backward={vizTransitionDirection === "backward"}
>
  {#key getVizComponentKey(currentStep)}
    <div
      class="viz-stage"
      in:fade={{ duration: 160 }}
      out:fade={{ duration: 120 }}
    >
      {#if currentStep >= 1 && currentStep <= 4}
        <div class="chart-shell" in:fade={{ duration: 280 }}>
          <BumpChart
            storyStep={currentStep}
            storyMode={true}
            storyProgress={stepProgress}
          />
        </div>
      {:else if currentStep >= 5 && currentStep <= 6}
        <div class="chart-shell" in:fade={{ duration: 280 }}>
          <USStrokeMortalityMapV2
            storyStep={currentStep}
            storyMode={true}
            storyProgress={stepProgress}
          />
        </div>

      {:else if currentStep === 7}
        <div class="chart-shell" in:fade={{ duration: 280 }}>
          <USStrokeMortalityMap3D
            storyMode={true}
            showYearSlider={false}
            storyProgress={stepProgress}
          />
        </div>

      {:else if currentStep >= 8 && currentStep <= 13}
        <div class="chart-shell" in:fade={{ duration: 280 }}>
          <DetailLinePlot
            storyStep={currentStep}
            storyMode={true}
            storyProgress={stepProgress}
          />
        </div>

      {:else if currentStep === HANDOFF_STEP}
      <p style="padding: 40px; color: #555; font-size: 1.1rem;">Scroll down to explore freely.</p>
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
      <BumpChart storyMode={false} />
      <USStrokeMortalityMapV2 storyMode={false} />
      <USStrokeMortalityMap3D storyMode={false} />
      <DetailLinePlot storyMode={false} />
    </div>
  </section>
{/if}

<style>
  .story-page {
    width: 100%;
    min-height: 100vh;
    position: relative;
    background:
      radial-gradient(
        circle at top left,
        rgba(30, 64, 175, 0.08),
        transparent 30%
      ),
      linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
    color: #111827;
    transition:
      background 420ms ease,
      color 260ms ease;
  }

  .story-page::before {
    content: "";
    position: fixed;
    top: 10%;
    right: 5%;
    width: 360px;
    height: 360px;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      rgba(59, 130, 246, 0.16),
      transparent 68%
    );
    filter: blur(18px);
    pointer-events: none;
    z-index: 0;
    opacity: 0.85;
    transition: background 420ms ease;
  }

  .story-page.theme-vis2::before {
    background: radial-gradient(
      circle,
      rgba(245, 158, 11, 0.18),
      transparent 68%
    );
  }

  .story-page.theme-vis3::before {
    background: radial-gradient(
      circle,
      rgba(16, 185, 129, 0.16),
      transparent 68%
    );
  }

  .story-page.theme-user::before {
    background: radial-gradient(
      circle,
      rgba(99, 102, 241, 0.14),
      transparent 68%
    );
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
    max-width: 920px;
    padding: 48px 40px;
    border-radius: 28px;
    background: rgba(255, 255, 255, 0.84);
    box-shadow: 0 26px 60px rgba(15, 23, 42, 0.09);
    backdrop-filter: blur(10px);
  }

  .eyebrow {
    margin: 0 0 14px 0;
    color: #1d4ed8;
    font-size: 0.85rem;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .intro-box h1 {
    margin: 0 0 18px 0;
    font-size: clamp(2.6rem, 5vw, 4.25rem);
    line-height: 0.98;
    font-weight: 800;
  }

  .intro-box p {
    font-size: 1.15rem;
    line-height: 1.7;
    color: #374151;
  }

  .intro-title {
    text-wrap: balance;
  }

  .intro-copy {
    max-width: 760px;
    margin-left: auto;
    margin-right: auto;
  }

  .hint {
    margin-top: 22px;
    color: #1d4ed8;
    font-weight: 700;
  }
  :global(.who-link) {
  color: #2563eb;
  font-weight: 800;
  text-decoration: none;
  background-color: #dbeafe;
  padding: 1px 4px;
  border-radius: 3px;
}
:global(.dataset-link) {
  color: #2563eb;
  font-weight: 800;
  text-decoration: none;
  background-color: #dbeafe;
  padding: 1px 4px;
  border-radius: 3px;
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

  .text-column {
    width: 25%;
    height: 100vh;
    overflow-y: auto;
    overflow-x: hidden;
    box-sizing: border-box;
    padding: 0 12px 0 24px;
    flex-shrink: 0;
    scroll-behavior: auto;
    overscroll-behavior-y: contain;
    scrollbar-width: thin;
    scrollbar-color: rgba(0, 0, 0, 0.15) transparent;
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
    padding: 28px 12px;
    box-sizing: border-box;
  }

  .step-bridge {
    min-height: var(--bridge-height, 40vh);
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 12px 20px 36px;
    box-sizing: border-box;
    color: #475569;
  }

  .bridge-label {
    margin: 0 0 8px;
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #64748b;
  }

  .bridge-text {
    margin: 0;
    font-size: 0.98rem;
    line-height: 1.75;
  }

  .step-card {
    width: 100%;
    position: relative;
    background: rgba(255, 255, 255, 0.82);
    border: 1px solid rgba(203, 213, 225, 0.9);
    border-radius: 22px;
    padding: 28px;
    box-sizing: border-box;
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.07);
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
    opacity: 0.42;
  }

  .step-card.active {
    background: rgba(255, 255, 255, 0.96);
    border-color: rgba(59, 130, 246, 0.45);
    box-shadow: 0 24px 48px rgba(37, 99, 235, 0.12);
    transform: translateY(-6px) scale(1.01);
    opacity: 1;
  }

  .step-card.past {
    opacity: 0.28;
  }

  .step-index {
    position: absolute;
    top: 18px;
    right: 18px;
    width: 34px;
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: rgba(226, 232, 240, 0.85);
    color: #475569;
    font-size: 0.88rem;
    font-weight: 800;
    transition:
      background 260ms ease,
      color 260ms ease,
      transform 260ms ease;
  }

  .step-card.active .step-index {
    background: linear-gradient(135deg, #1d4ed8 0%, #38bdf8 100%);
    color: #fff;
    transform: scale(1.06);
  }

  .section-tag {
    margin: 0 0 12px 0;
    font-size: 0.8rem;
    font-weight: 800;
    letter-spacing: 0.11em;
    color: #1d4ed8;
  }

  .step-title {
    margin: 0 0 16px 0;
    font-size: 1.95rem;
    line-height: 1.05;
    font-weight: 800;
    opacity: 0.82;
    transition: opacity 320ms ease;
  }

  .step-copy {
    margin: 0;
    font-size: 1.03rem;
    line-height: 1.82;
    color: #334155;
    opacity: 0.86;
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
    padding: 14px 16px;
    border-radius: 16px;
    background: rgba(248, 250, 252, 0.95);
    border: 1px solid rgba(203, 213, 225, 0.9);
  }

  .highlight-label {
    margin: 0 0 6px;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #64748b;
  }

  .highlight-value {
    margin: 0;
    font-size: 1.45rem;
    font-weight: 850;
    color: #0f172a;
  }

  .highlight-caption {
    margin: 6px 0 0;
    font-size: 0.9rem;
    line-height: 1.5;
    color: #475569;
  }

  .interaction-prompt {
    margin: 18px 0 0;
    padding-top: 14px;
    border-top: 1px solid rgba(203, 213, 225, 0.8);
    font-size: 0.92rem;
    line-height: 1.55;
    color: #1d4ed8;
    font-weight: 650;
  }

  .viz-panel {
    flex: 1;
    height: 100vh;
    padding: 24px 24px 24px 8px;
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
    background: rgba(255, 255, 255, 0.94);
    border: 1px solid #dbe3ee;
    border-radius: 24px;
    box-sizing: border-box;
    box-shadow: 0 20px 48px rgba(15, 23, 42, 0.1);
    overflow: hidden;
    backdrop-filter: blur(10px);
    transition:
      transform 320ms cubic-bezier(0.22, 1, 0.36, 1),
      border-color 320ms ease,
      box-shadow 320ms ease,
      background 320ms ease;
  }

  .theme-vis1 .viz-box {
    border-color: rgba(59, 130, 246, 0.22);
    box-shadow: 0 24px 52px rgba(37, 99, 235, 0.11);
  }

  .theme-vis2 .viz-box {
    border-color: rgba(245, 158, 11, 0.22);
    box-shadow: 0 24px 52px rgba(217, 119, 6, 0.1);
  }

  .theme-vis3 .viz-box {
    border-color: rgba(16, 185, 129, 0.2);
    box-shadow: 0 24px 52px rgba(5, 150, 105, 0.1);
  }

  .theme-user .viz-box {
    border-color: rgba(99, 102, 241, 0.2);
    box-shadow: 0 24px 52px rgba(79, 70, 229, 0.1);
  }

  .panel-glow {
    position: absolute;
    inset: 0;
    border-radius: 24px;
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.26),
      transparent 32%
    );
    pointer-events: none;
    z-index: 0;
  }

  .viz-scroll {
    position: relative;
    height: 100%;
    padding: 0px 18px;
    box-sizing: border-box;
    overflow: hidden; /*APR 26*/
    overscroll-behavior-y: contain;
    z-index: 1;
    display: flex; flex-direction: column;/*APR 26*/
  }

  .viz-header {
    position: sticky;
    top: 0;
    min-height: 76px;
    margin: -18px -18px 16px -18px;
    padding: 18px 18px 14px;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.98) 78%,
      rgba(255, 255, 255, 0)
    );
    backdrop-filter: blur(8px);
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
    font-size: 0.8rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: #1d4ed8;
  }

  .viz-header h3 {
    margin: 0;
    font-size: 1.55rem;
    font-weight: 800;
  }

  .viz-meta {
    text-align: right;
  }

  .viz-progress {
    margin: 0 0 4px 0;
    color: #1d4ed8;
    font-size: 0.84rem;
    font-weight: 700;
  }

  .viz-subtitle {
    margin: 0;
    color: #475569;
    font-size: 0.95rem;
    line-height: 1.45;
  }

  .viz-stage {
    flex: 1; min-height: 0; display: flex; flex-direction: column; /*APR 26*/
    position: relative;
    z-index: 1;
  }

  .viz-transition-layer {
    opacity: 1;
    transform: translateY(0);
    transition:
      opacity 220ms ease,
      transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
    will-change: opacity, transform;
    flex: 1; min-height: 0; display: flex; flex-direction: column; /*APR 26*/
  }

  .viz-step-transitioning {
    opacity: 0.78;
  }

  .viz-step-transitioning.transition-forward {
    transform: translateY(8px);
  }

  .viz-step-transitioning.transition-backward {
    transform: translateY(-8px);
  }

  .chart-shell {
    position: relative;
    flex: 1; min-height: 0; display: flex; flex-direction: column; /*APR 26*/
  }

  .explore-stage {
    display: grid;
    gap: 20px;
  }

  @media (max-width: 1120px) {
    .viz-header-content {
      flex-direction: column;
      align-items: flex-start;
    }

    .viz-meta {
      text-align: left;
    }
  }

  @media (max-width: 920px) {
    .story-page::before {
      width: 240px;
      height: 240px;
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

    .text-card-stage {
      display: none;
    }

    .step {
      min-height: 70vh;
      padding: 14px 0;
    }

    .step-card-scroll {
      visibility: visible;
      pointer-events: auto;
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
      display: block; /*APR 26*/
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
      padding: 36px 24px;
    }
  }
    .user-section {
      min-height: 100vh;
      padding: 40px 32px;
      box-sizing: border-box;
      background: #f8fafc;
      display: block;
    }
    .user-section-inner {
      display: grid;
      gap: 32px;
      max-width: 1400px;
      margin: 0 auto;
    }
    .story-body.user-mode {
  opacity: 0;
  pointer-events: none;
  z-index: 0;}
  

  
</style>
