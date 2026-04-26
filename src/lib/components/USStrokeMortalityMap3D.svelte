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
  export let height: number = 600;
  export let initialYear: number = 2019;
  export let showYearSlider: boolean = true;

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

  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let renderer: THREE.WebGLRenderer;
  let controls: OrbitControls;
  let raycaster: THREE.Raycaster;
  const pointer = new THREE.Vector2();
  let frameId = 0;

  let mortRows: Array<{ state: string; year: number; mortality: number }> = [];
  let geoFeatures: GeoJSON.Feature[] = [];
  let availableYears: number[] = [];
  let activeYear: number = initialYear;
  let dataReady = false;
  let loadError: string | null = null;

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

  const BASE_DEPTH = 3.2;
  const MAX_EXTRA_DEPTH = 40;
  const SELECT_LIFT = 8;

  const BEVEL_SIZE = 0.18;
  const BEVEL_THICKNESS = 0.14;
  const BEVEL_SEGMENTS = 2;
  const BEVEL_OFFSET = 0;

  const SCENE_BG = 0xe8e8ea;
  const FLOOR_BG = 0xf5f6f8;

  const formatM = d3.format(".1f");

  const unsubYear = selectedYear.subscribe((y) => {
    if (y == null) return;
    activeYear = y;
    if (dataReady) refreshStates();
  });

  const unsubState = selectedState.subscribe((s) => {
    selectedCode = s ?? null;
  });

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

      if (!availableYears.includes(activeYear)) {
        activeYear = availableYears[availableYears.length - 1];
      }

      dataReady = true;

      buildScene();
      buildMap();
      refreshStates();
      animate();

      window.addEventListener("resize", onResize);
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
    controls.minDistance = 360;
    controls.maxDistance = 1600;
    controls.minPolarAngle = Math.PI * 0.18;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.target.set(0, 0, 0);
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

    const rowsForYear = mortRows.filter((r) => r.year === activeYear);
    const mortMap = new Map(rowsForYear.map((r) => [r.state, r.mortality]));

    const allVals = mortRows.map((r) => r.mortality);
    const gMin = d3.min(allVals) ?? 0;
    const gMax = d3.max(allVals) ?? 1;
    const denom = Math.max(1e-6, gMax - gMin);

    const heightScale = d3
      .scaleLinear()
      .domain([gMin, gMax])
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

      const t = (m - gMin) / denom;

      s.targetDepth = heightScale(m);

      topMat.color.set(
        d3.color(d3.interpolateReds(0.08 + 0.48 * t))!.formatHex()
      );

      sideMat.color.set(
        d3.color(d3.interpolateReds(0.04 + 0.24 * t))!.formatHex()
      );
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

      const row = mortRows.find((r) => r.state === code && r.year === activeYear);

      tooltip = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        code,
        mortality: row?.mortality ?? null,
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

    for (const s of states3D) {
      const diff = s.targetDepth - s.currentDepth;

      if (Math.abs(diff) > 0.005) {
        s.currentDepth += diff * 0.12;
      } else {
        s.currentDepth = s.targetDepth;
      }

      s.mesh.scale.z = Math.max(0.001, s.currentDepth);

      const hovered = hoverCode === s.code;
      const selected = selectedCode === s.code;
      const targetLift = selected ? SELECT_LIFT : hovered ? SELECT_LIFT * 0.55 : 0;
      s.mesh.position.z += (targetLift - s.mesh.position.z) * 0.18;

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
    const w = Math.min(width, rect.width);
    const h = (w / width) * height;

    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function onYearInput(e: Event) {
    const v = +(e.target as HTMLInputElement).value;
    selectedYear.set(v);
  }

  function resetView() {
    if (!camera || !controls) return;

    camera.position.set(0, 870, 720);
    controls.target.set(0, 0, 0);
    controls.update();

    selectedState.set(null);
    refreshStates();
  }
</script>

<div class="map3d-shell" bind:this={containerEl}>
  <div class="map3d-header">
    <div>
      <h3>U.S. Stroke Mortality, 3D Relief Map</h3>
      <p class="caption">
        Each state is rendered as a smooth 3D relief block. Higher states indicate
        higher stroke mortality, while the color tint provides a second cue.
        Click a state to select it. Drag to rotate · scroll to zoom.
      </p>
    </div>

    <button class="reset-btn" on:click={resetView} type="button">Reset</button>
  </div>

  <div
    class="canvas-wrap"
    bind:this={canvasWrapEl}
    style:width="{width}px"
    style:height="{height}px"
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
        <div class="tt-hint">click to select this state</div>
      </div>
    {/if}
  </div>

  {#if showYearSlider && availableYears.length > 0}
    <div class="year-bar">
      <label>
        Year:
        <span class="year-num">{activeYear}</span>
      </label>

      <input
        type="range"
        min={availableYears[0]}
        max={availableYears[availableYears.length - 1]}
        value={activeYear}
        step="1"
        on:input={onYearInput}
      />

      <span class="year-range">
        {availableYears[0]}–{availableYears[availableYears.length - 1]}
      </span>
    </div>
  {/if}

  <div class="legend-row">
    <span class="legend-title">Mortality</span>
    <span class="grad" />
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
    color: #0f172a;
  }

  .caption {
    margin: 0;
    color: #556273;
    font-size: 0.89rem;
    line-height: 1.5;
    max-width: 78ch;
  }

  .reset-btn {
    flex: 0 0 auto;
    padding: 7px 14px;
    font-size: 0.82rem;
    font-weight: 700;
    background: rgba(255, 255, 255, 0.88);
    border: 1px solid rgba(148, 163, 184, 0.28);
    border-radius: 999px;
    color: #334155;
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
    background: #f5f6f8;
    border: 1px solid rgba(203, 213, 225, 0.58);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.82),
      0 12px 30px rgba(15, 23, 42, 0.055);
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
    background: rgba(255, 255, 255, 0.94);
    color: #1e293b;
    border: 1px solid rgba(148, 163, 184, 0.34);
    box-shadow: 0 14px 30px rgba(15, 23, 42, 0.14);
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
    color: #9a3412;
    font-size: 0.76rem;
    font-weight: 650;
  }

  .year-bar {
    display: grid;
    grid-template-columns: auto minmax(140px, 1fr) auto;
    align-items: center;
    gap: 12px;
    margin-top: 14px;
    padding: 10px 12px;
    font-size: 0.88rem;
    color: #475569;
    background: rgba(255, 255, 255, 0.74);
    border: 1px solid rgba(203, 213, 225, 0.56);
    border-radius: 14px;
  }

  .year-bar label {
    white-space: nowrap;
    font-weight: 650;
  }

  .year-bar input[type="range"] {
    width: 100%;
    accent-color: #c2410c;
    cursor: pointer;
  }

  .year-num {
    font-weight: 800;
    color: #c2410c;
    margin-left: 4px;
  }

  .year-range {
    color: #64748b;
    font-size: 0.78rem;
    white-space: nowrap;
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
    color: #334155;
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
    color: #64748b;
  }

  .dot-sep {
    color: #94a3b8;
    margin: 0 2px;
  }

  .legend-note {
    color: #64748b;
  }

  @media (max-width: 720px) {
    .map3d-header {
      flex-direction: column;
      gap: 10px;
    }

    .reset-btn {
      align-self: flex-start;
    }

    .year-bar {
      grid-template-columns: 1fr;
      gap: 8px;
    }
  }
</style>