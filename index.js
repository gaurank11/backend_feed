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

export const io = new Server(server, {
  cors: {
    origin: "https://beebark-feed.vercel.app",
    credentials: true,
  },
});

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: "https://beebark-feed.vercel.app",
    credentials: true,
  })
);

// Base Route for health/status check
app.get("/", (req, res) => {
  res.send("<h1>🟢 Beebark Backend Server is Running!</h1>");
});

// API Routes
app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/post", postRouter);
app.use("/api/connection", connectionRouter);
app.use("/api/notification", notificationRouter);

// WebSocket connection
export const userSocketMap = new Map();

io.on("connection", (socket) => {
  socket.on("register", (userId) => {
    userSocketMap.set(userId, socket.id);
    console.log(userSocketMap);
  });

  socket.on("disconnect", () => {
    for (let [key, value] of userSocketMap.entries()) {
      if (value === socket.id) {
        userSocketMap.delete(key);
      }
    }
    console.log("User disconnected:", socket.id);
  });
});

// Server Listening
const port = process.env.PORT || 5000;
server.listen(port, () => {
  connectDb();
  console.log(`Server started on port ${port}`);
});
