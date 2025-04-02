import { WebSocket,WebSocketServer } from 'ws';
import { JWT_SECRET } from './config';
import jwt, { JwtPayload } from "jsonwebtoken"
const { PrismaClient } = require("@prisma/client")
const prismaClient = new PrismaClient();

// const wss = new WebSocketServer({port: 8080});
const wss = new WebSocket.Server({ port: 8080, host: '0.0.0.0' }); 


interface User{
    ws: WebSocket,
    rooms: string[],
    userId: string
}

let users: User[] = [];

function checkUser(token: string) : string | null {
    try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if( typeof decoded =="string"){
        return null;
    }

    if( !decoded || !decoded.userId) {
        return null;
    }

    return decoded.userId;
} catch(e){
    return null;
}
}


wss.on('connection', function connection(ws,request) {
    const url = request.url
    console.log("Client connected");
    if(!url){
        return;
    }

    const urlPath = url.startsWith("/ws") ? url.substring(3) : url;
    const queryParams = new URLSearchParams(urlPath.split('?')[1]);

    const token = queryParams.get('token') || "";
    const userId = checkUser(token);
    
    if(!userId){
        console.log("closed")
        ws.close()
    }

    if(userId==null)
    {
        ws.close();
        return null;
    }
    console.log("Pushing user " + userId);
    users.push({
        ws,
        rooms: [],
        userId
    })
    ws.on('close', function close() {
        console.log(`User ${userId} disconnected`);
        users = users.filter(user => user.ws !== ws);
    });

    ws.on('message', async function message(data) {
        let parsedData;
        if (typeof data !== "string") {
        parsedData = JSON.parse(data.toString());
        } else {
          parsedData = JSON.parse(data); // {type: "join-room", roomId: 1}
        }
        if(parsedData.type === "join_room"){
            console.log(parsedData);
            const user = users.find(x => x.ws === ws);
            console.log(user?.userId);
            console.log(user?.rooms);
            user?.rooms.push(parsedData.roomId)
            console.log(user?.rooms);
        }

        if(parsedData.type === "leave_room"){
            const user = users.find(x => x.ws === ws);
            if(!user){
                return;
            }
            console.log("Leave room trigered");
            user.rooms = user?.rooms.filter(x => x !== parsedData.roomId);
        }

        if(parsedData.type === "chat") {
            const roomId = parsedData.roomId;
            const message = parsedData.message;
            await prismaClient.chat.create({
                data:{
                    roomId: Number(roomId),
                    message,
                    userId
                }
            });
            // console.log(users)
            users.forEach(user => {
                console.log(user.userId);
                if (user.rooms.includes(roomId)) {
                    console.log(user.userId)
                    user.ws.send(JSON.stringify({
                    type: "chat",
                    message: message,
                    roomId
                    }))
                }
            })
        }


    })


});

