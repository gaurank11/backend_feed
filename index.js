import express from "express";
import dotenv from "dotenv";
import connectDb from "./config/db.js";
import authRouter from "./routes/auth.routes.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import userRouter from "./routes/user.routes.js";
import postRouter from "./routes/post.routes.js";
import connectionRouter from "./routes/connection.routes.js";
import notificationRouter from "./routes/notification.routes.js";
import http from "http";
import { Server } from "socket.io";

dotenv.config();

const app = express();
const server = http.createServer(app);

// ✅ Use exact frontend URL(s) for CORS
const allowedOrigins = [
  "http://localhost:5173",                  // Local dev
  "https://beebark-feed.vercel.app",       // Frontend hosted on Vercel
];

// ✅ Socket.io server with proper CORS config
export const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  },
});

// ✅ Middleware
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// ✅ API Routes
app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/post", postRouter);
app.use("/api/connection", connectionRouter);
app.use("/api/notification", notificationRouter);

// ✅ Socket user map
export const userSocketMap = new Map();

io.on("connection", (socket) => {
  console.log("✅ New client connected:", socket.id);

  // Client should emit: socket.emit("register", userId)
  socket.on("register", (userId) => {
    userSocketMap.set(userId, socket.id);
    console.log("✅ User registered:", userId, socket.id);
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    for (const [userId, socketId] of userSocketMap.entries()) {
      if (socketId === socket.id) {
        userSocketMap.delete(userId);
        console.log("❌ User disconnected:", userId);
        break;
      }
    }
  });
});

// ✅ Start server
const port = process.env.PORT || 5000;
server.listen(port, () => {
  connectDb();
  console.log(`🚀 Server started on port ${port}`);
});
