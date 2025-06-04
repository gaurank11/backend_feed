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

// Allowed origins for CORS
const allowedOrigins = [
  "https://beebark-feed.vercel.app",
  "http://localhost:5173"
];

// CORS middleware with origin function to check whitelist
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like curl, Postman) or from allowed origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// Socket.io server with CORS config matching allowed origins
export const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  },
});

// Middleware for parsing JSON and cookies
app.use(express.json());
app.use(cookieParser());

// API routes
app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/post", postRouter);
app.use("/api/connection", connectionRouter);
app.use("/api/notification", notificationRouter);

// Map to keep track of userId to socketId
export const userSocketMap = new Map();

io.on("connection", (socket) => {
  console.log("✅ New client connected:", socket.id);

  // Client emits 'register' with their userId
  socket.on("register", (userId) => {
    userSocketMap.set(userId, socket.id);
    console.log("✅ User registered:", userId, socket.id);
  });

  // Clean up when socket disconnects
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

// Start server and connect to database
const port = process.env.PORT || 5000;
server.listen(port, () => {
  connectDb();
  console.log(`🚀 Server started on port ${port}`);
});
