const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Логический размер мира (для стабильной физики)
const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 600;

// Параметры игрока
const PLAYER_SIZE = 40;
const GRAVITY = 0.6;
const MOVE_SPEED = 4;
const JUMP_VELOCITY = -12;

let scaleX = 1;
let scaleY = 1;

const player = {
  x: 100,
  y: 100,
  vx: 0,
  vy: 0,
  width: PLAYER_SIZE,
  height: PLAYER_SIZE,
  grounded: false,
};

// Платформы (5 зелёных, разные размеры/высоты)
const platforms = [
  { x: 0, y: WORLD_HEIGHT - 40, width: WORLD_WIDTH, height: 40 },      // пол
  { x: 80, y: 420, width: 160, height: 20 },
  { x: 300, y: 340, width: 120, height: 20 },
  { x: 500, y: 260, width: 180, height: 20 },
  { x: 650, y: 180, width: 100, height: 20 },
];

const keys = {
  left: false,
  right: false,
  jump: false,
};

function resizeCanvas() {
  const container = document.querySelector(".game-container");
  const rect = container.getBoundingClientRect();

  const maxWidth = Math.min(rect.width, WORLD_WIDTH);
  const maxHeight = Math.min(rect.height, WORLD_HEIGHT);

  canvas.width = maxWidth;
  canvas.height = maxHeight;

  scaleX = canvas.width / WORLD_WIDTH;
  scaleY = canvas.height / WORLD_HEIGHT;
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", () => {
  setTimeout(resizeCanvas, 300);
});

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

function update() {
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
    // упал вниз — респаун
    player.x = 100;
    player.y = 100;
    player.vx = 0;
    player.vy = 0;
  }

  handleCollisions();
}

function draw() {
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);

  // Очистка "логического" мира
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Фон
  const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  gradient.addColorStop(0, "#66aaff");
  gradient.addColorStop(1, "#88ccff");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Платформы
  ctx.fillStyle = "#2ecc71";
  for (const p of platforms) {
    ctx.fillRect(p.x, p.y, p.width, p.height);
  }

  // Игрок
  ctx.fillStyle = "#3498db";
  ctx.fillRect(player.x, player.y, player.width, player.height);
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

resizeCanvas();
gameLoop();

