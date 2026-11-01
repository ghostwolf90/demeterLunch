import * as THREE from "./vendor/three.module.min.js";

const COLORS = {
  water: 0x9fc8cf,
  sand: 0xe8d79b,
  grass: 0x76a77d,
  grassDark: 0x4f7f66,
  stone: 0xd3cab5,
  ink: 0x153447,
  orange: 0xaa4729,
  yellow: 0xf1c84a,
  white: 0xfffdf8,
  blue: 0x6f9fb4,
  missing: 0xaaa99f,
};

const CITY_COLORS = {
  "臺中市": { land: 0x79a987, roof: 0xaa4729, building: 0xfff2d3 },
  "臺南市": { land: 0xc5a96b, roof: 0x396b5a, building: 0xffe9bd },
};

const DISH_COLORS = {
  主食: 0xe4bb58,
  主菜: 0xc66a4a,
  副菜: 0x6e9d6b,
  湯品: 0x6f9fb4,
  水果: 0xe48c54,
  飲品: 0xd7c6a4,
  乳品: 0xf1e9d8,
};

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

export class LunchIslandScene {
  constructor(canvas, { onSelect, onHover, labelLayer } = {}) {
    this.canvas = canvas;
    this.onSelect = onSelect;
    this.onHover = onHover;
    this.labelLayer = labelLayer;
    this.labels = [];
    this.pickables = [];
    this.focusTargets = new Map();
    this.currentRoot = null;
    this.hovered = null;
    this.dragging = false;
    this.dragDistance = 0;
    this.pointerStart = { x: 0, y: 0 };
    this.yaw = -0.62;
    this.pitch = 0.9;
    this.radius = 15;
    this.targetRadius = 15;
    this.targetYaw = this.yaw;
    this.targetPitch = this.pitch;
    this.needsFrame = false;
    this.introStart = 0;
    this.activeLayer = "cities";
    this.characters = [];
    this.followedCharacter = null;
    this.followMarker = null;
    this.peopleMotion = !prefersReducedMotion;
    this.lastCharacterFrame = 0;
    this.characterFrameInterval = coarsePointer ? 34 : 17;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !coarsePointer,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0xd8eaeb, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = !coarsePointer;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xd8eaeb, 24, 48);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
    this.cameraTarget = new THREE.Vector3(0, 0.2, 0);
    this.targetCameraTarget = this.cameraTarget.clone();
    this.followPosition = new THREE.Vector3();
    this.labelPosition = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.scene.add(new THREE.HemisphereLight(0xf6fbff, 0x8d8062, 2.4));
    const sun = new THREE.DirectionalLight(0xfff3d4, 3.1);
    sun.position.set(-8, 14, 7);
    sun.castShadow = !coarsePointer;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -14;
    sun.shadow.camera.right = 14;
    sun.shadow.camera.top = 14;
    sun.shadow.camera.bottom = -14;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 36;
    this.scene.add(sun);

    this.environment = new THREE.Group();
    this.scene.add(this.environment);
    this.buildEnvironment();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.bindControls();
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && this.characters.length && this.peopleMotion) this.requestFrame();
    });
    this.resize();
  }

  buildEnvironment() {
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(32, 64),
      new THREE.MeshStandardMaterial({ color: COLORS.water, roughness: 0.72, metalness: 0.02 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.36;
    water.receiveShadow = true;
    this.environment.add(water);

    const rings = new THREE.Group();
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xd7eceb, transparent: true, opacity: 0.28 });
    for (let i = 0; i < 5; i += 1) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(4.8 + i * 3.2, 4.88 + i * 3.2, 64), ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -0.34;
      rings.add(ring);
    }
    this.environment.add(rings);
  }

  bindControls() {
    this.canvas.addEventListener("pointerdown", (event) => {
      this.stopFollowing(false);
      this.dragging = true;
      this.dragDistance = 0;
      this.pointerStart = { x: event.clientX, y: event.clientY };
      this.canvas.setPointerCapture(event.pointerId);
    });

    this.canvas.addEventListener("pointermove", (event) => {
      if (this.dragging) {
        const dx = event.clientX - this.pointerStart.x;
        const dy = event.clientY - this.pointerStart.y;
        this.dragDistance += Math.abs(dx) + Math.abs(dy);
        this.pointerStart = { x: event.clientX, y: event.clientY };
        this.targetYaw -= dx * 0.006;
        this.targetPitch = THREE.MathUtils.clamp(this.targetPitch + dy * 0.0045, 0.42, 1.28);
        this.requestFrame();
        return;
      }
      if (!coarsePointer) this.updateHover(event);
    });

    this.canvas.addEventListener("pointerup", (event) => {
      if (!this.dragging) return;
      this.dragging = false;
      if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
      if (this.dragDistance < 7) this.selectAt(event);
    });

    this.canvas.addEventListener("pointercancel", () => { this.dragging = false; });
    this.canvas.addEventListener("pointerleave", () => {
      if (!this.dragging) this.setHovered(null);
    });
    this.canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      this.stopFollowing(false);
      this.targetRadius = THREE.MathUtils.clamp(this.targetRadius + event.deltaY * 0.012, 2.2, 32);
      this.requestFrame();
    }, { passive: false });
    this.canvas.addEventListener("keydown", (event) => {
      const keyActions = {
        ArrowLeft: () => { this.targetYaw += 0.14; },
        ArrowRight: () => { this.targetYaw -= 0.14; },
        ArrowUp: () => { this.targetPitch = Math.max(0.42, this.targetPitch - 0.1); },
        ArrowDown: () => { this.targetPitch = Math.min(1.28, this.targetPitch + 0.1); },
        "+": () => { this.targetRadius = Math.max(2.2, this.targetRadius - 1); },
        "=": () => { this.targetRadius = Math.max(2.2, this.targetRadius - 1); },
        "-": () => { this.targetRadius = Math.min(32, this.targetRadius + 1); },
      };
      const action = keyActions[event.key];
      if (!action) return;
      event.preventDefault();
      this.stopFollowing(false);
      action();
      this.requestFrame();
    });
  }

  resize() {
    const parent = this.canvas.parentElement;
    const width = Math.max(1, parent.clientWidth);
    const height = Math.max(1, parent.clientHeight);
    const cap = coarsePointer ? 1 : 1.45;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.requestFrame();
  }

  setContent(layer, items, context = {}) {
    this.activeLayer = layer;
    this.clearRoot();
    const root = new THREE.Group();
    root.position.y = prefersReducedMotion ? 0 : -0.32;
    root.scale.setScalar(prefersReducedMotion ? 1 : 0.94);
    this.currentRoot = root;
    this.scene.add(root);

    if (layer === "overview") this.buildOverview(root, items, context);
    if (layer === "cities") this.buildCities(root, items);
    if (layer === "showcase") this.buildShowcaseIsland(root, items, context);
    if (layer === "districts") this.buildDistricts(root, items, context);
    if (layer === "schools") this.buildSchools(root, items, context);
    if (layer === "meal") this.buildMealCampus(root, items, context);

    this.introStart = performance.now();
    this.resetCamera(layer, false);
    this.requestFrame();
  }

  buildOverview(root, items, context) {
    const centers = {
      "臺中市": new THREE.Vector3(-4.55, 0, 0.35),
      "臺南市": new THREE.Vector3(4.55, 0, -0.35),
    };
    const cityItems = new Map((context.cities || []).map((item) => [item.city, item]));

    for (const cityName of Object.keys(centers)) {
      const cityDistricts = items.filter((item) => item.city === cityName);
      const palette = CITY_COLORS[cityName] || CITY_COLORS["臺中市"];
      const city = new THREE.Group();
      city.position.copy(centers[cityName]);
      city.rotation.y = cityName === "臺中市" ? -0.06 : 0.08;
      root.add(city);

      const points = cityDistricts.map((_, index) => spiralPoint(index, cityDistricts.length, cityDistricts.length > 32 ? 3.8 : 3.45));
      let mobileLabelCount = 0;
      for (let index = 1; index < points.length; index += 1) {
        this.addBridgeBetween(city, points[nearestPreviousPoint(points, index)], points[index], 0.13, index % 5 === 0);
      }

      cityDistricts.forEach((item, index) => {
        const point = points[index];
        const district = new THREE.Group();
        district.position.set(point.x, 0, point.z);
        district.rotation.y = index * 0.57;
        city.add(district);
        this.addIsland(district, cityDistricts.length > 32 ? 0.56 : 0.61, palette.land, item, 6 + (index % 3));
        this.addDistrictCluster(district, item, palette, index, cityDistricts.length);
        if (index % 2 === 0) this.addTree(district, -0.27, 0.2, 0.18);
        if (item.featured && (!coarsePointer || mobileLabelCount < 4)) {
          this.addMapLabel(district, item, new THREE.Vector3(0, 1.2, 0), "");
          mobileLabelCount += 1;
        }
      });

      const cityItem = cityItems.get(cityName);
      if (cityItem) this.addMapLabel(city, cityItem, new THREE.Vector3(0, 1.65, -4.2), "is-city-label");
    }

    this.addBridgeBetween(root, new THREE.Vector3(-1.05, 0, 0.25), new THREE.Vector3(1.05, 0, -0.25), 0.22);
    this.addFerryRoute(root, new THREE.Vector3(-1.2, -0.28, 2.35), new THREE.Vector3(1.25, -0.28, 2.05));
    this.addOverviewDecoration(root, -9.2, -3.9, CITY_COLORS["臺中市"]);
    this.addOverviewDecoration(root, 9.25, 3.75, CITY_COLORS["臺南市"]);
  }

  buildCities(root, items) {
    const positions = items.length === 1 ? [0] : [-4.1, 4.1];
    items.forEach((item, index) => {
      const palette = CITY_COLORS[item.city] || CITY_COLORS["臺中市"];
      const city = new THREE.Group();
      city.position.set(positions[index], 0, index % 2 ? -0.6 : 0.5);
      root.add(city);
      this.addIsland(city, 2.85, palette.land, item);

      const markerCount = Math.min(item.districtCount || 12, 30);
      for (let marker = 0; marker < markerCount; marker += 1) {
        const point = spiralPoint(marker, markerCount, 2.05);
        const height = 0.25 + ((marker * 17) % 7) * 0.045;
        const building = this.addBuilding(city, point.x, point.z, 0.17, height, palette.building, palette.roof, item);
        building.rotation.y = marker * 0.47;
      }
      this.addLighthouse(city, 0, -1.95, item);
    });
    if (items.length > 1) {
      this.addFerryRoute(root, new THREE.Vector3(positions[0] + 2.5, -0.28, 0.3), new THREE.Vector3(positions[1] - 2.5, -0.28, -0.35));
    }
  }

  buildShowcaseIsland(root, items, context) {
    const palette = CITY_COLORS[context.city] || CITY_COLORS["臺中市"];
    const islandRadius = 8.45;
    this.addIsland(root, islandRadius, 0x7ca87d, null, 14);

    const westLobe = new THREE.Group();
    westLobe.position.set(-5.8, -0.05, 0.45);
    westLobe.scale.set(1, 0.9, 0.82);
    root.add(westLobe);
    this.addIsland(westLobe, 2.7, 0x719c78, null, 9);
    const eastLobe = new THREE.Group();
    eastLobe.position.set(5.6, -0.06, -0.35);
    eastLobe.scale.set(0.92, 0.88, 1.05);
    root.add(eastLobe);
    this.addIsland(eastLobe, 2.55, 0x86b183, null, 8);

    const centralPlaza = new THREE.Mesh(
      new THREE.CylinderGeometry(1.55, 1.66, 0.09, 32),
      new THREE.MeshStandardMaterial({ color: 0xefe3c8, roughness: 0.94 }),
    );
    centralPlaza.position.y = 0.34;
    centralPlaza.receiveShadow = true;
    root.add(centralPlaza);
    const plazaRing = new THREE.Mesh(
      new THREE.RingGeometry(1.7, 1.94, 40),
      new THREE.MeshStandardMaterial({ color: 0xc87455, roughness: 0.92, side: THREE.DoubleSide }),
    );
    plazaRing.rotation.x = -Math.PI / 2;
    plazaRing.position.y = 0.395;
    root.add(plazaRing);

    const schoolPositions = [
      { x: -4.55, z: -2.85 },
      { x: -0.2, z: -5.1 },
      { x: 4.4, z: -2.9 },
      { x: 4.55, z: 2.55 },
      { x: 0.15, z: 5.0 },
      { x: -4.55, z: 2.65 },
    ];
    const padColors = [0xd9c8a7, 0xc6d9c5, 0xd5c8d7, 0xc4d7dd, 0xe2cfad, 0xcbd6b7];
    const center = { x: 0, z: 0, label: "中央午餐廣場" };
    const schoolNodes = [];

    items.forEach((item, index) => {
      const point = schoolPositions[index % schoolPositions.length];
      const node = { ...point, label: item.label };
      schoolNodes.push(node);
      this.addWalkway(root, center, node, 0.22, index % 3 === 0, 0.33);
      const nextPoint = schoolPositions[(index + 1) % items.length];
      this.addWalkway(root, point, nextPoint, 0.13, false, 0.32);

      const campusPad = new THREE.Mesh(
        new THREE.CylinderGeometry(1.48, 1.6, 0.1, 18),
        new THREE.MeshStandardMaterial({ color: padColors[index % padColors.length], roughness: 0.94 }),
      );
      campusPad.position.set(point.x, 0.33, point.z);
      campusPad.rotation.y = index * 0.31;
      campusPad.receiveShadow = true;
      root.add(campusPad);

      const marker = this.addSchoolMarker(root, point.x, point.z, item, palette, index, items.length, 1.7);
      marker.rotation.y += index * 0.25;
      this.registerFocusTarget(item, marker);
      this.addMapLabel(marker, item, new THREE.Vector3(0, 1.58, 0), "is-school-label", 22);

      const tangentX = -Math.sin(index / items.length * Math.PI * 2);
      const tangentZ = Math.cos(index / items.length * Math.PI * 2);
      this.addMiniLamp(root, point.x + tangentX * 1.22, point.z + tangentZ * 1.22, 1.2);
      this.addMiniBench(root, point.x - tangentX * 1.05, point.z - tangentZ * 1.05, index * 0.58, 1.12);
      this.addMiniPlanter(root, point.x + tangentX * 0.95, point.z + tangentZ * 0.86, 1.05);
      if (!coarsePointer) {
        this.addMiniPlanter(root, point.x - tangentX * 0.82, point.z - tangentZ * 0.92, 0.88);
        if (index % 2 === 0) this.addMiniShelter(root, point.x + tangentX * 1.3, point.z - tangentZ * 0.8, 1.05);
        else this.addMiniBikeRack(root, point.x + tangentX * 1.26, point.z - tangentZ * 0.75, 1.08);
      }
    });

    this.addPlayground(root, 2.65, 0.35, 41);
    this.addGarden(root, -2.65, 0.35, 73);
    this.addSchoolBus(root, -1.35, -6.75, 12);
    this.addBikeParking(root, 1.15, -6.62, 25);
    this.addNoticeBoard(root, -1.2, -0.6, palette);
    this.addRecycleStation(root, 1.15, -0.7);
    this.addDrinkingFountain(root, 1.2, 1.0);
    this.addSchoolClock(root, 0, 0.15, palette);
    this.addSolarArray(root, -6.05, 0.15, 29);
    this.addOutdoorTable(root, -0.9, 1.05, 3);
    this.addOutdoorTable(root, 0.8, 1.15, 7);
    this.addMiniCourt(root, 6.05, -0.05, 3.2);
    this.addMiniPlayStructure(root, 2.35, 1.75, 1.8);
    this.addMiniPlayStructure(root, -2.2, 1.8, 1.65);
    this.addCampusFence(root, { x: -3.65, z: -6.55 }, { x: -0.9, z: -7.15 });
    this.addCampusFence(root, { x: 0.9, z: -7.15 }, { x: 3.65, z: -6.55 });

    const lampCount = coarsePointer ? 8 : 14;
    for (let index = 0; index < lampCount; index += 1) {
      const angle = (index / lampCount) * Math.PI * 2 + 0.12;
      const radius = 3.3 + (index % 2) * 0.45;
      this.addMiniLamp(root, Math.cos(angle) * radius, Math.sin(angle) * radius, 1.05);
    }
    const treeCount = coarsePointer ? 22 : 38;
    for (let index = 0; index < treeCount; index += 1) {
      const angle = (index / treeCount) * Math.PI * 2 + 0.08;
      const radius = 7.05 + (index % 4) * 0.27;
      this.addTree(root, Math.cos(angle) * radius, Math.sin(angle) * radius, 0.25 + (index % 5) * 0.022);
    }
    if (!coarsePointer) {
      for (let index = 0; index < 10; index += 1) {
        const angle = index / 10 * Math.PI * 2 + 0.32;
        this.addTree(root, Math.cos(angle) * 2.35, Math.sin(angle) * 2.35, 0.22 + (index % 3) * 0.025);
      }
    }

    const routes = [
      [schoolNodes[0], center, schoolNodes[3]],
      [schoolNodes[1], center, schoolNodes[4]],
      [schoolNodes[2], center, schoolNodes[5]],
      [schoolNodes[0], schoolNodes[1], schoolNodes[2], schoolNodes[3]],
      [schoolNodes[3], schoolNodes[4], schoolNodes[5], schoolNodes[0]],
      [schoolNodes[1], schoolNodes[2], center, schoolNodes[5]],
      [schoolNodes[4], center, schoolNodes[0], schoolNodes[1]],
      [schoolNodes[5], center, schoolNodes[2], schoolNodes[3]],
    ];
    (context.characters || []).forEach((item, index) => {
      const route = routes[item.routeSeed % routes.length].filter(Boolean);
      this.addCharacter(root, item, index % 2 ? [...route].reverse() : route, index);
    });
    const petRoutes = [
      [schoolNodes[5], center, schoolNodes[4]],
      [schoolNodes[2], center, schoolNodes[3]],
      [schoolNodes[0], schoolNodes[1], center],
    ];
    (context.pets || []).forEach((item, index) => {
      const route = petRoutes[item.routeSeed % petRoutes.length].filter(Boolean);
      this.addPet(root, item, index % 2 ? [...route].reverse() : route, index);
    });
  }

  buildDistricts(root, items, context) {
    const palette = CITY_COLORS[context.city] || CITY_COLORS["臺中市"];
    const radius = items.length > 30 ? 9.4 : items.length > 18 ? 8.5 : 7.4;
    const points = items.map((_, index) => spiralPoint(index, items.length, radius));
    const schoolsByDistrict = new Map();
    for (const schoolItem of context.schools || []) {
      const districtSchools = schoolsByDistrict.get(schoolItem.district) || [];
      districtSchools.push(schoolItem);
      schoolsByDistrict.set(schoolItem.district, districtSchools);
    }
    for (let index = 1; index < points.length; index += 1) {
      const nearestIndex = nearestPreviousPoint(points, index);
      this.addBridgeBetween(root, points[nearestIndex], points[index], items.length > 30 ? 0.12 : 0.15);
    }
    for (let index = 6; index < points.length; index += 7) {
      this.addBridgeBetween(root, points[index - 3], points[index], 0.1, true);
    }
    items.forEach((item, index) => {
      const point = points[index];
      const district = new THREE.Group();
      district.position.set(point.x, 0, point.z);
      district.rotation.y = index * 0.73;
      root.add(district);
      const seed = hashNumber(String(item.id || item.label || index));
      const islandRadius = (items.length > 30 ? 1.34 : 1.48) + (seed % 4) * 0.1;
      this.addVariedDistrictIsland(district, islandRadius, palette.land, item, seed);
      this.registerFocusTarget(item, district);
      this.addDistrictGroundNetwork(district, islandRadius, seed);
      const districtSchools = schoolsByDistrict.get(item.district) || [];
      this.addDistrictSchoolCluster(district, item, districtSchools, palette, index, islandRadius);
      for (const schoolItem of districtSchools) {
        if (!this.focusTargets.has(`${schoolItem.kind}:${schoolItem.id}`)) this.registerFocusTarget(schoolItem, district);
      }
      this.addDistrictThemeZone(district, item, index, islandRadius, palette, seed);
      this.addDistrictProps(district, item, index, islandRadius);
      const labelStep = coarsePointer ? 3 : 2;
      if (index < 3 || index % labelStep === 0) {
        this.addMapLabel(district, item, new THREE.Vector3(0, 1.62, 0), "", 24);
      }
    });
    const neighbors = points.map(() => []);
    const connectRoute = (first, second) => {
      if (!neighbors[first].includes(second)) neighbors[first].push(second);
      if (!neighbors[second].includes(first)) neighbors[second].push(first);
    };
    for (let index = 1; index < points.length; index += 1) connectRoute(nearestPreviousPoint(points, index), index);
    for (let index = 6; index < points.length; index += 7) connectRoute(index - 3, index);
    const bridgeRoute = (routeSeed) => {
      let current = points.length ? routeSeed % points.length : 0;
      let previous = -1;
      const routeIndices = [current];
      for (let step = 0; step < 3; step += 1) {
        const forward = neighbors[current].filter((candidate) => candidate !== previous);
        const choices = forward.length ? forward : neighbors[current];
        if (!choices.length) break;
        const next = choices[(routeSeed + step * 7) % choices.length];
        routeIndices.push(next);
        previous = current;
        current = next;
      }
      return routeIndices.map((pointIndex) => ({
        x: points[pointIndex].x,
        z: points[pointIndex].z,
        label: items[pointIndex]?.label || context.city,
      }));
    };
    (context.characters || []).forEach((item, index) => {
      const route = bridgeRoute(item.routeSeed);
      this.addCharacter(root, item, index % 2 ? [...route].reverse() : route, index);
    });
    (context.pets || []).forEach((item, index) => {
      const route = bridgeRoute(item.routeSeed);
      this.addPet(root, item, index % 2 ? [...route].reverse() : route, index);
    });
  }

  buildSchools(root, items, context) {
    const palette = CITY_COLORS[context.city] || CITY_COLORS["臺中市"];
    const islandRadius = Math.min(5.5, Math.max(3.2, 2.6 + items.length * 0.12));
    this.addIsland(root, islandRadius, palette.land, null, 8);
    const usableRadius = islandRadius - 0.75;
    items.forEach((item, index) => {
      const point = spiralPoint(index, items.length, usableRadius);
      if (index > 0) this.addWalkway(root, { x: 0, z: 0 }, point, items.length > 18 ? 0.07 : 0.09, false, 0.27);
      this.addSchoolMarker(root, point.x, point.z, item, palette, index, items.length);
    });
    for (let tree = 0; tree < Math.min(18, 6 + items.length); tree += 1) {
      const angle = (tree / Math.min(18, 6 + items.length)) * Math.PI * 2;
      this.addTree(root, Math.cos(angle) * (islandRadius - 0.38), Math.sin(angle) * (islandRadius - 0.38), 0.28);
    }
  }

  buildMealCampus(root, items, context) {
    const palette = CITY_COLORS[context.city] || CITY_COLORS["臺中市"];
    const seed = hashNumber(String(context.school?.fatraceSchoolId || context.school?.fullName || "campus"));
    const campusType = seed % 6;
    this.addIsland(root, 6.35, context.hasMeal ? 0x83a978 : 0x91a08e, null, 12);

    const nodes = {
      gate: { x: 0, z: -5.15, label: "校門" },
      center: { x: 0, z: -0.55, label: "中央走廊" },
      admin: { x: -2.65, z: -2.45, label: "行政大樓" },
      classroom: { x: 2.65, z: -2.2, label: "教學大樓" },
      library: { x: -4.25, z: 0.15, label: "圖書館" },
      lunch: { x: 0, z: 1.65, label: "午餐廣場" },
      kitchen: { x: -3.65, z: 3.25, label: "廚房與餐廳" },
      gym: { x: 3.65, z: 3.15, label: "活動中心" },
      garden: { x: 4.35, z: 0.45, label: "生態花園" },
    };

    this.addBridgeBetween(root, { x: 0, z: -7.1 }, nodes.gate, 0.28);
    this.addWalkway(root, nodes.gate, nodes.center, 0.24, true);
    this.addWalkway(root, nodes.center, nodes.admin, 0.2, campusType % 2 === 0);
    this.addWalkway(root, nodes.center, nodes.classroom, 0.2, campusType % 2 === 1);
    this.addWalkway(root, nodes.center, nodes.lunch, 0.26, true);
    this.addWalkway(root, nodes.lunch, nodes.kitchen, 0.2, false);
    this.addWalkway(root, nodes.lunch, nodes.gym, 0.2, false);
    this.addWalkway(root, nodes.admin, nodes.library, 0.16, false);
    this.addWalkway(root, nodes.classroom, nodes.garden, 0.16, false);

    this.addCampusBuilding(root, { ...nodes.admin, type: "admin", width: 1.55, depth: 0.72, floors: 2 + (seed % 2) }, palette, seed + 1);
    this.addCampusBuilding(root, { ...nodes.classroom, type: "classroom", width: 2.15, depth: 0.7, floors: 2 + ((seed >> 2) % 3) }, palette, seed + 2);
    this.addCampusBuilding(root, { ...nodes.library, type: "library", width: 1.35, depth: 0.88, floors: 1 + ((seed >> 3) % 2) }, palette, seed + 3);
    this.addCampusBuilding(root, { ...nodes.kitchen, type: "cafeteria", width: 1.65, depth: 0.95, floors: 1 }, palette, seed + 4);
    this.addCampusBuilding(root, { ...nodes.gym, type: "gym", width: 1.75, depth: 1.15, floors: 1 }, palette, seed + 5);
    this.addGatehouse(root, nodes.gate.x, nodes.gate.z, palette);
    this.addPlayground(root, 2.65, 0.45, seed);
    this.addGarden(root, nodes.garden.x, nodes.garden.z, seed);
    this.addCampusProps(root, nodes, seed, palette);

    const plaza = new THREE.Mesh(
      new THREE.CylinderGeometry(1.34, 1.42, 0.1, 28),
      new THREE.MeshStandardMaterial({ color: 0xf7e9c6, roughness: 0.92 }),
    );
    plaza.position.set(nodes.lunch.x, 0.33, nodes.lunch.z);
    plaza.receiveShadow = true;
    root.add(plaza);

    if (items.length) {
      items.forEach((item, index) => {
        const ring = Math.floor(index / 8);
        const ringCount = Math.min(8, items.length - ring * 8);
        const angle = (index % 8) / Math.max(ringCount, 1) * Math.PI * 2 - Math.PI / 2;
        const radius = 1.72 + ring * 0.68;
        this.addDishLandmark(root, nodes.lunch.x + Math.cos(angle) * radius, nodes.lunch.z + Math.sin(angle) * radius, item, index, 0.72);
      });
    } else {
      this.addNoMealSign(root, nodes.lunch.x, nodes.lunch.z);
    }

    const treeCount = coarsePointer ? 12 : 20;
    for (let index = 0; index < treeCount; index += 1) {
      const angle = (index / treeCount) * Math.PI * 2 + (seed % 9) * 0.07;
      const radius = 5.35 + (index % 3) * 0.22;
      this.addTree(root, Math.cos(angle) * radius, Math.sin(angle) * radius, 0.26 + (index % 4) * 0.025);
    }

    const routes = [
      [nodes.gate, nodes.center, nodes.admin],
      [nodes.gate, nodes.center, nodes.classroom],
      [nodes.classroom, nodes.center, nodes.lunch],
      [nodes.admin, nodes.center, nodes.lunch, nodes.kitchen],
      [nodes.library, nodes.admin, nodes.center, nodes.lunch],
      [nodes.gym, nodes.lunch, nodes.center, nodes.classroom],
      [nodes.garden, nodes.classroom, nodes.center, nodes.gate],
      [nodes.kitchen, nodes.lunch, nodes.gym],
    ];
    (context.characters || []).forEach((item, index) => {
      const route = routes[item.routeSeed % routes.length];
      this.addCharacter(root, item, index % 2 ? [...route].reverse() : route, index);
    });
    const petRoutes = [
      [nodes.garden, nodes.classroom, nodes.center, nodes.lunch],
      [nodes.gate, nodes.center, nodes.lunch, nodes.kitchen],
      [nodes.gym, nodes.lunch, nodes.center, nodes.garden],
    ];
    (context.pets || []).forEach((item, index) => {
      const route = petRoutes[item.routeSeed % petRoutes.length];
      this.addPet(root, item, index % 2 ? [...route].reverse() : route, index);
    });
  }

  addMapLabel(parent, item, position, className, maxRadius = Number.POSITIVE_INFINITY) {
    if (!this.labelLayer) return;
    const anchor = new THREE.Object3D();
    anchor.position.copy(position);
    parent.add(anchor);
    const element = document.createElement("button");
    element.type = "button";
    element.className = `map-label ${className}`.trim();
    element.textContent = item.label;
    element.dataset.index = item.labelIndex || "";
    element.setAttribute("aria-label", `前往${item.label}`);
    element.addEventListener("click", () => this.onSelect?.(item));
    this.labelLayer.append(element);
    this.labels.push({ anchor, element, maxRadius });
  }

  addOverviewDecoration(parent, x, z, palette) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    parent.add(group);
    this.addIsland(group, 1.05, palette.land, null, 9);
    this.addBuilding(group, -0.22, 0.08, 0.28, 0.54, palette.building, palette.roof, null);
    this.addTree(group, 0.36, 0.18, 0.27);
    this.addTree(group, 0.03, -0.36, 0.22);
  }

  addIsland(parent, radius, landColor, item = null, segments = 6) {
    const sand = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.91, radius * 1.08, 0.42, segments),
      new THREE.MeshStandardMaterial({ color: COLORS.sand, roughness: 0.95 }),
    );
    sand.position.y = -0.12;
    sand.receiveShadow = true;
    parent.add(sand);

    const land = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.84, radius * 0.96, 0.38, segments),
      new THREE.MeshStandardMaterial({ color: landColor, roughness: 0.9 }),
    );
    land.position.y = 0.08;
    land.castShadow = true;
    land.receiveShadow = true;
    parent.add(land);
    if (item) this.makePickable(land, item);
    return land;
  }

  addVariedDistrictIsland(parent, radius, landColor, item, seed) {
    const variant = seed % 6;
    const segments = 5 + (seed % 5);
    const shape = new THREE.Group();
    shape.rotation.y = ((seed % 17) - 8) * 0.07;
    shape.scale.set(0.82 + (seed % 5) * 0.055, 1, 0.84 + ((seed >> 3) % 5) * 0.055);
    parent.add(shape);
    const tint = new THREE.Color(landColor).offsetHSL(((seed % 7) - 3) * 0.006, 0, ((seed >> 4) % 3) * 0.018).getHex();
    this.addIsland(shape, radius, tint, item, segments);

    if (variant === 1 || variant === 4) {
      const lobe = new THREE.Group();
      lobe.position.set(radius * (variant === 1 ? 0.62 : -0.58), -0.035, radius * 0.16);
      lobe.scale.set(0.82, 0.86, 0.66);
      shape.add(lobe);
      this.addIsland(lobe, radius * 0.62, tint, item, Math.max(5, segments - 1));
    }
    if (variant === 2 || variant === 5) {
      const terrace = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.48, radius * 0.56, 0.14 + (seed % 3) * 0.035, segments),
        new THREE.MeshStandardMaterial({ color: tint, roughness: 0.92 }),
      );
      terrace.position.set(variant === 2 ? radius * 0.2 : -radius * 0.18, 0.34, radius * 0.08);
      terrace.rotation.y = (seed % 9) * 0.11;
      terrace.castShadow = true;
      terrace.receiveShadow = true;
      shape.add(terrace);
      this.makePickable(terrace, item);
    }
    if (variant === 3) {
      const cove = new THREE.Mesh(
        new THREE.CircleGeometry(radius * 0.28, 12),
        new THREE.MeshStandardMaterial({ color: COLORS.water, roughness: 0.72 }),
      );
      cove.rotation.x = -Math.PI / 2;
      cove.position.set(radius * 0.45, 0.285, radius * 0.42);
      shape.add(cove);
    }
    return shape;
  }

  addFerryRoute(parent, from, to) {
    const count = 13;
    const material = new THREE.MeshBasicMaterial({ color: 0xf8f0d7, transparent: true, opacity: 0.82 });
    for (let index = 0; index < count; index += 1) {
      const progress = (index + 1) / (count + 1);
      const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.025, 10), material);
      dot.position.lerpVectors(from, to, progress);
      parent.add(dot);
    }
    const boat = new THREE.Group();
    boat.position.lerpVectors(from, to, 0.5);
    boat.position.y = -0.17;
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.16, 0.22),
      new THREE.MeshStandardMaterial({ color: COLORS.orange, roughness: 0.78 }),
    );
    hull.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
    boat.add(hull);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.16, 0.16),
      new THREE.MeshStandardMaterial({ color: COLORS.white, roughness: 0.68 }),
    );
    cabin.position.y = 0.13;
    cabin.rotation.y = hull.rotation.y;
    boat.add(cabin);
    parent.add(boat);
  }

  addBridgeBetween(parent, from, to, width = 0.14, cosmetic = false) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.4) return;
    const angle = Math.atan2(dx, dz);
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.09, length),
      new THREE.MeshStandardMaterial({ color: cosmetic ? 0xd9c99c : 0xb88d5d, roughness: 0.9 }),
    );
    deck.position.set((from.x + to.x) / 2, 0.2, (from.z + to.z) / 2);
    deck.rotation.y = angle;
    deck.receiveShadow = true;
    parent.add(deck);
    if (coarsePointer || cosmetic || length > 4.5) return;
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.025, 0.16, length),
        new THREE.MeshStandardMaterial({ color: 0xf5ead1, roughness: 0.82 }),
      );
      rail.position.copy(deck.position);
      rail.position.x += Math.cos(angle) * width * 0.45 * side;
      rail.position.z -= Math.sin(angle) * width * 0.45 * side;
      rail.position.y = 0.31;
      rail.rotation.y = angle;
      parent.add(rail);
    }
  }

  addWalkway(parent, from, to, width = 0.18, covered = false, y = 0.3) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.15) return;
    const angle = Math.atan2(dx, dz);
    const path = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.045, length),
      new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.95 }),
    );
    path.position.set((from.x + to.x) / 2, y, (from.z + to.z) / 2);
    path.rotation.y = angle;
    path.receiveShadow = true;
    parent.add(path);
    if (!covered || coarsePointer) return;
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(width * 1.45, 0.06, length),
      new THREE.MeshStandardMaterial({ color: 0xe0a861, roughness: 0.78 }),
    );
    roof.position.copy(path.position);
    roof.position.y += 0.5;
    roof.rotation.y = angle;
    roof.castShadow = true;
    parent.add(roof);
    const columns = Math.max(2, Math.floor(length / 0.8));
    for (let index = 0; index <= columns; index += 1) {
      const progress = index / columns;
      for (const side of [-1, 1]) {
        const column = new THREE.Mesh(
          new THREE.BoxGeometry(0.035, 0.48, 0.035),
          new THREE.MeshStandardMaterial({ color: 0xf7efdd, roughness: 0.84 }),
        );
        column.position.set(
          from.x + dx * progress + Math.cos(angle) * width * 0.56 * side,
          y + 0.25,
          from.z + dz * progress - Math.sin(angle) * width * 0.56 * side,
        );
        parent.add(column);
      }
    }
  }

  addDistrictCluster(parent, item, palette, index, total) {
    const compact = total > 30;
    const scale = compact ? 0.72 : 0.86;
    this.addSchoolMarker(parent, 0, 0, item, palette, index, total, scale);
  }

  addDistrictGroundNetwork(parent, islandRadius, seed) {
    const assets = this.ensurePropAssets();
    const plaza = new THREE.Mesh(assets.discGeometry, assets.materials.white);
    plaza.scale.set(islandRadius * 2.05, 0.55, islandRadius * 2.05);
    plaza.position.y = 0.295;
    plaza.receiveShadow = true;
    parent.add(plaza);
    const pathCount = coarsePointer ? 3 : 4 + (seed % 2);
    for (let index = 0; index < pathCount; index += 1) {
      const angle = (index / pathCount) * Math.PI * 2 + (seed % 11) * 0.09;
      const length = islandRadius * (0.58 + (index % 2) * 0.08);
      const path = new THREE.Mesh(assets.boxGeometry, index % 3 === 0 ? assets.materials.yellow : assets.materials.white);
      path.scale.set(0.075, 0.025, length);
      path.position.set(Math.sin(angle) * length * 0.55, 0.31, Math.cos(angle) * length * 0.55);
      path.rotation.y = angle;
      path.receiveShadow = true;
      parent.add(path);
    }
    if (coarsePointer) return;
    const tileMaterials = [assets.materials.blue, assets.materials.orange, assets.materials.green, assets.materials.yellow];
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2 + seed * 0.017;
      const tile = new THREE.Mesh(assets.boxGeometry, tileMaterials[(seed + index) % tileMaterials.length]);
      tile.scale.set(0.11, 0.018, 0.11);
      tile.position.set(Math.cos(angle) * islandRadius * 0.37, 0.325, Math.sin(angle) * islandRadius * 0.37);
      tile.rotation.y = angle;
      parent.add(tile);
    }
  }

  addDistrictThemeZone(parent, item, index, islandRadius, palette, seed) {
    const assets = this.ensurePropAssets();
    const theme = seed % 8;
    const angle = ((seed % 19) / 19) * Math.PI * 2;
    const distance = islandRadius * 0.62;
    const zone = new THREE.Group();
    zone.position.set(Math.cos(angle) * distance, 0.245, Math.sin(angle) * distance);
    zone.rotation.y = -angle + Math.PI / 2;
    zone.scale.setScalar(coarsePointer ? 0.31 : 0.37);
    parent.add(zone);
    const padMaterials = [assets.materials.orange, assets.materials.green, assets.materials.blue, assets.materials.yellow];
    const pad = new THREE.Mesh(assets.discGeometry, padMaterials[theme % padMaterials.length]);
    pad.scale.set(3.25, 0.38, 2.45);
    pad.position.y = 0.08;
    zone.add(pad);

    if (theme === 0) {
      this.addMiniCourt(zone, 0, 0, 2.3);
      this.addMiniPlayStructure(zone, -0.75, 0.22, 1.25);
      for (const side of [-1, 1]) {
        const stand = new THREE.Mesh(assets.boxGeometry, assets.materials.wood);
        stand.scale.set(0.9, 0.18, 0.2);
        stand.position.set(0.15, 0.26, side * 0.78);
        zone.add(stand);
      }
    }
    if (theme === 1) {
      this.addGarden(zone, -0.35, 0, seed);
      this.addOutdoorTable(zone, 0.9, 0.12, seed);
      this.addRecycleStation(zone, 0.65, -0.62);
    }
    if (theme === 2) {
      const pond = new THREE.Mesh(assets.discGeometry, assets.materials.blue);
      pond.scale.set(2.6, 0.25, 1.8);
      pond.position.y = 0.12;
      zone.add(pond);
      for (let stone = 0; stone < 5; stone += 1) {
        const steppingStone = new THREE.Mesh(assets.discGeometry, assets.materials.white);
        steppingStone.scale.set(0.42, 0.35, 0.32);
        steppingStone.position.set(-0.85 + stone * 0.42, 0.18, Math.sin(stone * 1.7) * 0.34);
        zone.add(steppingStone);
      }
      this.addMiniPlanter(zone, -0.9, -0.55, 1.3);
      this.addMiniPlanter(zone, 0.95, 0.48, 1.3);
    }
    if (theme === 3) {
      const stage = new THREE.Mesh(assets.boxGeometry, assets.materials.wood);
      stage.scale.set(1.55, 0.22, 0.78);
      stage.position.set(0, 0.24, 0.18);
      zone.add(stage);
      const sculpture = new THREE.Mesh(assets.ringGeometry, assets.materials.orange);
      sculpture.scale.setScalar(1.6);
      sculpture.position.set(-0.95, 0.85, -0.35);
      sculpture.rotation.y = Math.PI / 2;
      zone.add(sculpture);
      for (let tileIndex = 0; tileIndex < 6; tileIndex += 1) {
        const artTile = new THREE.Mesh(assets.boxGeometry, padMaterials[(tileIndex + 1) % padMaterials.length]);
        artTile.scale.set(0.28, 0.035, 0.28);
        artTile.position.set(-0.72 + tileIndex * 0.29, 0.16, -0.72 + (tileIndex % 2) * 0.12);
        zone.add(artTile);
      }
    }
    if (theme === 4) {
      this.addSchoolBus(zone, 0.15, 0.12, seed);
      this.addBikeParking(zone, -0.85, -0.45, seed);
      this.addMiniShelter(zone, 0.95, -0.52, 1.4);
    }
    if (theme === 5) {
      this.addSolarArray(zone, -0.2, 0.1, seed);
      this.addSchoolClock(zone, 0.95, -0.42, palette);
      this.addMiniSolarPanel(zone, -0.95, -0.55, 1.55);
    }
    if (theme === 6) {
      this.addNoticeBoard(zone, 0, 0.15, palette);
      this.addMiniShelter(zone, -0.92, -0.35, 1.35);
      this.addMiniBench(zone, 0.82, -0.44, 0.2, 1.45);
      this.addMiniBench(zone, 0.75, 0.45, -0.2, 1.25);
    }
    if (theme === 7) {
      this.addOutdoorTable(zone, -0.55, 0.1, seed);
      this.addOutdoorTable(zone, 0.5, 0.25, seed + 1);
      this.addDrinkingFountain(zone, 0.92, -0.48);
      this.addRecycleStation(zone, -0.9, -0.52);
    }

    const flag = new THREE.Mesh(assets.boxGeometry, new THREE.MeshStandardMaterial({ color: palette.roof, roughness: 0.78 }));
    flag.scale.set(0.08, 0.5, 0.55);
    flag.position.set(-1.45, 0.54, 0);
    zone.add(flag);
    zone.userData.themeIndex = theme;
    zone.userData.districtId = item.id;
    zone.userData.order = index;
  }

  addDistrictSchoolCluster(parent, districtItem, schools, palette, districtIndex, islandRadius) {
    const visibleCount = Math.min(schools.length, coarsePointer ? 3 : 5);
    if (!visibleCount) {
      this.addDistrictCluster(parent, districtItem, palette, districtIndex, 32);
      return;
    }
    const seed = hashNumber(String(districtItem.id || districtItem.label));
    for (let index = 0; index < visibleCount; index += 1) {
      const schoolItem = schools[index];
      const angle = (index / visibleCount) * Math.PI * 2 + (seed % 13) * 0.12;
      const distance = visibleCount === 1 ? 0 : islandRadius * (0.28 + (index % 2) * 0.13);
      const point = { x: Math.cos(angle) * distance, z: Math.sin(angle) * distance };
      if (distance > 0) this.addWalkway(parent, { x: 0, z: 0 }, point, 0.045, false, 0.29);
      const marker = this.addSchoolMarker(parent, point.x, point.z, schoolItem, palette, index, visibleCount, 0.55);
      this.registerFocusTarget(schoolItem, marker);
      this.addMapLabel(marker, schoolItem, new THREE.Vector3(0, 1.12, 0), "is-school-label", 3.9);
    }
    const extraCount = Math.max(0, schools.length - visibleCount);
    if (extraCount) {
      const annexes = Math.min(3, Math.ceil(extraCount / 4));
      for (let index = 0; index < annexes; index += 1) {
        const angle = (index / annexes) * Math.PI * 2 + 1.2;
        this.addBuilding(
          parent,
          Math.cos(angle) * islandRadius * 0.58,
          Math.sin(angle) * islandRadius * 0.58,
          0.12,
          0.22 + index * 0.035,
          palette.building,
          palette.roof,
          districtItem,
        ).scale.setScalar(0.62);
      }
    }
  }

  addDistrictProps(parent, item, index, islandRadius = 0.72) {
    const seed = hashNumber(String(item.id || item.label || index));
    const edge = islandRadius * 0.58;
    this.addMiniLamp(parent, -edge, -edge * 0.54, 0.68);
    this.addMiniLamp(parent, edge * 0.25, edge * 1.08, 0.64);
    if (!coarsePointer) {
      this.addMiniLamp(parent, edge * 1.18, -edge * 0.05, 0.62);
      this.addMiniBench(parent, edge * 0.82, edge * 0.64, (seed % 7) * 0.3, 0.7);
      this.addMiniBench(parent, -edge * 0.58, edge * 0.72, (seed % 5) * -0.25, 0.64);
    }
    this.addMiniPlanter(parent, seed % 2 ? -edge * 0.78 : edge, seed % 2 ? edge * 0.74 : -edge * 0.62, 0.68);
    this.addMiniPlanter(parent, edge * 0.34, -edge * 0.92, 0.62);
    if (!coarsePointer) this.addMiniPlanter(parent, -edge * 0.18, edge * 0.88, 0.58);
    if (coarsePointer && index % 2 === 1) return;
    const type = seed % 5;
    if (type === 0) this.addMiniShelter(parent, edge, -edge * 0.8, 0.7);
    if (type === 1) this.addMiniPlayStructure(parent, edge, -edge * 0.72, 0.66);
    if (type === 2) this.addMiniBikeRack(parent, edge, -edge * 0.76, 0.7);
    if (type === 3) this.addMiniCourt(parent, edge, -edge * 0.7, 0.68);
    if (type === 4) this.addMiniSolarPanel(parent, edge, -edge * 0.74, 0.7);
    const treeCount = coarsePointer ? 4 : 7 + (seed % 3);
    for (let tree = 0; tree < treeCount; tree += 1) {
      const angle = (tree / treeCount) * Math.PI * 2 + seed * 0.03;
      const radius = islandRadius * (0.67 + (tree % 3) * 0.075);
      this.addTree(parent, Math.cos(angle) * radius, Math.sin(angle) * radius, 0.14 + (tree % 3) * 0.028);
    }
  }

  ensurePropAssets() {
    if (!this.propAssets) this.propAssets = createPropAssets();
    return this.propAssets;
  }

  addMiniLamp(parent, x, z, scale = 1) {
    const assets = this.ensurePropAssets();
    const group = new THREE.Group();
    group.position.set(x, 0.29, z);
    group.scale.setScalar(scale);
    parent.add(group);
    const pole = new THREE.Mesh(assets.poleGeometry, assets.materials.darkMetal);
    pole.scale.set(0.42, 0.52, 0.42);
    pole.position.y = 0.26;
    group.add(pole);
    const light = new THREE.Mesh(assets.orbGeometry, assets.materials.lamp);
    light.scale.setScalar(0.13);
    light.position.y = 0.56;
    group.add(light);
  }

  addMiniBench(parent, x, z, rotation = 0, scale = 1) {
    const assets = this.ensurePropAssets();
    const group = new THREE.Group();
    group.position.set(x, 0.31, z);
    group.rotation.y = rotation;
    group.scale.setScalar(scale);
    parent.add(group);
    const seat = new THREE.Mesh(assets.boxGeometry, assets.materials.wood);
    seat.scale.set(0.3, 0.045, 0.11);
    seat.position.y = 0.12;
    group.add(seat);
    const back = new THREE.Mesh(assets.boxGeometry, assets.materials.wood);
    back.scale.set(0.3, 0.15, 0.035);
    back.position.set(0, 0.22, -0.045);
    group.add(back);
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(assets.boxGeometry, assets.materials.darkMetal);
      leg.scale.set(0.025, 0.12, 0.04);
      leg.position.set(side * 0.1, 0.055, 0);
      group.add(leg);
    }
  }

  addMiniPlanter(parent, x, z, scale = 1) {
    const assets = this.ensurePropAssets();
    const group = new THREE.Group();
    group.position.set(x, 0.3, z);
    group.scale.setScalar(scale);
    parent.add(group);
    const planter = new THREE.Mesh(assets.boxGeometry, assets.materials.terracotta);
    planter.scale.set(0.14, 0.11, 0.14);
    planter.position.y = 0.055;
    group.add(planter);
    const shrub = new THREE.Mesh(assets.orbGeometry, assets.materials.leaf);
    shrub.scale.set(0.12, 0.1, 0.12);
    shrub.position.y = 0.17;
    group.add(shrub);
  }

  addMiniShelter(parent, x, z, scale = 1) {
    const assets = this.ensurePropAssets();
    const group = new THREE.Group();
    group.position.set(x, 0.3, z);
    group.scale.setScalar(scale);
    parent.add(group);
    const roof = new THREE.Mesh(assets.boxGeometry, assets.materials.blue);
    roof.scale.set(0.3, 0.04, 0.18);
    roof.position.y = 0.36;
    group.add(roof);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(assets.poleGeometry, assets.materials.darkMetal);
      post.scale.set(0.28, 0.34, 0.28);
      post.position.set(side * 0.12, 0.17, 0);
      group.add(post);
    }
  }

  addMiniPlayStructure(parent, x, z, scale = 1) {
    const assets = this.ensurePropAssets();
    const group = new THREE.Group();
    group.position.set(x, 0.3, z);
    group.scale.setScalar(scale);
    parent.add(group);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(assets.poleGeometry, side < 0 ? assets.materials.orange : assets.materials.yellow);
      post.scale.set(0.38, 0.32, 0.38);
      post.position.set(side * 0.1, 0.16, 0);
      post.rotation.z = side * 0.3;
      group.add(post);
    }
    const bar = new THREE.Mesh(assets.boxGeometry, assets.materials.blue);
    bar.scale.set(0.24, 0.035, 0.035);
    bar.position.y = 0.3;
    group.add(bar);
  }

  addMiniBikeRack(parent, x, z, scale = 1) {
    const assets = this.ensurePropAssets();
    const group = new THREE.Group();
    group.position.set(x, 0.32, z);
    group.scale.setScalar(scale);
    parent.add(group);
    for (let rack = -1; rack <= 1; rack += 1) {
      const loop = new THREE.Mesh(assets.wheelGeometry, assets.materials.metal);
      loop.scale.setScalar(0.45);
      loop.position.set(rack * 0.09, 0.09, 0);
      group.add(loop);
    }
  }

  addMiniCourt(parent, x, z, scale = 1) {
    const assets = this.ensurePropAssets();
    const court = new THREE.Mesh(assets.boxGeometry, assets.materials.court);
    court.scale.set(0.34 * scale, 0.018, 0.24 * scale);
    court.position.set(x, 0.31, z);
    parent.add(court);
  }

  addMiniSolarPanel(parent, x, z, scale = 1) {
    const assets = this.ensurePropAssets();
    const panel = new THREE.Mesh(assets.boxGeometry, assets.materials.solar);
    panel.scale.set(0.28 * scale, 0.025, 0.2 * scale);
    panel.position.set(x, 0.43, z);
    panel.rotation.x = -0.55;
    parent.add(panel);
  }

  addSchoolMarker(parent, x, z, item, palette, index, total, extraScale = 1) {
    const seed = hashNumber(String(item.school?.fatraceSchoolId || item.id || index));
    const type = Number.isInteger(item.visualType) ? item.visualType % 6 : seed % 6;
    const scale = (total > 18 ? 0.68 : total > 9 ? 0.82 : 1) * extraScale;
    const wallColor = item.status === "available" ? palette.building : COLORS.missing;
    const roofColor = item.status === "available" ? palette.roof : 0x7f8580;
    const group = new THREE.Group();
    group.position.set(x, 0.36, z);
    group.rotation.y = ((seed % 11) - 5) * 0.08;
    group.scale.setScalar(scale);
    parent.add(group);

    const block = (bx, bz, width, depth, height, flat = false) => {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.74 }),
      );
      body.position.set(bx, height / 2, bz);
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);
      this.makePickable(body, item);
      const roof = new THREE.Mesh(
        flat ? new THREE.BoxGeometry(width * 1.04, 0.08, depth * 1.05) : new THREE.ConeGeometry(Math.max(width, depth) * 0.62, 0.22, 4),
        new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.8 }),
      );
      roof.position.set(bx, height + (flat ? 0.04 : 0.1), bz);
      roof.rotation.y = flat ? 0 : Math.PI / 4;
      roof.castShadow = true;
      group.add(roof);
      this.makePickable(roof, item);
      const windowBand = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.72, height * 0.16, depth + 0.012),
        new THREE.MeshStandardMaterial({ color: 0x6f9fb4, roughness: 0.35, metalness: 0.04 }),
      );
      windowBand.position.set(bx, height * 0.58, bz + depth * 0.51);
      group.add(windowBand);
    };

    if (type === 0) {
      block(-0.22, 0, 0.18, 0.48, 0.66, true);
      block(0.22, 0, 0.18, 0.48, 0.66, true);
      block(0, 0.18, 0.52, 0.17, 0.52, true);
    } else if (type === 1) {
      block(0, 0, 0.35, 0.35, 0.92, true);
      block(0.29, 0.08, 0.28, 0.35, 0.48, true);
    } else if (type === 2) {
      block(0, 0, 0.72, 0.25, 0.62, true);
    } else if (type === 3) {
      block(-0.24, -0.08, 0.34, 0.28, 0.58, false);
      block(0.22, 0.12, 0.38, 0.31, 0.7, true);
    } else if (type === 4) {
      block(-0.18, 0, 0.42, 0.34, 0.44, false);
      block(0.27, 0.05, 0.27, 0.28, 0.36, false);
    } else {
      block(-0.12, 0, 0.48, 0.38, 0.74, true);
      block(0.22, -0.06, 0.34, 0.3, 0.48, true);
    }
    return group;
  }

  addCampusBuilding(parent, config, palette, seed) {
    const group = new THREE.Group();
    group.position.set(config.x, 0.35, config.z);
    group.rotation.y = ((seed % 7) - 3) * 0.035;
    parent.add(group);
    const floorHeight = 0.42;
    const totalHeight = config.floors * floorHeight;
    const bodyColor = config.type === "cafeteria" ? 0xffe4bd : config.type === "library" ? 0xe7f0e8 : palette.building;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(config.width, totalHeight, config.depth),
      new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.72 }),
    );
    body.position.y = totalHeight / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const roofMaterial = new THREE.MeshStandardMaterial({ color: palette.roof, roughness: 0.8 });
    const roof = new THREE.Mesh(
      config.type === "gym"
        ? new THREE.CylinderGeometry(config.depth * 0.52, config.depth * 0.52, config.width, 12, 1, false, 0, Math.PI)
        : new THREE.BoxGeometry(config.width * 1.04, 0.1, config.depth * 1.04),
      roofMaterial,
    );
    roof.position.y = totalHeight + (config.type === "gym" ? 0.08 : 0.05);
    if (config.type === "gym") roof.rotation.z = Math.PI / 2;
    roof.castShadow = true;
    group.add(roof);

    const windowRows = Math.max(1, config.floors);
    for (let floor = 0; floor < windowRows; floor += 1) {
      const windowCount = Math.max(2, Math.round(config.width / 0.35));
      for (let windowIndex = 0; windowIndex < windowCount; windowIndex += 1) {
        const windowMesh = new THREE.Mesh(
          new THREE.BoxGeometry(config.width / (windowCount * 1.6), 0.13, 0.018),
          new THREE.MeshStandardMaterial({ color: 0x6f9fb4, roughness: 0.32, metalness: 0.04 }),
        );
        windowMesh.position.set(
          -config.width * 0.36 + windowIndex * (config.width * 0.72 / Math.max(windowCount - 1, 1)),
          0.22 + floor * floorHeight,
          config.depth / 2 + 0.012,
        );
        group.add(windowMesh);
      }
    }

    if (config.type === "cafeteria") {
      const chimney = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.085, 0.62, 8),
        new THREE.MeshStandardMaterial({ color: 0xa86c4c, roughness: 0.88 }),
      );
      chimney.position.set(config.width * 0.3, totalHeight + 0.3, 0);
      group.add(chimney);
    }
    if (config.type === "admin") this.addFlag(group, -config.width * 0.6, 0, totalHeight);
  }

  addFlag(parent, x, z, baseHeight = 0) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.025, 1.05, 8),
      new THREE.MeshStandardMaterial({ color: 0xd9d9d2, metalness: 0.25, roughness: 0.45 }),
    );
    pole.position.set(x, baseHeight * 0.2 + 0.52, z);
    parent.add(pole);
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 0.2),
      new THREE.MeshStandardMaterial({ color: COLORS.orange, side: THREE.DoubleSide, roughness: 0.75 }),
    );
    flag.position.set(x + 0.18, baseHeight * 0.2 + 0.88, z);
    parent.add(flag);
  }

  addGatehouse(parent, x, z, palette) {
    const gate = new THREE.Group();
    gate.position.set(x, 0.35, z);
    parent.add(gate);
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.68, 0.18),
        new THREE.MeshStandardMaterial({ color: palette.building, roughness: 0.78 }),
      );
      pillar.position.set(side * 0.52, 0.34, 0);
      pillar.castShadow = true;
      gate.add(pillar);
    }
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.16, 0.2),
      new THREE.MeshStandardMaterial({ color: palette.roof, roughness: 0.8 }),
    );
    lintel.position.y = 0.68;
    gate.add(lintel);
  }

  addPlayground(parent, x, z, seed) {
    const group = new THREE.Group();
    group.position.set(x, 0.31, z);
    group.rotation.y = ((seed % 5) - 2) * 0.08;
    parent.add(group);
    const track = new THREE.Mesh(
      new THREE.RingGeometry(0.78, 1.02, 32),
      new THREE.MeshStandardMaterial({ color: 0xc77a58, roughness: 0.96, side: THREE.DoubleSide }),
    );
    track.rotation.x = -Math.PI / 2;
    track.scale.x = 1.45;
    group.add(track);
    const field = new THREE.Mesh(
      new THREE.CircleGeometry(0.75, 32),
      new THREE.MeshStandardMaterial({ color: 0x75a46f, roughness: 1 }),
    );
    field.rotation.x = -Math.PI / 2;
    field.scale.x = 1.42;
    field.position.y = 0.005;
    group.add(field);
  }

  addGarden(parent, x, z, seed) {
    const group = new THREE.Group();
    group.position.set(x, 0.34, z);
    group.rotation.y = (seed % 5) * 0.12;
    parent.add(group);
    for (let index = 0; index < 4; index += 1) {
      const planter = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.12, 0.18),
        new THREE.MeshStandardMaterial({ color: 0x8c6748, roughness: 0.95 }),
      );
      planter.position.set((index % 2 - 0.5) * 0.56, 0.06, (Math.floor(index / 2) - 0.5) * 0.34);
      group.add(planter);
      const plant = new THREE.Mesh(
        new THREE.ConeGeometry(0.1, 0.28, 6),
        new THREE.MeshStandardMaterial({ color: 0x4f7f66, roughness: 0.9 }),
      );
      plant.position.copy(planter.position);
      plant.position.y = 0.23;
      group.add(plant);
    }
  }

  addCampusProps(parent, nodes, seed, palette) {
    const lampPositions = coarsePointer
      ? [[-1.2, -3.9], [1.1, -1.1], [-1.5, 1.1], [1.8, 2.15], [-2.8, 3.8]]
      : [[-1.2, -4.25], [1.15, -3.85], [-1.25, -1.2], [1.15, -0.45], [-1.6, 1.0], [1.7, 1.05], [-2.75, 3.8], [2.85, 3.75]];
    lampPositions.forEach(([x, z]) => this.addMiniLamp(parent, x, z, 1.45));
    [[-1.85, -3.55, 0.2], [1.7, -3.5, -0.2], [-2.1, 1.65, 1.5], [2.05, 1.75, -1.5], [-1.8, 3.7, 0.1]]
      .slice(0, coarsePointer ? 3 : 5)
      .forEach(([x, z, rotation]) => this.addMiniBench(parent, x, z, rotation, 1.35));
    [[-1.25, -2.6], [1.25, -2.55], [-1.4, 2.2], [1.4, 2.35]]
      .forEach(([x, z]) => this.addMiniPlanter(parent, x, z, 1.2));

    this.addSchoolBus(parent, -1.35, -4.72, seed);
    this.addNoticeBoard(parent, nodes.admin.x + 0.85, nodes.admin.z + 0.75, palette);
    this.addBikeParking(parent, nodes.gate.x + 1.45, nodes.gate.z + 0.45, seed);
    this.addRecycleStation(parent, nodes.lunch.x - 1.15, nodes.lunch.z + 0.55);
    this.addDrinkingFountain(parent, nodes.gym.x - 1.05, nodes.gym.z - 0.45);
    this.addSolarArray(parent, nodes.library.x + 0.95, nodes.library.z + 1.05, seed);
    this.addSchoolClock(parent, nodes.center.x - 0.7, nodes.center.z + 0.15, palette);
    const tables = coarsePointer ? [[0.9, 2.75]] : [[0.9, 2.75], [-0.9, 2.85], [1.35, 2.35]];
    tables.forEach(([x, z], index) => this.addOutdoorTable(parent, x, z, index + seed));
    this.addCampusFence(parent, { x: -3.8, z: -4.78 }, { x: -0.75, z: -5.25 });
    this.addCampusFence(parent, { x: 0.75, z: -5.25 }, { x: 3.8, z: -4.78 });
  }

  addSchoolBus(parent, x, z, seed) {
    const assets = this.ensurePropAssets();
    const group = new THREE.Group();
    group.position.set(x, 0.35, z);
    group.rotation.y = -0.08 + (seed % 3) * 0.04;
    parent.add(group);
    const body = new THREE.Mesh(assets.boxGeometry, assets.materials.yellow);
    body.scale.set(0.96, 0.34, 0.42);
    body.position.y = 0.27;
    body.castShadow = true;
    group.add(body);
    const roof = new THREE.Mesh(assets.boxGeometry, assets.materials.white);
    roof.scale.set(0.72, 0.12, 0.4);
    roof.position.set(-0.08, 0.5, 0);
    group.add(roof);
    for (const side of [-1, 1]) {
      const windowBand = new THREE.Mesh(assets.boxGeometry, assets.materials.glass);
      windowBand.scale.set(0.56, 0.13, 0.025);
      windowBand.position.set(-0.08, 0.39, side * 0.225);
      group.add(windowBand);
      for (const axle of [-1, 1]) {
        const wheel = new THREE.Mesh(assets.wheelGeometry, assets.materials.tire);
        wheel.scale.setScalar(0.72);
        wheel.position.set(axle * 0.31, 0.12, side * 0.235);
        group.add(wheel);
      }
    }
  }

  addNoticeBoard(parent, x, z, palette) {
    const assets = this.ensurePropAssets();
    const group = new THREE.Group();
    group.position.set(x, 0.34, z);
    parent.add(group);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(assets.poleGeometry, assets.materials.darkMetal);
      post.scale.set(0.55, 0.72, 0.55);
      post.position.set(side * 0.28, 0.36, 0);
      group.add(post);
    }
    const board = new THREE.Mesh(assets.boxGeometry, assets.materials.white);
    board.scale.set(0.72, 0.42, 0.06);
    board.position.y = 0.58;
    group.add(board);
    const header = new THREE.Mesh(assets.boxGeometry, new THREE.MeshStandardMaterial({ color: palette.roof, roughness: 0.78 }));
    header.scale.set(0.76, 0.09, 0.075);
    header.position.y = 0.84;
    group.add(header);
  }

  addBikeParking(parent, x, z, seed) {
    const assets = this.ensurePropAssets();
    const group = new THREE.Group();
    group.position.set(x, 0.34, z);
    group.rotation.y = (seed % 5) * 0.08;
    parent.add(group);
    for (let bike = 0; bike < (coarsePointer ? 2 : 4); bike += 1) {
      const offset = (bike - 1.5) * 0.25;
      for (const wheelOffset of [-0.09, 0.09]) {
        const wheel = new THREE.Mesh(assets.wheelGeometry, assets.materials.tire);
        wheel.scale.setScalar(0.5);
        wheel.position.set(offset, 0.12, wheelOffset);
        group.add(wheel);
      }
      const frame = new THREE.Mesh(assets.boxGeometry, bike % 2 ? assets.materials.orange : assets.materials.blue);
      frame.scale.set(0.035, 0.035, 0.2);
      frame.position.set(offset, 0.16, 0);
      frame.rotation.x = 0.42;
      group.add(frame);
    }
  }

  addRecycleStation(parent, x, z) {
    const assets = this.ensurePropAssets();
    const group = new THREE.Group();
    group.position.set(x, 0.34, z);
    parent.add(group);
    [assets.materials.blue, assets.materials.green, assets.materials.yellow].forEach((material, index) => {
      const bin = new THREE.Mesh(assets.boxGeometry, material);
      bin.scale.set(0.18, 0.28, 0.18);
      bin.position.set((index - 1) * 0.22, 0.14, 0);
      group.add(bin);
      const lid = new THREE.Mesh(assets.boxGeometry, assets.materials.darkMetal);
      lid.scale.set(0.19, 0.035, 0.19);
      lid.position.set((index - 1) * 0.22, 0.3, 0);
      group.add(lid);
    });
  }

  addOutdoorTable(parent, x, z, seed) {
    const assets = this.ensurePropAssets();
    const group = new THREE.Group();
    group.position.set(x, 0.34, z);
    group.rotation.y = (seed % 7) * 0.28;
    parent.add(group);
    const top = new THREE.Mesh(assets.tableGeometry, assets.materials.wood);
    top.scale.set(0.9, 0.12, 0.9);
    top.position.y = 0.34;
    group.add(top);
    const stem = new THREE.Mesh(assets.poleGeometry, assets.materials.darkMetal);
    stem.scale.set(0.8, 0.32, 0.8);
    stem.position.y = 0.16;
    group.add(stem);
    for (let seat = 0; seat < 4; seat += 1) {
      const angle = seat * Math.PI / 2;
      const stool = new THREE.Mesh(assets.tableGeometry, assets.materials.orange);
      stool.scale.set(0.42, 0.12, 0.42);
      stool.position.set(Math.cos(angle) * 0.42, 0.18, Math.sin(angle) * 0.42);
      group.add(stool);
    }
  }

  addDrinkingFountain(parent, x, z) {
    const assets = this.ensurePropAssets();
    const group = new THREE.Group();
    group.position.set(x, 0.34, z);
    parent.add(group);
    const base = new THREE.Mesh(assets.boxGeometry, assets.materials.metal);
    base.scale.set(0.28, 0.48, 0.22);
    base.position.y = 0.24;
    group.add(base);
    const basin = new THREE.Mesh(assets.tableGeometry, assets.materials.blue);
    basin.scale.set(0.85, 0.16, 0.65);
    basin.position.y = 0.52;
    group.add(basin);
    const tap = new THREE.Mesh(assets.orbGeometry, assets.materials.darkMetal);
    tap.scale.setScalar(0.18);
    tap.position.set(0, 0.61, 0);
    group.add(tap);
  }

  addSolarArray(parent, x, z, seed) {
    const assets = this.ensurePropAssets();
    const group = new THREE.Group();
    group.position.set(x, 0.34, z);
    group.rotation.y = (seed % 5) * 0.12;
    parent.add(group);
    for (let panelIndex = 0; panelIndex < (coarsePointer ? 2 : 4); panelIndex += 1) {
      const panel = new THREE.Mesh(assets.boxGeometry, assets.materials.solar);
      panel.scale.set(0.42, 0.025, 0.28);
      panel.position.set((panelIndex % 2 - 0.5) * 0.92, 0.28, (Math.floor(panelIndex / 2) - 0.5) * 0.65);
      panel.rotation.x = -0.58;
      group.add(panel);
    }
  }

  addSchoolClock(parent, x, z, palette) {
    const assets = this.ensurePropAssets();
    const group = new THREE.Group();
    group.position.set(x, 0.34, z);
    parent.add(group);
    const post = new THREE.Mesh(assets.poleGeometry, assets.materials.darkMetal);
    post.scale.set(0.75, 0.9, 0.75);
    post.position.y = 0.45;
    group.add(post);
    const clock = new THREE.Mesh(assets.discGeometry, assets.materials.white);
    clock.position.y = 0.96;
    clock.rotation.x = Math.PI / 2;
    group.add(clock);
    const rim = new THREE.Mesh(assets.ringGeometry, new THREE.MeshStandardMaterial({ color: palette.roof, roughness: 0.72 }));
    rim.position.set(0, 0.96, 0.035);
    group.add(rim);
  }

  addCampusFence(parent, from, to) {
    const assets = this.ensurePropAssets();
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const length = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, dz);
    const group = new THREE.Group();
    parent.add(group);
    const rail = new THREE.Mesh(assets.boxGeometry, assets.materials.white);
    rail.scale.set(0.045, 0.07, length);
    rail.position.set((from.x + to.x) / 2, 0.55, (from.z + to.z) / 2);
    rail.rotation.y = angle;
    group.add(rail);
    const posts = Math.max(3, Math.round(length / 0.5));
    for (let index = 0; index <= posts; index += 1) {
      const progress = index / posts;
      const post = new THREE.Mesh(assets.poleGeometry, assets.materials.white);
      post.scale.set(0.65, 0.5, 0.65);
      post.position.set(from.x + dx * progress, 0.54, from.z + dz * progress);
      group.add(post);
    }
  }

  addNoMealSign(parent, x, z) {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.44, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xf5ead1, roughness: 0.82 }),
    );
    sign.position.set(x, 0.9, z);
    sign.castShadow = true;
    parent.add(sign);
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.045, 0.75, 8),
      new THREE.MeshStandardMaterial({ color: 0x76563b, roughness: 0.9 }),
    );
    post.position.set(x, 0.55, z);
    parent.add(post);
  }

  addCharacter(parent, item, routePoints, index) {
    if (!this.characterAssets) this.characterAssets = createCharacterAssets();
    const assets = this.characterAssets;
    const group = new THREE.Group();
    const route = routePoints.map((point) => {
      const vector = new THREE.Vector3(point.x, 0.35, point.z);
      vector.userData = { label: point.label };
      return vector;
    });
    const startIndex = item.routeSeed % route.length;
    group.position.copy(route[startIndex]);
    group.scale.setScalar(item.scale || (coarsePointer ? 0.86 : 0.92));
    parent.add(group);

    const colorIndex = item.colorSeed % assets.clothing.length;
    const skinIndex = item.colorSeed % assets.skin.length;
    const body = new THREE.Mesh(assets.bodyGeometry, assets.clothing[colorIndex]);
    body.position.y = 0.42;
    body.castShadow = !coarsePointer;
    group.add(body);
    const head = new THREE.Mesh(assets.headGeometry, assets.skin[skinIndex]);
    head.position.y = 0.72;
    head.castShadow = !coarsePointer;
    group.add(head);
    const hair = new THREE.Mesh(assets.hairGeometry, assets.hair[item.colorSeed % assets.hair.length]);
    hair.position.y = 0.79;
    group.add(hair);

    const expression = (item.expressionSeed ?? item.colorSeed) % 4;
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(assets.eyeGeometry, assets.faceDark);
      eye.position.set(side * 0.045, 0.735, 0.112);
      if (expression === 1 && side === 1) eye.scale.y = 0.16;
      if (expression === 3) eye.scale.set(1.16, 1.22, 0.8);
      group.add(eye);
      if (expression === 2 || expression === 3) {
        const brow = new THREE.Mesh(assets.browGeometry, assets.faceDark);
        brow.position.set(side * 0.047, 0.775, 0.112);
        brow.rotation.z = side * (expression === 2 ? -0.22 : 0.2);
        group.add(brow);
      }
    }
    const mouth = new THREE.Mesh(expression === 3 ? assets.mouthOpenGeometry : assets.mouthGeometry, assets.faceDark);
    mouth.position.set(0, 0.68, 0.119);
    if (expression === 0) mouth.rotation.z = 0.16;
    if (expression === 1) mouth.rotation.z = -0.12;
    if (expression === 2) mouth.scale.x = 0.72;
    group.add(mouth);
    if (expression === 0 || expression === 1) {
      for (const side of [-1, 1]) {
        const cheek = new THREE.Mesh(assets.cheekGeometry, assets.cheek);
        cheek.position.set(side * 0.082, 0.692, 0.103);
        group.add(cheek);
      }
    }

    const leftLeg = new THREE.Group();
    const rightLeg = new THREE.Group();
    leftLeg.position.set(-0.055, 0.29, 0);
    rightLeg.position.set(0.055, 0.29, 0);
    for (const leg of [leftLeg, rightLeg]) {
      const mesh = new THREE.Mesh(assets.legGeometry, assets.trouser);
      mesh.position.y = -0.12;
      leg.add(mesh);
    }
    group.add(leftLeg, rightLeg);

    const leftArm = new THREE.Group();
    const rightArm = new THREE.Group();
    leftArm.position.set(-0.145, 0.54, 0);
    rightArm.position.set(0.145, 0.54, 0);
    for (const [arm, side] of [[leftArm, -1], [rightArm, 1]]) {
      arm.rotation.z = side * 0.08;
      const sleeve = new THREE.Mesh(assets.armGeometry, assets.clothing[colorIndex]);
      sleeve.position.y = -0.09;
      arm.add(sleeve);
      const hand = new THREE.Mesh(assets.handGeometry, assets.skin[skinIndex]);
      hand.position.y = -0.2;
      arm.add(hand);
    }
    group.add(leftArm, rightArm);
    const hitTarget = new THREE.Mesh(assets.hitGeometry, assets.hitMaterial);
    hitTarget.position.y = 0.43;
    group.add(hitTarget);
    this.makePickable(body, item);
    this.makePickable(head, item);
    this.makePickable(hitTarget, item);

    const direction = startIndex >= route.length - 1 ? -1 : 1;
    const firstTarget = route[startIndex + direction] || route[startIndex];
    const heading = Math.atan2(firstTarget.x - route[startIndex].x, firstTarget.z - route[startIndex].z);
    group.rotation.y = heading;
    this.characters.push({
      group,
      item,
      route,
      segment: startIndex,
      direction,
      progress: ((index * 37) % 100) / 100,
      speed: item.speed || 0.7,
      phase: index * 0.71,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      body,
      head,
      baseY: 0.35,
      heading,
    });
  }

  addPet(parent, item, routePoints, index) {
    const group = new THREE.Group();
    const route = routePoints.map((point) => {
      const vector = new THREE.Vector3(point.x, 0.35, point.z);
      vector.userData = { label: point.label };
      return vector;
    });
    const startIndex = item.routeSeed % route.length;
    group.position.copy(route[startIndex]);
    group.scale.setScalar(item.scale || (coarsePointer ? 0.82 : 0.9));
    parent.add(group);

    const isCat = item.species.includes("貓");
    const coatColors = isCat ? [0xd58b43, 0x77736d, 0xd9c7a7, 0x403b39] : [0xb87b45, 0xe2c89f, 0x6d5541, 0xeee4d1];
    const coat = new THREE.MeshStandardMaterial({ color: coatColors[item.colorSeed % coatColors.length], roughness: 0.9 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3c3732, roughness: 0.94 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.19, 9, 7), coat);
    body.position.y = 0.2;
    body.scale.set(0.92, 0.72, isCat ? 1.42 : 1.52);
    body.castShadow = !coarsePointer;
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(isCat ? 0.145 : 0.155, 9, 7), coat);
    head.position.set(0, 0.3, 0.26);
    head.castShadow = !coarsePointer;
    group.add(head);

    if (isCat) {
      for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.13, 4), coat);
        ear.position.set(side * 0.08, 0.43, 0.26);
        ear.rotation.y = Math.PI / 4;
        group.add(ear);
      }
    } else {
      for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.13, 0.045), coat);
        ear.position.set(side * 0.13, 0.27, 0.25);
        ear.rotation.z = side * 0.38;
        group.add(ear);
      }
      const snout = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), coat);
      snout.position.set(0, 0.27, 0.38);
      snout.scale.set(0.9, 0.65, 1.1);
      group.add(snout);
    }

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.025, 7, 5), dark);
    nose.position.set(0, isCat ? 0.29 : 0.28, isCat ? 0.39 : 0.46);
    group.add(nose);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), dark);
      eye.position.set(side * 0.057, 0.34, isCat ? 0.377 : 0.395);
      group.add(eye);
    }

    const legGeometry = new THREE.BoxGeometry(0.055, 0.16, 0.055);
    const leftLeg = new THREE.Mesh(legGeometry, coat);
    const rightLeg = new THREE.Mesh(legGeometry, coat);
    leftLeg.position.set(-0.09, 0.08, 0.13);
    rightLeg.position.set(0.09, 0.08, 0.13);
    group.add(leftLeg, rightLeg);
    for (const side of [-1, 1]) {
      const rearLeg = new THREE.Mesh(legGeometry, coat);
      rearLeg.position.set(side * 0.09, 0.08, -0.16);
      group.add(rearLeg);
    }

    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, isCat ? 0.42 : 0.31, 7), coat);
    tail.position.set(0, isCat ? 0.31 : 0.25, -0.32);
    tail.rotation.x = isCat ? -0.96 : -1.12;
    tail.rotation.z = isCat ? 0.22 : 0;
    group.add(tail);
    this.makePickable(body, item);
    this.makePickable(head, item);

    const direction = startIndex >= route.length - 1 ? -1 : 1;
    const firstTarget = route[startIndex + direction] || route[startIndex];
    const heading = Math.atan2(firstTarget.x - route[startIndex].x, firstTarget.z - route[startIndex].z);
    group.rotation.y = heading;
    this.characters.push({
      group,
      item,
      route,
      segment: startIndex,
      direction,
      progress: ((index * 53 + 19) % 100) / 100,
      speed: item.speed || 0.42,
      phase: index * 0.93 + 1.4,
      leftLeg,
      rightLeg,
      baseY: 0.35,
      heading,
    });
  }

  followCharacter(item) {
    const character = this.characters.find((candidate) => candidate.item.id === item.id);
    if (!character) return false;
    this.followedCharacter = character;
    this.showFollowMarker(character);
    this.targetRadius = coarsePointer ? 3.6 : 2.6;
    this.targetPitch = 0.82;
    this.lastCharacterFrame = performance.now();
    this.requestFrame();
    return true;
  }

  isFollowing() {
    return Boolean(this.followedCharacter);
  }

  stopFollowing(resetView = false) {
    if (!this.followedCharacter) return false;
    this.followedCharacter = null;
    this.clearFollowMarker();
    if (resetView) this.resetCamera(this.activeLayer);
    else this.targetCameraTarget.copy(this.cameraTarget);
    this.requestFrame();
    return true;
  }

  showFollowMarker(character) {
    this.clearFollowMarker();
    const marker = new THREE.Group();
    marker.position.y = character.item.kind === "pet" ? 0.72 : 1.05;
    const material = new THREE.MeshStandardMaterial({ color: COLORS.orange, emissive: COLORS.orange, emissiveIntensity: 0.28, roughness: 0.65 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.045, 6, 18), material);
    ring.rotation.x = Math.PI / 2;
    marker.add(ring);
    const pointer = new THREE.Mesh(new THREE.ConeGeometry(0.105, 0.21, 7), material);
    pointer.position.y = -0.21;
    pointer.rotation.z = Math.PI;
    marker.add(pointer);
    character.group.add(marker);
    this.followMarker = marker;
  }

  clearFollowMarker() {
    if (!this.followMarker) return;
    this.followMarker.parent?.remove(this.followMarker);
    this.followMarker.traverse((object) => {
      object.geometry?.dispose?.();
      object.material?.dispose?.();
    });
    this.followMarker = null;
  }

  setPeopleMotion(enabled) {
    this.peopleMotion = Boolean(enabled) && !prefersReducedMotion;
    if (this.peopleMotion && this.characters.length) {
      this.lastCharacterFrame = performance.now();
      this.requestFrame();
    }
  }

  updateCharacters(time) {
    const delta = Math.min(0.05, Math.max(0, (time - this.lastCharacterFrame) / 1000));
    this.lastCharacterFrame = time;
    for (const character of this.characters) {
      const nextIndex = character.segment + character.direction;
      const from = character.route[character.segment];
      const to = character.route[nextIndex];
      if (!from || !to) continue;
      const segmentLength = Math.max(0.2, from.distanceTo(to));
      character.progress += character.speed * delta / segmentLength;
      if (character.progress >= 1) {
        character.segment = nextIndex;
        character.progress -= 1;
        if (character.segment >= character.route.length - 1) character.direction = -1;
        if (character.segment <= 0) character.direction = 1;
        character.item.destinationLabel = character.route[character.segment + character.direction]?.userData?.label || character.item.destinationLabel;
      }
      const activeFrom = character.route[character.segment];
      const activeTo = character.route[character.segment + character.direction];
      if (!activeFrom || !activeTo) continue;
      character.group.position.lerpVectors(activeFrom, activeTo, character.progress);
      const angle = Math.atan2(activeTo.x - activeFrom.x, activeTo.z - activeFrom.z);
      const headingDelta = Math.atan2(Math.sin(angle - character.heading), Math.cos(angle - character.heading));
      character.heading += headingDelta * Math.min(1, delta * 5.2);
      character.group.rotation.y = character.heading;
      const stride = Math.sin(time * 0.009 * (0.9 + character.speed) + character.phase);
      const lift = Math.abs(Math.sin(time * 0.018 * (0.9 + character.speed) + character.phase));
      character.group.position.y = (character.baseY || 0.35) + lift * (character.item.kind === "pet" ? 0.012 : 0.026);
      character.leftLeg.rotation.x = stride * (character.item.kind === "pet" ? 0.36 : 0.62);
      character.rightLeg.rotation.x = -stride * (character.item.kind === "pet" ? 0.36 : 0.62);
      if (character.leftArm && character.rightArm) {
        character.leftArm.rotation.x = -stride * 0.54;
        character.rightArm.rotation.x = stride * 0.54;
        character.leftArm.rotation.z = -0.08 + stride * 0.025;
        character.rightArm.rotation.z = 0.08 + stride * 0.025;
      }
      if (character.body) character.body.rotation.z = stride * 0.025;
      if (character.head) character.head.rotation.z = -stride * 0.018;
    }
  }

  addBuilding(parent, x, z, width, height, wallColor, roofColor, item) {
    const group = new THREE.Group();
    group.position.set(x, 0.43 + height / 2, z);
    parent.add(group);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(width * 1.35, height, width),
      new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.72 }),
    );
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(width * 1.03, width * 0.72, 4),
      new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.78 }),
    );
    roof.position.y = height / 2 + width * 0.34;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);
    if (item) {
      this.makePickable(body, item);
      this.makePickable(roof, item);
    }
    return group;
  }

  addTree(parent, x, z, scale = 0.3) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(scale * 0.14, scale * 0.18, scale * 0.9, 7),
      new THREE.MeshStandardMaterial({ color: 0x785f45, roughness: 1 }),
    );
    trunk.position.set(x, 0.48, z);
    parent.add(trunk);
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(scale * 0.7, scale * 1.7, 7),
      new THREE.MeshStandardMaterial({ color: COLORS.grassDark, roughness: 0.9 }),
    );
    crown.position.set(x, 0.98, z);
    crown.castShadow = true;
    parent.add(crown);
  }

  addLighthouse(parent, x, z, item) {
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.18, 0.75, 10),
      new THREE.MeshStandardMaterial({ color: 0xf8f1df, roughness: 0.75 }),
    );
    tower.position.set(x, 0.63, z);
    tower.castShadow = true;
    parent.add(tower);
    const light = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 12, 8),
      new THREE.MeshStandardMaterial({ color: COLORS.yellow, emissive: COLORS.yellow, emissiveIntensity: 0.65 }),
    );
    light.position.set(x, 1.04, z);
    parent.add(light);
    if (item) {
      this.makePickable(tower, item);
      this.makePickable(light, item);
    }
  }

  addDishLandmark(parent, x, z, item, index, scale = 1) {
    const color = DISH_COLORS[item.category] || [COLORS.orange, COLORS.yellow, COLORS.greenDark][index % 3];
    const group = new THREE.Group();
    group.position.set(x, 0.44, z);
    group.scale.setScalar(scale);
    parent.add(group);
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.58, 0.18, 20),
      new THREE.MeshStandardMaterial({ color: 0xf8edcf, roughness: 0.85 }),
    );
    base.castShadow = true;
    group.add(base);

    let landmark;
    if (item.category === "湯品") {
      landmark = new THREE.Mesh(
        new THREE.CylinderGeometry(0.38, 0.3, 0.42, 20),
        new THREE.MeshStandardMaterial({ color, roughness: 0.55 }),
      );
    } else if (item.category === "主食") {
      landmark = new THREE.Mesh(
        new THREE.SphereGeometry(0.38, 18, 12),
        new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
      );
      landmark.scale.y = 0.68;
    } else if (["水果", "乳品", "飲品"].includes(item.category)) {
      landmark = new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 18, 12),
        new THREE.MeshStandardMaterial({ color, roughness: 0.7 }),
      );
    } else {
      landmark = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.38, 0),
        new THREE.MeshStandardMaterial({ color, roughness: 0.78 }),
      );
    }
    landmark.position.y = 0.36;
    landmark.rotation.y = index * 0.72;
    landmark.castShadow = true;
    group.add(landmark);
    this.makePickable(base, item);
    this.makePickable(landmark, item);
  }

  makePickable(mesh, item) {
    mesh.userData.pickItem = item;
    this.pickables.push(mesh);
  }

  registerFocusTarget(item, object) {
    if (!item || !object) return;
    this.focusTargets.set(`${item.kind}:${item.id}`, object);
  }

  focusItem(item, { radius = 3.6 } = {}) {
    const target = this.focusTargets.get(`${item.kind}:${item.id}`);
    if (!target) return false;
    this.stopFollowing(false);
    target.getWorldPosition(this.followPosition);
    this.targetCameraTarget.copy(this.followPosition);
    this.targetCameraTarget.y = 0.42;
    this.targetRadius = THREE.MathUtils.clamp(radius, 2.2, 32);
    this.targetPitch = 0.84;
    this.requestFrame();
    return true;
  }

  pointerCoordinates(event) {
    const bounds = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    this.pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
  }

  hitAt(event) {
    this.pointerCoordinates(event);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.intersectObjects(this.pickables, false)[0]?.object || null;
  }

  updateHover(event) {
    const hit = this.hitAt(event);
    this.setHovered(hit);
  }

  setHovered(mesh) {
    if (mesh === this.hovered) return;
    if (this.hovered?.material?.emissive) this.hovered.material.emissive.setHex(this.hovered.userData.baseEmissive || 0x000000);
    this.hovered = mesh;
    if (mesh?.material?.emissive) {
      mesh.userData.baseEmissive = mesh.material.emissive.getHex();
      mesh.material.emissive.setHex(0x2d2618);
    }
    this.canvas.style.cursor = mesh ? "pointer" : this.dragging ? "grabbing" : "grab";
    this.onHover?.(mesh?.userData.pickItem || null);
    this.requestFrame();
  }

  selectAt(event) {
    const hit = this.hitAt(event);
    if (hit?.userData.pickItem) this.onSelect?.(hit.userData.pickItem);
  }

  updateLabels() {
    if (!this.labels.length || !this.labelLayer) return;
    const width = this.labelLayer.clientWidth;
    const height = this.labelLayer.clientHeight;
    this.scene.updateMatrixWorld(true);
    for (const label of this.labels) {
      label.anchor.getWorldPosition(this.labelPosition);
      this.labelPosition.project(this.camera);
      const visible = this.radius <= label.maxRadius
        && this.labelPosition.z > -1 && this.labelPosition.z < 1
        && Math.abs(this.labelPosition.x) < 1.08 && Math.abs(this.labelPosition.y) < 1.08;
      label.element.hidden = !visible;
      if (!visible) continue;
      label.element.style.left = `${(this.labelPosition.x * 0.5 + 0.5) * width}px`;
      label.element.style.top = `${(-this.labelPosition.y * 0.5 + 0.5) * height}px`;
    }
  }

  resetCamera(layer = this.activeLayer, animate = true) {
    this.followedCharacter = null;
    this.clearFollowMarker();
    this.targetCameraTarget.set(0, 0.2, 0);
    const radii = { overview: 18.5, cities: 16.5, showcase: 17.5, districts: 22, schools: 15.5, meal: 16 };
    this.targetRadius = radii[layer] || 15;
    this.targetYaw = layer === "overview" ? -0.5 : layer === "cities" ? -0.62 : -0.48;
    this.targetPitch = layer === "meal" ? 0.78 : layer === "showcase" ? 0.72 : layer === "districts" ? 0.68 : layer === "overview" ? 0.82 : 0.88;
    if (!animate || prefersReducedMotion) {
      this.radius = this.targetRadius;
      this.yaw = this.targetYaw;
      this.pitch = this.targetPitch;
      this.cameraTarget.copy(this.targetCameraTarget);
    }
    this.requestFrame();
  }

  requestFrame() {
    if (this.needsFrame) return;
    this.needsFrame = true;
    requestAnimationFrame((time) => this.render(time));
  }

  render(time) {
    this.needsFrame = false;
    const ease = prefersReducedMotion ? 1 : 0.15;
    this.yaw += (this.targetYaw - this.yaw) * ease;
    this.pitch += (this.targetPitch - this.pitch) * ease;
    this.radius += (this.targetRadius - this.radius) * ease;
    if (this.followedCharacter) {
      this.followedCharacter.group.getWorldPosition(this.followPosition);
      this.followPosition.y += this.followedCharacter.item.kind === "pet" ? 0.3 : 0.55;
      this.targetCameraTarget.copy(this.followPosition);
      if (this.followMarker) {
        const pulse = 1 + Math.sin(time * 0.006) * 0.09;
        this.followMarker.scale.setScalar(pulse);
        this.followMarker.rotation.y = time * 0.0012;
      }
    }
    this.cameraTarget.lerp(this.targetCameraTarget, prefersReducedMotion ? 1 : 0.13);
    const sinPitch = Math.sin(this.pitch);
    this.camera.position.set(
      this.cameraTarget.x + this.radius * sinPitch * Math.sin(this.yaw),
      this.cameraTarget.y + this.radius * Math.cos(this.pitch),
      this.cameraTarget.z + this.radius * sinPitch * Math.cos(this.yaw),
    );
    this.camera.lookAt(this.cameraTarget);

    let introAnimating = false;
    if (this.currentRoot && this.introStart) {
      const duration = prefersReducedMotion ? 1 : 420;
      const progress = Math.min(1, (time - this.introStart) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.currentRoot.position.y = -0.32 * (1 - eased);
      this.currentRoot.scale.setScalar(0.94 + 0.06 * eased);
      introAnimating = progress < 1;
    }

    const peopleAnimating = this.peopleMotion && this.characters.length > 0 && !document.hidden;
    if (peopleAnimating && (time - this.lastCharacterFrame >= this.characterFrameInterval || !this.lastCharacterFrame)) {
      this.updateCharacters(time);
    }

    this.renderer.render(this.scene, this.camera);
    this.updateLabels();
    const cameraAnimating =
      Math.abs(this.yaw - this.targetYaw) > 0.001 ||
      Math.abs(this.pitch - this.targetPitch) > 0.001 ||
      Math.abs(this.radius - this.targetRadius) > 0.01 ||
      this.cameraTarget.distanceToSquared(this.targetCameraTarget) > 0.0001;
    if (cameraAnimating || introAnimating || this.dragging || peopleAnimating) this.requestFrame();
  }

  clearRoot() {
    this.setHovered(null);
    this.clearFollowMarker();
    this.pickables = [];
    this.focusTargets.clear();
    this.characters = [];
    this.followedCharacter = null;
    this.characterAssets = null;
    this.propAssets = null;
    this.lastCharacterFrame = 0;
    this.labels = [];
    this.labelLayer?.replaceChildren();
    if (!this.currentRoot) return;
    this.scene.remove(this.currentRoot);
    this.currentRoot.traverse((object) => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material?.dispose?.();
    });
    this.currentRoot = null;
  }

  destroy() {
    this.clearRoot();
    this.resizeObserver.disconnect();
    this.renderer.dispose();
  }
}

function spiralPoint(index, total, radius) {
  if (total <= 1) return { x: 0, z: 0 };
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const normalized = Math.sqrt((index + 0.7) / total);
  const angle = index * goldenAngle;
  return {
    x: Math.cos(angle) * radius * normalized,
    z: Math.sin(angle) * radius * normalized,
  };
}

function nearestPreviousPoint(points, index) {
  let nearest = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let candidate = 0; candidate < index; candidate += 1) {
    const dx = points[index].x - points[candidate].x;
    const dz = points[index].z - points[candidate].z;
    const distance = dx * dx + dz * dz;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = candidate;
    }
  }
  return nearest;
}

function hashNumber(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createCharacterAssets() {
  return {
    bodyGeometry: new THREE.CylinderGeometry(0.1, 0.135, 0.31, 7),
    headGeometry: new THREE.SphereGeometry(0.125, 10, 7),
    hairGeometry: new THREE.SphereGeometry(0.132, 9, 6, 0, Math.PI * 2, 0, Math.PI * 0.54),
    legGeometry: new THREE.BoxGeometry(0.065, 0.24, 0.075),
    armGeometry: new THREE.CapsuleGeometry(0.035, 0.12, 3, 6),
    handGeometry: new THREE.SphereGeometry(0.04, 7, 5),
    eyeGeometry: new THREE.SphereGeometry(0.014, 6, 4),
    browGeometry: new THREE.BoxGeometry(0.04, 0.008, 0.008),
    mouthGeometry: new THREE.BoxGeometry(0.045, 0.009, 0.009),
    mouthOpenGeometry: new THREE.SphereGeometry(0.019, 6, 5),
    cheekGeometry: new THREE.SphereGeometry(0.014, 6, 4),
    hitGeometry: new THREE.CapsuleGeometry(0.18, 0.48, 3, 6),
    clothing: [0x396b5a, 0xaa4729, 0x6f9fb4, 0xd39b4a, 0x765887, 0x4f718f, 0x9b6253, 0x577b56]
      .map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.78 })),
    skin: [0xf3caa6, 0xe2ac82, 0xc8875c, 0x9c6548]
      .map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.88 })),
    hair: [0x2f2925, 0x4a3429, 0x655044, 0x252c32]
      .map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.94 })),
    trouser: new THREE.MeshStandardMaterial({ color: 0x344b59, roughness: 0.88 }),
    faceDark: new THREE.MeshStandardMaterial({ color: 0x302c2a, roughness: 0.86 }),
    cheek: new THREE.MeshStandardMaterial({ color: 0xdc887b, roughness: 0.92 }),
    hitMaterial: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  };
}

function createPropAssets() {
  const material = (color, roughness = 0.82, options = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...options });
  return {
    boxGeometry: new THREE.BoxGeometry(1, 1, 1),
    poleGeometry: new THREE.CylinderGeometry(0.04, 0.05, 1, 7),
    orbGeometry: new THREE.SphereGeometry(0.5, 8, 6),
    wheelGeometry: new THREE.TorusGeometry(0.18, 0.028, 6, 12),
    tableGeometry: new THREE.CylinderGeometry(0.5, 0.5, 0.1, 10),
    discGeometry: new THREE.CylinderGeometry(0.22, 0.22, 0.05, 16),
    ringGeometry: new THREE.TorusGeometry(0.23, 0.025, 6, 16),
    materials: {
      wood: material(0x9a6545, 0.9),
      darkMetal: material(0x334b56, 0.62, { metalness: 0.18 }),
      metal: material(0x9da9a7, 0.5, { metalness: 0.34 }),
      tire: material(0x242b2d, 0.92),
      lamp: material(0xffe9a6, 0.38, { emissive: 0xf1c84a, emissiveIntensity: 0.35 }),
      terracotta: material(0xa96547, 0.92),
      leaf: material(0x4f7f66, 0.9),
      blue: material(0x5f95ac, 0.72),
      green: material(0x5f8c69, 0.82),
      orange: material(0xc9653e, 0.8),
      yellow: material(0xe6b94c, 0.82),
      white: material(0xf7efdd, 0.78),
      glass: material(0x6f9fb4, 0.28, { metalness: 0.08 }),
      court: material(0x6f9273, 0.95),
      solar: material(0x365c75, 0.36, { metalness: 0.16 }),
    },
  };
}
