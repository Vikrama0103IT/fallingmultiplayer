const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const youScoreEl = document.getElementById("youScore");
const timeEl = document.getElementById("timeLeft");
const otpScreen = document.getElementById("otpScreen");
const otpInput = document.getElementById("otpInput");
const otpBtn = document.getElementById("otpBtn");
const otpStatus = document.getElementById("otpStatus");
const gameOverScreen = document.getElementById("gameOverScreen");
const resultText = document.getElementById("resultText");
const restartBtn = document.getElementById("restartBtn");

// ✅ Updated socket connection for ALL devices (PC / Android / iOS / WiFi / 4G)
const socket = io("/", {
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 500
});

let players = {};
let blocks = [];
let playerIndex = null;
let gameTime = 60;
let gameOver = true;

// Resize canvas for fullscreen
function resizeGame() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeGame();
window.addEventListener("resize", resizeGame);

// OTP Submit
otpBtn.addEventListener("click", () => {
  socket.emit("otpSubmit", otpInput.value);
});

socket.on("otpWaiting", () => otpStatus.textContent = "Waiting for opponent...");
socket.on("otpMismatch", () => otpStatus.textContent = "OTP mismatch! Try again.");

socket.on("otpSuccess", () => {
  let c = 3;
  const t = setInterval(() => {
    otpStatus.textContent = "Game starts in " + c + "...";
    c--;
    if (c < 0) {
      clearInterval(t);
      otpScreen.style.display = "none";
      document.getElementById("info").style.display = "block";
      canvas.style.display = "block";
      socket.emit("otpDone");
    }
  }, 1000);
});

// Game Start
socket.on("gameStart", () => {
  gameOver = false;
  gameOverScreen.style.display = "none";
  canvas.style.display = "block";
  document.getElementById("info").style.display = "block";
});

// Game State
socket.on("state", state => {
  players = state.players;
  blocks = state.blocks;
  gameTime = state.gameTime;

  const me = players[socket.id];
  if (me) {
    playerIndex = me.index;
    youScoreEl.textContent = "Score: " + me.score;
    timeEl.textContent = "Time: " + gameTime;
  }
});

// Game Over
socket.on("gameOver", data => {
  gameOver = true;

  canvas.style.display = "none";
  document.getElementById("info").style.display = "none";

  const me = players[socket.id];
  let msg = "";

  if (data.result === "draw") msg = "Match Draw!";
  else if (
    (me.index === 0 && data.result === "p1") ||
    (me.index === 1 && data.result === "p2")
  ) msg = "You Win!";
  else msg = "You Lose!";

  resultText.textContent = msg;
  gameOverScreen.style.display = "block";
});

// Restart game
restartBtn.addEventListener("click", () => {
  socket.emit("restartRequest");
});

socket.on("restartGame", () => {
  otpScreen.style.display = "block";
  otpInput.value = "";
  otpStatus.textContent = "";
  gameOverScreen.style.display = "none";
  canvas.style.display = "none";
  document.getElementById("info").style.display = "none";

  players = {};
  blocks = [];
  playerIndex = null;
  gameTime = 60;
});

// Controls
const keys = {};
window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);

function handleInput() {
  if (playerIndex !== null && !gameOver) {
    if (keys["ArrowLeft"] || keys["a"]) socket.emit("move", "left");
    if (keys["ArrowRight"] || keys["d"]) socket.emit("move", "right");
  }
}

// Drawing
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw blocks (RED)
  blocks.forEach(b => {
    ctx.fillStyle = "#ff595e";
    ctx.fillRect((b.x / 400) * canvas.width, b.y, 30, 30);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect((b.x / 400) * canvas.width, b.y, 30, 30);
  });

  // Draw paddle (BLUE)
  const me = players[socket.id];
  if (me) {
    const px = (me.x / 400) * canvas.width;
    const py = canvas.height - 90;
    ctx.fillStyle = "#1982c4";
    ctx.fillRect(px, py, 60, 20);
  }
}

function loop() {
  handleInput();
  draw();
  requestAnimationFrame(loop);
}
loop();
