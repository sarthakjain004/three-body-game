/* ============================================================
 * THREE BODY — render3d.js
 * Full 3D world view (Three.js): shader sky dome, three suns as
 * lit sprites driving real directional lights and shadows, a
 * displaced terrain, the settlement growing through the ages,
 * instanced townsfolk with duties, weather particles, syzygy
 * levitation, and the title-screen orbital dance.
 *
 * Exposes the SAME TB.render API as the 2D renderer and replaces
 * it only if WebGL initializes — otherwise the 2D canvas renderer
 * (loaded just before this file) keeps the job.
 * ============================================================ */
'use strict';
var TB = globalThis.TB = globalThis.TB || {};

(function () {
  if (typeof THREE === 'undefined') return;        // library missing → keep 2D
  const U = TB.util, P = TB.physics, C = TB.climate;
  const render2d = TB.render;                       // fallback

  // Normalized settlement coordinate (0..1, shared with the 2D logic and
  // the crowd duty stations) → world X. The settlement spreads along +Z.
  // Mirrored so that, seen from the camera (looking +Z), the pyramid sits
  // on the LEFT and the lake on the RIGHT, matching the 2D composition.
  const NX = (n) => (0.5 - n) * 260;

  let renderer, scene, camera, W = 0, H = 0;
  let fallback = false, booted = false;

  // Scene handles
  let skyMat, starPts, sunGroup = [], lights = [], hemi, ambient;
  let terrain, terrainMat, lake, lakeMat;
  let pyramidAncient, pyramidLate, antennaLight;
  let townMesh, skylineMesh, domesGroup, observatory, factoryGroup, smokePts;
  let coolingGroup, steamPts, mastGroup, pendulumGroup, bobMesh, gantryGroup, launchSprite;
  let furrows, searchlights = [];
  let snowPts, emberPts, rockMesh;
  let meteorSeg = null, m3 = [], m3Next = 12000, m3Until = 0;   // meteor showers
  let skinsMesh;
  // People (instanced parts)
  let people = null;
  // Juice / state
  let trauma = 0, flashEl = null, flashA = 0, flashColor = '255,255,255';
  let viewYaw = 0, brightSm = 0, syzygyLift = 0, lastMs = 0;
  let crowd = [];
  const srng = U.makeRng(8888);
  const reduceMotion = (typeof window !== 'undefined' && window.matchMedia)
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

  // World biomes — each of the system's worlds wears a different face.
  // .g is the temperate ground colour (0..1 RGB); climate frost/scorch
  // blends over it. Chosen by world index as planets are lost.
  const BIOMES = [
    { name: 'the Ashen Waste',     g: [0.20, 0.17, 0.13], lake: 0x224c76 },
    { name: 'the Frostpan',        g: [0.40, 0.44, 0.50], lake: 0x2a5a82 },
    { name: 'the Rustlands',       g: [0.34, 0.15, 0.10], lake: 0x2e4860 },
    { name: 'the Salt Flats',      g: [0.54, 0.52, 0.47], lake: 0x3a6a86 },
    { name: 'the Basalt Plain',    g: [0.12, 0.12, 0.15], lake: 0x1f2e38 },
    { name: 'the Verdant Remnant', g: [0.22, 0.27, 0.15], lake: 0x245a4a },
  ];
  let biome = BIOMES[0];
  function setBiome3d(worldIndex) {
    biome = BIOMES[((worldIndex % BIOMES.length) + BIOMES.length) % BIOMES.length];
    return biome.name;
  }

  // Title demo
  let demo = null, demoScene = null, demoCam = null;

  // ----------------------------------------------------------
  // Procedural textures
  // ----------------------------------------------------------
  function radialTexture(stops, size) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size || 128;
    const g = cv.getContext('2d');
    const grad = g.createRadialGradient(cv.width / 2, cv.height / 2, 0,
                                        cv.width / 2, cv.height / 2, cv.width / 2);
    for (const [t, c] of stops) grad.addColorStop(t, c);
    g.fillStyle = grad;
    g.fillRect(0, 0, cv.width, cv.height);
    const tex = new THREE.CanvasTexture(cv);
    return tex;
  }

  // ----------------------------------------------------------
  // Init
  // ----------------------------------------------------------
  function init3d(cv) {
    renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x10141d, 0.0013);

    camera = new THREE.PerspectiveCamera(58, 1, 0.1, 2600);
    camera.position.set(0, 6.5, -26);

    resize();
    window.addEventListener('resize', resize);

    buildSky();
    buildTerrain(11);
    buildSettlement();
    buildPeople();
    buildWeather();
    buildMeteors();
    buildOverlays();
    booted = true;
  }

  function resize() {
    if (!renderer) return;
    W = window.innerWidth; H = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  }

  // ----------------------------------------------------------
  // Sky, stars, suns, lights
  // ----------------------------------------------------------
  function buildSky() {
    const geo = new THREE.SphereGeometry(1200, 32, 18);
    skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        zenith: { value: new THREE.Color(0x070a14) },
        horizon: { value: new THREE.Color(0x10141f) },
      },
      vertexShader: 'varying vec3 vPos; void main(){ vPos = position; ' +
        'gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 zenith; uniform vec3 horizon; varying vec3 vPos;' +
        'void main(){ float h = clamp(normalize(vPos).y, 0.0, 1.0);' +
        'vec3 c = mix(horizon, zenith, pow(h, 0.55));' +
        'gl_FragColor = vec4(c, 1.0); }',
    });
    scene.add(new THREE.Mesh(geo, skyMat));

    // Stars on the upper dome.
    const n = 900, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const az = srng.range(0, Math.PI * 2), el = Math.asin(srng.next()) * 0.98;
      pos[i * 3] = Math.cos(el) * Math.sin(az) * 1100;
      pos[i * 3 + 1] = Math.sin(el) * 1100 + 8;
      pos[i * 3 + 2] = Math.cos(el) * Math.cos(az) * 1100;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    starPts = new THREE.Points(sg, new THREE.PointsMaterial({
      color: 0xcfe0ff, size: 2.4, sizeAttenuation: false,
      transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    scene.add(starPts);

    // Suns: disc + glow sprite + a real directional light each.
    const discTex = radialTexture([[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,244,214,1)'],
      [0.72, 'rgba(255,214,150,0.9)'], [1, 'rgba(255,190,110,0)']], 256);
    const glowTex = radialTexture([[0, 'rgba(255,230,170,0.85)'], [0.35, 'rgba(255,190,110,0.30)'],
      [1, 'rgba(255,150,70,0)']], 256);
    for (let i = 0; i < 3; i++) {
      const disc = new THREE.Sprite(new THREE.SpriteMaterial({
        map: discTex, transparent: true, depthWrite: false, fog: false }));
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, transparent: true, depthWrite: false, fog: false,
        blending: THREE.AdditiveBlending }));
      scene.add(disc); scene.add(glow);
      const light = new THREE.DirectionalLight(0xfff2dd, 0);
      scene.add(light); scene.add(light.target);
      sunGroup.push({ disc, glow, light });
    }
    // Only the brightest sun casts shadows (perf).
    const sl = sunGroup[0].light;
    sl.castShadow = true;
    sl.shadow.mapSize.set(1024, 1024);
    sl.shadow.camera.left = -180; sl.shadow.camera.right = 180;
    sl.shadow.camera.top = 200; sl.shadow.camera.bottom = -120;
    sl.shadow.camera.far = 2400;

    hemi = new THREE.HemisphereLight(0x223044, 0x1a1410, 0.35);
    scene.add(hemi);
    ambient = new THREE.AmbientLight(0x202833, 0.25);
    scene.add(ambient);
  }

  // ----------------------------------------------------------
  // Terrain
  // ----------------------------------------------------------
  function buildTerrain(seed) {
    if (terrain) { scene.remove(terrain); terrain.geometry.dispose(); }
    const rng = U.makeRng(seed);
    const a1 = rng.range(0.004, 0.007), a2 = rng.range(0.010, 0.016),
          p1 = rng.range(0, 6), p2 = rng.range(0, 6), p3 = rng.range(0, 6);
    const geo = new THREE.PlaneGeometry(2400, 2400, 96, 96);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const d = Math.hypot(x, z);
      // flat settlement basin, hills beyond, mountains at the rim
      const basin = U.smoothstep(170, 420, d);
      let h = (Math.sin(x * a1 + p1) + Math.cos(z * a1 + p2)) * 6
            + Math.sin(x * a2 + z * a2 * 0.7 + p3) * 3.2;
      h = h * basin + Math.pow(U.smoothstep(500, 1150, d), 1.6) * 150
        * (0.7 + 0.3 * Math.sin(Math.atan2(z, x) * 5 + p1));
      pos.setY(i, h);
    }
    geo.computeVertexNormals();
    terrainMat = terrainMat || new THREE.MeshStandardMaterial({
      color: 0x4a4136, roughness: 1, metalness: 0 });
    terrain = new THREE.Mesh(geo, terrainMat);
    terrain.receiveShadow = true;
    scene.add(terrain);
  }

  // ----------------------------------------------------------
  // Settlement — the skyline is a tech tree
  // ----------------------------------------------------------
  const DARK = new THREE.MeshStandardMaterial({ color: 0x14161d, roughness: 0.95 });
  const DARK2 = new THREE.MeshStandardMaterial({ color: 0x1b1e26, roughness: 0.9 });

  function buildSettlement() {
    // --- Pyramid, ancient (stepped) and late (smooth) ---
    pyramidAncient = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const w = 56 * (1 - i * 0.17);
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, 9, w), DARK);
      b.position.set(0, 4.5 + i * 9, 0);
      b.castShadow = true;
      pyramidAncient.add(b);
    }
    pyramidAncient.position.set(NX(0.18), 0, 120);
    scene.add(pyramidAncient);

    pyramidLate = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 34, 52, 4), DARK);
    cone.position.y = 26; cone.rotation.y = Math.PI / 4; cone.castShadow = true;
    pyramidLate.add(cone);
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 16), DARK2);
    spire.position.y = 58;
    pyramidLate.add(spire);
    antennaLight = new THREE.Mesh(new THREE.SphereGeometry(0.9),
      new THREE.MeshBasicMaterial({ color: 0xff5050 }));
    antennaLight.position.y = 66.5;
    pyramidLate.add(antennaLight);
    pyramidLate.position.copy(pyramidAncient.position);
    scene.add(pyramidLate);

    // --- Town (instanced houses, count grows with tech) ---
    const houseGeo = new THREE.BoxGeometry(1, 1, 1);
    houseGeo.translate(0, 0.5, 0);
    townMesh = new THREE.InstancedMesh(houseGeo, new THREE.MeshStandardMaterial({
      color: 0x232730, roughness: 0.9, emissive: 0x000000 }), 16);
    const r1 = U.makeRng(5151);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 16; i++) {
      dummy.position.set(NX(0.18) + 40 + (i % 8) * 13 + r1.range(-3, 3),
                         0, 150 + Math.floor(i / 8) * 18 + r1.range(-4, 4));
      dummy.scale.set(r1.range(7, 11), r1.range(5, 12), r1.range(7, 10));
      dummy.rotation.y = r1.range(-0.2, 0.2);
      dummy.updateMatrix();
      townMesh.setMatrixAt(i, dummy.matrix);
    }
    townMesh.castShadow = true;
    scene.add(townMesh);

    // --- Late-age skyline (taller, further back) ---
    skylineMesh = new THREE.InstancedMesh(houseGeo, new THREE.MeshStandardMaterial({
      color: 0x1d2530, roughness: 0.7, emissive: 0x000000 }), 10);
    for (let i = 0; i < 10; i++) {
      dummy.position.set(-30 + i * 12 + r1.range(-3, 3), 0, 215 + r1.range(-8, 8));
      dummy.scale.set(r1.range(7, 10), r1.range(26, 64), r1.range(7, 10));
      dummy.rotation.y = 0;
      dummy.updateMatrix();
      skylineMesh.setMatrixAt(i, dummy.matrix);
    }
    scene.add(skylineMesh);

    // --- Dehydratories: a row of half-domes ---
    domesGroup = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const r = 4.5 + (i % 3);
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), DARK2);
      dome.position.set(NX(0.70) + i * 9.5, 0, 110);
      dome.castShadow = true;
      domesGroup.add(dome);
    }
    scene.add(domesGroup);

    // --- Lake ---
    lakeMat = new THREE.MeshStandardMaterial({
      color: 0x224c76, roughness: 0.15, metalness: 0.35 });
    lake = new THREE.Mesh(new THREE.CircleGeometry(23, 28), lakeMat);
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(NX(0.86), 0.25, 120);
    scene.add(lake);

    // --- Observatory ---
    observatory = new THREE.Group();
    const obase = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 5, 12), DARK);
    obase.position.y = 2.5; obase.castShadow = true;
    const odome = new THREE.Mesh(
      new THREE.SphereGeometry(6, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), DARK2);
    odome.position.y = 5;
    observatory.add(obase, odome);
    observatory.position.set(NX(0.585), 0, 152);
    scene.add(observatory);

    // --- Factory (age ≥ 8) ---
    factoryGroup = new THREE.Group();
    const fhall = new THREE.Mesh(new THREE.BoxGeometry(22, 8, 12), DARK);
    fhall.position.y = 4; fhall.castShadow = true;
    factoryGroup.add(fhall);
    for (const sx of [-6, 5]) {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 17, 8), DARK2);
      stack.position.set(sx, 12, 0);
      factoryGroup.add(stack);
    }
    factoryGroup.position.set(NX(0.475), 0, 140);
    scene.add(factoryGroup);

    // --- Cooling tower + radio mast (age ≥ 10) ---
    coolingGroup = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(5, 8, 18, 14), DARK2);
    tower.position.y = 9; tower.castShadow = true;
    coolingGroup.add(tower);
    coolingGroup.position.set(NX(0.51), 0, 152);
    scene.add(coolingGroup);

    mastGroup = new THREE.Group();
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 34, 6), DARK2);
    mast.position.y = 17;
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.8),
      new THREE.MeshBasicMaterial({ color: 0xff4646 }));
    beacon.position.y = 34.8;
    beacon.name = 'beacon';
    mastGroup.add(mast, beacon);
    mastGroup.position.set(NX(0.545), 0, 158);
    scene.add(mastGroup);

    // --- Pendulum monument (age ≥ 10) ---
    pendulumGroup = new THREE.Group();
    for (const sx of [-9, 9]) {
      const legM = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 30, 8), DARK);
      legM.position.set(sx * 0.55, 14, 0);
      legM.rotation.z = sx > 0 ? -0.31 : 0.31;
      legM.castShadow = true;
      pendulumGroup.add(legM);
    }
    bobMesh = new THREE.Mesh(new THREE.SphereGeometry(2.2, 14, 10),
      new THREE.MeshStandardMaterial({ color: 0x39414e, roughness: 0.3, metalness: 0.8 }));
    bobMesh.castShadow = true;
    pendulumGroup.add(bobMesh);
    pendulumGroup.position.set(NX(0.52), 0, 136);
    scene.add(pendulumGroup);

    // --- Fleet gantries (final age) ---
    gantryGroup = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(1.6, 22, 1.6), DARK2);
      g.position.set(i * 9, 11, 0);
      g.castShadow = true;
      gantryGroup.add(g);
    }
    gantryGroup.position.set(NX(0.07), 0, 100);
    scene.add(gantryGroup);
    launchSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialTexture([[0, 'rgba(255,235,180,1)'], [1, 'rgba(255,150,60,0)']], 64),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    launchSprite.scale.set(6, 6, 1);
    scene.add(launchSprite);

    // --- Searchlights (final age, at night) ---
    for (let i = 0; i < 2; i++) {
      const coneM = new THREE.Mesh(new THREE.ConeGeometry(9, 120, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xbcd6ff, transparent: true, opacity: 0.05,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      coneM.position.set(NX(0.07) + i * 14, 60, 100);
      scene.add(coneM);
      searchlights.push(coneM);
    }

    // --- Furrowed fields (age ≥ 2) ---
    furrows = new THREE.Group();
    const fm = new THREE.MeshStandardMaterial({ color: 0x2c2218, roughness: 1 });
    for (let i = 0; i < 6; i++) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, 46), fm);
      strip.position.set(NX(0.31) + i * 6.5, 0.15, 82);
      furrows.add(strip);
    }
    scene.add(furrows);

    // --- Rolled skins by the domes (instanced) ---
    const skinGeo = new THREE.CapsuleGeometry
      ? new THREE.CapsuleGeometry(0.5, 1.6, 3, 6)
      : new THREE.CylinderGeometry(0.5, 0.5, 2.2, 6);
    skinGeo.rotateZ(Math.PI / 2);
    skinsMesh = new THREE.InstancedMesh(skinGeo, new THREE.MeshStandardMaterial({
      color: 0xc4b89e, roughness: 0.9 }), 48);
    const r2 = U.makeRng(7711);
    for (let i = 0; i < 48; i++) {
      dummy.position.set(NX(0.695) + (i % 14) * 2.1 + r2.range(-0.5, 0.5),
                         0.5 + Math.floor(i / 14) * 1.05, 104 + Math.floor(i / 14) * 1.4);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, r2.range(-0.2, 0.2), 0);
      dummy.updateMatrix();
      skinsMesh.setMatrixAt(i, dummy.matrix);
    }
    scene.add(skinsMesh);
  }

  // ----------------------------------------------------------
  // People — instanced body parts with duties and a walk cycle
  // ----------------------------------------------------------
  const N_PEOPLE = 84;
  function buildPeople() {
    const SKINS = [0xe8b88a, 0xd9a06b, 0xc98a55, 0xb27845, 0x8d5b34];
    const CLOTH_OLD = [0x7d4a32, 0x5b6470, 0x7a6a3c, 0x84423c, 0x4f5a45, 0x6b5340];
    const CLOTH_NEW = [0x2e3b4e, 0x54331f, 0x3c4a3a, 0x5d2f35, 0x27313f, 0x6e7681];
    const ROLES = ['farmer', 'farmer', 'farmer', 'carrier', 'carrier', 'mason',
                   'mason', 'keeper', 'townsman', 'townsman', 'watcher'];
    crowd = [];
    for (let i = 0; i < N_PEOPLE; i++) {
      crowd.push({
        x: srng.range(0.30, 0.66),
        row: i % 4,
        phase: srng.range(0, Math.PI * 2),
        drift: srng.range(0.7, 1.3),
        build: srng.range(0.85, 1.15),
        skin: SKINS[srng.int(0, SKINS.length - 1)],
        clothOld: CLOTH_OLD[srng.int(0, CLOTH_OLD.length - 1)],
        clothNew: CLOTH_NEW[srng.int(0, CLOTH_NEW.length - 1)],
        hat: srng.next() < 0.4,
        role: ROLES[i % ROLES.length],
        tx: srng.range(0.32, 0.62),
        dwellMs: srng.range(0, 2500),
        leg: srng.next() > 0.5 ? 1 : 0,
        dir: 1,
      });
    }

    const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
    const mk = (geo, m) => {
      const im = new THREE.InstancedMesh(geo, m, N_PEOPLE);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.castShadow = true;
      scene.add(im);
      return im;
    };
    const headGeo = new THREE.SphereGeometry(0.30, 10, 8);
    const torsoGeo = new THREE.BoxGeometry(0.62, 1.12, 0.34);
    const legGeo = new THREE.BoxGeometry(0.20, 0.95, 0.20); legGeo.translate(0, -0.475, 0);
    const armGeo = new THREE.BoxGeometry(0.15, 0.85, 0.15); armGeo.translate(0, -0.425, 0);
    const hatGeo = new THREE.ConeGeometry(0.55, 0.35, 10);

    people = {
      head: mk(headGeo, mat(0xe8b88a)),
      torso: mk(torsoGeo, mat(0x7d4a32)),
      legL: mk(legGeo, mat(0x2a241c)),
      legR: mk(legGeo, mat(0x2a241c)),
      armL: mk(armGeo, mat(0x6b5340)),
      armR: mk(armGeo, mat(0x6b5340)),
      hat: mk(hatGeo, mat(0x9a7c43)),
      dummy: new THREE.Object3D(),
      clothEra: -1,
    };
    // Per-instance colors for skin & clothes.
    const c = new THREE.Color();
    for (let i = 0; i < N_PEOPLE; i++) {
      people.head.setColorAt(i, c.setHex(crowd[i].skin));
      people.torso.setColorAt(i, c.setHex(crowd[i].clothOld));
      people.armL.setColorAt(i, c.setHex(crowd[i].clothOld));
      people.armR.setColorAt(i, c.setHex(crowd[i].clothOld));
    }
  }

  function setPart(part, i, x, y, z, rx, ry, rz, s) {
    const d = people.dummy;
    d.position.set(x, y, z);
    d.rotation.set(rx || 0, ry || 0, rz || 0);
    d.scale.setScalar(s);
    d.updateMatrix();
    part.setMatrixAt(i, d.matrix);
  }
  const FAR_AWAY = new THREE.Matrix4().makeTranslation(0, -500, 0);

  function updatePeople(state, nowMs, dtMs) {
    const civ = state.civ;
    const age = civ.ageIdx;
    const domeX = 0.715;
    const visible = civ.dormant ? 0
      : Math.round(U.clamp(Math.sqrt(Math.max(civ.popH, 0)) * 8.5, 0, N_PEOPLE));
    const WALK = 0.000052;

    // Swap clothing palette when the era of coats arrives.
    const eraKey = age >= 9 ? 1 : 0;
    if (people.clothEra !== eraKey) {
      people.clothEra = eraKey;
      const c = new THREE.Color();
      for (let i = 0; i < N_PEOPLE; i++) {
        const hex = eraKey ? crowd[i].clothNew : crowd[i].clothOld;
        people.torso.setColorAt(i, c.setHex(hex));
        people.armL.setColorAt(i, c.setHex(hex));
        people.armR.setColorAt(i, c.setHex(hex));
      }
      people.torso.instanceColor.needsUpdate = true;
      people.armL.instanceColor.needsUpdate = true;
      people.armR.instanceColor.needsUpdate = true;
    }

    for (let i = 0; i < N_PEOPLE; i++) {
      if (i >= visible) {
        for (const k of ['head', 'torso', 'legL', 'legR', 'armL', 'armR', 'hat'])
          people[k].setMatrixAt(i, FAR_AWAY);
        continue;
      }
      const p = crowd[i];
      let walking = false, action = null;

      if (civ.order === 'dehydrate') {
        walking = Math.abs(domeX - p.x) > 0.005;
        if (walking) p.x += Math.sign(domeX - p.x) * WALK * 1.5 * p.drift * dtMs;
      } else if (civ.order === 'rehydrate') {
        walking = true;
        if (p.x > 0.80) p.x -= WALK * p.drift * dtMs;
        else if (Math.abs(0.46 - p.x) > 0.01) p.x += Math.sign(0.46 - p.x) * WALK * p.drift * dtMs;
        else walking = false;
      } else if (p.dwellMs > 0) {
        p.dwellMs -= dtMs;
        if (p.role === 'farmer' && age >= 2) action = 'bend';
        else if (p.role === 'mason') action = 'hammer';
      } else if (Math.abs(p.tx - p.x) > 0.005) {
        walking = true;
        p.x += Math.sign(p.tx - p.x) * WALK * p.drift * dtMs;
      } else {
        p.leg = 1 - p.leg;
        const j = (i * 31 + Math.floor(p.phase * 100)) % 7;
        switch (p.role) {
          case 'farmer':   p.tx = 0.31 + j * 0.022; p.dwellMs = 2600 + j * 600; break;
          case 'carrier':  p.tx = p.leg ? 0.795 : 0.45 + j * 0.01; p.dwellMs = p.leg ? 700 : 1700; break;
          case 'mason':    p.tx = p.leg ? 0.235 + j * 0.008 : 0.42 + j * 0.012; p.dwellMs = p.leg ? 3400 : 900; break;
          case 'keeper':   p.tx = 0.695 + j * 0.013; p.dwellMs = 1500 + j * 400; break;
          case 'watcher':  p.tx = (age >= 5 ? 0.565 : 0.52) + j * 0.008; p.dwellMs = 4200 + j * 800; break;
          default:         p.tx = p.leg ? 0.345 + j * 0.01 : 0.48 + j * 0.014; p.dwellMs = 1100 + j * 500;
        }
      }
      if (walking) p.dir = Math.sign((civ.order === 'dehydrate' ? domeX : p.tx) - p.x) || p.dir;
      p.phase += (walking ? 0.0095 : 0.0022) * dtMs * p.drift;

      const sc = p.build * (1.05 + p.row * 0.05);
      const wx = NX(p.x);
      const wz = 48 + p.row * 10;
      const lift = syzygyLift * (5 + p.row * 1.5 + Math.sin(p.phase * 0.7 + i) * 2);
      const y0 = lift;
      const swing = walking ? Math.sin(p.phase) : 0;
      const bend = action === 'bend' ? 0.42 + Math.sin(p.phase * 2.2) * 0.12 : 0;
      const yaw = walking ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : Math.PI;
      const lifted = syzygyLift > 0.05;

      // hips at 0.95·sc, shoulders 1.9·sc, head 2.2·sc
      setPart(people.legL, i, wx - 0.12 * sc, y0 + 0.95 * sc, wz,
        (lifted ? 0.5 : swing * 0.55), yaw, 0, sc);
      setPart(people.legR, i, wx + 0.12 * sc, y0 + 0.95 * sc, wz,
        (lifted ? 0.2 : -swing * 0.55), yaw, 0, sc);
      setPart(people.torso, i, wx, y0 + (1.42 - bend * 0.18) * sc, wz,
        bend + (lifted ? Math.sin(p.phase * 0.6) * 0.4 : 0), yaw, 0, sc);
      setPart(people.armL, i, wx - 0.38 * sc, y0 + 1.86 * sc, wz,
        (lifted ? -2.4 : action === 'hammer' ? -1.1 - Math.abs(Math.sin(p.phase * 3)) * 1.1
          : -swing * 0.5 + bend * 1.6), yaw, lifted ? 0.4 : 0.08, sc);
      setPart(people.armR, i, wx + 0.38 * sc, y0 + 1.86 * sc, wz,
        (lifted ? -2.2 : swing * 0.5 + bend * 1.6), yaw, lifted ? -0.4 : -0.08, sc);
      const headBendZ = bend * 0.3 * sc;
      setPart(people.head, i, wx, y0 + (2.22 - bend * 0.3) * sc, wz + headBendZ, bend, yaw, 0, sc);
      if (p.hat && age <= 6) {
        setPart(people.hat, i, wx, y0 + (2.48 - bend * 0.32) * sc, wz + headBendZ, bend, yaw, 0, sc);
      } else {
        people.hat.setMatrixAt(i, FAR_AWAY);
      }
    }
    for (const k of ['head', 'torso', 'legL', 'legR', 'armL', 'armR', 'hat'])
      people[k].instanceMatrix.needsUpdate = true;
  }

  // ----------------------------------------------------------
  // Weather particles
  // ----------------------------------------------------------
  function makeCloud(n, color, size, blending) {
    const pos = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({
      color, size, transparent: true, opacity: 0, depthWrite: false,
      blending: blending || THREE.NormalBlending }));
    pts.frustumCulled = false;
    scene.add(pts);
    return pts;
  }

  function buildWeather() {
    snowPts = makeCloud(1100, 0xe6eefc, 1.5);
    const sp = snowPts.geometry.attributes.position.array;
    for (let i = 0; i < sp.length; i += 3) {
      sp[i] = srng.range(-220, 220); sp[i + 1] = srng.range(0, 120); sp[i + 2] = srng.range(-60, 260);
    }
    emberPts = makeCloud(420, 0xff9a3c, 2.2, THREE.AdditiveBlending);
    const ep = emberPts.geometry.attributes.position.array;
    for (let i = 0; i < ep.length; i += 3) {
      ep[i] = srng.range(-220, 220); ep[i + 1] = srng.range(0, 90); ep[i + 2] = srng.range(-60, 260);
    }
    smokePts = makeCloud(60, 0x8a8d96, 4);
    steamPts = makeCloud(40, 0xc2c8d2, 5);

    // Syzygy debris.
    rockMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.5),
      new THREE.MeshStandardMaterial({ color: 0x3a352f, roughness: 1 }), 70);
    rockMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(rockMesh);
  }

  // Meteor showers — a pool of streak segments high on the sky dome.
  const MET_N = 26;
  function buildMeteors() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MET_N * 2 * 3), 3));
    meteorSeg = new THREE.LineSegments(g, new THREE.LineBasicMaterial({
      color: 0xeaf2ff, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending }));
    meteorSeg.frustumCulled = false;
    for (let i = 0; i < MET_N; i++) m3.push({ active: false, x: 0, y: -9999, z: 0, vx: 0, vy: 0, vz: 0, life: 0, len: 10 });
    scene.add(meteorSeg);
  }
  function updateMeteors3d(nowMs, dark, chaos) {
    if (!meteorSeg) return;
    meteorSeg.material.opacity += ((dark ? 0.85 : 0) - meteorSeg.material.opacity) * 0.08;
    if (nowMs > m3Next) {
      m3Next = nowMs + (chaos ? 26000 : 52000) + Math.random() * 45000;
      m3Until = nowMs + 3000 + Math.random() * 3500;
    }
    if (dark && nowMs < m3Until && Math.random() < 0.5) {
      const m = m3.find(x => !x.active);
      if (m) {
        m.active = true; m.life = 1; m.len = 9 + Math.random() * 9;
        m.x = -420 + Math.random() * 840; m.y = 280 + Math.random() * 260; m.z = 360 + Math.random() * 420;
        const dir = m.x < 0 ? 1 : -1;
        m.vx = dir * (7 + Math.random() * 7); m.vy = -(2 + Math.random() * 3); m.vz = (Math.random() - 0.5) * 3;
      }
    }
    const pos = meteorSeg.geometry.attributes.position;
    for (let i = 0; i < m3.length; i++) {
      const m = m3[i];
      if (m.active) {
        m.x += m.vx; m.y += m.vy; m.z += m.vz; m.life -= 0.02;
        const tail = m.len * (0.4 + m.life * 0.6);
        if (m.life <= 0 || m.y < 130) m.active = false;
        pos.setXYZ(i * 2, m.x, m.y, m.z);
        pos.setXYZ(i * 2 + 1, m.x - m.vx * tail, m.y - m.vy * tail, m.z - m.vz * tail);
      } else {
        pos.setXYZ(i * 2, 0, -9999, 0); pos.setXYZ(i * 2 + 1, 0, -9999, 0);
      }
    }
    pos.needsUpdate = true;
  }

  function updateWeather(T, obs, nowMs, dtMs) {
    // Snow
    const wantSnow = T < -22;
    snowPts.material.opacity += ((wantSnow ? 0.85 : 0) - snowPts.material.opacity) * 0.03;
    if (snowPts.material.opacity > 0.02) {
      const a = snowPts.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) {
        let y = a.getY(i) - 0.018 * dtMs;
        if (y < 0) y = 120;
        a.setY(i, y);
        a.setX(i, a.getX(i) + Math.sin(nowMs / 800 + i) * 0.02);
      }
      a.needsUpdate = true;
    }
    // Embers
    const wantEmber = T > 75;
    emberPts.material.opacity += ((wantEmber ? 0.8 : 0) - emberPts.material.opacity) * 0.03;
    if (emberPts.material.opacity > 0.02) {
      const a = emberPts.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) {
        let y = a.getY(i) + 0.02 * dtMs;
        if (y > 90) y = 0;
        a.setY(i, y);
      }
      a.needsUpdate = true;
    }
    // Syzygy debris rises
    if (syzygyLift > 0.03) {
      const d = people.dummy;
      for (let i = 0; i < 70; i++) {
        const t = ((nowMs / 2600) + i / 70) % 1;
        d.position.set(-150 + (i * 53 % 300), t * 55 * syzygyLift,
                       50 + (i * 37 % 200));
        d.rotation.set(t * 6, i, t * 4);
        d.scale.setScalar(0.6 + (i % 5) * 0.3);
        d.updateMatrix();
        rockMesh.setMatrixAt(i, d.matrix);
      }
      rockMesh.visible = true;
      rockMesh.instanceMatrix.needsUpdate = true;
    } else rockMesh.visible = false;
  }

  // ----------------------------------------------------------
  // DOM overlays: vignette (static CSS) + flash
  // ----------------------------------------------------------
  function buildOverlays() {
    let vg = document.getElementById('vignette3d');
    if (!vg) {
      vg = document.createElement('div');
      vg.id = 'vignette3d';
      vg.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;' +
        'background:radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,0.45) 100%)';
      document.body.appendChild(vg);
    }
    flashEl = document.getElementById('flash3d');
    if (!flashEl) {
      flashEl = document.createElement('div');
      flashEl.id = 'flash3d';
      flashEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:6;opacity:0';
      document.body.appendChild(flashEl);
    }
  }

  // ----------------------------------------------------------
  // Per-frame world update
  // ----------------------------------------------------------
  const _zen = new THREE.Color(), _hor = new THREE.Color(), _tmp = new THREE.Color();

  function render3d(state, nowMs) {
    const dtMs = U.clamp(nowMs - (lastMs || nowMs), 0, 100);
    lastMs = nowMs;
    const dt = dtMs / 1000;
    const obs = P.observe(state.sys);
    const cl = state.cl, T = cl.tempC, civ = state.civ, age = civ.ageIdx;

    // ---- Sky & lights from the true sun states ----
    let fluxVis = 0, brightest = obs.suns[0];
    for (const o of obs.suns) { fluxVis += o.flux; if (o.flux > brightest.flux) brightest = o; }
    brightSm += (U.clamp(Math.pow(fluxVis / 1.2, 0.5), 0, 1) - brightSm) * U.relax(dt, 0.25);
    const bright = brightSm;
    const heat = U.clamp((T + 60) / 160, 0, 1);

    _zen.setRGB(
      U.lerp(0.024, U.lerp(0.10, 0.47, heat), bright),
      U.lerp(0.031, U.lerp(0.24, 0.35, heat), bright),
      U.lerp(0.071, U.lerp(0.55, 0.35, heat), bright));
    _hor.setRGB(
      U.lerp(0.063, U.lerp(0.59, 1.0, heat), bright),
      U.lerp(0.071, U.lerp(0.67, 0.66, heat), bright),
      U.lerp(0.13, U.lerp(0.82, 0.35, heat), bright));
    skyMat.uniforms.zenith.value.copy(_zen);
    skyMat.uniforms.horizon.value.copy(_hor);
    scene.fog.color.copy(_hor).multiplyScalar(0.65);
    scene.fog.density = 0.0010 + (1 - bright) * 0.0004;
    starPts.material.opacity = U.clamp(0.9 - bright * 1.7, 0, 0.9)
      * (0.75 + 0.25 * Math.sin(nowMs / 900));

    hemi.color.copy(_zen).multiplyScalar(2.2);
    hemi.groundColor.setRGB(0.16, 0.12, 0.09);
    hemi.intensity = 0.25 + bright * 0.45;
    ambient.intensity = 0.16 + bright * 0.2;

    // Sun sprites + directional lights. The sky slowly yaws so the
    // brightest sun rides above the settlement (the 3D analogue of the
    // 2D camera tracking it) — relative sun angles are preserved, so a
    // syzygy still stacks and flying stars still scatter.
    viewYaw += wrap(brightest.dir - viewYaw) * 0.02;
    const sorted = [...obs.suns].sort((a, b) => b.flux - a.flux);
    for (let k = 0; k < 3; k++) {
      const o = sorted[k], su = sunGroup[k];
      const az = wrap(o.dir - viewYaw);          // brightest → az ≈ 0 → over the town
      const el = 0.16 + 0.17 * Math.sin(o.dir * 2);   // 9°–19°: always in frame
      const R = 1050;
      const x = Math.cos(el) * Math.sin(az) * R;
      const y = Math.sin(el) * R;
      const z = Math.cos(el) * Math.cos(az) * R;
      su.disc.position.set(x, y, z);
      su.glow.position.set(x, y, z);
      const isDisc = o.d < C.consts.DISC_DIST;
      const closeness = U.clamp(1 - o.d / C.consts.DISC_DIST, 0, 1);
      const scale = isDisc
        ? U.clamp(o.angSize * 2200, 14, 700) * 1.9
        : U.clamp(9 / o.d, 2.5, 8);
      su.disc.scale.set(scale, scale, 1);
      su.glow.scale.set(scale * 3.2, scale * 3.2, 1);
      _tmp.setRGB(1,
        U.lerp(0.96, 0.45, Math.pow(closeness, 1.6)),
        U.lerp(0.84, 0.22, Math.pow(closeness, 1.3)));
      su.disc.material.color.copy(_tmp);
      su.glow.material.color.copy(_tmp);
      su.glow.material.opacity = isDisc ? 0.9 : 0.45;
      su.light.position.set(x, y, z);
      su.light.target.position.set(0, 0, 110);
      su.light.color.copy(_tmp);
      su.light.intensity = U.clamp(o.flux * 0.9, 0, 2.2);
    }

    // ---- Terrain & lake mood (over the world's biome base) ----
    const bg = biome.g;
    if (T < -15) {                                  // frost whitens from the biome base
      const f = U.clamp((-T - 15) / 80, 0, 1);
      terrainMat.color.setRGB(U.lerp(bg[0], 0.72, f), U.lerp(bg[1], 0.76, f), U.lerp(bg[2], 0.84, f));
    } else {                                         // biome base, scorch reddens it
      const hf = U.clamp((T - 45) / 250, 0, 1);
      terrainMat.color.setRGB(bg[0] + hf * 0.32, bg[1] - hf * 0.04, bg[2] - hf * 0.05);
    }
    lakeMat.color.setHex(T < -2 ? 0xc8dcec : T > 70 ? 0x6b3424 : biome.lake);
    lakeMat.roughness = T < -2 ? 0.7 : 0.15;

    // ---- Civilization staging ----
    pyramidAncient.visible = age < 4;
    pyramidLate.visible = age >= 4;
    antennaLight.visible = age >= 8 && Math.sin(nowMs / 500) > 0;
    townMesh.count = age >= 3 ? U.clamp(Math.floor((civ.tech - 190) / 110) + 2, 2, 16) : 0;
    skylineMesh.count = age >= 10 ? U.clamp(Math.floor((civ.tech - 8110) / 450) + 1, 1, 10) : 0;
    const dark = bright < 0.38;
    townMesh.material.emissive.setHex(dark && age >= 9 ? 0x4a3a14 : 0x000000);
    skylineMesh.material.emissive.setHex(dark ? 0x554218 : 0x000000);
    observatory.visible = age >= 5;
    factoryGroup.visible = age >= 8;
    coolingGroup.visible = age >= 10;
    mastGroup.visible = age >= 10;
    mastGroup.getObjectByName('beacon').visible = Math.sin(nowMs / 480) > 0;
    pendulumGroup.visible = state.flags.einstein && age >= 10;
    if (pendulumGroup.visible) {
      const ang = Math.sin(nowMs / 1400) * 0.55;
      bobMesh.position.set(Math.sin(ang) * 16, 28 - Math.cos(ang) * 16 * 0.9, 0);
    }
    gantryGroup.visible = age >= 12 || civ.fleet.ships > 0;
    furrows.visible = age >= 2;
    const rolls = Math.round(U.clamp(Math.sqrt(Math.max(civ.popD, 0)) * 5.5, 0, 48));
    skinsMesh.count = rolls;

    if (civ.fleet.building) {
      const t = (nowMs % 2600) / 2600;
      launchSprite.visible = true;
      launchSprite.position.set(NX(0.07) + 9, 4 + t * 130, 100);
      launchSprite.material.opacity = 1 - t;
    } else launchSprite.visible = false;

    for (let i = 0; i < searchlights.length; i++) {
      const s = searchlights[i];
      s.visible = age >= 12 && dark;
      if (s.visible) s.rotation.z = Math.sin(nowMs / (3100 + i * 900) + i * 2) * 0.5;
    }

    // Factory smoke / cooling steam.
    updatePlume(smokePts, factoryGroup.visible, factoryGroup.position, 17, nowMs);
    updatePlume(steamPts, coolingGroup.visible, coolingGroup.position, 19, nowMs);

    // ---- Syzygy lift ----
    const liftTarget = obs.alignSpread < 0.12 ? 1 : 0;
    syzygyLift += (liftTarget - syzygyLift) * 0.04;
    if (syzygyLift < 0.01) syzygyLift = 0;

    // ---- People & weather ----
    updatePeople(state, nowMs, dtMs);
    updateWeather(T, obs, nowMs, dtMs);
    updateMeteors3d(nowMs, bright < 0.42, cl.eraType === 'chaotic');

    // ---- Camera: gentle idle sway + trauma shake ----
    trauma = Math.max(0, trauma - dt * 1.1);
    const s2 = trauma * trauma;
    camera.position.set(
      Math.sin(nowMs / 9000) * 1.4 + s2 * 2.4 * Math.sin(nowMs * 0.061),
      6.5 + Math.sin(nowMs / 7000) * 0.4 + s2 * 2.0 * Math.cos(nowMs * 0.053),
      -26);
    camera.lookAt(Math.sin(nowMs / 13000) * 9,
      18 + s2 * 1.5 * Math.sin(nowMs * 0.045), 110);

    // Exposure follows the sky: a tri-solar day truly blinds.
    renderer.toneMappingExposure = 1.05 + bright * 0.18 - (1 - bright) * 0.12;

    // ---- Flash overlay ----
    if (flashEl) {
      if (flashA > 0.005) {
        flashEl.style.background = 'rgb(' + flashColor + ')';
        flashEl.style.opacity = flashA.toFixed(3);
        flashA *= Math.exp(-dt / 0.16);
      } else flashEl.style.opacity = '0';
    }

    renderer.render(scene, camera);
  }

  function updatePlume(pts, on, basePos, topY, nowMs) {
    pts.material.opacity += ((on ? 0.45 : 0) - pts.material.opacity) * 0.04;
    if (pts.material.opacity < 0.02) return;
    const a = pts.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) {
      const t = ((nowMs / 5200) + i / a.count) % 1;
      a.setXYZ(i,
        basePos.x + Math.sin(t * 5 + i) * 4 * t + (i % 2 ? 5 : -6),
        topY + t * 36,
        basePos.z + Math.cos(t * 3 + i) * 3 * t);
    }
    a.needsUpdate = true;
  }

  function wrap(a) {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a <= -Math.PI) a += 2 * Math.PI;
    return a;
  }

  // ----------------------------------------------------------
  // Title demo: the three-body dance, in space
  // ----------------------------------------------------------
  function titleDemo3d(nowMs) {
    if (!demo) {
      const rng = U.makeRng(2049);
      demoScene = new THREE.Scene();
      demoCam = new THREE.PerspectiveCamera(50, W / H, 0.1, 4000);
      const cols = [0xffd75e, 0xff9e64, 0x7ecbff];
      const glowTex = radialTexture([[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,230,170,0.6)'],
        [1, 'rgba(255,190,110,0)']], 128);
      demo = { sys: P.createSystem(rng), suns: [], trails: [], pTrail: null, n: 0 };
      for (let i = 0; i < 3; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowTex, color: cols[i], transparent: true,
          blending: THREE.AdditiveBlending, depthWrite: false }));
        sp.scale.set(26, 26, 1);
        demoScene.add(sp);
        demo.suns.push(sp);
        const tg = new THREE.BufferGeometry();
        tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2400 * 3), 3));
        const line = new THREE.Line(tg, new THREE.LineBasicMaterial({
          color: cols[i], transparent: true, opacity: 0.35 }));
        line.frustumCulled = false;
        demoScene.add(line);
        demo.trails.push({ line, n: 0 });
      }
      const pg = new THREE.BufferGeometry();
      pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2400 * 3), 3));
      demo.pTrail = { line: new THREE.Line(pg, new THREE.LineBasicMaterial({
        color: 0xe8f0ff, transparent: true, opacity: 0.5 })), n: 0 };
      demo.pTrail.line.frustumCulled = false;
      demoScene.add(demo.pTrail.line);
      // backdrop stars
      const n = 700, pos = new Float32Array(n * 3);
      const r2 = U.makeRng(31);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = r2.range(-900, 900); pos[i * 3 + 1] = r2.range(-500, 500);
        pos[i * 3 + 2] = r2.range(-900, -200);
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      demoScene.add(new THREE.Points(sg, new THREE.PointsMaterial({
        color: 0xb9c8e8, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.7 })));
    }
    P.advance(demo.sys, 0.004);
    const SC = 26;
    const pushPt = (tr, x, y) => {
      const a = tr.line.geometry.attributes.position;
      if (tr.n < 2400) { a.setXYZ(tr.n, x, y, 0); tr.n++; }
      else { a.array.copyWithin(0, 3); a.setXYZ(2399, x, y, 0); }
      tr.line.geometry.setDrawRange(0, tr.n);
      a.needsUpdate = true;
    };
    for (let i = 0; i < 3; i++) {
      const s = demo.sys.suns[i];
      demo.suns[i].position.set(s.x * SC, s.y * SC, 0);
      pushPt(demo.trails[i], s.x * SC, s.y * SC);
    }
    pushPt(demo.pTrail, demo.sys.planet.x * SC, demo.sys.planet.y * SC);

    demoCam.aspect = W / H;
    demoCam.updateProjectionMatrix();
    const t = nowMs / 26000;
    demoCam.position.set(Math.sin(t) * 240, 90 + Math.sin(nowMs / 9000) * 30, Math.cos(t) * 240);
    demoCam.lookAt(0, 0, 0);
    renderer.render(demoScene, demoCam);
  }

  // ----------------------------------------------------------
  // Public API — same shape as the 2D renderer
  // ----------------------------------------------------------

  // A canvas that has hosted a WebGL context can never host a 2D one, so
  // falling back means swapping in a fresh canvas element.
  function fall2d(err) {
    console.warn('3D renderer unavailable — switching to the 2D renderer.', err);
    fallback = true;
    try {
      const old = document.getElementById('world');
      const cv = document.createElement('canvas');
      cv.id = 'world';
      old.parentNode.replaceChild(cv, old);
      const vg = document.getElementById('vignette3d');
      if (vg) vg.style.display = 'none';   // the 2D renderer draws its own
      render2d.init(cv);
    } catch (e2) { console.error(e2); }
  }

  TB.render = {
    init(cv) {
      try { init3d(cv); } catch (e) { fall2d(e); }
    },
    render(state, nowMs) {
      if (fallback) return render2d.render(state, nowMs);
      try { render3d(state, nowMs); } catch (e) { fall2d(e); }
    },
    resize() { fallback ? render2d.resize() : resize(); },
    reseedTerrain(k) { if (fallback) render2d.reseedTerrain(k); else buildTerrain(11 + k * 71); },
    setBiome(worldIndex) {
      const name = setBiome3d(worldIndex);
      if (fallback && render2d.setBiome) render2d.setBiome(worldIndex);
      return name;
    },
    titleDemo(nowMs) {
      if (fallback) return render2d.titleDemo(nowMs);
      try { titleDemo3d(nowMs); } catch (e) { fall2d(e); }
    },
    addShake(a) {
      if (fallback) return render2d.addShake(a);
      trauma = Math.min(1, trauma + a * (reduceMotion ? 0.25 : 1));
    },
    flash(c, a) {
      if (fallback) return render2d.flash(c, a);
      flashColor = c; flashA = Math.max(flashA, a * (reduceMotion ? 0.4 : 1));
    },
  };
})();
