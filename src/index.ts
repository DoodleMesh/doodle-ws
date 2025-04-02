import { WebSocket, WebSocketServer } from 'ws';
import { JWT_SECRET } from './config';
import jwt from "jsonwebtoken";
const { PrismaClient } = require("@prisma/client");
const prismaClient = new PrismaClient();

const wss = new WebSocket.Server({ port: 8080, host: '0.0.0.0' });

interface User {
    ws: WebSocket,
    rooms: string[],
    userId: string
}

let users: User[] = [];

function checkUser(token: string): string | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (typeof decoded === "string" || !decoded?.userId) {
            return null;
        }
        return decoded.userId;
    } catch (e) {
        return null;
    }
}

wss.on('connection', function connection(ws, request) {
    const url = request.url;
    console.log("Client connected");
    if (!url) return;

    const urlPath = url.startsWith("/ws") ? url.replace(/^\/ws/, "") : url;
    const queryParams = new URLSearchParams(urlPath.split('?')[1] || "");
    const token = queryParams.get("token") || "";
    const userId = checkUser(token);

    if (!userId) {
        console.log("Invalid token, closing connection");
        ws.close();
        return;
    }

    console.log("Pushing user", userId);

    users = users.filter(user => user.ws.readyState !== WebSocket.CLOSED);
    users.push({ ws, rooms: [], userId });

    ws.on('close', function close() {
        console.log(`User ${userId} disconnected`);
        users = users.filter(user => user.ws !== ws);
    });

    ws.on('message', async function message(data) {
        let parsedData;
        try {
            parsedData = JSON.parse(data.toString());
        } catch (error) {
            console.error("Invalid JSON received:", data);
            return;
        }

        if (parsedData.type === "join_room") {
            console.log("Join Room Triggered", parsedData);
            const user = users.find(x => x.ws === ws);
            if (user) {
                user.rooms.push(parsedData.roomId);
            }
        }

        if (parsedData.type === "leave_room") {
            const user = users.find(x => x.ws === ws);
            if (user) {
                console.log("Leave Room Triggered");
                user.rooms = user.rooms.filter(x => x !== parsedData.roomId);
            }
        }

        if (parsedData.type === "chat") {
            console.log("Message recieved")
            const { roomId, message } = parsedData;
            await prismaClient.chat.create({
                data: { roomId: Number(roomId), message, userId }
            });

            users.forEach(user => {
                if (user.rooms.includes(roomId)) {
                    user.ws.send(JSON.stringify({
                        type: "chat",
                        message,
                        roomId
                    }));
                }
            });
        }
    });
});
