const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));
const PORT = process.env.PORT || 3000;


// Game State
let players = {};
let blocks = [];
let nextBlockId = 1;
let gameTime = 60;
let gameRunning = false;

// OTP + Restart
let otpValues = {};
let otpDone = {};
let restartVotes = {};

const GAME_WIDTH = 400;
const PLAYER_WIDTH = 60;
const PLAYER_HEIGHT = 20;

// Reset game
function resetGame() {
  blocks = [];
  nextBlockId = 1;
  gameTime = 60;
  gameRunning = true;

  Object.values(players).forEach(p => {
    p.score = 0;
    p.x = p.index === 0 ? 100 : 300;
  });
}

// Spawn block
function spawnBlock() {
  const size = 30;
  const x = Math.random() * (GAME_WIDTH - size);
  const speed = 3 + Math.random() * 3;
  blocks.push({ id: nextBlockId++, x, y: 0, size, speed });
}

// Main physics loop
setInterval(() => {
  if (!gameRunning) return;
  blocks.forEach(b => (b.y += b.speed));

  blocks = blocks.filter(b => {
    if (b.y > 800) return false;

    for (const [sid, p] of Object.entries(players)) {
      if (
        b.x < p.x + PLAYER_WIDTH &&
        b.x + b.size > p.x &&
        b.y > 480 && b.y < 560
      ) {
        p.score++;
        return false;
      }
    }
    return true;
  });

  io.emit("state", { players, blocks, gameTime });
}, 1000 / 30);

// Timer
setInterval(() => {
  if (!gameRunning) return;

  gameTime--;
  if (gameTime <= 0) {
    gameRunning = false;

    const [p1, p2] = Object.values(players).sort((a, b) => a.index - b.index);
    let result = "draw";
    if (p1.score > p2.score) result = "p1";
    else if (p2.score > p1.score) result = "p2";

    io.emit("gameOver", { p1Score: p1.score, p2Score: p2.score, result });
  }
}, 1000);

// Spawn blocks
setInterval(() => {
  if (gameRunning) spawnBlock();
}, 900);

io.on("connection", socket => {
  const existing = Object.values(players).length;
  if (existing >= 2) {
    socket.emit("roomFull");
    socket.disconnect();
    return;
  }

  players[socket.id] = { index: existing, x: existing === 0 ? 100 : 300, score: 0 };
  otpValues = {};
  otpDone = {};
  restartVotes = {};

  // OTP
  socket.on("otpSubmit", otp => {
    otpValues[socket.id] = otp;

    if (Object.keys(otpValues).length === 2) {
      const [v1, v2] = Object.values(otpValues);
      if (v1 === v2) io.emit("otpSuccess");
      else {
        io.emit("otpMismatch");
        otpValues = {};
      }
    } else socket.emit("otpWaiting");
  });

  socket.on("otpDone", () => {
    otpDone[socket.id] = true;
    if (Object.keys(otpDone).length === 2) {
      resetGame();
      io.emit("gameStart");
    }
  });

  // Movement
  socket.on("move", dir => {
    const p = players[socket.id];
    const speed = 10;
    if (dir === "left") p.x -= speed;
    if (dir === "right") p.x += speed;
    if (p.x < 0) p.x = 0;
    if (p.x > GAME_WIDTH - PLAYER_WIDTH) p.x = GAME_WIDTH - PLAYER_WIDTH;
  });

  // Restart request
  socket.on("restartRequest", () => {
    restartVotes[socket.id] = true;
    if (Object.keys(restartVotes).length === 2) {
      otpValues = {};
      otpDone = {};
      restartVotes = {};
      io.emit("restartGame");
    }
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    blocks = [];
    gameRunning = false;
    otpValues = {};
    otpDone = {};
    restartVotes = {};
    io.emit("waitingForPlayer");
  });
});

server.listen(PORT, () => console.log("RUNNING → http://localhost:" + PORT));
