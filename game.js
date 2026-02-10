const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Логический размер мира (для стабильной физики)
const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 600;

// Параметры игрока
const PLAYER_SIZE = 40;
const GRAVITY = 0.6;
const MOVE_SPEED = 4;
const JUMP_VELOCITY = -14;
const ENEMY_SIZE = 35;
const ENEMY_SPEED = 1.5;

let scaleX = 1;
let scaleY = 1;
let gameOver = false;
let gameOverTimer = null;
let time = 0;
let visualScale = 1;

// Платформы (5 зелёных, лесенка)
const platforms = [
  { x: 0,   y: WORLD_HEIGHT - 40, width: WORLD_WIDTH, height: 40 }, // пол
  { x: 80,  y: 460, width: 180, height: 20 },
  { x: 260, y: 380, width: 180, height: 20 },
  { x: 440, y: 300, width: 180, height: 20 },
  { x: 620, y: 220, width: 140, height: 20 },
];

// Финишный флаг (на последней платформе)
const lastPlatform = platforms[4];
const finishFlag = {
  width: 50,
  height: 50,
};
finishFlag.x = lastPlatform.x + lastPlatform.width - finishFlag.width;
finishFlag.y = lastPlatform.y - finishFlag.height;

let killedEnemies = 0;
const TOTAL_ENEMIES = 3;

const player = {
  x: 50,
  y: 0,
  vx: 0,
  vy: 0,
  width: PLAYER_SIZE,
  height: PLAYER_SIZE,
  grounded: false,
};

// Враги: по одному на трёх верхних платформах
const enemies = [
  {
    // на платформе 1 (x:80,y:460)
    x: 100,
    y: 460 - ENEMY_SIZE,
    width: ENEMY_SIZE,
    height: ENEMY_SIZE,
    vx: ENEMY_SPEED,
    platformIndex: 1,
    alive: true,
  },
  {
    // на платформе 2 (x:260,y:380)
    x: 280,
    y: 380 - ENEMY_SIZE,
    width: ENEMY_SIZE,
    height: ENEMY_SIZE,
    vx: -ENEMY_SPEED,
    platformIndex: 2,
    alive: true,
  },
  {
    // на платформе 3 (x:440,y:300)
    x: 460,
    y: 300 - ENEMY_SIZE,
    width: ENEMY_SIZE,
    height: ENEMY_SIZE,
    vx: ENEMY_SPEED,
    platformIndex: 3,
    alive: true,
  },
];

const keys = {
  left: false,
  right: false,
  jump: false,
};

function resizeCanvas() {
  const maxWidth = Math.min(window.innerWidth, WORLD_WIDTH);
  const controlsHeight = 150; // место под кнопки
  const availableHeight = Math.max(200, window.innerHeight - controlsHeight);
  const maxHeight = Math.min(availableHeight, WORLD_HEIGHT);

  canvas.width = maxWidth;
  canvas.height = maxHeight;

  scaleX = canvas.width / WORLD_WIDTH;
  scaleY = canvas.height / WORLD_HEIGHT;

  // Адаптивный размер элементов для узких экранов
  visualScale = window.innerWidth < 600 ? 0.8 : 1;
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", () => {
  setTimeout(resizeCanvas, 300);
});

// Глобальный запрет нежелательного скролла/жеста "pull to refresh"
window.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
  },
  { passive: false }
);

// Управление с клавиатуры (для десктопа)
window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = true;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = true;
  if (e.code === "ArrowUp" || e.code === "Space" || e.code === "KeyW") {
    keys.jump = true;
    tryJump();
  }
});

window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
  if (e.code === "ArrowUp" || e.code === "Space" || e.code === "KeyW") {
    keys.jump = false;
  }
});

// Touch + mouse управление
function setupButtonControl(buttonId, onDown, onUp) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;

  const start = (e) => {
    e.preventDefault();
    onDown();
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    btn.classList.add("active");
  };

  const end = (e) => {
    e.preventDefault();
    onUp();
    btn.classList.remove("active");
  };

  btn.addEventListener("touchstart", start, { passive: false });
  btn.addEventListener("touchend", end, { passive: false });
  btn.addEventListener("touchcancel", end, { passive: false });

  btn.addEventListener("mousedown", start);
  window.addEventListener("mouseup", end);
}

setupButtonControl(
  "btnLeft",
  () => {
    keys.left = true;
  },
  () => {
    keys.left = false;
  }
);

setupButtonControl(
  "btnRight",
  () => {
    keys.right = true;
  },
  () => {
    keys.right = false;
  }
);

setupButtonControl(
  "btnJump",
  () => {
    keys.jump = true;
    tryJump();
  },
  () => {
    keys.jump = false;
  }
);

function tryJump() {
  if (player.grounded) {
    player.vy = JUMP_VELOCITY;
    player.grounded = false;
  }
}

function rectIntersect(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function handleCollisions() {
  player.grounded = false;

  for (const p of platforms) {
    const nextPlayer = {
      x: player.x,
      y: player.y,
      width: player.width,
      height: player.height,
    };

    if (!rectIntersect(nextPlayer, p)) continue;

    // Определим сторону столкновения
    const prevBottom = player.y + player.height - player.vy;
    const prevTop = player.y - player.vy;
    const prevRight = player.x + player.width - player.vx;
    const prevLeft = player.x - player.vx;

    const isFallingOnPlatform = prevBottom <= p.y && player.y + player.height >= p.y;
    const isHittingHead = prevTop >= p.y + p.height && player.y <= p.y + p.height;

    if (isFallingOnPlatform) {
      player.y = p.y - player.height;
      player.vy = 0;
      player.grounded = true;
    } else if (isHittingHead) {
      player.y = p.y + p.height;
      player.vy = 0;
    } else {
      // Боковое столкновение
      if (prevRight <= p.x && player.x + player.width >= p.x) {
        // слева
        player.x = p.x - player.width;
        player.vx = 0;
      } else if (prevLeft >= p.x + p.width && player.x <= p.x + p.width) {
        // справа
        player.x = p.x + p.width;
        player.vx = 0;
      }
    }
  }
}

function restartGame() {
  // ресет игрока
  player.x = 50;
  player.y = 0;
  player.vx = 0;
  player.vy = 0;
  player.grounded = false;

  gameOver = false;
  if (gameOverTimer) {
    clearTimeout(gameOverTimer);
    gameOverTimer = null;
  }

  // ресет врагов
  enemies[0].x = 100;
  enemies[0].y = 460 - ENEMY_SIZE;
  enemies[0].vx = ENEMY_SPEED;
  enemies[0].alive = true;

  enemies[1].x = 280;
  enemies[1].y = 380 - ENEMY_SIZE;
  enemies[1].vx = ENEMY_SPEED;
  enemies[1].alive = true;

  enemies[2].x = 460;
  enemies[2].y = 300 - ENEMY_SIZE;
  enemies[2].vx = ENEMY_SPEED;
  enemies[2].alive = true;

  killedEnemies = 0;
}

function updateEnemies() {
  if (gameOver) return;

  for (const enemy of enemies) {
    if (!enemy.alive) continue;

    const platform = platforms[enemy.platformIndex];
    enemy.x += enemy.vx;

    // Патрулирование по ширине платформы
    const leftLimit = platform.x;
    const rightLimit = platform.x + platform.width - enemy.width;

    if (enemy.x <= leftLimit) {
      enemy.x = leftLimit;
      enemy.vx = ENEMY_SPEED;
    } else if (enemy.x >= rightLimit) {
      enemy.x = rightLimit;
      enemy.vx = -ENEMY_SPEED;
    }
  }
}

function handleEnemyPlayerCollisions() {
  if (gameOver) return;

  for (const enemy of enemies) {
    if (!enemy.alive) continue;

    if (!rectIntersect(player, enemy)) continue;

    const playerBottom = player.y + player.height;
    const playerPrevBottom = playerBottom - player.vy; // приблизительно
    const enemyTop = enemy.y;

    // Удар сверху: нижняя грань игрока чуть выше верха врага
    if (playerPrevBottom <= enemyTop && playerBottom < enemyTop + 10 && player.vy > 0) {
      // убиваем врага, игрок подпрыгивает
      if (enemy.alive) {
        enemy.alive = false;
        killedEnemies++;
      }
      player.vy = JUMP_VELOCITY * 0.8; // небольшой отскок
    } else {
      // Столкновение сбоку/снизу — Game Over
      gameOver = true;
      if (!gameOverTimer) {
        gameOverTimer = setTimeout(() => {
          restartGame();
        }, 1000);
      }
      break;
    }
  }
}

function handleFinish() {
  if (gameOver) return;
  if (killedEnemies < TOTAL_ENEMIES) return;

  if (rectIntersect(player, finishFlag)) {
    alert("You Win! Level Complete");
    restartGame();
  }
}

function update() {
  if (gameOver) {
    // даже в Game Over продолжаем применять гравитацию, чтобы текст рисовался
    player.vy += GRAVITY;
    player.y += player.vy;
    return;
  }

  time += 1 / 60;

  // Горизонтальное движение
  player.vx = 0;
  if (keys.left) player.vx = -MOVE_SPEED;
  if (keys.right) player.vx = MOVE_SPEED;

  player.x += player.vx;

  // Гравитация
  player.vy += GRAVITY;
  player.y += player.vy;

  // Ограничения мира
  if (player.x < 0) player.x = 0;
  if (player.x + player.width > WORLD_WIDTH) player.x = WORLD_WIDTH - player.width;

  if (player.y > WORLD_HEIGHT + 200) {
    // упал вниз — Game Over с автоперезапуском
    if (!gameOver) {
      gameOver = true;
      if (!gameOverTimer) {
        gameOverTimer = setTimeout(() => {
          restartGame();
        }, 1000);
      }
    }
  }

  handleCollisions();
  updateEnemies();
  handleEnemyPlayerCollisions();
  handleFinish();
}

function draw() {
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);

  // Очистка "логического" мира
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Фон (небо: голубой сверху, светлее снизу)
  const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  gradient.addColorStop(0, "#4fa9ff");
  gradient.addColorStop(1, "#b9e5ff");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Платформы
  for (const p of platforms) {
    const ph = p.height * visualScale;
    const py = p.y + (p.height - ph); // верх остаётся на месте

    // тело платформы
    ctx.fillStyle = "#2ecc71";
    ctx.fillRect(p.x, py, p.width, ph);

    // обводка
    ctx.strokeStyle = "#1e8c4a";
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x + 0.5, py + 0.5, p.width - 1, ph - 1);

    // "трава" — короткие вертикальные штрихи сверху
    ctx.strokeStyle = "#27ae60";
    ctx.lineWidth = 1;
    const step = 6;
    const grassTop = py;
    for (let x = p.x + 2; x < p.x + p.width - 2; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, grassTop);
      ctx.lineTo(x, grassTop - 5);
      ctx.stroke();
    }
  }

  // Враги (поверх платформ)
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const ew = enemy.width * visualScale;
    const eh = enemy.height * visualScale;
    const ex = enemy.x + (enemy.width - ew) / 2;
    const ey = enemy.y + (enemy.height - eh);

    // тело врага
    ctx.fillStyle = "#e74c3c";
    ctx.fillRect(ex, ey, ew, eh);

    const cx = ex + ew / 2;
    const cy = ey + eh / 2;

    // глаза
    ctx.fillStyle = "#ffdddd";
    const eyeOffsetX = ew * 0.18;
    const eyeOffsetY = eh * 0.18;
    const eyeR = ew * 0.09;
    ctx.beginPath();
    ctx.arc(cx - eyeOffsetX, cy - eyeOffsetY, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + eyeOffsetX, cy - eyeOffsetY, eyeR, 0, Math.PI * 2);
    ctx.fill();

    // зрачки (злые, опущенные внутрь)
    ctx.fillStyle = "#c0392b";
    const pupilR = eyeR * 0.8;
    ctx.beginPath();
    ctx.arc(cx - eyeOffsetX, cy - eyeOffsetY + 2, pupilR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + eyeOffsetX, cy - eyeOffsetY + 2, pupilR, 0, Math.PI * 2);
    ctx.fill();

    // рот с "зубами"
    const mouthWidth = ew * 0.6;
    const mouthHeight = eh * 0.18;
    const mouthX = cx - mouthWidth / 2;
    const mouthY = cy + enemy.height * 0.1;
    ctx.fillStyle = "#000";
    ctx.fillRect(mouthX, mouthY, mouthWidth, mouthHeight);
    ctx.fillStyle = "#ecf0f1";
    const teethCount = 4;
    const toothW = mouthWidth / teethCount;
    const toothH = mouthHeight * 0.7;
    for (let i = 0; i < teethCount; i++) {
      const tx = mouthX + i * toothW;
      const ty = mouthY;
      ctx.beginPath();
      ctx.moveTo(tx + toothW / 2, ty + toothH);
      ctx.lineTo(tx, ty);
      ctx.lineTo(tx + toothW, ty);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Финишный флаг (золотой квадрат)
  const floatOffset = Math.sin(time * 2) * 5; // плавное движение вверх-вниз
  const flagY = finishFlag.y + floatOffset;
  if (killedEnemies >= TOTAL_ENEMIES) {
    ctx.fillStyle = "#f1c40f";
  } else {
    ctx.fillStyle = "rgba(241, 196, 15, 0.4)"; // полупрозрачный, пока закрыт
  }
  ctx.fillRect(finishFlag.x, flagY, finishFlag.width, finishFlag.height);

  // Игрок
  const pw = player.width * visualScale;
  const ph = player.height * visualScale;
  const px = player.x + (player.width - pw) / 2;
  const py = player.y + (player.height - ph);

  ctx.fillStyle = "#3498db";
  ctx.fillRect(px, py, pw, ph);

  // лицо игрока
  const pCenterX = px + pw / 2;
  const pCenterY = py + ph / 2;

  // глаза
  ctx.fillStyle = "#ffffff";
  const pEyeOffsetX = pw * 0.18;
  const pEyeOffsetY = ph * 0.18;
  const pEyeR = pw * 0.09;
  ctx.beginPath();
  ctx.arc(pCenterX - pEyeOffsetX, pCenterY - pEyeOffsetY, pEyeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(pCenterX + pEyeOffsetX, pCenterY - pEyeOffsetY, pEyeR, 0, Math.PI * 2);
  ctx.fill();

  // зрачки
  ctx.fillStyle = "#000000";
  const pPupilR = pEyeR * 0.7;
  ctx.beginPath();
  ctx.arc(pCenterX - pEyeOffsetX, pCenterY - pEyeOffsetY, pPupilR, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(pCenterX + pEyeOffsetX, pCenterY - pEyeOffsetY, pPupilR, 0, Math.PI * 2);
  ctx.fill();

  // улыбка
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  const smileRadius = pw * 0.22;
  const smileY = pCenterY + ph * 0.1;
  ctx.beginPath();
  ctx.arc(pCenterX, smileY, smileRadius, 0.15 * Math.PI, 0.85 * Math.PI, false);
  ctx.stroke();

  // HUD: счётчик врагов
  ctx.fillStyle = "#000";
  ctx.font = "20px system-ui";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`Enemies: ${killedEnemies}/${TOTAL_ENEMIES}`, 10, 10);

  // Экран GAME OVER
  if (gameOver) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    ctx.fillStyle = "#e74c3c";
    ctx.font = "48px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("GAME OVER", WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
  }
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

resizeCanvas();
gameLoop();

