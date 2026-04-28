<script lang="ts">
  // @ts-nocheck
  import { onMount, onDestroy } from "svelte";
  import * as THREE from "three";
  import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
  import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
  import * as d3 from "d3";
  import { asset } from "$app/paths";
  import { selectedState, selectedYear } from "$lib/stores";

  export let width: number = 960;
  export let height: number = 500;
  export let initialYear: number = 2019;
  export let showYearSlider: boolean = true;
  export let storyMode: boolean = false;
  export let storyProgress: number = 0;
  export let active: boolean = true;
  
  let showBrush = false;

  $: showYearSlider;
  $: storyProgress;

  type MortalityRow = {
    state: string;
    year: number;
    mortality: number;
  };

  type SeriesPoint = {
    year: number;
    value: number | null;
  };

  type BrushInteraction = {
    anchorYear: number;
    latestYear: number;
  } | null;

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
  let canvasWrapEl: HTMLDivElement;
  let brushSvgEl: SVGSVGElement | null = null;

  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let renderer: THREE.WebGLRenderer;
  let controls: OrbitControls;
  let resizeObserver: ResizeObserver | null = null;
  let raycaster: THREE.Raycaster;
  const pointer = new THREE.Vector2();
  let frameId = 0;

  let mortRows: MortalityRow[] = [];
  let geoFeatures: GeoJSON.Feature[] = [];
  let availableYears: number[] = [];
  let activeYear: number = initialYear;
  let dataReady = false;
  let loadError: string | null = null;
  let yearStateMortality = new Map<number, Map<string, number>>();
  let yearAverageMortality = new Map<number, number>();
  let globalMinMortality = 0;
  let globalMaxMortality = 1;
  let brushRangeStart = initialYear;
  let brushRangeEnd = initialYear;
  let brushInteraction: BrushInteraction = null;
  let storyPlaybackOffset = 0;
  let lastAppliedStoryProgress: number | null = null;

  type StateRec = {
    code: string;
    name: string;
    mesh: THREE.Mesh;
    targetDepth: number;
    currentDepth: number;
  };

  const states3D: StateRec[] = [];
  const stateHitMeshes: THREE.Object3D[] = [];

  let mapGroup: THREE.Group;
  let projection: d3.GeoProjection;

  let hoverCode: string | null = null;
  let selectedCode: string | null = null;
  let tooltip:
    | {
        x: number;
        y: number;
        code: string;
        mortality: number | null;
      }
    | null = null;

  const MAP_W = 1100;
  const MAP_H = 600;
  const BRUSH_W = 1100;
  const BRUSH_H = 176;
  const BRUSH_MARGIN = { top: 18, right: 18, bottom: 42, left: 48 };
  const DEFAULT_FOCUS_STATE = "MS";

  const BASE_DEPTH = 4.8;
  const MAX_EXTRA_DEPTH = 88;
  const SELECT_LIFT = 12;

  const BEVEL_SIZE = 0.18;
  const BEVEL_THICKNESS = 0.14;
  const BEVEL_SEGMENTS = 2;
  const BEVEL_OFFSET = 0;

  const SCENE_BG = 0xe8e8ea;
  const FLOOR_BG = 0xf5f6f8;

  const formatM = d3.format(".1f");
  const formatBrushValue = d3.format(".1f");

  const unsubYear = selectedYear.subscribe((y) => {
    if (y == null) return;
    activeYear = y;
    if (dataReady) refreshStates();
  });

  const unsubState = selectedState.subscribe((s) => {
    selectedCode = s ?? null;
  });

  $: focusStateCode = selectedCode ?? DEFAULT_FOCUS_STATE;
  $: focusStateName = C2S[focusStateCode] ?? focusStateCode;
  $: brushMinYear = availableYears[0] ?? initialYear;
  $: brushMaxYear = availableYears[availableYears.length - 1] ?? initialYear;
  $: if (availableYears.length && brushRangeStart > brushRangeEnd) {
    brushRangeStart = brushMinYear;
    brushRangeEnd = brushMaxYear;
  }
  $: if (
    availableYears.length &&
    (brushRangeStart < brushMinYear ||
      brushRangeStart > brushMaxYear ||
      brushRangeEnd < brushMinYear ||
      brushRangeEnd > brushMaxYear)
  ) {
    brushRangeStart = clampYearToExtent(brushRangeStart);
    brushRangeEnd = clampYearToExtent(brushRangeEnd);
  }
  $: nationalAverageSeries = availableYears.map((year) => ({
    year,
    value: yearAverageMortality.get(year) ?? null,
  }));
  $: focusStateSeries = availableYears.map((year) => ({
    year,
    value: yearStateMortality.get(year)?.get(focusStateCode) ?? null,
  }));
  $: brushValues = [
    ...nationalAverageSeries.map((point) => point.value),
    ...focusStateSeries.map((point) => point.value),
  ].filter((value) => value != null && Number.isFinite(value)) as number[];
  $: brushValueMin = d3.min(brushValues) ?? 0;
  $: brushValueMax = d3.max(brushValues) ?? 1;
  $: brushValuePad = Math.max(2, (brushValueMax - brushValueMin) * 0.14);
  $: brushXScale = d3
    .scaleLinear()
    .domain([brushMinYear, brushMaxYear])
    .range([BRUSH_MARGIN.left, BRUSH_W - BRUSH_MARGIN.right]);
  $: brushYScale = d3
    .scaleLinear()
    .domain([brushValueMin - brushValuePad, brushValueMax + brushValuePad])
    .nice()
    .range([BRUSH_H - BRUSH_MARGIN.bottom, BRUSH_MARGIN.top]);
  $: brushLine = d3
    .line<SeriesPoint>()
    .defined((point) => point.value != null && Number.isFinite(point.value))
    .x((point) => brushXScale(point.year))
    .y((point) => brushYScale(point.value as number));
  $: nationalAveragePath = nationalAverageSeries.length
    ? (brushLine(nationalAverageSeries) ?? "")
    : "";
  $: focusStatePath = focusStateSeries.length
    ? (brushLine(focusStateSeries) ?? "")
    : "";
  $: yearStepPx =
    availableYears.length > 1
      ? brushXScale(availableYears[1]) - brushXScale(availableYears[0])
      : 24;
  $: brushSelectionLeft = clampValue(
    brushXScale(brushRangeStart) - yearStepPx * 0.5,
    BRUSH_MARGIN.left,
    BRUSH_W - BRUSH_MARGIN.right
  );
  $: brushSelectionRight = clampValue(
    brushXScale(brushRangeEnd) + yearStepPx * 0.5,
    BRUSH_MARGIN.left,
    BRUSH_W - BRUSH_MARGIN.right
  );
  $: brushCurrentYearX = brushXScale(activeYear);
  $: brushCurrentAverage = yearAverageMortality.get(activeYear) ?? null;
  $: brushCurrentStateValue =
    yearStateMortality.get(activeYear)?.get(focusStateCode) ?? null;
  $: brushXTicks = availableYears.filter(
    (year, index) =>
      index === 0 || index === availableYears.length - 1 || year % 5 === 0
  );
  $: brushYTicks = brushYScale.ticks(4);
  $: brushRangeLabel =
    brushRangeStart === brushRangeEnd
      ? `${brushRangeStart}`
      : `${brushRangeStart} - ${brushRangeEnd}`;
  $: brushRangeYears = availableYears.filter(
    (year) => year >= brushRangeStart && year <= brushRangeEnd
  );
  $: activeBrushYears = brushRangeYears.length ? brushRangeYears : availableYears;
  $: if (!storyMode) {
    storyPlaybackOffset = 0;
    lastAppliedStoryProgress = null;
  }
  $: if (dataReady && availableYears.length && storyMode) {
    const clampedProgress = clampValue(storyProgress, 0, 1);
    if (
      lastAppliedStoryProgress === null ||
      Math.abs(clampedProgress - lastAppliedStoryProgress) > 0.0005
    ) {
      lastAppliedStoryProgress = clampedProgress;
      const storyYear = getStoryYearFromProgress(clampedProgress);
      if (storyYear !== null && storyYear !== activeYear) {
        selectedYear.set(storyYear);
      }
    }
  }
  $: if (
    dataReady &&
    availableYears.length &&
    !storyMode &&
    (activeYear < brushRangeStart || activeYear > brushRangeEnd)
  ) {
    setYearFromInteraction(brushRangeEnd);
  }

  onMount(async () => {
    try {
      const [rows, geo] = await Promise.all([
        d3.csv(asset("/data/stroke_geo_clean_state.csv"), (d) => ({
          state: d.State as string,
          year: +d.Year,
          mortality: +d.mortality,
        })),
        d3.json(asset("/data/us-states.geojson")),
      ]);

      mortRows = rows.filter((r: any) => Number.isFinite(r.mortality));

      geoFeatures = (geo as GeoJSON.FeatureCollection).features.filter(
        (f) => (f.properties?.name ?? f.properties?.NAME) !== "Puerto Rico"
      );

      availableYears = Array.from(new Set(mortRows.map((r) => r.year))).sort();
      brushRangeStart = availableYears[0] ?? initialYear;
      brushRangeEnd = availableYears[availableYears.length - 1] ?? initialYear;
      globalMinMortality = d3.min(mortRows, (row) => row.mortality) ?? 0;
      globalMaxMortality = d3.max(mortRows, (row) => row.mortality) ?? 1;

      const rowsByYear = d3.group(mortRows, (row) => row.year);
      yearStateMortality = new Map(
        Array.from(rowsByYear, ([year, rowsForYear]) => [
          year,
          new Map(rowsForYear.map((row) => [row.state, row.mortality])),
        ])
      );
      yearAverageMortality = new Map(
        Array.from(rowsByYear, ([year, rowsForYear]) => [
          year,
          d3.mean(rowsForYear, (row) => row.mortality) ?? 0,
        ])
      );

      if (!availableYears.includes(activeYear)) {
        activeYear = availableYears[availableYears.length - 1];
      }

      dataReady = true;

      buildScene();
      buildMap();
      refreshStates();
      animate();

      window.addEventListener("resize", onResize);
      resizeObserver = new ResizeObserver(() => {
        onResize();
      });
      resizeObserver.observe(containerEl);
      onResize();
    } catch (e) {
      console.error(e);
      loadError = "Failed to load 3D map data.";
    }
  });

  onDestroy(() => {
    cancelAnimationFrame(frameId);
    unsubYear();
    unsubState();
    window.removeEventListener("resize", onResize);
    resizeObserver?.disconnect();
    resizeObserver = null;

    if (renderer?.domElement) {
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("click", onPointerClick);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
    }

    if (renderer) {
      renderer.dispose();
      renderer.domElement?.remove();
    }

    const disposeMat = (m: THREE.Material | THREE.Material[]) => {
      if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
      else m.dispose();
    };

    states3D.forEach((s) => {
      s.mesh.geometry.dispose();
      disposeMat(s.mesh.material);
    });
  });

  function clampValue(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  function nearestAvailableYear(target: number) {
    if (!availableYears.length) return target;

    return availableYears.reduce((closest, year) =>
      Math.abs(year - target) < Math.abs(closest - target) ? year : closest
    );
  }

  function clampYearToExtent(year: number) {
    if (!availableYears.length) return year;
    return nearestAvailableYear(clampValue(year, brushMinYear, brushMaxYear));
  }

  function getStoryYearFromProgress(progress: number) {
    if (!activeBrushYears.length) return null;
    const clampedProgress = clampValue(progress + storyPlaybackOffset, 0, 1);
    const index = Math.round(clampedProgress * (activeBrushYears.length - 1));
    return activeBrushYears[index] ?? activeBrushYears[activeBrushYears.length - 1];
  }

  function setYearFromInteraction(year: number) {
    const nextYear = clampYearToExtent(year);
    if (nextYear !== activeYear) {
      selectedYear.set(nextYear);
    }
  }

  function setBrushRange(startYear: number, endYear: number) {
    const safeStart = clampYearToExtent(startYear);
    const safeEnd = clampYearToExtent(endYear);

    brushRangeStart = Math.min(safeStart, safeEnd);
    brushRangeEnd = Math.max(safeStart, safeEnd);
  }

  function getYearsInRange(startYear: number, endYear: number) {
    const rangeStart = Math.min(startYear, endYear);
    const rangeEnd = Math.max(startYear, endYear);
    return availableYears.filter((year) => year >= rangeStart && year <= rangeEnd);
  }

  function syncStoryPlaybackOffsetToYear(
    targetYear: number,
    startYear: number = brushRangeStart,
    endYear: number = brushRangeEnd
  ) {
    if (!storyMode) return;

    const yearsInRange = getYearsInRange(startYear, endYear);
    if (!yearsInRange.length) return;

    const clampedTargetYear = clampYearToExtent(targetYear);
    const targetIndex = yearsInRange.indexOf(clampedTargetYear);
    if (targetIndex < 0) return;

    const targetProgress =
      yearsInRange.length > 1 ? targetIndex / (yearsInRange.length - 1) : 0;
    storyPlaybackOffset = clampValue(
      targetProgress - clampValue(storyProgress, 0, 1),
      -1,
      1
    );
  }

  function getBrushYearFromClientX(clientX: number) {
    if (!brushSvgEl) return activeYear;

    const rect = brushSvgEl.getBoundingClientRect();
    const normalizedX = ((clientX - rect.left) / rect.width) * BRUSH_W;
    const boundedX = clampValue(
      normalizedX,
      BRUSH_MARGIN.left,
      BRUSH_W - BRUSH_MARGIN.right
    );

    return clampYearToExtent(Math.round(brushXScale.invert(boundedX)));
  }

  function beginBrushInteraction(event: PointerEvent) {
    if (!availableYears.length) return;

    event.preventDefault();
    event.stopPropagation();

    const anchorYear = getBrushYearFromClientX(event.clientX);
    brushInteraction = {
      anchorYear,
      latestYear: anchorYear,
    };
    setBrushRange(anchorYear, anchorYear);
    setYearFromInteraction(anchorYear);
    syncStoryPlaybackOffsetToYear(anchorYear, anchorYear, anchorYear);

    window.addEventListener("pointermove", handleBrushPointerMove);
    window.addEventListener("pointerup", endBrushInteraction);
  }

  function handleBrushPointerMove(event: PointerEvent) {
    if (!brushInteraction) return;

    const currentYear = getBrushYearFromClientX(event.clientX);
    brushInteraction.latestYear = currentYear;
    const nextStart = Math.min(brushInteraction.anchorYear, currentYear);
    const nextEnd = Math.max(brushInteraction.anchorYear, currentYear);

    setBrushRange(nextStart, nextEnd);
    setYearFromInteraction(currentYear);
    syncStoryPlaybackOffsetToYear(currentYear, nextStart, nextEnd);
  }

  function endBrushInteraction() {
    if (!brushInteraction) return;

    setYearFromInteraction(brushInteraction.latestYear);
    syncStoryPlaybackOffsetToYear(brushInteraction.latestYear);

    brushInteraction = null;
    window.removeEventListener("pointermove", handleBrushPointerMove);
    window.removeEventListener("pointerup", endBrushInteraction);
  }

  function buildScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(SCENE_BG);

    camera = new THREE.PerspectiveCamera(40, width / height, 5, 3000);
    camera.position.set(0, 870, 720);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.domElement.style.cursor = "grab";

    canvasWrapEl.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enableZoom = !storyMode;
    controls.enablePan = !storyMode;
    controls.enableRotate = true;
    controls.minDistance = 360;
    controls.maxDistance = 1600;
    controls.minPolarAngle = Math.PI * 0.18;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.target.set(0, 0, 200);
    controls.update();

    scene.add(new THREE.HemisphereLight(0xffffff, 0xd7dbe2, 0.95));

    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(180, 720, 240);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -900;
    key.shadow.camera.right = 900;
    key.shadow.camera.top = 900;
    key.shadow.camera.bottom = -900;
    key.shadow.camera.near = 50;
    key.shadow.camera.far = 1800;
    key.shadow.bias = -0.00045;
    key.shadow.radius = 4;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xf8f8fc, 0.24);
    fill.position.set(-260, 300, -220);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.10);
    rim.position.set(-60, 380, 460);
    scene.add(rim);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(3400, 3400),
      new THREE.MeshStandardMaterial({
        color: FLOOR_BG,
        roughness: 1,
        metalness: 0,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.85;
    floor.receiveShadow = true;
    scene.add(floor);

    raycaster = new THREE.Raycaster();

    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("click", onPointerClick);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);
  }

  function onPointerLeave() {
    hoverCode = null;
    tooltip = null;
    if (renderer?.domElement) renderer.domElement.style.cursor = "grab";
  }

  function buildMap() {
    projection = d3
      .geoAlbersUsa()
      .fitSize([MAP_W, MAP_H], {
        type: "FeatureCollection",
        features: geoFeatures,
      });

    mapGroup = new THREE.Group();
    mapGroup.rotation.x = -Math.PI / 2;
    scene.add(mapGroup);

    states3D.length = 0;
    stateHitMeshes.length = 0;

    for (const f of geoFeatures) {
      const name = (f.properties?.name ?? f.properties?.NAME) as string;
      const code = S2C[name];
      if (!code) continue;

      const shapes = featureToShapes(f);
      if (shapes.length === 0) continue;

      let geom = new THREE.ExtrudeGeometry(shapes, {
        depth: 1,
        steps: 1,
        bevelEnabled: true,
        bevelSize: BEVEL_SIZE,
        bevelThickness: BEVEL_THICKNESS,
        bevelSegments: BEVEL_SEGMENTS,
        bevelOffset: BEVEL_OFFSET,
        curveSegments: 1,
      });

      // 关键修复：合并重复顶点并重算法线，能明显减少侧面一条条的竖向面感
      geom.deleteAttribute("normal");
      geom = mergeVertices(geom, 1e-4);
      geom.computeVertexNormals();
      geom.normalizeNormals();

      const topMat = new THREE.MeshStandardMaterial({
        color: 0xf7f2ee,
        roughness: 0.92,
        metalness: 0,
        emissive: 0x000000,
        emissiveIntensity: 0,
      });

      const sideMat = new THREE.MeshStandardMaterial({
        color: 0xdccbc1,
        roughness: 1,
        metalness: 0,
        flatShading: false,
      });

      const mesh = new THREE.Mesh(geom, [topMat, sideMat]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.scale.z = BASE_DEPTH;
      mesh.userData.code = code;

      mapGroup.add(mesh);
      stateHitMeshes.push(mesh);

      states3D.push({
        code,
        name,
        mesh,
        targetDepth: BASE_DEPTH,
        currentDepth: BASE_DEPTH,
      });
    }
  }

  function polygonAreaAbs(pts: [number, number][]) {
    if (pts.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      area += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
    }
    return Math.abs(area) / 2;
  }

  function closeRing(pts: [number, number][]) {
    if (pts.length < 3) return pts;
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      return [...pts, first];
    }
    return pts;
  }

  function simplifyRingPoints(
    pts: [number, number][],
    minDist = 1.5,
    collinearEps = 0.02
  ): [number, number][] {
    if (pts.length <= 3) return pts;

    const filtered: [number, number][] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = filtered[filtered.length - 1];
      const [x2, y2] = pts[i];
      if (Math.hypot(x2 - x1, y2 - y1) >= minDist) {
        filtered.push(pts[i]);
      }
    }

    if (filtered.length <= 3) return filtered;

    const simplified: [number, number][] = [filtered[0]];
    for (let i = 1; i < filtered.length - 1; i++) {
      const a = simplified[simplified.length - 1];
      const b = filtered[i];
      const c = filtered[i + 1];

      const abx = b[0] - a[0];
      const aby = b[1] - a[1];
      const bcx = c[0] - b[0];
      const bcy = c[1] - b[1];

      const cross = Math.abs(abx * bcy - aby * bcx);
      const abLen = Math.hypot(abx, aby);
      const bcLen = Math.hypot(bcx, bcy);

      if (abLen < 1e-6 || bcLen < 1e-6 || cross / (abLen * bcLen) > collinearEps) {
        simplified.push(b);
      }
    }

    simplified.push(filtered[filtered.length - 1]);
    return simplified;
  }

  function getSimplifyParams(area: number) {
    if (area < 18) return { minDist: 0.28, collinearEps: 0.05 };
    if (area < 45) return { minDist: 0.45, collinearEps: 0.045 };
    if (area < 120) return { minDist: 0.75, collinearEps: 0.035 };
    if (area < 300) return { minDist: 1.15, collinearEps: 0.028 };
    if (area < 900) return { minDist: 1.7, collinearEps: 0.022 };
    return { minDist: 2.3, collinearEps: 0.018 };
  }

  function featureToShapes(f: GeoJSON.Feature): THREE.Shape[] {
    const out: THREE.Shape[] = [];
    const g = f.geometry as any;
    if (!g) return out;

    const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;

    for (const poly of polys) {
      let outerProjected = poly[0]
        .map((c: number[]) => projection(c as [number, number]))
        .filter(Boolean) as [number, number][];

      if (outerProjected.length < 3) continue;

      const rawArea = polygonAreaAbs(closeRing(outerProjected));
      const { minDist, collinearEps } = getSimplifyParams(rawArea);

      let outer = closeRing(
        simplifyRingPoints(outerProjected, minDist, collinearEps)
      );

      if (outer.length < 4 || polygonAreaAbs(outer) < 5) continue;

      const shape = new THREE.Shape();
      outer.forEach(([x, y], i) => {
        const px = x - MAP_W / 2;
        const py = -(y - MAP_H / 2);
        if (i === 0) shape.moveTo(px, py);
        else shape.lineTo(px, py);
      });

      for (let h = 1; h < poly.length; h++) {
        let ringProjected = poly[h]
          .map((c: number[]) => projection(c as [number, number]))
          .filter(Boolean) as [number, number][];

        if (ringProjected.length < 3) continue;

        const ringArea = polygonAreaAbs(closeRing(ringProjected));
        const ringParams = getSimplifyParams(ringArea);

        let ring = closeRing(
          simplifyRingPoints(
            ringProjected,
            ringParams.minDist * 0.8,
            ringParams.collinearEps
          )
        );

        if (ring.length < 4 || polygonAreaAbs(ring) < 4) continue;

        const hole = new THREE.Path();
        ring.forEach(([x, y], i) => {
          const px = x - MAP_W / 2;
          const py = -(y - MAP_H / 2);
          if (i === 0) hole.moveTo(px, py);
          else hole.lineTo(px, py);
        });
        shape.holes.push(hole);
      }

      out.push(shape);
    }

    return out;
  }

  function refreshStates() {
    if (!states3D.length) return;

    const mortMap = yearStateMortality.get(activeYear) ?? new Map<string, number>();
    const denom = Math.max(1e-6, globalMaxMortality - globalMinMortality);
    const topColorScale = d3.interpolateRgbBasis([
      "#fbf3ed",
      "#f4c3a7",
      "#ea8b57",
      "#cf5530",
      "#7f1d1d",
    ]);
    const sideColorScale = d3.interpolateRgbBasis([
      "#ead8cd",
      "#d79a77",
      "#a95d40",
      "#65201a",
    ]);

    const heightScale = d3
      .scalePow()
      .exponent(1.12)
      .domain([globalMinMortality, globalMaxMortality])
      .range([BASE_DEPTH, BASE_DEPTH + MAX_EXTRA_DEPTH]);

    for (const s of states3D) {
      const m = mortMap.get(s.code);
      const mats = s.mesh.material as THREE.MeshStandardMaterial[];
      const topMat = mats[0];
      const sideMat = mats[1];

      if (m == null) {
        s.targetDepth = BASE_DEPTH;
        topMat.color.set(0xf0ece9);
        sideMat.color.set(0xddcfc7);
        continue;
      }

      const t = (m - globalMinMortality) / denom;
      const contrastT = Math.pow(t, 0.85);

      s.targetDepth = heightScale(m);

      topMat.color.set(d3.color(topColorScale(contrastT))!.formatHex());
      sideMat.color.set(d3.color(sideColorScale(contrastT))!.formatHex());
    }
  }

  function onPointerMove(e: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();

    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(stateHitMeshes, false);

    if (hits.length) {
      const code = hits[0].object.userData.code as string;
      hoverCode = code;
      const mortality = yearStateMortality.get(activeYear)?.get(code) ?? null;

      tooltip = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        code,
        mortality,
      };

      renderer.domElement.style.cursor = "pointer";
    } else {
      hoverCode = null;
      tooltip = null;
      renderer.domElement.style.cursor = "grab";
    }
  }

  function onPointerClick() {
    if (!hoverCode) return;
    const code = hoverCode;
    selectedState.update((c) => (c === code ? null : code));
  }

  function animate() {
    frameId = requestAnimationFrame(animate);

    if (!active) return;

    const depthEase = storyMode ? 0.22 : 0.12;
    const liftEase = storyMode ? 0.24 : 0.18;

    for (const s of states3D) {
      const diff = s.targetDepth - s.currentDepth;

      if (Math.abs(diff) > 0.005) {
        s.currentDepth += diff * depthEase;
      } else {
        s.currentDepth = s.targetDepth;
      }

      s.mesh.scale.z = Math.max(0.001, s.currentDepth);

      const hovered = hoverCode === s.code;
      const selected = selectedCode === s.code;
      const targetLift = selected ? SELECT_LIFT : hovered ? SELECT_LIFT * 0.55 : 0;
      s.mesh.position.z += (targetLift - s.mesh.position.z) * liftEase;

      const mats = s.mesh.material as THREE.MeshStandardMaterial[];
      const topMat = mats[0];

      topMat.emissive.set(
        selected ? 0xa83214 : hovered ? 0x4a1810 : 0x000000
      );
      topMat.emissiveIntensity = selected ? 0.45 : hovered ? 0.14 : 0;
    }

    controls.update();
    renderer.render(scene, camera);
  }

  function onResize() {
    if (!containerEl || !renderer || !camera) return;

    const rect = containerEl.getBoundingClientRect();
    const availableWidth = Math.floor(rect.width);
    if (availableWidth <= 0) return;
    
    const w = Math.round(rect.width);
    const h = Math.round(rect.height) || Math.max(320, Math.round((w / width) * height));

    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function resetView() {
    if (!camera || !controls) return;

    camera.position.set(0, 870, 720);
    controls.target.set(0, 0, 0);
    controls.update();

    if (availableYears.length) {
      brushRangeStart = availableYears[0];
      brushRangeEnd = availableYears[availableYears.length - 1];
      storyPlaybackOffset = 0;
      lastAppliedStoryProgress = null;
      if (!storyMode) {
        setYearFromInteraction(brushRangeEnd);
      }
    }

    selectedState.set(null);
    refreshStates();
  }

  $: if (controls) {
    controls.enableZoom = !storyMode;
    controls.enablePan = !storyMode;
    controls.enableRotate = true;
  }

  $: if (active && renderer && scene && camera) {
    onResize();
    renderer.render(scene, camera);
  }
</script>

<div class="map3d-shell" bind:this={containerEl}>
  <div class="map3d-header">
    <div>
      <h3>U.S. Stroke Mortality, 3D Relief Map</h3>
      <p class="caption">
        Each state is rendered as a smooth 3D relief block. Higher states indicate
        higher stroke mortality, while the color tint provides a second cue.
        {#if storyMode}
          Click a state to highlight it. Drag to rotate. Click or drag on the strip below to anchor a year window while scroll continues within it.
        {:else}
          Click a state to select it. Drag to rotate, zoom, and click or drag on the strip below to set a year window.
        {/if}
      </p>
    </div>

    <button class="reset-btn" onclick={resetView} type="button">Reset</button>
  </div>

  <div
    class="canvas-wrap"
    bind:this={canvasWrapEl}
    style:width="{width}px"
    style="flex: 1; min-height: 0;"
  >
    {#if !dataReady && !loadError}
      <div class="overlay">Loading 3D scene…</div>
    {/if}

    {#if loadError}
      <div class="overlay error">{loadError}</div>
    {/if}

    {#if tooltip}
      <div
        class="tooltip"
        style:left="{tooltip.x + 14}px"
        style:top="{tooltip.y - 18}px"
      >
        <strong>{C2S[tooltip.code] ?? tooltip.code} ({tooltip.code})</strong>
        {#if tooltip.mortality != null}
          <div>Mortality: {formatM(tooltip.mortality)}</div>
        {/if}
        <div class="tt-hint">click to compare this state across time</div>
      </div>
    {/if}
  </div>

  {#if storyMode}
  <button class="brush-toggle-btn" onclick={() => showBrush = !showBrush}>
    {showBrush ? '▲ Hide timeline' : '▼ Show timeline'}
  </button>
  {/if}

  {#if availableYears.length > 0 && (!storyMode || showBrush)}
    <div class="timeline-card">
      <div class="timeline-header">
        <div class="timeline-series-legend">
          <span class="series-pill avg">
            <span class="series-swatch"></span>
            U.S. average
          </span>
          <span class="series-pill state">
            <span class="series-swatch"></span>
            {focusStateName} ({focusStateCode})
          </span>
        </div>

        <div class="timeline-meta">
          <span class="timeline-year-pill">Year {activeYear}</span>
          <span class="timeline-range-pill">{brushRangeLabel}</span>
        </div>
      </div>

      <svg
        class="timeline-svg"
        bind:this={brushSvgEl}
        viewBox={`0 0 ${BRUSH_W} ${BRUSH_H}`}
        preserveAspectRatio="none"
      >
        {#each brushYTicks as tick}
          <line
            class="timeline-grid"
            x1={BRUSH_MARGIN.left}
            x2={BRUSH_W - BRUSH_MARGIN.right}
            y1={brushYScale(tick)}
            y2={brushYScale(tick)}
          />
          <text
            class="timeline-y-tick"
            x={BRUSH_MARGIN.left - 10}
            y={brushYScale(tick)}
            dy="0.32em"
            text-anchor="end"
          >
            {formatBrushValue(tick)}
          </text>
        {/each}

        <rect
          class="brush-selection-fill"
          x={brushSelectionLeft}
          y={BRUSH_MARGIN.top}
          width={Math.max(yearStepPx, brushSelectionRight - brushSelectionLeft)}
          height={BRUSH_H - BRUSH_MARGIN.top - BRUSH_MARGIN.bottom}
        />

        <path class="timeline-line avg" d={nationalAveragePath}></path>
        <path class="timeline-line state" d={focusStatePath}></path>

        {#each nationalAverageSeries as point (point.year)}
          {#if point.value != null}
            <circle
              class="timeline-point avg"
              cx={brushXScale(point.year)}
              cy={brushYScale(point.value)}
              r={point.year === activeYear ? 4.6 : 3.1}
            ></circle>
          {/if}
        {/each}

        {#each focusStateSeries as point (point.year)}
          {#if point.value != null}
            <circle
              class="timeline-point state"
              cx={brushXScale(point.year)}
              cy={brushYScale(point.value)}
              r={point.year === activeYear ? 4.8 : 3.2}
            ></circle>
          {/if}
        {/each}

        <line
          class="timeline-playhead"
          x1={brushCurrentYearX}
          x2={brushCurrentYearX}
          y1={BRUSH_MARGIN.top}
          y2={BRUSH_H - BRUSH_MARGIN.bottom}
        />

        {#if brushCurrentAverage != null}
          <circle
            class="timeline-current-dot avg"
            cx={brushCurrentYearX}
            cy={brushYScale(brushCurrentAverage)}
            r="5.4"
          ></circle>
        {/if}

        {#if brushCurrentStateValue != null}
          <circle
            class="timeline-current-dot state"
            cx={brushCurrentYearX}
            cy={brushYScale(brushCurrentStateValue)}
            r="5.8"
          ></circle>
        {/if}

        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <rect
          class="brush-overlay"
          x={BRUSH_MARGIN.left}
          y={BRUSH_MARGIN.top}
          width={BRUSH_W - BRUSH_MARGIN.left - BRUSH_MARGIN.right}
          height={BRUSH_H - BRUSH_MARGIN.top - BRUSH_MARGIN.bottom}
          aria-hidden="true"
          role="presentation"
          onpointerdown={beginBrushInteraction}
        />

        {#each brushXTicks as tick}
          <line
            class="timeline-axis-tick"
            x1={brushXScale(tick)}
            x2={brushXScale(tick)}
            y1={BRUSH_H - BRUSH_MARGIN.bottom}
            y2={BRUSH_H - BRUSH_MARGIN.bottom + 8}
          />
          <text
            class="timeline-x-tick"
            x={brushXScale(tick)}
            y={BRUSH_H - BRUSH_MARGIN.bottom + 24}
            text-anchor="middle"
          >
            {tick}
          </text>
        {/each}
      </svg>

      <div class="timeline-footer">
        <p class="timeline-label">{brushRangeLabel}</p>
        <p class="timeline-instruction">
          {#if storyMode}
            Click to set a start year, then drag in either direction. The blue playhead follows your drag, and scroll continues inside that window.
          {:else}
            Click to isolate a single year, or drag in either direction to define a year window and scrub through it.
          {/if}
        </p>
      </div>
    </div>
  {/if}

  <div class="legend-row">
    <span class="legend-title">Mortality</span>
    <span class="grad"></span>
    <span class="legend-min">low</span>
    <span class="legend-max">high</span>
    <span class="dot-sep">•</span>
    <span class="legend-note">state height represents mortality level</span>
  </div>
</div>

<style>
  .map3d-shell {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 100%;
    flex: 1;
    min-height: 0;
  }

  .map3d-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 14px;
  }

  .map3d-header h3 {
    margin: 0 0 6px;
    font-size: 1.12rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--story-text, #241419);
  }

  .caption {
    margin: 0;
    color: var(--story-muted, #6f5960);
    font-size: 0.89rem;
    line-height: 1.5;
    max-width: 78ch;
  }

  .reset-btn {
    flex: 0 0 auto;
    padding: 7px 14px;
    font-size: 0.82rem;
    font-weight: 700;
    background: rgba(255, 253, 251, 0.92);
    border: 1px solid var(--story-border, #e8d2cb);
    border-radius: 999px;
    color: var(--story-accent-strong, #8e0f27);
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
    transition:
      transform 120ms ease,
      background 120ms ease,
      box-shadow 120ms ease;
  }

  .reset-btn:hover {
    background: #ffffff;
    transform: translateY(-1px);
    box-shadow: 0 10px 20px rgba(15, 23, 42, 0.06);
  }

  .canvas-wrap {
    position: relative;
    border-radius: 20px;
    overflow: hidden;
    align-self: center;
    max-width: 100%;
    background: #fff9f7;
    border: 1px solid var(--story-border, #e8d2cb);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.82),
      0 12px 30px rgba(15, 23, 42, 0.055);
    flex: 1;
    min-height: 0;
  }

  .canvas-wrap :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
  }

  .canvas-wrap::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(
        circle at 50% 45%,
        rgba(255, 255, 255, 0) 55%,
        rgba(15, 23, 42, 0.045) 100%
      ),
      linear-gradient(
        to bottom,
        rgba(255, 255, 255, 0.16),
        rgba(255, 255, 255, 0)
      );
  }

  .overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    font-size: 0.95rem;
    background: rgba(248, 250, 252, 0.88);
    backdrop-filter: blur(3px);
  }

  .overlay.error {
    color: #b91c1c;
  }

  .tooltip {
    position: absolute;
    pointer-events: none;
    z-index: 10;
    min-width: 164px;
    padding: 0.68rem 0.8rem;
    border-radius: 14px;
    background: rgba(255, 253, 251, 0.94);
    color: var(--story-text, #241419);
    border: 1px solid var(--story-border, #e8d2cb);
    box-shadow: 0 14px 30px rgba(53, 18, 22, 0.14);
    font-size: 0.87rem;
    line-height: 1.42;
    transform: translateY(-100%);
    backdrop-filter: blur(8px);
  }

  .tooltip strong {
    color: #0f172a;
  }

  .tt-hint {
    margin-top: 5px;
    color: var(--story-accent-strong, #8e0f27);
    font-size: 0.76rem;
    font-weight: 650;
  }

  .timeline-card {
    margin-top: 16px;
    padding: 14px 14px 10px;
    border-radius: 18px;
    background: rgba(255, 253, 251, 0.86);
    border: 1px solid var(--story-border, #e8d2cb);
    box-shadow: 0 10px 24px rgba(53, 18, 22, 0.08);
  }

  .timeline-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 10px;
  }

  .timeline-series-legend {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }

  .series-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--story-text, #241419);
    background: rgba(255, 253, 251, 0.95);
    border: 1px solid var(--story-border, #e8d2cb);
  }

  .series-swatch {
    width: 18px;
    height: 3px;
    border-radius: 999px;
    background: currentColor;
  }

  .series-pill.avg {
    color: #334155;
  }

  .series-pill.state {
    color: var(--story-accent-strong, #8e0f27);
  }

  .timeline-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .timeline-year-pill,
  .timeline-range-pill {
    display: inline-flex;
    align-items: center;
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(255, 253, 251, 0.95);
    border: 1px solid var(--story-border, #e8d2cb);
    color: var(--story-text, #241419);
    font-size: 0.78rem;
    font-weight: 750;
  }

  .timeline-year-pill {
    color: var(--story-accent-strong, #8e0f27);
  }

  .timeline-svg {
    width: 100%;
    height: 176px;
    display: block;
    overflow: visible;
  }

  .timeline-grid {
    stroke: rgba(148, 163, 184, 0.22);
    stroke-width: 1;
  }

  .timeline-y-tick,
  .timeline-x-tick {
    fill: var(--story-muted, #6f5960);
    font-size: 11px;
    font-weight: 550;
  }

  .timeline-axis-tick {
    stroke: rgba(100, 116, 139, 0.56);
    stroke-width: 1.25;
  }

  .timeline-line {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .timeline-line.avg {
    stroke: rgba(51, 65, 85, 0.82);
    stroke-width: 2.2;
  }

  .timeline-line.state {
    stroke: var(--story-accent-strong, #8e0f27);
    stroke-width: 2.8;
  }

  .timeline-point.avg {
    fill: rgba(71, 85, 105, 0.68);
  }

  .timeline-point.state {
    fill: rgba(142, 15, 39, 0.72);
  }

  .timeline-current-dot {
    stroke: white;
    stroke-width: 2.2;
  }

  .timeline-current-dot.avg {
    fill: #334155;
  }

  .timeline-current-dot.state {
    fill: var(--story-accent-strong, #8e0f27);
  }

  .timeline-playhead {
    stroke: rgba(142, 15, 39, 0.82);
    stroke-width: 2;
    stroke-dasharray: 4 4;
  }

  .brush-selection-fill {
    fill: rgba(148, 163, 184, 0.18);
    stroke: rgba(100, 116, 139, 0.14);
    stroke-width: 1;
    rx: 10;
  }

  .brush-overlay {
    fill: transparent;
    cursor: crosshair;
  }

  .timeline-footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    margin-top: 2px;
    text-align: center;
  }

  .timeline-label {
    margin: 0;
    font-size: 1.15rem;
    line-height: 1.1;
    font-weight: 850;
    color: var(--story-text, #241419);
  }

  .timeline-instruction {
    margin: 0;
    color: var(--story-muted, #6f5960);
    font-size: 0.84rem;
    line-height: 1.45;
  }

  .legend-row {
    margin-top: 12px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 0.78rem;
    color: #475569;
  }

  .legend-title {
    font-weight: 750;
    color: var(--story-text, #241419);
  }

  .grad {
    display: inline-block;
    width: 150px;
    height: 11px;
    border-radius: 999px;
    background: linear-gradient(
      to right,
      #fbf5f1,
      #f3d2bf,
      #e9a985,
      #d97a50,
      #b8502d
    );
    border: 1px solid rgba(148, 163, 184, 0.38);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
  }

  .legend-min,
  .legend-max {
    color: var(--story-muted, #6f5960);
  }

  .dot-sep {
    color: #94a3b8;
    margin: 0 2px;
  }

  .legend-note {
    color: var(--story-muted, #6f5960);
  }

  .brush-toggle-btn {
  align-self: flex-end;
  margin: 4px 8px 0;
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid var(--story-border, #e8d2cb);
  background: #fffdfb;
  color: var(--story-accent-strong, #8e0f27);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

  

  @media (max-width: 720px) {
    .map3d-header {
      flex-direction: column;
      gap: 10px;
    }

    .reset-btn {
      align-self: flex-start;
    }

    .timeline-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .timeline-meta {
      justify-content: flex-start;
    }
  }
</style>
