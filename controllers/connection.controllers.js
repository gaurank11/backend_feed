import Connection from "../models/connection.model.js";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import { io, userSocketMap } from "../index.js";

// Send Connection Request
export const sendConnection = async (req, res) => {
	try {
		const { id } = req.params;
		const sender = req.userId;

		if (sender === id) {
			return res.status(400).json({ message: "You cannot send a request to yourself" });
		}

		const user = await User.findById(sender);
		if (user.connection.includes(id)) {
			return res.status(400).json({ message: "You are already connected" });
		}

		const existingConnection = await Connection.findOne({
			sender,
			receiver: id,
			status: "pending",
		});

		if (existingConnection) {
			return res.status(400).json({ message: "Request already exists" });
		}

		const newRequest = await Connection.create({
			sender,
			receiver: id,
		});

		// Emit socket updates
		const receiverSocketId = userSocketMap.get(id);
		const senderSocketId = userSocketMap.get(sender);

		if (receiverSocketId && io.sockets.sockets.get(receiverSocketId)) {
			io.to(receiverSocketId).emit("statusUpdate", { updatedUserId: sender, newStatus: "received" });
		}
		if (senderSocketId && io.sockets.sockets.get(senderSocketId)) {
			io.to(senderSocketId).emit("statusUpdate", { updatedUserId: id, newStatus: "pending" });
		}

		return res.status(200).json(newRequest);
	} catch (error) {
		console.error("sendConnection error:", error);
		return res.status(500).json({ message: `sendConnection error: ${error.message}` });
	}
};

// Accept Connection
export const acceptConnection = async (req, res) => {
	try {
		const { connectionId } = req.params;
		const userId = req.userId;

		const connection = await Connection.findById(connectionId);
		if (!connection) return res.status(400).json({ message: "Connection does not exist" });

		if (connection.status !== "pending") {
			return res.status(400).json({ message: "Request already processed" });
		}

		if (connection.receiver.toString() !== userId.toString()) {
			return res.status(403).json({ message: "Unauthorized action" });
		}

		connection.status = "accepted";
		await connection.save();

		// Add both users to each other's connection list
		await User.findByIdAndUpdate(userId, {
			$addToSet: { connection: connection.sender },
		});
		await User.findByIdAndUpdate(connection.sender, {
			$addToSet: { connection: userId },
		});

		// Send notification
		await Notification.create({
			receiver: connection.sender,
			type: "connectionAccepted",
			relatedUser: userId,
		});

		// Emit socket updates
		const receiverSocketId = userSocketMap.get(userId);
		const senderSocketId = userSocketMap.get(connection.sender.toString());

		if (receiverSocketId && io.sockets.sockets.get(receiverSocketId)) {
			io.to(receiverSocketId).emit("statusUpdate", {
				updatedUserId: connection.sender,
				newStatus: "connected",
			});
		}
		if (senderSocketId && io.sockets.sockets.get(senderSocketId)) {
			io.to(senderSocketId).emit("statusUpdate", {
				updatedUserId: userId,
				newStatus: "connected",
			});
		}

		return res.status(200).json({ message: "Connection accepted" });
	} catch (error) {
		console.error("acceptConnection error:", error);
		return res.status(500).json({ message: `acceptConnection error: ${error.message}` });
	}
};

// Reject Connection
export const rejectConnection = async (req, res) => {
	try {
		const { connectionId } = req.params;
		const userId = req.userId;

		const connection = await Connection.findById(connectionId);
		if (!connection) return res.status(400).json({ message: "Connection does not exist" });

		if (connection.status !== "pending") {
			return res.status(400).json({ message: "Request already processed" });
		}

		if (connection.receiver.toString() !== userId.toString()) {
			return res.status(403).json({ message: "Unauthorized action" });
		}

		connection.status = "rejected";
		await connection.save();

		// Optional: notify sender
		await Notification.create({
			receiver: connection.sender,
			type: "connectionRejected",
			relatedUser: userId,
		});

		return res.status(200).json({ message: "Connection rejected" });
	} catch (error) {
		console.error("rejectConnection error:", error);
		return res.status(500).json({ message: `rejectConnection error: ${error.message}` });
	}
};

// Get Connection Status
export const getConnectionStatus = async (req, res) => {
	try {
		const targetUserId = req.params.userId;
		const currentUserId = req.userId;

		const currentUser = await User.findById(currentUserId).lean();
		if (currentUser.connection.includes(targetUserId)) {
			return res.json({ status: "connected" });
		}

		const pendingRequest = await Connection.findOne({
			$or: [
				{ sender: currentUserId, receiver: targetUserId },
				{ sender: targetUserId, receiver: currentUserId },
			],
			status: "pending",
		});

		if (pendingRequest) {
			if (pendingRequest.sender.toString() === currentUserId.toString()) {
				return res.json({ status: "pending" });
			} else {
				return res.json({ status: "received", requestId: pendingRequest._id });
			}
		}

		return res.json({ status: "connect" });
	} catch (error) {
		console.error("getConnectionStatus error:", error);
		return res.status(500).json({ message: "getConnectionStatus error" });
	}
};

// Remove Connection
export const removeConnection = async (req, res) => {
	try {
		const myId = req.userId;
		const otherUserId = req.params.userId;

		await User.findByIdAndUpdate(myId, { $pull: { connection: otherUserId } });
		await User.findByIdAndUpdate(otherUserId, { $pull: { connection: myId } });

		const receiverSocketId = userSocketMap.get(otherUserId);
		const senderSocketId = userSocketMap.get(myId);

		if (receiverSocketId && io.sockets.sockets.get(receiverSocketId)) {
			io.to(receiverSocketId).emit("statusUpdate", { updatedUserId: myId, newStatus: "connect" });
		}
		if (senderSocketId && io.sockets.sockets.get(senderSocketId)) {
			io.to(senderSocketId).emit("statusUpdate", { updatedUserId: otherUserId, newStatus: "connect" });
		}

		return res.json({ message: "Connection removed successfully" });
	} catch (error) {
		console.error("removeConnection error:", error);
		return res.status(500).json({ message: "removeConnection error" });
	}
};

// Get All Incoming Connection Requests
export const getConnectionRequests = async (req, res) => {
	try {
		const userId = req.userId;

		const requests = await Connection.find({ receiver: userId, status: "pending" })
			.populate("sender", "firstName lastName email userName profileImage headline")
			.lean();

		return res.status(200).json(requests);
	} catch (error) {
		console.error("getConnectionRequests error:", error);
		return res.status(500).json({ message: "getConnectionRequests error" });
	}
};

// Get User's Connected Users
export const getUserConnections = async (req, res) => {
	try {
		const userId = req.userId;

		const user = await User.findById(userId)
			.populate("connection", "firstName lastName userName profileImage headline connection")
			.lean();

		return res.status(200).json(user.connection);
	} catch (error) {
		console.error("getUserConnections error:", error);
		return res.status(500).json({ message: "getUserConnections error" });
	}
};
