<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import StoryBumpChart from '$lib/components/story/StoryBumpChart.svelte';
  import StoryDetailLinePlot from '$lib/components/story/StoryDetailLinePlot.svelte';
  import StoryUSStrokeMortalityMap from '$lib/components/story/StoryUSStrokeMortalityMap.svelte';

  type StorySection = 'vis1' | 'vis2' | 'vis3' | 'user';
  type StoryStep = {
    step: number;
    section: StorySection;
    title: string;
    text: string;
  };

  let currentStep = 0;
  let transitionProgress = 0;
  let introEl: HTMLElement;
  let stepEls: HTMLDivElement[] = [];

  const storySteps: StoryStep[] = [
    {
      step: 1,
      section: 'vis1',
      title: '2019 Rank Overview',
      text:
        'We begin with a 2019 ranking bar chart so the audience first sees where stroke mortality is highest before any motion is introduced.'
    },
    {
      step: 2,
      section: 'vis1',
      title: 'From Snapshot to Trend',
      text:
        'One scroll later, that static ranking expands into a bump chart for 1999-2019. The chart now tells a story of changing positions rather than a single-year order.'
    },
    {
      step: 3,
      section: 'vis1',
      title: 'Prepare a State Focus',
      text:
        'A pop-up pauses the viewer and signals that the next move is a state selection. This makes the transition from national comparison to case study feel deliberate.'
    },
    {
      step: 4,
      section: 'vis1',
      title: 'Mississippi Becomes the Guide',
      text:
        'Mississippi is automatically selected and highlighted. That chosen state anchors the rest of the author-driven story.'
    },
    {
      step: 5,
      section: 'vis2',
      title: 'Map the 2019 Landscape',
      text:
        'The map opens on the 2019 national distribution with Mississippi still highlighted, preserving continuity while shifting from rank to geography.'
    },
    {
      step: 6,
      section: 'vis2',
      title: 'Animate National Change',
      text:
        'The first map scroll introduces a note and then animates the choropleth from 1999 to 2019 so the audience sees spatial change over time.'
    },
    {
      step: 7,
      section: 'vis3',
      title: 'Mississippi Baseline',
      text:
        "The final chart starts with Mississippi's overall mortality trend as a single line. That clean baseline makes each later comparison easier to read."
    },
    {
      step: 8,
      section: 'vis3',
      title: 'Sex 35-64: Overall',
      text:
        'The plot resets to sex for ages 35-64 and begins with the overall subgroup line only.'
    },
    {
      step: 9,
      section: 'vis3',
      title: 'Sex 35-64: Add Men',
      text:
        'A second line is added for men ages 35-64, keeping the comparison focused and readable.'
    },
    {
      step: 10,
      section: 'vis3',
      title: 'Sex 35-64: Add Women',
      text:
        'The women ages 35-64 line is added next, completing the younger-age sex comparison.'
    },
    {
      step: 11,
      section: 'vis3',
      title: 'Sex 65+: Reset the Plot',
      text:
        'The chart is cleaned and reset to the ages 65+ overall line so the next comparison starts fresh.'
    },
    {
      step: 12,
      section: 'vis3',
      title: 'Sex 65+: Add Men',
      text:
        'The male 65+ line is added using the same one-scroll, one-line rhythm.'
    },
    {
      step: 13,
      section: 'vis3',
      title: 'Sex 65+: Add Women',
      text:
        'The female 65+ line completes the older-age sex comparison.'
    },
    {
      step: 14,
      section: 'vis3',
      title: 'Race 35-64: Overall',
      text:
        'The view resets to race for ages 35-64 and again starts from the overall line.'
    },
    {
      step: 15,
      section: 'vis3',
      title: 'Race 35-64: Add White',
      text:
        'The White subgroup line is introduced first so the audience can form a simple visual comparison.'
    },
    {
      step: 16,
      section: 'vis3',
      title: 'Race 35-64: Add Black (Non-Hispanic)',
      text:
        'A second race-specific line is added for Black non-Hispanic residents, sharpening the contrast.'
    },
    {
      step: 17,
      section: 'vis3',
      title: 'Race 35-64: Add Hispanic',
      text:
        'The Hispanic line appears next, extending the race comparison one step at a time.'
    },
    {
      step: 18,
      section: 'vis3',
      title: 'Race 35-64: Add Asian / Pacific Islander',
      text:
        'Another line is added for Asian and Pacific Islander residents to continue the incremental reveal.'
    },
    {
      step: 19,
      section: 'vis3',
      title: 'Race 35-64: Add AI / AN',
      text:
        'The final race line adds American Indian and Alaska Native residents, completing the race comparison.'
    },
    {
      step: 20,
      section: 'vis3',
      title: 'County 35-64: State Average',
      text:
        'The chart resets to county mode for ages 35-64 and starts with the state average only.'
    },
    {
      step: 21,
      section: 'vis3',
      title: 'County 35-64: Suggested County 1',
      text:
        'The first suggested county line is added so the county comparison remains curated and readable.'
    },
    {
      step: 22,
      section: 'vis3',
      title: 'County 35-64: Suggested County 2',
      text:
        'A second suggested county is layered in against the state average.'
    },
    {
      step: 23,
      section: 'vis3',
      title: 'County 35-64: Suggested County 3',
      text:
        'The third county line deepens the local comparison while preserving legibility.'
    },
    {
      step: 24,
      section: 'vis3',
      title: 'County 35-64: Suggested County 4',
      text:
        'A fourth suggested county is added to test whether the emerging county pattern holds.'
    },
    {
      step: 25,
      section: 'vis3',
      title: 'County 35-64: Suggested County 5',
      text:
        'The fifth suggested county completes the guided county comparison.'
    },
    {
      step: 26,
      section: 'user',
      title: 'Hand Off to User-Driven Mode',
      text:
        'The guided sequence ends here. The viewer can now move into the user-driven dashboard for free exploration.'
    }
  ];

  const totalSteps = storySteps.length;
  const vis3StartStep = 7;

  function clamp(value: number, min = 0, max = 1) {
    return Math.min(max, Math.max(min, value));
  }

  function getVizMeta(step: number) {
    if (step >= 1 && step <= 4) {
      return {
        tag: 'VIS1',
        title: 'Bump Chart Story',
        subtitle:
          step === 1
            ? '2019 ranking bar chart'
            : step === 2
              ? 'Transition into the 1999-2019 bump chart'
              : step === 3
                ? 'Pause before state selection'
                : 'Mississippi selected and highlighted'
      };
    }

    if (step >= 5 && step <= 6) {
      return {
        tag: 'VIS2',
        title: 'U.S. Stroke Mortality Map',
        subtitle:
          step === 5
            ? '2019 choropleth with Mississippi highlighted'
            : 'Animated national change from 1999 to 2019'
      };
    }

    if (step >= 7 && step <= 25) {
      const current = storySteps.find((item) => item.step === step);
      return {
        tag: 'VIS3',
        title: 'Mississippi Detail Story',
        subtitle: current?.title ?? 'Guided subgroup comparison'
      };
    }

    return {
      tag: 'FREE',
      title: 'User-Driven Exploration',
      subtitle: 'Switch from guided storytelling to free exploration'
    };
  }

  function openDashboard() {
    goto('/');
  }

  function getThemeClass(step: number) {
    if (step >= 1 && step <= 4) return 'theme-vis1';
    if (step >= 5 && step <= 6) return 'theme-vis2';
    if (step >= vis3StartStep && step <= 25) return 'theme-vis3';
    return 'theme-user';
  }

  function getStepNote(step: number) {
    if (step === 2) {
      return {
        label: 'Transition',
        title: 'From bars to bump chart',
        text: 'The 2019 bars expand into a full 1999-2019 ranking story.',
        tone: 'blue'
      };
    }

    if (step === 3) {
      return {
        label: 'Next step',
        title: 'Choose one state',
        text:
          'The story is about to move from national movement to one guided state case so the audience can stay oriented.',
        tone: 'blue'
      };
    }

    if (step === 4) {
      return {
        label: 'Story focus',
        title: 'Mississippi',
        text: 'Mississippi now anchors the rest of the narrative across the map and subgroup views.',
        tone: 'rose'
      };
    }

    if (step === 6) {
      return {
        label: 'Animation',
        title: 'Watch the national pattern change',
        text:
          'This step animates the map from 1999 to 2019 so the audience reads change over time instead of a single-year snapshot.',
        tone: 'amber'
      };
    }

    if (step >= 8 && step <= 25) {
      return {
        label: 'Guided line build',
        title: 'One scroll, one addition',
        text: 'Each scroll adds one line or resets the plot for the next mode.',
        tone: 'emerald'
      };
    }

    return null;
  }

  function updateScrollState() {
    const validStepEls = stepEls.filter(Boolean);

    if (validStepEls.length === 0) {
      currentStep = 0;
      transitionProgress = 0;
      return;
    }

    const triggerY = window.scrollY + window.innerHeight * 0.42;
    const stepPositions = validStepEls.map((el) => window.scrollY + el.getBoundingClientRect().top);
    const firstStepTop = stepPositions[0];

    if (triggerY < firstStepTop) {
      currentStep = 0;
      transitionProgress = 0;
      return;
    }

    let activeIndex = stepPositions.findIndex((top, index) => {
      const nextTop = stepPositions[index + 1] ?? Number.POSITIVE_INFINITY;
      return triggerY >= top && triggerY < nextTop;
    });

    if (activeIndex === -1) {
      activeIndex = stepPositions.length - 1;
    }

    const start = stepPositions[activeIndex];
    const end =
      stepPositions[activeIndex + 1] ??
      start + Math.max(validStepEls[activeIndex]?.offsetHeight ?? window.innerHeight, window.innerHeight);

    currentStep = storySteps[activeIndex]?.step ?? 0;
    transitionProgress = clamp((triggerY - start) / Math.max(end - start, 1));
  }

  onMount(() => {
    let frame = 0;

    const scheduleUpdate = () => {
      if (frame) return;

      frame = requestAnimationFrame(() => {
        frame = 0;
        updateScrollState();
      });
    };

    scheduleUpdate();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
    };
  });
</script>

<div class={`story-page ${getThemeClass(currentStep)}`}>
  {#if currentStep > 0}
    <div class="story-progress-track" aria-hidden="true">
      <div class="story-progress-fill" style={`transform:scaleX(${transitionProgress});`}></div>
    </div>
  {/if}

  <section class="intro-section" data-step="0" bind:this={introEl}>
    <div class="intro-box">
      <p class="eyebrow" in:fade={{ duration: 420, delay: 80 }}>
        Author-Driven Story
      </p>
      <h1 class="intro-title" in:fly={{ y: 22, duration: 620, delay: 120 }}>
        Stroke Mortality in the U.S.
      </h1>
      <p class="intro-copy" in:fade={{ duration: 520, delay: 260 }}>
        This version uses scroll to reveal one guided narrative arc: national rank,
        geographic context, then Mississippi subgroup detail.
      </p>
      <p class="hint" in:fade={{ duration: 520, delay: 420 }}>
        Scroll down to start the guided story
      </p>
    </div>
  </section>

  <div class="story-body">
    <div class="text-column">
      {#if currentStep > 0}
        {@const activeStoryStep = storySteps[currentStep - 1]}
        {@const stepNote = getStepNote(currentStep)}
        <div class="text-card-stage">
          {#key `text-${currentStep}`}
            <div class="text-card-stack" in:fade={{ duration: 220 }} out:fade={{ duration: 140 }}>
              <div class="step-card step-card-fixed active">
                <div class="step-index">{activeStoryStep.step}</div>
                <p class="section-tag">{activeStoryStep.section.toUpperCase()}</p>
                <h2 class="step-title">{activeStoryStep.title}</h2>
                <p class="step-copy">{activeStoryStep.text}</p>
              </div>

              {#if stepNote}
                <div class={`story-note-card ${stepNote.tone}`}>
                  <p class="story-note-label">{stepNote.label}</p>
                  <h3 class="story-note-title">{stepNote.title}</h3>
                  <p class="story-note-text">{stepNote.text}</p>
                </div>
              {/if}
            </div>
          {/key}
        </div>
      {/if}

      {#each storySteps as item, i}
        <div class="step" data-step={item.step} bind:this={stepEls[i]}>
          <div
            class="step-card step-card-scroll"
            class:active={currentStep === item.step}
            class:past={currentStep > item.step}
          >
            <div class="step-index">{item.step}</div>
            <p class="section-tag">{item.section.toUpperCase()}</p>
            <h2 class="step-title">{item.title}</h2>
            <p class="step-copy">{item.text}</p>
          </div>
        </div>
      {/each}
    </div>

    {#if currentStep > 0}
      {@const meta = getVizMeta(currentStep)}
      <div class="viz-panel">
        <div class="viz-box">
          <div class="panel-glow" aria-hidden="true"></div>
          <div class="viz-scroll">
            <div class="viz-header">
              {#key `header-${currentStep}`}
                <div
                  class="viz-header-content"
                  in:fade={{ duration: 260 }}
                  out:fade={{ duration: 160 }}
                >
                  <div class="viz-title-block" in:fade={{ duration: 280 }}>
                    <p class="viz-tag">{meta.tag}</p>
                    <h3>{meta.title}</h3>
                  </div>

                  <div
                    class="viz-meta"
                    in:fade={{ duration: 300, delay: 60 }}
                  >
                    <p class="viz-progress">Step {currentStep} / {totalSteps}</p>
                    <p class="viz-subtitle">{meta.subtitle}</p>
                  </div>
                </div>
              {/key}
            </div>

            {#key currentStep}
              <div
                class="viz-stage"
                in:fly={{ y: 24, duration: 380 }}
                out:fade={{ duration: 180 }}
              >
                {#if currentStep >= 1 && currentStep <= 4}
                  <div class="chart-shell" in:fade={{ duration: 320 }}>
                    <StoryBumpChart storyStep={currentStep} />
                  </div>
                {:else if currentStep >= 5 && currentStep <= 6}
                  <div class="chart-shell" in:fade={{ duration: 320 }}>
                    <StoryUSStrokeMortalityMap storyStep={currentStep} />
                  </div>
                {:else if currentStep >= 7 && currentStep <= 25}
                  <div class="chart-shell" in:fade={{ duration: 320 }}>
                    <StoryDetailLinePlot storyStep={currentStep} />
                  </div>
                {:else}
                  <div class="user-mode-card" in:fade={{ duration: 320 }}>
                    <p class="user-mode-tag">User-Driven Mode</p>
                    <h4>Explore the dashboard freely</h4>
                    <p>
                      The guided narrative is complete. Continue in the free-exploration view to
                      choose states, years, and subgroup combinations on your own.
                    </p>
                    <button class="user-mode-link" type="button" onclick={openDashboard}>
                      Open User-Driven Dashboard
                    </button>
                  </div>
                {/if}
              </div>
            {/key}
          </div>

        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .story-page {
    width: 100%;
    min-height: 100vh;
    position: relative;
    background:
      radial-gradient(circle at top left, rgba(30, 64, 175, 0.08), transparent 30%),
      linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
    color: #111827;
    transition:
      background 420ms ease,
      color 260ms ease;
  }

  .story-page::before {
    content: '';
    position: fixed;
    top: 10%;
    right: 5%;
    width: 360px;
    height: 360px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(59, 130, 246, 0.16), transparent 68%);
    filter: blur(18px);
    pointer-events: none;
    z-index: 0;
    opacity: 0.85;
    transition: background 420ms ease;
  }

  .story-page.theme-vis2::before {
    background: radial-gradient(circle, rgba(245, 158, 11, 0.18), transparent 68%);
  }

  .story-page.theme-vis3::before {
    background: radial-gradient(circle, rgba(16, 185, 129, 0.16), transparent 68%);
  }

  .story-page.theme-user::before {
    background: radial-gradient(circle, rgba(99, 102, 241, 0.14), transparent 68%);
  }

  .story-progress-track {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 6px;
    background: rgba(255, 255, 255, 0.4);
    z-index: 30;
    backdrop-filter: blur(8px);
  }

  .story-progress-fill {
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, #1d4ed8 0%, #38bdf8 100%);
    box-shadow: 0 0 20px rgba(29, 78, 216, 0.35);
    transform-origin: left center;
    will-change: transform;
    transition: transform 120ms linear;
  }

  .intro-section {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    box-sizing: border-box;
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

  .story-body {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 28px;
    padding: 0 24px 56px;
    box-sizing: border-box;
    z-index: 1;
  }

  .text-column {
    position: relative;
    width: 37%;
    box-sizing: border-box;
  }

  .text-card-stage {
    position: sticky;
    top: 50vh;
    transform: translateY(-50%);
    padding: 24px 12px;
    box-sizing: border-box;
    z-index: 2;
    pointer-events: none;
  }

  .text-card-stack {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .step {
    min-height: 100vh;
    display: flex;
    align-items: center;
    padding: 24px 12px;
    box-sizing: border-box;
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

  .step-card-fixed {
    pointer-events: auto;
  }

  .step-card-scroll {
    visibility: hidden;
    pointer-events: none;
  }

  .story-note-card {
    padding: 18px 20px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(203, 213, 225, 0.9);
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
    backdrop-filter: blur(8px);
    pointer-events: auto;
  }

  .story-note-card.blue {
    border-color: rgba(96, 165, 250, 0.45);
    background: rgba(239, 246, 255, 0.9);
  }

  .story-note-card.rose {
    border-color: rgba(244, 114, 182, 0.35);
    background: rgba(255, 241, 242, 0.94);
  }

  .story-note-card.amber {
    border-color: rgba(251, 191, 36, 0.4);
    background: rgba(255, 251, 235, 0.94);
  }

  .story-note-card.emerald {
    border-color: rgba(52, 211, 153, 0.35);
    background: rgba(236, 253, 245, 0.94);
  }

  .story-note-label {
    margin: 0 0 8px 0;
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #1d4ed8;
  }

  .story-note-card.rose .story-note-label {
    color: #be185d;
  }

  .story-note-card.amber .story-note-label {
    color: #b45309;
  }

  .story-note-card.emerald .story-note-label {
    color: #047857;
  }

  .story-note-title {
    margin: 0 0 8px 0;
    font-size: 1.05rem;
    font-weight: 800;
    line-height: 1.3;
    color: #0f172a;
  }

  .story-note-text {
    margin: 0;
    font-size: 0.96rem;
    line-height: 1.68;
    color: #334155;
  }

  .step-card.active {
    background: rgba(255, 255, 255, 0.96);
    border-color: rgba(59, 130, 246, 0.45);
    box-shadow: 0 24px 48px rgba(37, 99, 235, 0.12);
    transform: translateY(-6px) scale(1.01);
  }

  .step-card.past {
    opacity: 0.7;
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
    transition:
      opacity 320ms ease;
  }

  .step-copy {
    margin: 0;
    font-size: 1.03rem;
    line-height: 1.82;
    color: #334155;
    opacity: 0.86;
    transition:
      opacity 360ms ease;
    transition-delay: 20ms;
  }

  .step-card.active .step-title,
  .step-card.active .step-copy {
    opacity: 1;
  }

  .step-card.active .step-copy {
    transition-delay: 40ms;
  }

  .viz-panel {
    position: fixed;
    top: 24px;
    right: 24px;
    width: calc(63% - 40px);
    height: calc(100vh - 48px);
    box-sizing: border-box;
    z-index: 10;
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
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.26), transparent 32%);
    pointer-events: none;
    z-index: 0;
  }

  .viz-scroll {
    position: relative;
    height: 100%;
    padding: 18px;
    box-sizing: border-box;
    overflow: auto;
    z-index: 1;
  }

  .viz-header {
    position: relative;
    min-height: 76px;
    margin-bottom: 16px;
    z-index: 1;
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
    min-height: calc(100% - 72px);
    position: relative;
    z-index: 1;
  }

  .chart-shell {
    position: relative;
  }

  .user-mode-card {
    min-height: calc(100vh - 180px);
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 16px;
    padding: 32px;
    border-radius: 22px;
    background:
      linear-gradient(140deg, rgba(29, 78, 216, 0.07), rgba(14, 116, 144, 0.06)),
      #ffffff;
    border: 1px solid #dbe3ee;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
  }

  .user-mode-tag {
    margin: 0;
    color: #1d4ed8;
    font-size: 0.86rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .user-mode-card h4 {
    margin: 0;
    font-size: 2rem;
    line-height: 1.05;
  }

  .user-mode-card p {
    margin: 0;
    max-width: 720px;
    color: #334155;
    font-size: 1.03rem;
    line-height: 1.75;
  }

  .user-mode-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: fit-content;
    padding: 12px 18px;
    border-radius: 999px;
    background: #1d4ed8;
    border: 0;
    color: #ffffff;
    text-decoration: none;
    cursor: pointer;
    font: inherit;
    font-weight: 700;
    box-shadow: 0 10px 20px rgba(29, 78, 216, 0.22);
    transition:
      transform 180ms ease,
      box-shadow 180ms ease,
      background 180ms ease;
  }

  .user-mode-link:hover {
    background: #1e40af;
    transform: translateY(-1px);
    box-shadow: 0 14px 24px rgba(29, 78, 216, 0.28);
  }

  .user-mode-link:focus-visible {
    outline: 3px solid rgba(37, 99, 235, 0.28);
    outline-offset: 3px;
  }

  @media (max-width: 1120px) {
    .viz-header {
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
    }

    .text-column {
      width: 100%;
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
      top: auto;
      right: auto;
      width: 100%;
      height: auto;
      margin-top: 24px;
    }

    .viz-box {
      min-height: 420px;
      height: auto;
    }

    .intro-box {
      padding: 36px 24px;
    }
  }
</style>
