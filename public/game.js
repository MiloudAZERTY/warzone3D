import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

// ================================================
// WARZONE 3D
// ================================================

const game = document.getElementById("game");
const menu = document.getElementById("menu");
const playButton = document.getElementById("playButton");
const healthDisplay = document.getElementById("health");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b8df);
scene.fog = new THREE.Fog(0x87b8df, 90, 240);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  500
);

camera.position.set(0, 1.7, -22);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
game.appendChild(renderer.domElement);

// ================================================
// LUMIERES
// ================================================

scene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 2));

const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(30, 60, 20);
sun.castShadow = true;
scene.add(sun);

// ================================================
// SOL
// ================================================

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(250, 250),
  new THREE.MeshStandardMaterial({ color: 0x52634a })
);

ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// ================================================
// VARIABLES
// ================================================

const keys = {};
const walls = [];
const floors = [];
const buildings = [];
const enemies = [];
const bullets = [];
const enemyBullets = [];

let started = false;
let gameOver = false;

let yaw = 0;
let pitch = 0;

let health = 100;
let protectionTimer = 0;
let stamina = 100;
let medkits = 3;

let selectedSlot = 2;
let lastShot = 0;

let verticalVelocity = 0;
let grounded = true;

const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.35;

const GRAVITY = 22;
const JUMP_FORCE = 8.5;

const clock = new THREE.Clock();

// ================================================
// HUD
// ================================================

const hud = document.createElement("div");

hud.style.cssText = `
  position:fixed;
  left:25px;
  bottom:25px;
  width:250px;
  z-index:1001;
  color:white;
  font:bold 15px Arial;
  text-shadow:1px 1px 3px black;
  pointer-events:none;
`;

function createBar(color, height) {
  const outer = document.createElement("div");

  outer.style.cssText = `
    width:100%;
    height:${height}px;
    background:#222;
    border:2px solid white;
    border-radius:5px;
    overflow:hidden;
  `;

  const inner = document.createElement("div");

  inner.style.cssText = `
    width:100%;
    height:100%;
    background:${color};
    transition:width .15s;
  `;

  outer.appendChild(inner);
  return { outer, inner };
}

const healthText = document.createElement("div");
const healthBar = createBar("#20d64b", 22);

const staminaText = document.createElement("div");
const staminaBar = createBar("#35baff", 12);

healthText.style.marginBottom = "5px";
staminaText.style.margin = "10px 0 4px";
staminaText.textContent = "ENDURANCE";

hud.appendChild(healthText);
hud.appendChild(healthBar.outer);
hud.appendChild(staminaText);
hud.appendChild(staminaBar.outer);

game.appendChild(hud);

function updateHUD() {
  health = Math.max(0, Math.min(100, health));
  stamina = Math.max(0, Math.min(100, stamina));

  healthText.textContent = "VIE : " + health + " / 100";
  healthBar.inner.style.width = health + "%";

  healthBar.inner.style.background =
    health > 60 ? "#20d64b" :
    health > 30 ? "#ff9900" : "#ed2525";

  staminaBar.inner.style.width = stamina + "%";

  if (healthDisplay) {
    healthDisplay.textContent = health;
  }
}

// ================================================
// INVENTAIRE
// ================================================

const weapons = [
  { name: "SOINS", damage: 0, delay: 0, speed: 0 },
  { name: "PISTOLET", damage: 25, delay: 350, speed: 55 },
  { name: "FUSIL", damage: 15, delay: 120, speed: 65 },
  { name: "POMPE", damage: 12, delay: 650, speed: 55 },
  { name: "SNIPER", damage: 100, delay: 1000, speed: 100 }
];

const inventory = document.createElement("div");

inventory.style.cssText = `
  position:fixed;
  left:50%;
  bottom:20px;
  transform:translateX(-50%);
  display:flex;
  gap:6px;
  z-index:1002;
  font:bold 12px Arial;
  pointer-events:none;
`;

game.appendChild(inventory);

function updateInventory() {
  inventory.innerHTML = "";

  const names = [
    "1 SOINS",
    "2 PISTOLET",
    "3 FUSIL",
    "4 POMPE",
    "5 SNIPER"
  ];

  names.forEach((name, index) => {
    const slot = document.createElement("div");

    slot.textContent =
      index === 0 ? name + " x" + medkits : name;

    slot.style.cssText = `
      padding:10px 9px;
      border:2px solid white;
      border-radius:6px;
      color:white;
      background:${selectedSlot === index + 1 ? "#d49a25" : "rgba(0,0,0,.8)"};
    `;

    inventory.appendChild(slot);
  });
}

// ================================================
// ARME VISIBLE
// ================================================

const weaponGroup = new THREE.Group();

camera.add(weaponGroup);
weaponGroup.position.set(0.35, -0.32, -0.65);

function weaponPart(sx, sy, sz, x, y, z, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(sx, sy, sz),
    new THREE.MeshBasicMaterial({
      color,
      depthTest: false,
      depthWrite: false
    })
  );

  mesh.position.set(x, y, z);
  mesh.renderOrder = 999;
  mesh.frustumCulled = false;

  weaponGroup.add(mesh);
}

function buildWeapon() {
  weaponGroup.clear();

  weaponPart(0.22, 0.18, 0.65, 0, 0, 0, 0x222222);
  weaponPart(0.09, 0.09, 0.7, 0, 0.08, -0.55, 0x111111);
  weaponPart(0.13, 0.32, 0.16, 0, -0.22, 0.18, 0x333333);

  if (selectedSlot === 3) {
    weaponPart(0.12, 0.12, 0.45, 0, 0.13, -0.35, 0x333333);
  }

  if (selectedSlot === 4) {
    weaponPart(0.13, 0.13, 0.85, 0, 0.08, -0.6, 0x663311);
  }

  if (selectedSlot === 5) {
    weaponPart(0.1, 0.1, 1.2, 0, 0.08, -0.8, 0x111111);
    weaponPart(0.2, 0.15, 0.35, 0, 0.22, -0.25, 0x333333);
  }
}

buildWeapon();
updateInventory();

// ================================================
// CONSTRUCTION DES BLOCS
// ================================================

function createBox(x, y, z, sx, sy, sz, color, solid = false) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(sx, sy, sz),
    new THREE.MeshStandardMaterial({ color })
  );

  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  scene.add(mesh);

  if (solid) {
    walls.push({
      minX: x - sx / 2,
      maxX: x + sx / 2,
      minZ: z - sz / 2,
      maxZ: z + sz / 2,
      minY: y - sy / 2,
      maxY: y + sy / 2
    });
  }

  return mesh;
}

// ================================================
// PLANCHERS AVEC TROU POUR LES RAMPES
// ================================================

function createFloor(cx, cz, height) {
  const thickness = 0.2;

  const parts = [
    { x: cx - 6, z: cz, sx: 8, sz: 20 },
    { x: cx + 6, z: cz, sx: 8, sz: 20 },
    { x: cx, z: cz - 6, sx: 4, sz: 8 },
    { x: cx, z: cz + 6, sx: 4, sz: 8 }
  ];

  for (const part of parts) {
    createBox(
      part.x,
      height,
      part.z,
      part.sx,
      thickness,
      part.sz,
      0x777777
    );

    floors.push({
      minX: part.x - part.sx / 2,
      maxX: part.x + part.sx / 2,
      minZ: part.z - part.sz / 2,
      maxZ: part.z + part.sz / 2,
      height
    });
  }
}

// ================================================
// IMMEUBLES
// ================================================

function createBuilding(cx, cz) {
  buildings.push({ x: cx, z: cz });

  createBox(cx, 0, cz, 20, 0.2, 20, 0x777777);

  createBox(cx - 10, 8.75, cz, 0.4, 17.5, 20, 0x999999, true);
  createBox(cx + 10, 8.75, cz, 0.4, 17.5, 20, 0x999999, true);
  createBox(cx, 8.75, cz - 10, 20, 17.5, 0.4, 0x999999, true);

  createBox(cx - 8, 8.75, cz + 10, 4, 17.5, 0.4, 0x999999, true);
  createBox(cx + 8, 8.75, cz + 10, 4, 17.5, 0.4, 0x999999, true);

  createBox(cx, 17.7, cz, 20, 0.4, 20, 0x555555, true);

  for (let level = 1; level <= 4; level++) {
    createFloor(cx, cz, level * 3.5);
  }

  for (let level = 0; level < 4; level++) {
    const direction = level % 2 === 0 ? 1 : -1;

    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.2, 8.5),
      new THREE.MeshStandardMaterial({ color: 0xaaaaaa })
    );

    ramp.position.set(cx, level * 3.5 + 1.75, cz);
    ramp.rotation.x = direction * Math.atan(3.5 / 8);
    scene.add(ramp);
  }
}

createBuilding(0, -35);
createBuilding(35, -35);
createBuilding(-35, -35);
createBuilding(35, 35);
createBuilding(-35, 35);

// ================================================
// COLLISIONS
// ================================================

function isBlocked(x, z, feet) {
  const radius = PLAYER_RADIUS;

  for (const wall of walls) {
    const closestX = Math.max(wall.minX, Math.min(x, wall.maxX));
    const closestZ = Math.max(wall.minZ, Math.min(z, wall.maxZ));

    const dx = x - closestX;
    const dz = z - closestZ;

    const verticalOverlap =
      feet < wall.maxY &&
      feet + PLAYER_HEIGHT > wall.minY;

    if (
      dx * dx + dz * dz < radius * radius &&
      verticalOverlap
    ) {
      return true;
    }
  }

  return false;
}

// ================================================
// HAUTEUR DU SOL
// ================================================

function isInsideFloor(floor, x, z) {
  return (
    x >= floor.minX &&
    x <= floor.maxX &&
    z >= floor.minZ &&
    z <= floor.maxZ
  );
}

function getGroundHeight(x, z) {
  let highest = 0;

  for (const floor of floors) {
    if (isInsideFloor(floor, x, z)) {
      if (floor.height > highest) {
        highest = floor.height;
      }
    }
  }

  return highest;
}

// ================================================
// MOUVEMENT VERTICAL
// ================================================

function updateVerticalMovement(delta) {
  const oldY = camera.position.y;
  const oldFeet = oldY - PLAYER_HEIGHT;

  verticalVelocity -= GRAVITY * delta;

  let newY = oldY + verticalVelocity * delta;
  let newFeet = newY - PLAYER_HEIGHT;

  const x = camera.position.x;
  const z = camera.position.z;

  let landingHeight = 0;

  if (verticalVelocity <= 0) {
    for (const floor of floors) {
      if (
        isInsideFloor(floor, x, z) &&
        oldFeet >= floor.height - 0.05 &&
        newFeet <= floor.height
      ) {
        landingHeight = Math.max(landingHeight, floor.height);
      }
    }

    if (oldFeet >= 0 && newFeet <= 0) {
      landingHeight = Math.max(landingHeight, 0);
    }

    if (newFeet <= landingHeight) {
      newY = landingHeight + PLAYER_HEIGHT;
      verticalVelocity = 0;
      grounded = true;
    } else {
      grounded = false;
    }
  }

  if (verticalVelocity > 0) {
    for (const floor of floors) {
      if (!isInsideFloor(floor, x, z)) continue;

      const oldHead = oldY;
      const newHead = newY;

      if (
        oldHead <= floor.height &&
        newHead >= floor.height
      ) {
        newY = floor.height;
        verticalVelocity = 0;
        break;
      }
    }

    grounded = false;
  }

  camera.position.y = newY;
}

// ================================================
// SOINS
// ================================================

function useMedkit() {
  if (
    selectedSlot !== 1 ||
    medkits <= 0 ||
    health >= 100
  ) {
    return;
  }

  health = Math.min(100, health + 5);
  medkits--;

  updateInventory();
  updateHUD();
}

// ================================================
// ENNEMIS : 100 PV MAXIMUM
// ================================================

function createEnemy(x, z) {
  const enemy = new THREE.Group();

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xcc2222
  });

  const skinMaterial = new THREE.MeshStandardMaterial({
    color: 0xffbb99
  });

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 1.2, 0.5),
    bodyMaterial
  );

  body.position.y = 0.9;
  enemy.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 12, 12),
    skinMaterial
  );

  head.position.y = 1.7;
  enemy.add(head);

  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.65, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x222222 })
    );

    leg.position.set(side * 0.2, 0.25, 0);
    enemy.add(leg);
  }

  // Fusil visible dans les mains du soldat.
  const rifle = new THREE.Group();
  const rifleMetal = new THREE.MeshStandardMaterial({ color: 0x252a2e });
  const rifleWood = new THREE.MeshStandardMaterial({ color: 0x5b4632 });

  const rifleBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.16, 0.85),
    rifleMetal
  );

  rifleBody.position.z = 0.05;
  rifle.add(rifleBody);

  const rifleBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.65, 8),
    rifleMetal
  );

  rifleBarrel.rotation.x = Math.PI / 2;
  rifleBarrel.position.z = -0.65;
  rifle.add(rifleBarrel);

  const rifleStock = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.2, 0.35),
    rifleWood
  );

  rifleStock.position.z = 0.55;
  rifle.add(rifleStock);

  const rifleGrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.25, 0.12),
    rifleWood
  );

  rifleGrip.position.set(0, -0.17, 0.12);
  rifle.add(rifleGrip);

  rifle.position.set(0.42, 1.2, 0.28);
  enemy.add(rifle);

  enemy.position.set(x, 0, z);
  scene.add(enemy);

  // Barre de vie de l'ennemi.
  const bar = new THREE.Group();
  bar.name = "enemyHealthBar";

  const background = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.12),
    new THREE.MeshBasicMaterial({
      color: 0x222222,
      side: THREE.DoubleSide
    })
  );

  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 0.08),
    new THREE.MeshBasicMaterial({
      color: 0x20dd35,
      side: THREE.DoubleSide
    })
  );

  fill.position.z = 0.01;

  bar.add(background);
  bar.add(fill);
  bar.position.y = 2.25;

  enemy.add(bar);

  enemies.push({
    mesh: enemy,
    health: 100,
    maxHealth: 100,
    speed: 2.2,
    attackTimer: 0,
    shootTimer: 1,
    alive: true,
    healthFill: fill
  });
}

// Huit ennemis.
createEnemy(12, -20);
createEnemy(-15, -20);
createEnemy(20, 10);
createEnemy(-20, 15);
createEnemy(45, 0);
createEnemy(-45, 0);
createEnemy(10, 45);
createEnemy(-10, 45);

// ================================================
// DEGATS AUX ENNEMIS
// ================================================

function damageEnemy(enemy, damage) {
  if (!enemy.alive) return;

  enemy.health = Math.max(0, enemy.health - damage);

  const percent = enemy.health / 100;

  enemy.healthFill.scale.x = percent;
  enemy.healthFill.position.x = -(1 - percent) * 0.5;

  if (enemy.health <= 0) {
    enemy.alive = false;
    scene.remove(enemy.mesh);
  }
}

// ================================================
// IA DES ENNEMIS
// ================================================

function updateEnemies(delta) {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;

    const dx = camera.position.x - enemy.mesh.position.x;
    const dz = camera.position.z - enemy.mesh.position.z;
    const distance = Math.hypot(dx, dz);

    enemy.mesh.getObjectByName("enemyHealthBar")?.lookAt(camera.position);

    // Les soldats avancent vers le joueur.
    if (distance > 1.8 && distance < 45) {
      const mx = (dx / distance) * enemy.speed * delta;
      const mz = (dz / distance) * enemy.speed * delta;

      const nextX = enemy.mesh.position.x + mx;
      const nextZ = enemy.mesh.position.z + mz;

      if (!isBlocked(nextX, enemy.mesh.position.z, 0)) {
        enemy.mesh.position.x = nextX;
      }

      if (!isBlocked(enemy.mesh.position.x, nextZ, 0)) {
        enemy.mesh.position.z = nextZ;
      }
    }

    // Les soldats tirent automatiquement à distance.
    if (distance < 35 && distance > 1.8) {
      enemy.mesh.rotation.y = Math.atan2(dx, dz);
      enemy.shootTimer -= delta;

      if (enemy.shootTimer <= 0) {
        const start = enemy.mesh.localToWorld(
          new THREE.Vector3(0.42, 1.2, -0.42)
        );

        const direction = new THREE.Vector3(
          camera.position.x - start.x,
          camera.position.y - start.y,
          camera.position.z - start.z
        ).normalize();

        const shot = new THREE.Mesh(
          new THREE.SphereGeometry(0.09, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xff4422 })
        );

        shot.position.copy(start);
        shot.userData.direction = direction;
        shot.userData.speed = 20;
        shot.userData.life = 2.5;
        shot.userData.damage = 5;

        scene.add(shot);
        enemyBullets.push(shot);

        enemy.shootTimer = 1.35 + Math.random() * 0.7;
      }
    }

    // Dégâts au contact.
    if (distance < 1.8) {
      enemy.attackTimer -= delta;

      if (enemy.attackTimer <= 0) {
        health = Math.max(0, health - 8);
        enemy.attackTimer = 1;
      }
    }
  }
}

// ================================================
// MISE A JOUR DES BALLES ENNEMIES
// ================================================

function updateEnemyBullets(delta) {
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const bullet = enemyBullets[i];

    bullet.position.addScaledVector(
      bullet.userData.direction,
      bullet.userData.speed * delta
    );

    bullet.userData.life -= delta;

    if (bullet.position.distanceTo(camera.position) < 0.65) {
      health = Math.max(0, health - bullet.userData.damage);
      scene.remove(bullet);
      enemyBullets.splice(i, 1);
      continue;
    }

    if (bullet.userData.life <= 0) {
      scene.remove(bullet);
      enemyBullets.splice(i, 1);
    }
  }
}

// ================================================
// COMMANDES CLAVIER
// ================================================

window.addEventListener("keydown", event => {
  keys[event.code] = true;

  if (
    event.code === "Space" &&
    grounded &&
    started &&
    !gameOver
  ) {
    verticalVelocity = JUMP_FORCE;
    grounded = false;
  }

  if (event.code === "KeyE") {
    useMedkit();
  }

  if (event.code.startsWith("Digit")) {
    const number = Number(event.code.slice(5));

    if (number >= 1 && number <= 5) {
      selectedSlot = number;
      buildWeapon();
      updateInventory();
    }
  }
});

window.addEventListener("keyup", event => {
  keys[event.code] = false;
});

// ================================================
// SOURIS
// ================================================

document.addEventListener("mousemove", event => {
  if (
    !started ||
    document.pointerLockElement !== renderer.domElement
  ) {
    return;
  }

  yaw -= event.movementX * 0.002;
  pitch -= event.movementY * 0.002;

  pitch = Math.max(-1.4, Math.min(1.4, pitch));

  camera.rotation.order = "YXZ";
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
});

// ================================================
// DEMARRER AVEC 5 SECONDES DE PROTECTION
// ================================================

playButton.addEventListener("click", () => {
  if (gameOver) return;

  started = true;

  // Protection contre les soldats pendant 5 secondes
  protectionTimer = 5;

  // Remettre la vie à 100 au lancement
  health = 100;
  updateHUD();

  // Supprimer les anciennes balles ennemies
  for (const bullet of enemyBullets) {
    scene.remove(bullet);
  }
  enemyBullets.length = 0;

  // Réinitialiser les tirs des soldats
  for (const enemy of enemies) {
    enemy.shootTimer = 1.5;
    enemy.attackTimer = 1;
  }

  menu.style.display = "none";
  game.style.display = "block";

  renderer.domElement.requestPointerLock?.();
});

renderer.domElement.addEventListener("click", () => {
  if (
    started &&
    document.pointerLockElement !== renderer.domElement
  ) {
    renderer.domElement.requestPointerLock?.();
  }
});

// ================================================
// DEPLACEMENT ET SPRINT
// ================================================

function movePlayer(delta) {
  if (!started || gameOver) return;

  const forward = new THREE.Vector3(
    -Math.sin(yaw), 0, -Math.cos(yaw)
  );

  const right = new THREE.Vector3(
    Math.cos(yaw), 0, -Math.sin(yaw)
  );

  const movement = new THREE.Vector3();

  if (keys["KeyZ"] || keys["ArrowUp"]) movement.add(forward);
  if (keys["KeyS"] || keys["ArrowDown"]) movement.sub(forward);
  if (keys["KeyQ"] || keys["ArrowLeft"]) movement.sub(right);
  if (keys["KeyD"] || keys["ArrowRight"]) movement.add(right);

  const wantsSprint =
    keys["ShiftLeft"] || keys["ShiftRight"];

  const sprinting =
    wantsSprint &&
    stamina > 0 &&
    movement.lengthSq() > 0;

  if (sprinting) {
    stamina = Math.max(0, stamina - 28 * delta);
  } else {
    stamina = Math.min(100, stamina + 18 * delta);
  }

  if (movement.lengthSq() > 0) {
    movement.normalize();

    movement.multiplyScalar(
      (sprinting ? 7.5 : 3.8) * delta
    );

    const feet = camera.position.y - PLAYER_HEIGHT;

    const nextX = camera.position.x + movement.x;
    const nextZ = camera.position.z + movement.z;

    if (!isBlocked(nextX, camera.position.z, feet)) {
      camera.position.x = nextX;
    }

    if (!isBlocked(camera.position.x, nextZ, feet)) {
      camera.position.z = nextZ;
    }
  }

  updateVerticalMovement(delta);
}

// ================================================
// TIR DU JOUEUR
// ================================================

function shoot() {
  if (!started || gameOver || selectedSlot === 1) return;

  const now = performance.now();
  const weapon = weapons[selectedSlot - 1];

  if (now - lastShot < weapon.delay) return;

  lastShot = now;

  const count = selectedSlot === 4 ? 5 : 1;

  for (let i = 0; i < count; i++) {
    const direction = new THREE.Vector3();

    camera.getWorldDirection(direction);

    if (selectedSlot === 4) {
      direction.x += (Math.random() - 0.5) * 0.12;
      direction.y += (Math.random() - 0.5) * 0.12;
      direction.z += (Math.random() - 0.5) * 0.12;
      direction.normalize();
    }

    const bullet = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffff00 })
    );

    bullet.position.copy(camera.position);

    bullet.userData.direction = direction;
    bullet.userData.speed = weapon.speed;
    bullet.userData.damage = weapon.damage;
    bullet.userData.life = 2;

    scene.add(bullet);
    bullets.push(bullet);
  }
}

document.addEventListener("mousedown", event => {
  if (event.button === 0) shoot();
});

// ================================================
// MISE A JOUR DES BALLES DU JOUEUR
// ================================================

function updateBullets(delta) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];

    bullet.position.addScaledVector(
      bullet.userData.direction,
      bullet.userData.speed * delta
    );

    bullet.userData.life -= delta;

    let hit = false;

    for (const enemy of enemies) {
      if (!enemy.alive) continue;

      const target = enemy.mesh.position.clone();
      target.y += 1;

      if (bullet.position.distanceTo(target) < 0.85) {
        damageEnemy(enemy, bullet.userData.damage);
        hit = true;
        break;
      }
    }

    if (hit || bullet.userData.life <= 0) {
      scene.remove(bullet);
      bullets.splice(i, 1);
    }
  }
}

// ================================================
// FIN DE PARTIE
// ================================================

function showGameOver() {
  gameOver = true;
  started = false;

  document.exitPointerLock?.();

  const overlay = document.createElement("div");

  overlay.style.cssText = `
    position:fixed;
    inset:0;
    z-index:2000;
    background:rgba(0,0,0,.85);
    display:flex;
    flex-direction:column;
    justify-content:center;
    align-items:center;
    color:white;
    font:bold 36px Arial;
    font-family:Arial;
  `;

  overlay.innerHTML = `
    <div>VOUS ÊTES MORT</div>
    <div style="font-size:18px;margin-top:20px">
      Recharge la page pour recommencer
    </div>
  `;

  document.body.appendChild(overlay);
}

// ================================================
// BOUCLE PRINCIPALE AVEC PROTECTION
// ================================================

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);

  movePlayer(delta);

  // Les soldats restent inactifs tant que la partie n'a pas commencé.
  if (started && !gameOver) {

    // Protection de 5 secondes
    if (protectionTimer > 0) {
      protectionTimer = Math.max(0, protectionTimer - delta);

      // Supprimer les balles ennemies pendant la protection
      for (const bullet of enemyBullets) {
        scene.remove(bullet);
      }

      enemyBullets.length = 0;

    } else {
      // Les soldats reprennent le combat après la protection
      updateEnemies(delta);
      updateEnemyBullets(delta);
    }
  }

  updateBullets(delta);
  updateHUD();

  if (health <= 0 && !gameOver) {
    showGameOver();
  }

  renderer.render(scene, camera);
}

// ================================================
// REDIMENSIONNEMENT
// ================================================

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );
});

// ================================================
// LANCEMENT
// ================================================

game.style.display = "none";

updateHUD();
animate();

// ================================================
// MULTIJOUEUR WARZONE 3D - PVP
// ================================================

const socket = window.io();

const createRoomButton = document.getElementById("createRoomButton");
const joinRoomButton = document.getElementById("joinRoomButton");
const roomCodeInput = document.getElementById("roomCodeInput");
const discordInviteButton = document.getElementById("discordInviteButton");
const roomInfo = document.getElementById("roomInfo");
const statusText = document.getElementById("status");

let currentRoomCode = null;
const remotePlayers = new Map();

function setStatus(message) {
  if (statusText) statusText.textContent = message;
}

function createRemotePlayer(player) {
  if (!player || !player.id || player.id === socket.id) return;

  if (remotePlayers.has(player.id)) return;

  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 1.2, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x2277ff })
  );

  body.position.y = 0.9;
  body.userData.playerId = player.id;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xffcc99 })
  );

  head.position.y = 1.7;
  head.userData.playerId = player.id;
  group.add(head);

  // La position reçue correspond à la caméra :
  // on place les pieds du personnage au niveau du sol.
  group.position.set(
    Number(player.x) || 0,
    (Number(player.y) || 1.7) - PLAYER_HEIGHT,
    Number(player.z) || 0
  );

  group.rotation.y = Number(player.rotation) || 0;

  scene.add(group);
  remotePlayers.set(player.id, group);
}

function removeRemotePlayer(playerId) {
  const player = remotePlayers.get(playerId);
  if (!player) return;

  scene.remove(player);
  remotePlayers.delete(playerId);
}

function updateRemotePlayer(player) {
  if (!player || !player.id) return;

  if (!remotePlayers.has(player.id)) {
    createRemotePlayer(player);
  }

  const mesh = remotePlayers.get(player.id);
  if (!mesh) return;

  mesh.position.set(
    Number(player.x) || 0,
    (Number(player.y) || 1.7) - PLAYER_HEIGHT,
    Number(player.z) || 0
  );

  mesh.rotation.y = Number(player.rotation) || 0;
}

// Connexion au serveur
socket.on("connect", () => {
  setStatus("Connecté au serveur !");
});

socket.on("disconnect", () => {
  setStatus("Connexion au serveur perdue...");
});

// Création d'une partie privée
if (createRoomButton) {
  createRoomButton.addEventListener("click", () => {
    socket.emit("createRoom", (result) => {
      if (!result || !result.ok) {
        setStatus("Impossible de créer la partie.");
        return;
      }

      currentRoomCode = result.roomCode;

      if (roomInfo) {
        roomInfo.textContent = "CODE DE TA PARTIE : " + currentRoomCode;
      }

      setStatus("Partie privée créée !");
    });
  });
}

// Rejoindre une partie
if (joinRoomButton) {
  joinRoomButton.addEventListener("click", () => {
    const code = roomCodeInput ? roomCodeInput.value.trim().toUpperCase() : "";

    if (code.length !== 6) {
      setStatus("Entre un code de 6 caractères.");
      return;
    }

    socket.emit("joinRoom", code, (result) => {
      if (!result || !result.ok) {
        setStatus(result?.error || "Impossible de rejoindre la partie.");
        return;
      }

      currentRoomCode = result.roomCode;

      if (roomInfo) {
        roomInfo.textContent = "PARTIE : " + currentRoomCode;
      }

      if (result.players) {
        Object.values(result.players).forEach(createRemotePlayer);
      }

      setStatus("Partie rejointe !");
    });
  });
}

// Joueurs déjà présents
socket.on("currentPlayers", (players) => {
  Object.values(players || {}).forEach(createRemotePlayer);
});

// Nouveau joueur
socket.on("newPlayer", (player) => {
  createRemotePlayer(player);
});

// Déplacement des autres joueurs
socket.on("playerMoved", (player) => {
  updateRemotePlayer(player);
});

// Déconnexion d'un joueur
socket.on("playerDisconnected", (playerId) => {
  removeRemotePlayer(playerId);
});

// Synchroniser notre position
let networkTimer = 0;

function sendPlayerPosition(delta) {
  if (!currentRoomCode || !started || gameOver) return;

  networkTimer += delta;

  if (networkTimer < 0.05) return;

  networkTimer = 0;

  socket.emit("playerMovement", {
    x: camera.position.x,
    y: camera.position.y,
    z: camera.position.z,
    rotation: yaw
  });
}

// Invitation via Discord
if (discordInviteButton) {
  discordInviteButton.addEventListener("click", async () => {
    if (!currentRoomCode) {
      setStatus("Crée ou rejoins une partie avant d'inviter.");
      return;
    }

    const invitation =
      window.location.origin + "/?room=" + currentRoomCode;

    try {
      await navigator.clipboard.writeText(invitation);
      setStatus("Lien copié ! Envoie-le à ton ami sur Discord.");
    } catch {
      setStatus("Ton code de partie est : " + currentRoomCode);
    }

    window.open("https://discord.com/app", "_blank");
  });
}

// Détection des tirs contre les autres joueurs
const originalShoot = shoot;

shoot = function() {
  if (!started || gameOver || !currentRoomCode) {
    originalShoot();
    return;
  }

  originalShoot();

  const raycaster = new THREE.Raycaster();
  const direction = new THREE.Vector3();

  camera.getWorldDirection(direction);
  raycaster.set(camera.position, direction);

  const targets = [];

  for (const [playerId, mesh] of remotePlayers) {
    for (const child of mesh.children) {
      child.userData.playerId = playerId;
      targets.push(child);
    }
  }

  const hits = raycaster.intersectObjects(targets, true);

  if (hits.length > 0) {
    const targetId = hits[0].object.userData.playerId;

    if (targetId) {
      const weapon = weapons[selectedSlot - 1];

      socket.emit("playerHit", {
        targetId: targetId,
        damage: weapon.damage
      });
    }
  }
};

// Recevoir les dégâts des autres joueurs
socket.on("playerDamaged", (data) => {
  if (!data || !Number.isFinite(data.damage)) return;

  health = Math.max(0, health - data.damage);
  updateHUD();

  if (health <= 0 && !gameOver) {
    showGameOver();
  }
});

socket.on("playerHitConfirmed", () => {
  setStatus("Touché !");
});

// Élimination d'un joueur
socket.on("playerEliminated", (data) => {
  if (!data) return;

  if (data.playerId === socket.id) {
    setStatus("Tu as été éliminé !");
  } else {
    removeRemotePlayer(data.playerId);
  }
});

// Rejoindre automatiquement avec un lien d'invitation
const invitationCode = new URLSearchParams(
  window.location.search
).get("room");

if (invitationCode && roomCodeInput && joinRoomButton) {
  roomCodeInput.value = invitationCode.toUpperCase();

  setTimeout(() => {
    joinRoomButton.click();
  }, 500);
}

// Ajouter l'envoi de position à la boucle du jeu
const originalMovePlayer = movePlayer;

movePlayer = function(delta) {
  originalMovePlayer(delta);
  sendPlayerPosition(delta);
};


