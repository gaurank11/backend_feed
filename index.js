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

// Allowed origins for CORS (frontend URLs)
const allowedOrigins = [
  "https://beebark-feed.vercel.app",  // Vercel frontend
];

// CORS options with origin check and debug logging
const corsOptions = {
  origin: function (origin, callback) {
    console.log("Incoming request Origin:", origin);
    // Allow requests with no origin like Postman or server-to-server calls
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

// Preflight OPTIONS requests must be handled with CORS headers
app.options("*", cors(corsOptions));

// Apply CORS middleware
app.use(cors(corsOptions));

// Built-in middleware to parse JSON bodies
app.use(express.json());

// Parse cookies
app.use(cookieParser());

// API Routes
app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/post", postRouter);
app.use("/api/connection", connectionRouter);
app.use("/api/notification", notificationRouter);

// Socket.io server with CORS config
export const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  },
});

// Map userId to socketId for real-time features
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

// Connect to database and start server
const port = process.env.PORT || 5000;
server.listen(port, () => {
  connectDb();
  console.log(`🚀 Server started on port ${port}`);
});
