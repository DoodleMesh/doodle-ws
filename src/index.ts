import { WebSocket, WebSocketServer } from "ws";
import { JWT_SECRET } from "./config";
import jwt from "jsonwebtoken";
const { PrismaClient } = require("@prisma/client");
const prismaClient = new PrismaClient();

// WebSocket Server Initialization
const wss = new WebSocketServer({ port: 8080, host: "0.0.0.0" });

interface User {
  ws: WebSocket;
  rooms: string[];
  userId: string;
}

let users: User[] = [];

function checkUser(token: string): string | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === "string" || !decoded || !decoded.userId) {
      return null;
    }
    return decoded.userId;
  } catch (e) {
    return null;
  }
}

wss.on("connection", function connection(ws, request) {
  const url = request.url;
  console.log("Client connected");

  if (!url) {
    console.log("No URL found, closing WebSocket");
    ws.close();
    return;
  }

  
  const urlPath = url.startsWith("/ws") ? url.replace(/^\/ws/, "") : url;
  const queryParams = new URLSearchParams(urlPath.split("?")[1]);

  const token = queryParams.get("token") || "";
  const userId = checkUser(token);

  if (!userId) {
    console.log("Invalid token, closing WebSocket");
    ws.close();
    return;
  }

  console.log("Pushing user " + userId);
  users.push({ ws, rooms: [], userId });

  ws.on("close", function close(code, reason) {
    console.log(`User ${userId} disconnected - Code: ${code}, Reason: ${reason}`);
    users = users.filter((user) => user.ws !== ws);
  });

  ws.on("error", function error(err) {
    console.error(`WebSocket Error for user ${userId}:`, err);
  });

  ws.on("message", async function message(data) {
    let parsedData;
    try {
      parsedData = typeof data !== "string" ? JSON.parse(data.toString()) : JSON.parse(data);
    } catch (error) {
      console.error("Invalid JSON received:", error);
      return;
    }

    if (parsedData.type === "join_room") {
      console.log("Join Room Request:", parsedData);
      const user = users.find((x) => x.ws === ws);
      if (!user || !parsedData.roomId) return;
      user.rooms.push(parsedData.roomId);
    }

    if (parsedData.type === "leave_room") {
      const user = users.find((x) => x.ws === ws);
      if (!user || !parsedData.roomId) return;
      user.rooms = user.rooms.filter((x) => x !== parsedData.roomId);
      console.log(`User ${user.userId} left room ${parsedData.roomId}`);
    }

    if (parsedData.type === "chat") {
      const roomId = parsedData.roomId;
      const message = parsedData.message;
      if (!roomId || !message) return;

      await prismaClient.chat.create({
        data: { roomId: Number(roomId), message, userId },
      });

      users.forEach((user) => {
        if (user.rooms.includes(roomId)) {
          user.ws.send(JSON.stringify({ type: "chat", message, roomId }));
        }
      });
    }
  });
});
