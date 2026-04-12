<script lang="ts">
  import { onMount } from 'svelte';
  import BumpChart from '$lib/components/BumpChart.svelte';
  import DetailLinePlot from '$lib/components/DetailLinePlot.svelte';
  import USStrokeMortalityMap from '$lib/components/USStrokeMortalityMap.svelte';

  let currentStep = 0;
  let introEl: HTMLElement;
  let stepEls: HTMLDivElement[] = [];

  type StoryStep = {
    step: number;
    section: 'vis1' | 'vis2' | 'vis3';
    title: string;
    text: string;
  };

  const storySteps: StoryStep[] = [
    {
      step: 1,
      section: 'vis1',
      title: 'Visualization 1 · Starting Point',
      text:
        'We begin with the first visualization as an overview of stroke mortality ranking. This opening view helps the audience understand where states stand before we introduce movement over time.'
    },
    {
      step: 2,
      section: 'vis1',
      title: 'Visualization 1 · Ranking to Trend',
      text:
        'As we continue scrolling, the first chart shifts from a static ranking perspective toward a time-based comparison. This transition sets up the bump-chart storytelling of how state positions changed from 1999 to 2019.'
    },
    {
      step: 3,
      section: 'vis1',
      title: 'Visualization 1 · Guided Focus',
      text:
        'At this point, an explanatory prompt guides the viewer from the national ranking context toward a more focused state-level interpretation.'
    },
    {
      step: 4,
      section: 'vis1',
      title: 'Visualization 1 · Mississippi Highlight',
      text:
        'Now we narrow the focus to Mississippi. This prepares the transition from broad state ranking to targeted geographic and subgroup analysis.'
    },
    {
      step: 5,
      section: 'vis2',
      title: 'Visualization 2 · Map Overview',
      text:
        'The second visualization begins with a geographic view. The choropleth map introduces regional differences and gives the audience a spatial understanding of stroke mortality.'
    },
    {
      step: 6,
      section: 'vis2',
      title: 'Visualization 2 · Explain the Change',
      text:
        'A guided note explains that the map is about to reveal how mortality patterns changed over time, instead of only showing a single-year snapshot.'
    },
    {
      step: 7,
      section: 'vis2',
      title: 'Visualization 2 · Distribution Shift',
      text:
        'This is the key storytelling moment of the geographic section: the map now emphasizes changing mortality distribution from 1999 to 2019.'
    },
    {
      step: 8,
      section: 'vis3',
      title: 'Visualization 3 · Mississippi Baseline',
      text:
        'The final visualization starts with Mississippi as the default baseline. This keeps the transition consistent with the previous state-focused section.'
    },
    {
      step: 9,
      section: 'vis3',
      title: 'Visualization 3 · Add the First Subgroup',
      text:
        'We gradually introduce subgroup comparison instead of showing all lines at once. The first added line helps the audience understand how the comparison works.'
    },
    {
      step: 10,
      section: 'vis3',
      title: 'Visualization 3 · Add More Subgroups',
      text:
        'More subgroup lines are layered in sequence so the audience can compare age and sex categories without being overwhelmed.'
    },
    {
      step: 11,
      section: 'vis3',
      title: 'Visualization 3 · Race and County Detail',
      text:
        'Finally, the story expands to race and selected county-level comparisons, serving as a bridge toward a future user-driven exploration mode.'
    }
  ];

  onMount(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;

          const step = Number(entry.target.getAttribute('data-step'));
          if (!Number.isNaN(step)) {
            currentStep = step;
          }
        }
      },
      {
        threshold: 0.6
      }
    );

    if (introEl) observer.observe(introEl);

    stepEls.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  });
</script>

<div class="story-page">
  <section class="intro-section" data-step="0" bind:this={introEl}>
    <div class="intro-box">
      <h1>Stroke Mortality in the U.S.</h1>
      <p>
        This story explores how stroke mortality changed across time, geography,
        and population groups.
      </p>
      <p class="hint">Scroll down to continue</p>
    </div>
  </section>

  <div class="story-body">
    <div class="text-column">
      {#each storySteps as item, i}
        <div class="step" data-step={item.step} bind:this={stepEls[i]}>
          <div class="step-card">
            <p class="section-tag">{item.section.toUpperCase()}</p>
            <h2>{item.title}</h2>
            <p>{item.text}</p>
          </div>
        </div>
      {/each}
    </div>

    {#if currentStep > 0}
      <div class="viz-panel">
        <div class="viz-box">
          {#if currentStep >= 1 && currentStep <= 4}
            <div class="viz-state-box">
              <div class="viz-header">
                <div>
                  <p class="viz-tag">VIS1</p>
                  <h3>Bump Chart</h3>
                </div>
                <p class="viz-subtitle">
                  {#if currentStep === 1}
                    Overview / starting point
                  {:else if currentStep === 2}
                    Transition from ranking to trend story
                  {:else if currentStep === 3}
                    Guided focus / popup stage
                  {:else}
                    Mississippi highlight stage
                  {/if}
                </p>
              </div>

              <div class="chart-shell">
                <BumpChart storyStep={currentStep} />

                {#if currentStep === 2}
                  <div class="overlay-banner">
                    <strong>Transition step</strong>
                    <span>We are shifting from a single ranking view to a time-based comparison.</span>
                  </div>
                {/if}

                {#if currentStep === 3}
                  <div class="overlay-popup">
                    <h4>Next, focus on one state</h4>
                    <p>
                      We are about to move from a broad ranking overview to a closer
                      reading of a representative case.
                    </p>
                  </div>
                {/if}

                {#if currentStep === 4}
                  <div class="overlay-focus">
                    <div class="focus-chip">Focus state: Mississippi</div>
                    <div class="focus-note">
                      This stage prepares the audience for the transition to the map and subgroup analysis.
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          {:else if currentStep >= 5 && currentStep <= 7}
            <div class="viz-state-box">
              <div class="viz-header">
                <div>
                  <p class="viz-tag">VIS2</p>
                  <h3>U.S. Stroke Mortality Map</h3>
                </div>
                <p class="viz-subtitle">
                  {#if currentStep === 5}
                    Map overview
                  {:else if currentStep === 6}
                    Explanatory popup stage
                  {:else}
                    Distribution shift stage
                  {/if}
                </p>
              </div>

              <div class="chart-shell">
                <USStrokeMortalityMap />

                {#if currentStep === 6}
                  <div class="overlay-popup">
                    <h4>From snapshot to change over time</h4>
                    <p>
                      The next step emphasizes how mortality distribution changes across the country,
                      rather than only showing one moment.
                    </p>
                  </div>
                {/if}

                {#if currentStep === 7}
                  <div class="overlay-banner">
                    <strong>Distribution change emphasis</strong>
                    <span>Use this stage to narrate the national shift from 1999 to 2019.</span>
                  </div>
                {/if}
              </div>
            </div>
          {:else if currentStep >= 8}
            <div class="viz-state-box">
              <div class="viz-header">
                <div>
                  <p class="viz-tag">VIS3</p>
                  <h3>Detail Line Plot</h3>
                </div>
                <p class="viz-subtitle">
                  {#if currentStep === 8}
                    Mississippi baseline
                  {:else if currentStep === 9}
                    Add first subgroup
                  {:else if currentStep === 10}
                    Add more subgroup lines
                  {:else}
                    Race and county detail
                  {/if}
                </p>
              </div>

              <div class="chart-shell">
                <DetailLinePlot />

                {#if currentStep === 9}
                  <div class="overlay-banner">
                    <strong>Step 1 of detail comparison</strong>
                    <span>Introduce one subgroup line first so the comparison remains readable.</span>
                  </div>
                {/if}

                {#if currentStep === 10}
                  <div class="overlay-banner">
                    <strong>More subgroup layers</strong>
                    <span>Now the story compares additional age/sex groups in sequence.</span>
                  </div>
                {/if}

                {#if currentStep === 11}
                  <div class="overlay-popup">
                    <h4>Race and county detail</h4>
                    <p>
                      This final stage bridges the author-driven story toward a future user-driven mode.
                    </p>
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .story-page {
    width: 100%;
    min-height: 100vh;
    background: #f3f4f6;
    color: #111827;
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
    max-width: 900px;
  }

  .intro-box h1 {
    font-size: 3rem;
    margin-bottom: 16px;
    font-weight: 700;
  }

  .intro-box p {
    font-size: 1.2rem;
    line-height: 1.6;
  }

  .hint {
    margin-top: 20px;
    color: #2563eb;
    font-weight: 600;
  }

  .story-body {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 24px;
    padding: 0 24px 48px;
    box-sizing: border-box;
  }

  .text-column {
    width: 38%;
    box-sizing: border-box;
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
    background: rgba(255, 255, 255, 0.82);
    border-radius: 16px;
    padding: 24px;
    box-sizing: border-box;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
  }

  .section-tag {
    margin: 0 0 10px 0;
    font-size: 0.82rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: #2563eb;
  }

  .step-card h2 {
    margin-bottom: 16px;
    font-size: 2rem;
    font-weight: 700;
  }

  .step-card p {
    font-size: 1.08rem;
    line-height: 1.8;
    color: #374151;
  }

  .viz-panel {
    position: fixed;
    top: 24px;
    right: 24px;
    width: calc(62% - 36px);
    height: calc(100vh - 48px);
    box-sizing: border-box;
    z-index: 10;
  }

  .viz-box {
    width: 100%;
    height: 100%;
    background: #ffffff;
    border: 2px solid #d1d5db;
    border-radius: 16px;
    padding: 16px;
    box-sizing: border-box;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    overflow: auto;
  }

  .viz-state-box {
    width: 100%;
  }

  .viz-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px;
    margin-bottom: 14px;
  }

  .viz-tag {
    margin: 0 0 6px 0;
    font-size: 0.8rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: #2563eb;
  }

  .viz-header h3 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
  }

  .viz-subtitle {
    margin: 0;
    color: #4b5563;
    font-size: 0.95rem;
    text-align: right;
  }

  .chart-shell {
    position: relative;
  }

  .overlay-banner {
    position: absolute;
    top: 12px;
    left: 12px;
    right: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 14px;
    border-radius: 12px;
    background: rgba(37, 99, 235, 0.92);
    color: white;
    box-shadow: 0 6px 20px rgba(37, 99, 235, 0.25);
    pointer-events: none;
    z-index: 20;
  }

  .overlay-banner strong {
    font-size: 0.95rem;
    font-weight: 700;
  }

  .overlay-banner span {
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .overlay-popup {
    position: absolute;
    top: 50%;
    left: 50%;
    width: min(420px, calc(100% - 40px));
    transform: translate(-50%, -50%);
    padding: 18px 20px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.97);
    border: 2px solid #cbd5e1;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.18);
    z-index: 25;
  }

  .overlay-popup h4 {
    margin: 0 0 10px 0;
    font-size: 1.1rem;
    font-weight: 700;
  }

  .overlay-popup p {
    margin: 0;
    color: #374151;
    line-height: 1.6;
    font-size: 0.95rem;
  }

  .overlay-focus {
    position: absolute;
    top: 14px;
    right: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-end;
    z-index: 20;
    pointer-events: none;
  }

  .focus-chip {
    padding: 8px 12px;
    border-radius: 999px;
    background: rgba(220, 38, 38, 0.92);
    color: white;
    font-size: 0.9rem;
    font-weight: 700;
    box-shadow: 0 6px 20px rgba(220, 38, 38, 0.22);
  }

  .focus-note {
    max-width: 320px;
    padding: 12px 14px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.96);
    border: 2px solid #fecaca;
    color: #7f1d1d;
    font-size: 0.92rem;
    line-height: 1.5;
    box-shadow: 0 10px 24px rgba(127, 29, 29, 0.12);
  }

  @media (max-width: 1100px) {
    .viz-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .viz-subtitle {
      text-align: left;
    }
  }

  @media (max-width: 900px) {
    .story-body {
      display: block;
      padding: 0 16px 32px;
    }

    .text-column {
      width: 100%;
    }

    .step {
      min-height: 72vh;
      padding: 16px 0;
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

    .intro-box h1 {
      font-size: 2.2rem;
    }
  }
</style>
