// Salón 3D — las puertas se abren y la cámara entra a un salón de gala en tonos neutros.
// Three.js se carga solo cuando la sección está cerca de la pantalla.
const stage = document.getElementById("salon-stage");
const canvas = document.getElementById("salon-canvas");
const loading = document.getElementById("salon-loading");
const replayBtn = document.getElementById("salon-replay");
const hint = document.getElementById("salon-hint");

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch (e) { return false; }
}

function fail() {
  loading.classList.add("is-hidden");
  const msg = document.createElement("div");
  msg.className = "salon-fallback";
  msg.textContent = "Tu navegador no pudo mostrar el recorrido 3D, pero el salón te espera en persona. ✦";
  stage.appendChild(msg);
}

if (stage && canvas) {
  const pre = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    pre.disconnect();
    if (!webglAvailable()) return fail();
    Promise.all([
      import("three"),
      import("three/addons/postprocessing/EffectComposer.js"),
      import("three/addons/postprocessing/RenderPass.js"),
      import("three/addons/postprocessing/UnrealBloomPass.js"),
      import("three/addons/postprocessing/OutputPass.js"),
      import("three/addons/environments/RoomEnvironment.js"),
      import("three/addons/utils/BufferGeometryUtils.js"),
    ]).then(build).catch((err) => { console.error(err); fail(); });
  }, { rootMargin: "600px 0px" });
  pre.observe(stage);
}

function build([THREE, { EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }, { RoomEnvironment }, { mergeGeometries }]) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isSmall = Math.min(window.innerWidth, window.innerHeight) < 600;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isSmall, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070605);
  scene.fog = new THREE.Fog(0x120e09, 34, 80);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 120);

  // ---------- Medidas del salón ----------
  const W = 22, L = 34, H = 9;           // ancho, largo, alto
  const HW = W / 2;
  const DOOR_W = 4.6, DOOR_H = 4.9;      // vano de la puerta (más el arco)
  const rand = mulberry32(7);

  // ---------- Materiales ----------
  const M = {
    ivory: new THREE.MeshStandardMaterial({ color: 0xf1e8d8, roughness: 0.85 }),
    wall: new THREE.MeshStandardMaterial({ color: 0xeee3d0, roughness: 0.9 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0xfbf6ee, roughness: 0.95 }),
    drape: new THREE.MeshStandardMaterial({ color: 0xf6eedf, roughness: 1, side: THREE.DoubleSide, emissive: 0x2a2014, emissiveIntensity: 0.5 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd8b673, metalness: 1, roughness: 0.3, envMapIntensity: 0.7 }),
    goldSoft: new THREE.MeshStandardMaterial({ color: 0xd6b878, metalness: 0.45, roughness: 0.45, envMapIntensity: 0.6 }),
    door: new THREE.MeshStandardMaterial({ color: 0xede2cc, roughness: 0.38, metalness: 0.05 }),
    facade: new THREE.MeshStandardMaterial({ color: 0x1b1712, roughness: 0.7 }),
    flame: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.2, 1.1), toneMapped: false }),
    bulb: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.0, 1.2), toneMapped: false }),
    crystal: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.3, roughness: 0.05, emissive: 0xfff1d6, emissiveIntensity: 0.55 }),
    candle: new THREE.MeshStandardMaterial({ color: 0xfaf3e6, roughness: 0.6, emissive: 0x3a2a12, emissiveIntensity: 0.4 }),
    cake: new THREE.MeshStandardMaterial({ color: 0xfdf9f2, roughness: 0.7 }),
    flower: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 }),
  };

  // ---------- Instancias (flores, cristales, llamas) ----------
  const flowers = [], crystals = [], flames = [], candles = [];
  const palette = [0xfbf6ec, 0xfbf6ec, 0xf4e3d7, 0xf0d6cc, 0xeedcbf, 0xf7ead9, 0xe9cfc4].map((c) => new THREE.Color(c));
  const leafColor = new THREE.Color(0x8d9b7d);
  function flowerBall(cx, cy, cz, r, n, spread = 1) {
    for (let i = 0; i < n; i++) {
      const u = rand() * 2 - 1, th = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      const rr = r * (0.82 + rand() * 0.2);
      const isLeaf = rand() < 0.12;
      flowers.push({
        p: [cx + s * Math.cos(th) * rr * spread, cy + u * rr, cz + s * Math.sin(th) * rr * spread],
        s: isLeaf ? 0.04 : 0.045 + rand() * 0.04,
        c: isLeaf ? leafColor : palette[(rand() * palette.length) | 0],
      });
    }
  }
  function flowerBlob(cx, cy, cz, sx, sy, sz, n) {
    for (let i = 0; i < n; i++) {
      const u = rand() * 2 - 1, th = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      flowers.push({ p: [cx + s * Math.cos(th) * sx, cy + u * sy, cz + s * Math.sin(th) * sz], s: 0.06 + rand() * 0.05, c: rand() < 0.1 ? leafColor : palette[(rand() * palette.length) | 0] });
    }
  }

  // ---------- Textura de mármol ----------
  function marbleTexture(base, vein, line) {
    const c = document.createElement("canvas"); c.width = c.height = 1024;
    const g = c.getContext("2d");
    g.fillStyle = base; g.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 28; i++) {
      g.strokeStyle = vein; g.lineWidth = 0.6 + rand() * 2.2;
      g.beginPath();
      let x = rand() * 1024, y = rand() * 1024; g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (rand() - 0.3) * 260; y += (rand() - 0.5) * 220; g.lineTo(x, y); }
      g.stroke();
    }
    g.strokeStyle = line; g.lineWidth = 3;
    for (let i = 0; i <= 1024; i += 512) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 1024); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(1024, i); g.stroke(); }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }
  const floorTex = marbleTexture("#efe6d6", "rgba(150,130,105,.18)", "rgba(190,165,120,.55)");
  floorTex.repeat.set(W / 4, L / 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, L), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.2, metalness: 0.0, envMapIntensity: 0.35 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -L / 2);
  scene.add(floor);

  const outTex = marbleTexture("#2a251f", "rgba(200,170,110,.12)", "rgba(200,164,92,.35)");
  outTex.repeat.set(4, 3);
  const outFloor = new THREE.Mesh(new THREE.PlaneGeometry(24, 14), new THREE.MeshStandardMaterial({ map: outTex, roughness: 0.25 }));
  outFloor.rotation.x = -Math.PI / 2; outFloor.position.set(0, 0, 7);
  scene.add(outFloor);

  // Alfombras
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 25), new THREE.MeshStandardMaterial({ color: 0xf7f0e3, roughness: 1 }));
  runner.rotation.x = -Math.PI / 2; runner.position.set(0, 0.01, -14);
  scene.add(runner);
  const outRunner = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 12), new THREE.MeshStandardMaterial({ color: 0xd9c49a, roughness: 0.9 }));
  outRunner.rotation.x = -Math.PI / 2; outRunner.position.set(0, 0.01, 6);
  scene.add(outRunner);

  // ---------- Paredes ----------
  const wallGeo = new THREE.PlaneGeometry(L, H);
  [-1, 1].forEach((side) => {
    const w = new THREE.Mesh(wallGeo, M.wall);
    w.position.set(side * HW, H / 2, -L / 2); w.rotation.y = -side * Math.PI / 2;
    scene.add(w);
  });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), M.wall);
  back.position.set(0, H / 2, -L); scene.add(back);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, L), new THREE.MeshStandardMaterial({ color: 0x1d1813, roughness: 1 }));
  ceiling.rotation.x = Math.PI / 2; ceiling.position.set(0, H, -L / 2); scene.add(ceiling);
  // Zócalo y cornisa dorados
  [-1, 1].forEach((side) => {
    [0.12, H - 0.25].forEach((y) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, y < 1 ? 0.24 : 0.18, L), M.goldSoft);
      m.position.set(side * (HW - 0.04), y, -L / 2); scene.add(m);
    });
  });

  // Forma de arco
  function archShape(w, h, shape = new THREE.Shape(), ox = 0, oy = 0) {
    const r = w / 2;
    shape.moveTo(ox - r, oy); shape.lineTo(ox + r, oy); shape.lineTo(ox + r, oy + h);
    shape.absarc(ox, oy + h, r, 0, Math.PI, false); shape.lineTo(ox - r, oy);
    return shape;
  }
  function archCurve(w, h, ox = 0, oy = 0) {
    const r = w / 2, pts = [];
    pts.push(new THREE.Vector3(ox - r, oy, 0));
    for (let i = 0; i <= 24; i++) { const a = Math.PI - (i / 24) * Math.PI; pts.push(new THREE.Vector3(ox + Math.cos(a) * r, oy + h + Math.sin(a) * r, 0)); }
    pts.push(new THREE.Vector3(ox + r, oy, 0));
    return new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.1);
  }

  // Espejos en arco con luz cálida entre pilastras
  function glowTexture(inner, outer) {
    const c = document.createElement("canvas"); c.width = 128; c.height = 256;
    const g = c.getContext("2d");
    const gr = g.createRadialGradient(64, 150, 5, 64, 150, 160);
    gr.addColorStop(0, inner); gr.addColorStop(1, outer);
    g.fillStyle = gr; g.fillRect(0, 0, 128, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const mirrorMat = new THREE.MeshBasicMaterial({ map: glowTexture("#fff1d2", "#b89567"), color: new THREE.Color(1.15, 1.05, 0.95) });
  const mirrorGeo = new THREE.ShapeGeometry(archShape(2.4, 3.6), 24);
  mirrorGeo.computeBoundingBox();
  remapUV(mirrorGeo);
  const frameGeo = new THREE.TubeGeometry(archCurve(2.5, 3.6), 60, 0.06, 6, false);
  const pilasterGeo = new THREE.BoxGeometry(0.7, H, 0.35);
  const capGeo = new THREE.BoxGeometry(0.9, 0.22, 0.5);
  for (let z = -2; z >= -L + 1; z -= 4) {
    [-1, 1].forEach((side) => {
      const p = new THREE.Mesh(pilasterGeo, M.ivory);
      p.position.set(side * (HW - 0.17), H / 2, z); p.rotation.y = side * Math.PI / 2; scene.add(p);
      const cap = new THREE.Mesh(capGeo, M.goldSoft);
      cap.position.set(side * (HW - 0.2), 6.3, z); cap.rotation.y = side * Math.PI / 2; scene.add(cap);
      if (z - 2 > -L + 1) {
        const mz = z - 2;
        const mirror = new THREE.Mesh(mirrorGeo, mirrorMat);
        mirror.position.set(side * (HW - 0.02), 1.0, mz); mirror.rotation.y = -side * Math.PI / 2; scene.add(mirror);
        const fr = new THREE.Mesh(frameGeo, M.gold);
        fr.position.copy(mirror.position); fr.position.x -= side * 0.02; fr.rotation.copy(mirror.rotation); scene.add(fr);
        // apliques de pared
        addSconce(side * (HW - 0.25), 4.4, z, side);
      }
    });
  }

  // ---------- Fachada con la puerta ----------
  const wallShape = new THREE.Shape();
  wallShape.moveTo(-HW, -0.05); wallShape.lineTo(HW, -0.05); wallShape.lineTo(HW, H); wallShape.lineTo(-HW, H); wallShape.lineTo(-HW, -0.05);
  wallShape.holes.push(new THREE.Path(archShape(DOOR_W, DOOR_H).getPoints(32)));
  const wallShapeGeo = new THREE.ShapeGeometry(wallShape, 32);
  const facadeOut = new THREE.Mesh(wallShapeGeo, M.facade); facadeOut.position.z = 0.02; scene.add(facadeOut);
  const facadeIn = new THREE.Mesh(wallShapeGeo, M.wall); facadeIn.rotation.y = Math.PI; facadeIn.position.z = -0.02; scene.add(facadeIn);
  // marco dorado del arco (doble)
  [0.0, 0.32].forEach((off, i) => {
    const t = new THREE.Mesh(new THREE.TubeGeometry(archCurve(DOOR_W + 0.18 + off * 2, DOOR_H, 0, 0), 80, i ? 0.05 : 0.11, 8, false), M.gold);
    t.position.z = 0.08; scene.add(t);
  });
  // grosor del vano
  const revealShape = archShape(DOOR_W + 0.2, DOOR_H, undefined, 0, -0.05);
  revealShape.holes.push(new THREE.Path(archShape(DOOR_W, DOOR_H).getPoints(40)));
  const reveal = new THREE.Mesh(new THREE.ExtrudeGeometry(revealShape, { depth: 0.5, bevelEnabled: false, curveSegments: 32 }), M.goldSoft);
  reveal.position.z = -0.45; scene.add(reveal);
  // luneto (abanico de luz sobre la puerta)
  const fan = new THREE.Mesh(new THREE.CircleGeometry(DOOR_W / 2 - 0.05, 32, 0, Math.PI), new THREE.MeshBasicMaterial({ map: glowTexture("#fff3da", "#a7834f"), color: new THREE.Color(0.95, 0.88, 0.78) }));
  fan.position.set(0, DOOR_H, -0.25); scene.add(fan);
  const fanBar = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W, 0.12, 0.2), M.gold); fanBar.position.set(0, DOOR_H + 0.02, -0.2); scene.add(fanBar);
  for (let i = 1; i < 6; i++) {
    const a = (i / 6) * Math.PI;
    const ray = new THREE.Mesh(new THREE.BoxGeometry(0.04, DOOR_W / 2 - 0.1, 0.06), M.gold);
    ray.position.set(Math.cos(a) * (DOOR_W / 4), DOOR_H + Math.sin(a) * (DOOR_W / 4), -0.2);
    ray.rotation.z = a - Math.PI / 2; scene.add(ray);
  }

  // Hojas de la puerta
  function panelFrame(w, h, thick = 0.035) {
    const geos = [];
    const add = (gw, gh, x, y) => { const g = new THREE.BoxGeometry(gw, gh, 0.03); g.translate(x, y, 0); geos.push(g); };
    add(w, thick, 0, h / 2); add(w, thick, 0, -h / 2); add(thick, h, -w / 2, 0); add(thick, h, w / 2, 0);
    return geos;
  }
  function makeLeaf(dir) {
    const leafW = DOOR_W / 2 - 0.03;
    const pivot = new THREE.Group();
    pivot.position.set(-dir * DOOR_W / 2, 0, -0.1);
    const body = new THREE.Mesh(new THREE.BoxGeometry(leafW, DOOR_H - 0.02, 0.12), M.door);
    body.position.set(dir * leafW / 2, DOOR_H / 2, 0); pivot.add(body);
    const trims = [];
    [1, -1].forEach((face) => {
      panelFrame(leafW - 0.45, 2.3).forEach((g) => { g.translate(dir * leafW / 2, 3.25, face * 0.075); trims.push(g); });
      panelFrame(leafW - 0.45, 1.3).forEach((g) => { g.translate(dir * leafW / 2, 1.05, face * 0.075); trims.push(g); });
      panelFrame(leafW - 0.7, 1.9, 0.02).forEach((g) => { g.translate(dir * leafW / 2, 3.25, face * 0.075); trims.push(g); });
      const handle = new THREE.CylinderGeometry(0.025, 0.025, 0.9, 10); handle.translate(dir * (leafW - 0.22), 2.25, face * 0.13); trims.push(handle);
      const knobA = new THREE.SphereGeometry(0.045, 10, 8); knobA.translate(dir * (leafW - 0.22), 2.7, face * 0.13); trims.push(knobA);
      const knobB = new THREE.SphereGeometry(0.045, 10, 8); knobB.translate(dir * (leafW - 0.22), 1.8, face * 0.13); trims.push(knobB);
      const rose = new THREE.TorusGeometry(0.14, 0.02, 8, 24); rose.translate(dir * leafW / 2, 3.25, face * 0.08); trims.push(rose);
    });
    pivot.add(new THREE.Mesh(mergeGeometries(trims.map((g) => g.toNonIndexed())), M.gold));
    scene.add(pivot);
    return pivot;
  }
  const leafL = makeLeaf(1), leafR = makeLeaf(-1);
  // luz que se filtra entre las hojas
  const gap = new THREE.Mesh(new THREE.PlaneGeometry(0.06, DOOR_H - 0.1), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.3, 1.4), toneMapped: false }));
  gap.position.set(0, DOOR_H / 2, -0.3); scene.add(gap);

  // Luces de fachada
  [-1, 1].forEach((s) => addSconce(s * (DOOR_W / 2 + 1.0), 3.6, 0.12, 0, true));
  const porch = new THREE.PointLight(0xffd29a, 6, 14, 2); porch.position.set(0, 4.2, 3.2); scene.add(porch);

  // Apliques
  function addSconce(x, y, z, side, outside = false) {
    const g = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 16), M.gold);
    plate.rotation.x = Math.PI / 2; g.add(plate);
    const arm = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.018, 6, 16, Math.PI), M.gold);
    g.add(arm);
    g.position.set(x, y, z);
    if (side) g.rotation.y = -side * Math.PI / 2;
    scene.add(g);
    const wp = new THREE.Vector3(0, 0.18, 0.2); g.updateMatrixWorld(); wp.applyMatrix4(g.matrixWorld);
    const tw = new THREE.Vector3(0.2, 0.1, 0.12); const tw2 = new THREE.Vector3(-0.2, 0.1, 0.12);
    [tw, tw2].forEach((v) => { v.applyMatrix4(g.matrixWorld); candles.push({ p: [v.x, v.y - 0.05, v.z], h: 0.16, r: 0.025 }); flames.push({ p: [v.x, v.y + 0.07, v.z], s: 0.035 }); });
  }

  // ---------- Techo de tela plisada ----------
  const drapeGeo = new THREE.PlaneGeometry(W - 0.4, L - 1, 90, 160);
  drapeGeo.rotateX(Math.PI / 2);
  const pos = drapeGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const u = (x + (W - 0.4) / 2) / (W - 0.4);
    const sag = Math.sin(Math.PI * u);
    const pleat = 0.5 + 0.5 * Math.cos((z / 1.1) * Math.PI * 2);
    pos.setY(i, -1.15 * sag - 0.16 * pleat * sag - 0.06 * Math.cos((z / 1.1) * Math.PI * 2 + x * 0.4));
  }
  drapeGeo.computeVertexNormals();
  const drape = new THREE.Mesh(drapeGeo, M.drape); drape.position.set(0, H - 0.15, -L / 2); scene.add(drape);
  // Guirnaldas de tela a lo largo de las paredes
  [-1, 1].forEach((side) => {
    for (let z = -2; z > -L + 1; z -= 4) {
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(side * (HW - 0.3), 7.7, z), new THREE.Vector3(side * (HW - 0.35), 6.9, z - 2), new THREE.Vector3(side * (HW - 0.3), 7.7, z - 4));
      const swag = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.16, 8, false), M.cloth); scene.add(swag);
      flowerBall(side * (HW - 0.45), 7.65, z, 0.32, 70);
    }
  });

  // ---------- Candelabros ----------
  const chandelierZ = [-8, -17, -26];
  const lights = [];
  chandelierZ.forEach((cz) => {
    const y0 = 5.4;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, H - y0 - 1.0, 8), M.gold);
    rod.position.set(0, (H + y0) / 2 - 0.2, cz); scene.add(rod);
    const tiers = [[1.35, 0, 16], [1.0, 0.6, 12], [0.6, 1.15, 8]];
    tiers.forEach(([r, dy, n]) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.03, 8, 64), M.gold);
      ring.rotation.x = Math.PI / 2; ring.position.set(0, y0 + dy, cz); scene.add(ring);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const x = Math.cos(a) * r, z = cz + Math.sin(a) * r;
        candles.push({ p: [x, y0 + dy + 0.1, z], h: 0.18, r: 0.03 });
        flames.push({ p: [x, y0 + dy + 0.24, z], s: 0.04 });
        const strand = 3 + ((i % 2) ? 2 : 0);
        for (let k = 0; k < strand; k++) crystals.push({ p: [x * 0.97, y0 + dy - 0.12 - k * 0.13, z - (z - cz) * 0.03], s: 0.05 - k * 0.006 });
      }
      // guirnaldas de cristal entre brazos
      for (let i = 0; i < n * 3; i++) {
        const a = (i / (n * 3)) * Math.PI * 2, sagk = Math.sin(((i % 3) / 3) * Math.PI) * 0.14;
        crystals.push({ p: [Math.cos(a) * r, y0 + dy - 0.05 - sagk, cz + Math.sin(a) * r], s: 0.028 });
      }
    });
    // cascada central
    for (let k = 0; k < 14; k++) {
      const a = k * 2.4, rr = 0.08 + k * 0.025;
      crystals.push({ p: [Math.cos(a) * rr, y0 - 0.2 - k * 0.07, cz + Math.sin(a) * rr], s: 0.05 });
    }
    crystals.push({ p: [0, y0 - 1.3, cz], s: 0.11 });
    // nube de flores sobre el candelabro
    flowerBlob(0, H - 0.95, cz, 2.0, 0.35, 2.0, isSmall ? 380 : 600);
    const light = new THREE.PointLight(0xffd6a1, 14, 26, 1.6);
    light.position.set(0, y0 + 0.3, cz); scene.add(light); lights.push(light);
  });

  // ---------- Mesas, sillas y centros de mesa ----------
  const tablePos = [];
  [-8, -4.3, 4.3, 8].forEach((x) => [-5.5, -10.5, -15.5, -20.5].forEach((z) => tablePos.push([x, z])));
  const clothGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.95, 1.05, 0.76, 40, 1, true).translate(0, 0.38, 0).toNonIndexed(),
    new THREE.CircleGeometry(0.95, 40).rotateX(-Math.PI / 2).translate(0, 0.761, 0).toNonIndexed(),
  ]);
  const clothMat = M.cloth.clone(); clothMat.side = THREE.DoubleSide;
  const tables = new THREE.InstancedMesh(clothGeo, clothMat, tablePos.length);
  const sashGeo = new THREE.CylinderGeometry(0.965, 0.98, 0.07, 40, 1, true).translate(0, 0.6, 0);
  const sashes = new THREE.InstancedMesh(sashGeo, M.goldSoft, tablePos.length);
  // silla tipo tiffany
  const chairParts = [];
  const cyl = (r, h, x, y, z, rx = 0, rz = 0) => { const g = new THREE.CylinderGeometry(r, r, h, 6); g.rotateX(rx); g.rotateZ(rz); g.translate(x, y, z); chairParts.push(g.toNonIndexed()); };
  [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]].forEach(([x, z]) => cyl(0.016, 0.45, x, 0.225, z));
  cyl(0.016, 0.52, -0.19, 0.71, 0.2); cyl(0.016, 0.52, 0.19, 0.71, 0.2);
  [0.62, 0.8, 0.96].forEach((y) => cyl(0.012, 0.38, 0, y, 0.2, 0, Math.PI / 2));
  [-0.09, 0, 0.09].forEach((x) => cyl(0.009, 0.32, x, 0.79, 0.2));
  cyl(0.01, 0.38, 0, 0.12, -0.19, 0, Math.PI / 2); cyl(0.01, 0.38, 0, 0.12, 0.19, 0, Math.PI / 2);
  const seat = new THREE.BoxGeometry(0.44, 0.04, 0.44).translate(0, 0.45, 0); chairParts.push(seat.toNonIndexed());
  const chairGeo = mergeGeometries(chairParts);
  const cushionGeo = new THREE.BoxGeometry(0.4, 0.05, 0.4).translate(0, 0.49, 0);
  const CHAIRS = 8;
  const chairs = new THREE.InstancedMesh(chairGeo, M.gold, tablePos.length * CHAIRS);
  const cushions = new THREE.InstancedMesh(cushionGeo, M.cloth, tablePos.length * CHAIRS);
  const stands = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1), yAxis = new THREE.Vector3(0, 1, 0);
  tablePos.forEach(([x, z], ti) => {
    m4.makeTranslation(x, 0, z); tables.setMatrixAt(ti, m4); sashes.setMatrixAt(ti, m4);
    for (let c = 0; c < CHAIRS; c++) {
      const a = (c / CHAIRS) * Math.PI * 2 + 0.2;
      q.setFromAxisAngle(yAxis, Math.PI / 2 - a);
      v.set(x + Math.cos(a) * 1.35, 0, z + Math.sin(a) * 1.35);
      m4.compose(v, q, sc);
      chairs.setMatrixAt(ti * CHAIRS + c, m4); cushions.setMatrixAt(ti * CHAIRS + c, m4);
    }
    stands.push([x, z]);
    flowerBall(x, 2.05, z, 0.46, isSmall ? 160 : 240);
    for (let k = 0; k < 10; k++) { const a = rand() * Math.PI * 2; flowers.push({ p: [x + Math.cos(a) * 0.35, 1.72 - rand() * 0.45, z + Math.sin(a) * 0.35], s: 0.06 + rand() * 0.04, c: palette[(rand() * palette.length) | 0] }); }
    [[0.45, 0], [-0.3, 0.35], [-0.3, -0.35]].forEach(([dx, dz]) => { candles.push({ p: [x + dx, 0.82, z + dz], h: 0.12, r: 0.035 }); flames.push({ p: [x + dx, 0.92, z + dz], s: 0.03 }); });
  });
  scene.add(tables, sashes, chairs, cushions);
  const standGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.02, 0.03, 1.15, 8).translate(0, 1.33, 0).toNonIndexed(),
    new THREE.CylinderGeometry(0.16, 0.2, 0.05, 20).translate(0, 0.79, 0).toNonIndexed(),
    new THREE.CylinderGeometry(0.22, 0.06, 0.12, 20).translate(0, 1.92, 0).toNonIndexed(),
  ]);
  const standMesh = new THREE.InstancedMesh(standGeo, M.gold, stands.length);
  stands.forEach(([x, z], i) => { m4.makeTranslation(x, 0, z); standMesh.setMatrixAt(i, m4); });
  scene.add(standMesh);

  // Velas del pasillo
  for (let z = -1.5; z > -26; z -= 1.6) {
    [-1.45, 1.45].forEach((x) => {
      const h = 0.25 + ((Math.abs(z * 10) | 0) % 3) * 0.12;
      candles.push({ p: [x, h / 2, z], h, r: 0.07 });
      flames.push({ p: [x, h + 0.06, z], s: 0.045 });
      if (Math.round(z * 10) % 32 === 0 || z === -1.5) flowerBlob(x * 1.1, 0.15, z, 0.35, 0.18, 0.35, 60);
    });
  }

  // ---------- Tarima, arco floral y torta ----------
  const stageZ = -30.5;
  const platform = new THREE.Mesh(new THREE.BoxGeometry(13, 0.6, 6.2), M.ivory); platform.position.set(0, 0.3, stageZ); scene.add(platform);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(13.02, 0.06, 0.06), M.gold); lip.position.set(0, 0.6, stageZ + 3.1); scene.add(lip);
  const steps = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 0.8), M.ivory); steps.position.set(0, 0.15, stageZ + 3.5); scene.add(steps);
  // nicho iluminado detrás
  const niche = new THREE.Mesh(new THREE.ShapeGeometry(archShape(7, 4.2), 32), new THREE.MeshBasicMaterial({ map: glowTexture("#fff4dc", "#9c7a4c"), color: new THREE.Color(1.1, 1.0, 0.9) }));
  remapUV(niche.geometry);
  niche.position.set(0, 0.6, -L + 0.02); scene.add(niche);
  const nicheFrame = new THREE.Mesh(new THREE.TubeGeometry(archCurve(7.2, 4.2), 80, 0.09, 8, false), M.gold); nicheFrame.position.set(0, 0.6, -L + 0.08); scene.add(nicheFrame);
  // arco floral
  const archR = 3.1, archH = 2.4;
  for (let i = 0; i <= 44; i++) {
    const t = i / 44;
    let x, y;
    if (t < 0.25) { x = -archR; y = 0.6 + (t / 0.25) * archH; }
    else if (t > 0.75) { x = archR; y = 0.6 + ((1 - t) / 0.25) * archH; }
    else { const a = Math.PI - ((t - 0.25) / 0.5) * Math.PI; x = Math.cos(a) * archR; y = 0.6 + archH + Math.sin(a) * archR; }
    const thick = (t < 0.12 || t > 0.88) ? 0.62 : (t > 0.35 && t < 0.65 ? 0.32 : 0.45);
    flowerBlob(x, y, stageZ - 1.4, thick, thick, thick * 0.8, isSmall ? 40 : 60);
  }
  // torta de varios pisos (¡YeNoVa!)
  const cakeTable = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.8, 0.85, 40), M.cloth); cakeTable.position.set(0, 1.025, stageZ - 0.5); scene.add(cakeTable);
  let cy = 1.45;
  [[0.55, 0.38], [0.44, 0.34], [0.33, 0.3], [0.23, 0.26]].forEach(([r, h], i) => {
    const tier = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 48), M.cake); tier.position.set(0, cy + h / 2, stageZ - 0.5); scene.add(tier);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.005, r + 0.005, 0.04, 48, 1, true), M.gold); band.position.set(0, cy + 0.03, stageZ - 0.5); scene.add(band);
    const pearls = 18 - i * 3;
    for (let k = 0; k < pearls; k++) { const a = k / pearls * Math.PI * 2 + i; if (k % 3 === 0) flowers.push({ p: [Math.cos(a) * (r + 0.02), cy + h, stageZ - 0.5 + Math.sin(a) * (r + 0.02)], s: 0.05, c: palette[(k + i) % palette.length] }); }
    cy += h;
  });
  flowerBlob(0, cy + 0.08, stageZ - 0.5, 0.16, 0.08, 0.16, 18);
  const stageLight = new THREE.SpotLight(0xffe3b8, 40, 22, 0.42, 0.6, 1.4);
  stageLight.position.set(0, 7.5, stageZ + 7); stageLight.target.position.set(0, 1.4, stageZ - 0.5); scene.add(stageLight, stageLight.target);
  // arreglos laterales altos en la tarima y en la entrada interior
  [[-5.2, stageZ - 1], [5.2, stageZ - 1], [-2.6, -1.2], [2.6, -1.2]].forEach(([x, z]) => {
    const urn = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 8), M.gold);
    const base = z < -20 ? 0.6 : 0;
    urn.position.set(x, base + 0.8, z); scene.add(urn);
    flowerBall(x, base + 1.9, z, 0.55, isSmall ? 220 : 340);
  });
  // arreglos de la entrada exterior
  [-1, 1].forEach((s) => {
    const urn = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.18, 0.9, 24), M.gold); urn.position.set(s * 3.4, 0.45, 1.4); scene.add(urn);
    flowerBall(s * 3.4, 1.4, 1.4, 0.62, isSmall ? 260 : 400);
    for (let z = 2.5; z < 10; z += 2) { candles.push({ p: [s * 1.6, 0.2, z], h: 0.4, r: 0.08 }); flames.push({ p: [s * 1.6, 0.46, z], s: 0.05 }); }
  });

  // ---------- Crear las mallas instanciadas ----------
  const flowerGeo = new THREE.IcosahedronGeometry(1, 0);
  const flowerMesh = new THREE.InstancedMesh(flowerGeo, M.flower, flowers.length);
  flowers.forEach((f, i) => {
    q.setFromEuler(new THREE.Euler(rand() * 3, rand() * 3, rand() * 3));
    m4.compose(v.set(...f.p), q, sc.set(f.s, f.s * 0.85, f.s)); flowerMesh.setMatrixAt(i, m4); flowerMesh.setColorAt(i, f.c);
  });
  sc.set(1, 1, 1);
  scene.add(flowerMesh);
  const crystalMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), M.crystal, crystals.length);
  crystals.forEach((c, i) => { m4.compose(v.set(...c.p), q.identity(), new THREE.Vector3(c.s * 0.7, c.s * 1.3, c.s * 0.7)); crystalMesh.setMatrixAt(i, m4); });
  scene.add(crystalMesh);
  const candleMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 12), M.candle, candles.length);
  candles.forEach((c, i) => { m4.compose(v.set(...c.p), q.identity(), new THREE.Vector3(c.r, c.h, c.r)); candleMesh.setMatrixAt(i, m4); });
  scene.add(candleMesh);
  const flameGeo = new THREE.SphereGeometry(1, 8, 6); flameGeo.scale(0.7, 1.5, 0.7);
  const flameMesh = new THREE.InstancedMesh(flameGeo, M.flame, flames.length);
  flames.forEach((f, i) => { m4.compose(v.set(...f.p), q.identity(), new THREE.Vector3(f.s, f.s, f.s)); flameMesh.setMatrixAt(i, m4); });
  scene.add(flameMesh);

  // Luz general
  scene.add(new THREE.HemisphereLight(0xfff2dc, 0x3a2e20, 0.35));
  const fill = new THREE.PointLight(0xffe0b0, 6, 30, 1.5); fill.position.set(0, 3.5, -3); scene.add(fill);

  // Destellos dorados flotando
  const SPARKS = isSmall ? 220 : 380;
  const sparkPos = new Float32Array(SPARKS * 3);
  for (let i = 0; i < SPARKS; i++) { sparkPos[i * 3] = (rand() - 0.5) * W * 0.9; sparkPos[i * 3 + 1] = rand() * 7.5 + 0.3; sparkPos[i * 3 + 2] = -rand() * L; }
  const sparkGeo = new THREE.BufferGeometry(); sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
  const sparkTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,240,200,1)"); gr.addColorStop(0.3, "rgba(240,205,130,.6)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ size: 0.09, map: sparkTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffe2a8 }));
  scene.add(sparks);

  // El mapa de entorno solo da reflejos sutiles; el dorado lo aprovecha más.
  scene.traverse((o) => { const m = o.material; if (m && m.isMeshStandardMaterial && m.envMapIntensity === 1) m.envMapIntensity = 0.12; });

  // ---------- Posprocesado (brillo) ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.5, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---------- Cámara y animación ----------
  const START = { pos: new THREE.Vector3(0, 2.4, 10.5), look: new THREE.Vector3(0, 3.4, 0) };
  const END = { pos: new THREE.Vector3(0, 2.25, -4.2), look: new THREE.Vector3(0, 2.4, -22) };
  let playStart = null;        // tiempo de inicio de la apertura
  let played = false;
  let yaw = 0, pitch = 0, targetYaw = 0, targetPitch = 0, userTouched = 0;
  const OPEN = 1.85;           // radianes que gira cada hoja

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const clamp01 = (t) => Math.min(1, Math.max(0, t));

  function setState(elapsed) {
    const d = reduceMotion ? 1 : ease(clamp01((elapsed - 0.4) / 2.6));
    const c = reduceMotion ? 1 : ease(clamp01((elapsed - 1.4) / 5.2));
    leafL.rotation.y = OPEN * d;
    leafR.rotation.y = -OPEN * d;
    gap.visible = d < 0.02;
    camera.position.lerpVectors(START.pos, END.pos, c);
    camera.position.y += Math.sin(c * Math.PI) * 0.12;
    const look = new THREE.Vector3().lerpVectors(START.look, END.look, c);
    renderer.toneMappingExposure = 0.9 + 0.2 * d;
    return { look, done: c >= 1 };
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 72 : w / h < 1.2 ? 62 : 52;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  // Mirar alrededor arrastrando (horizontal en móvil, sin bloquear el scroll vertical)
  let dragging = false, lx = 0, ly = 0;
  canvas.addEventListener("pointerdown", (e) => { dragging = true; lx = e.clientX; ly = e.clientY; });
  window.addEventListener("pointerup", () => { dragging = false; });
  canvas.addEventListener("pointercancel", () => { dragging = false; });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    targetYaw = Math.max(-0.9, Math.min(0.9, targetYaw + (e.clientX - lx) * 0.005));
    targetPitch = Math.max(-0.25, Math.min(0.45, targetPitch + (e.clientY - ly) * 0.003));
    lx = e.clientX; ly = e.clientY; userTouched = performance.now();
    hint.hidden = true;
  });

  function play() {
    playStart = performance.now();
    played = true;
    targetYaw = targetPitch = 0;
    replayBtn.hidden = true; hint.hidden = true;
  }
  replayBtn.addEventListener("click", play);

  let visible = false, raf = null;
  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();
  function frame(now) {
    raf = visible ? requestAnimationFrame(frame) : null;
    const t = clock.getElapsedTime();
    const elapsed = window.__salonT ?? (playStart === null ? 0 : (now - playStart) / 1000);
    const { look, done } = setState(elapsed);
    if (done && replayBtn.hidden && played) { replayBtn.hidden = false; if (!userTouched) hint.hidden = false; }
    // paseo suave de la mirada cuando nadie interactúa
    const idle = done && now - userTouched > 4000;
    const autoYaw = idle ? Math.sin(t * 0.18) * 0.38 : 0;
    yaw += ((done ? targetYaw : 0) + autoYaw - yaw) * 0.05;
    pitch += ((done ? targetPitch : 0) - pitch) * 0.06;
    tmp.copy(look).sub(camera.position);
    tmp.applyAxisAngle(yAxis, -yaw);
    const right = new THREE.Vector3().crossVectors(tmp, yAxis).normalize();
    tmp.applyAxisAngle(right, pitch);
    camera.lookAt(tmp.add(camera.position));
    // destellos y llamas
    const sp = sparkGeo.attributes.position;
    for (let i = 0; i < SPARKS; i++) {
      let y = sp.getY(i) + 0.004 + Math.sin(t + i) * 0.002;
      if (y > 8) y = 0.3;
      sp.setY(i, y); sp.setX(i, sp.getX(i) + Math.sin(t * 0.5 + i * 1.7) * 0.002);
    }
    sp.needsUpdate = true;
    lights.forEach((l, i) => { l.intensity = 14 + Math.sin(t * 3 + i * 2) * 0.6; });
    composer.render();
    window.__salonFrames = (window.__salonFrames || 0) + 1;
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !raf) { raf = requestAnimationFrame(frame); }
  }, { threshold: 0 }).observe(stage);
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !played) play();
  }, { threshold: 0.55 }).observe(stage);

  loading.classList.add("is-hidden");
  window.__salon = { play, setState }; // útil para pruebas
}

// UV 0..1 para formas planas (para que el degradado cubra el arco completo)
function remapUV(geo) {
  geo.computeBoundingBox();
  const b = geo.boundingBox, uv = geo.attributes.uv, p = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) - b.min.x) / (b.max.x - b.min.x), (p.getY(i) - b.min.y) / (b.max.y - b.min.y));
  uv.needsUpdate = true;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
