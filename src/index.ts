
import { WebSocket, WebSocketServer } from 'ws';
import jwt, { JwtPayload } from "jsonwebtoken";
import { JWT_SECRET } from './config';
const { prismaClient } = require("@repo/db/client")

const wss = new WebSocketServer({ port: 8080 });

interface User {
  ws: WebSocket,
  rooms: string[],
  userId: string
}

const users: User[] = [];

function checkUser(token: string): string | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (typeof decoded == "string") {
      return null;
    }

    if (!decoded || !decoded.userId) {
      return null;
    }

    return decoded.userId;
  } catch(e) {
    return null;
  }
  return null;
}

wss.on('connection', function connection(ws, request) {
  const url = request.url;
  console.log("Connected")
  if (!url) {
    return;
  }
  const urlPath = url.startsWith("/ws") ? url.replace(/^\/ws/, "") : url;
    const queryParams = new URLSearchParams(urlPath.split('?')[1] || "");
    const token = queryParams.get("token") || "";
    const userId = checkUser(token);

    if (!userId) {
        console.log("Invalid token, closing connection");
        console.log(token);
        console.log("TOKEN ABOVE ME");
        ws.close();
        return;
    }


  users.push({
    userId,
    rooms: [],
    ws
  })

  ws.on('message', async function message(data) {
    let parsedData;
    if (typeof data !== "string") {
      parsedData = JSON.parse(data.toString());
    } else {
      parsedData = JSON.parse(data); // {type: "join-room", roomId: 1}
    }
    
    if (parsedData.type === "join_room") {
     console.log("ROOM JOINED");
      const user = users.find(x => x.ws === ws);
      user?.rooms.push(parsedData.roomId);
      console.log(users);
    }

    if (parsedData.type === "leave_room") {
      const user = users.find(x => x.ws === ws);
      if (!user) {
        return;
      }
      user.rooms = user?.rooms.filter(x => x === parsedData.room);
    }
    

    if (parsedData.type === "chat") {
        console.log("Message PING");
      const roomId = parsedData.roomId;
      const message = parsedData.message;

      await prismaClient.chat.create({
        data: {
          roomId: Number(roomId),
          message,
          userId
        }
      });
      
      users.forEach(user => {
        console.log("MILA->" + user.userId);
        console.log(user.rooms);
        
        if (user.rooms.map(String).includes(String(roomId))) {
        console.log("BOOM");
         console.log("Sending to " + user.userId);
          user.ws.send(JSON.stringify({
            type: "chat",
            message: message,
            roomId
          }))
        }
      })
    }

  });

});