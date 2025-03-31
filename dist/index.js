"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const config_1 = require("./config");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const { PrismaClient } = require("@prisma/client");
const prismaClient = new PrismaClient();
// const wss = new WebSocketServer({port: 8080});
const wss = new ws_1.WebSocket.Server({ port: 8080, host: '0.0.0.0' }); // <- Binds to all IPs
const users = [];
function checkUser(token) {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.JWT_SECRET);
        if (typeof decoded == "string") {
            return null;
        }
        if (!decoded || !decoded.userId) {
            return null;
        }
        return decoded.userId;
    }
    catch (e) {
        return null;
    }
}
wss.on('connection', function connection(ws, request) {
    const url = request.url;
    console.log("Client connected");
    if (!url) {
        return;
    }
    const queryParams = new URLSearchParams(url.split('?')[1]);
    const token = queryParams.get('token') || "";
    const userId = checkUser(token);
    if (!userId) {
        console.log("closed");
        ws.close();
    }
    if (userId == null) {
        ws.close();
        return null;
    }
    console.log("Pushing user " + userId);
    users.push({
        ws,
        rooms: [],
        userId
    });
    ws.on('message', function message(data) {
        return __awaiter(this, void 0, void 0, function* () {
            let parsedData;
            if (typeof data !== "string") {
                parsedData = JSON.parse(data.toString());
            }
            else {
                parsedData = JSON.parse(data); // {type: "join-room", roomId: 1}
            }
            if (parsedData.type === "join_room") {
                console.log(parsedData);
                const user = users.find(x => x.ws === ws);
                console.log(user === null || user === void 0 ? void 0 : user.userId);
                console.log(user === null || user === void 0 ? void 0 : user.rooms);
                user === null || user === void 0 ? void 0 : user.rooms.push(parsedData.roomId);
                console.log(user === null || user === void 0 ? void 0 : user.rooms);
            }
            if (parsedData.type === "leave_room") {
                const user = users.find(x => x.ws === ws);
                if (!user) {
                    return;
                }
                console.log("Leave room trigered");
                user.rooms = user === null || user === void 0 ? void 0 : user.rooms.filter(x => x !== parsedData.roomId);
            }
            if (parsedData.type === "chat") {
                const roomId = parsedData.roomId;
                const message = parsedData.message;
                yield prismaClient.chat.create({
                    data: {
                        roomId: Number(roomId),
                        message,
                        userId
                    }
                });
                // console.log(users)
                users.forEach(user => {
                    console.log(user.userId);
                    if (user.rooms.includes(roomId)) {
                        console.log(user.userId);
                        user.ws.send(JSON.stringify({
                            type: "chat",
                            message: message,
                            roomId
                        }));
                    }
                });
            }
        });
    });
});
