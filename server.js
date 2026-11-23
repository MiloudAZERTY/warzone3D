
const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 4;

const rooms = new Map();
const players = new Map();
const lastHits = new Map();

const WEAPONS = {
  25: { damage: 25, delay: 350 },
  15: { damage: 15, delay: 120 },
  12: { damage: 12, delay: 650 },
  100: { damage: 100, delay: 1000 }
};

function generateRoomCode() {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;

  do {
    code = "";
    for (let i = 0; i < 6; i++) {
      code += characters[Math.floor(Math.random() * characters.length)];
    }
  } while (rooms.has(code));

  return code;
}

function getRoomPlayers(roomCode) {
  const room = rooms.get(roomCode);
  const result = {};

  if (!room) return result;

  for (const playerId of room.players) {
    if (players.has(playerId)) {
      result[playerId] = { ...players.get(playerId) };
    }
  }

  return result;
}

function leaveRoom(socket) {
  const roomCode = socket.data.roomCode;
  if (!roomCode) return;

  const room = rooms.get(roomCode);

  if (room) {
    room.players.delete(socket.id);

    socket.to(roomCode).emit("playerDisconnected", socket.id);

    if (room.players.size === 0) {
      rooms.delete(roomCode);
      console.log("Salle supprimée :", roomCode);
    }
  }

  socket.leave(roomCode);
  socket.data.roomCode = null;
  players.delete(socket.id);
  lastHits.delete(socket.id);
}

function createPlayer(socket) {
  return {
    id: socket.id,
    x: 0,
    y: 1.7,
    z: -22,
    rotation: 0,
    health: 100,
    alive: true
  };
}

io.on("connection", (socket) => {
  console.log("Connexion :", socket.id);

  socket.data.roomCode = null;

  // CRÉER UNE PARTIE PRIVÉE
  socket.on("createRoom", (callback) => {
    leaveRoom(socket);

    const roomCode = generateRoomCode();

    rooms.set(roomCode, {
      players: new Set()
    });

    socket.join(roomCode);
    socket.data.roomCode = roomCode;

    const player = createPlayer(socket);
    players.set(socket.id, player);
    rooms.get(roomCode).players.add(socket.id);

    console.log("Salle créée :", roomCode);

    if (typeof callback === "function") {
      callback({
        ok: true,
        roomCode,
        players: getRoomPlayers(roomCode)
      });
    }
  });

  // REJOINDRE UNE PARTIE
  socket.on("joinRoom", (rawCode, callback) => {
    const roomCode = String(rawCode || "").trim().toUpperCase();
    const room = rooms.get(roomCode);

    if (!room) {
      if (typeof callback === "function") {
        callback({
          ok: false,
          error: "Salle introuvable. Vérifie le code."
        });
      }
      return;
    }

    if (room.players.size >= MAX_PLAYERS) {
      if (typeof callback === "function") {
        callback({
          ok: false,
          error: "Cette salle contient déjà 4 joueurs."
        });
      }
      return;
    }

    // Récupérer les joueurs déjà présents.
    const existingPlayers = getRoomPlayers(roomCode);

    leaveRoom(socket);

    socket.join(roomCode);
    socket.data.roomCode = roomCode;

    const player = createPlayer(socket);
    players.set(socket.id, player);
    room.players.add(socket.id);

    socket.emit("currentPlayers", existingPlayers);
    socket.to(roomCode).emit("newPlayer", player);

    console.log(socket.id, "a rejoint la salle", roomCode);

    if (typeof callback === "function") {
      callback({
        ok: true,
        roomCode,
        players: existingPlayers
      });
    }
  });

  // DÉPLACEMENTS
  socket.on("playerMovement", (data) => {
    const roomCode = socket.data.roomCode;
    const player = players.get(socket.id);

    if (!roomCode || !player || !data || !player.alive) return;

    for (const field of ["x", "y", "z", "rotation"]) {
      if (Number.isFinite(data[field])) {
        player[field] = Math.max(-250, Math.min(250, data[field]));
      }
    }

    socket.to(roomCode).emit("playerMoved", player);
  });

  // TIRS VISUELS
  socket.on("playerShoot", (data) => {
    const roomCode = socket.data.roomCode;
    const player = players.get(socket.id);

    if (!roomCode || !player || !player.alive) return;

    socket.to(roomCode).emit("playerShoot", {
      playerId: socket.id,
      data: data || {}
    });
  });

  // TOUCHER UN AUTRE JOUEUR
  socket.on("playerHit", (data) => {
    const roomCode = socket.data.roomCode;
    const attacker = players.get(socket.id);

    if (!roomCode || !attacker || !attacker.alive || !data) return;

    const targetId = data.targetId;
    const target = players.get(targetId);
    const room = rooms.get(roomCode);

    if (!room || !target || targetId === socket.id) return;

    // Les deux joueurs doivent être dans la même salle.
    if (!room.players.has(targetId)) return;

    // Vérifier les dégâts autorisés.
    const weapon = WEAPONS[data.damage];
    if (!weapon) return;

    // Limiter la cadence des tirs.
    const now = Date.now();
    const previousHit = lastHits.get(socket.id) || 0;

    if (now - previousHit < weapon.delay * 0.85) return;

    lastHits.set(socket.id, now);

    // Vérifier que la cible n'est pas trop éloignée.
    const dx = attacker.x - target.x;
    const dy = attacker.y - target.y;
    const dz = attacker.z - target.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance > 100) return;

    // Appliquer les dégâts.
    target.health = Math.max(0, target.health - weapon.damage);

    io.to(targetId).emit("playerDamaged", {
      damage: weapon.damage,
      health: target.health,
      attackerId: socket.id
    });

    socket.emit("playerHitConfirmed", {
      targetId,
      damage: weapon.damage
    });

    console.log(
      socket.id,
      "a touché",
      targetId,
      "- Vie restante :",
      target.health
    );

    if (target.health <= 0) {
      target.alive = false;

      io.to(roomCode).emit("playerEliminated", {
        playerId: targetId,
        attackerId: socket.id
      });

      console.log(targetId, "a été éliminé !");
    }
  });

  // QUITTER UNE PARTIE
  socket.on("leaveRoom", () => {
    leaveRoom(socket);
  });

  // DÉCONNEXION
  socket.on("disconnect", () => {
    leaveRoom(socket);
    console.log("Déconnexion :", socket.id);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`WARZONE 3D lancé sur le port ${PORT}`);
});

