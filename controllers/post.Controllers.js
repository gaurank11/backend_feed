import Post from "../models/post.model.js";
import uploadOnCloudinary from "../config/cloudinary.js";
import { io } from "../index.js";
import Notification from "../models/notification.model.js";

// Create Post
export const createPost = async (req, res) => {
	try {
		const { description } = req.body;
		let newPost;

		if (req.file) {
			const image = await uploadOnCloudinary(req.file.path);
			newPost = await Post.create({
				author: req.userId,
				description,
				image,
			});
		} else {
			newPost = await Post.create({
				author: req.userId,
				description,
			});
		}

		return res.status(201).json(newPost);
	} catch (error) {
		console.error("createPost error:", error);
		return res.status(500).json({ message: `createPost error: ${error.message}` });
	}
};

// Get All Posts
export const getPost = async (req, res) => {
	try {
		const posts = await Post.find()
			.populate("author", "firstName lastName profileImage headline userName")
			.populate("comment.user", "firstName lastName profileImage headline")
			.sort({ createdAt: -1 });

		return res.status(200).json(posts);
	} catch (error) {
		console.error("getPost error:", error);
		return res.status(500).json({ message: `getPost error: ${error.message}` });
	}
};

// Like / Unlike Post
export const like = async (req, res) => {
	try {
		const postId = req.params.id;
		const userId = req.userId;

		const post = await Post.findById(postId);
		if (!post) {
			return res.status(404).json({ message: "Post not found" });
		}

		const alreadyLiked = post.like.includes(userId);
		if (alreadyLiked) {
			post.like = post.like.filter((id) => id.toString() !== userId.toString());
		} else {
			post.like.push(userId);

			// Create notification only if liker is not the author
			if (post.author.toString() !== userId.toString()) {
				await Notification.create({
					receiver: post.author,
					type: "like",
					relatedUser: userId,
					relatedPost: postId,
				});
			}
		}

		await post.save();

		if (io) {
			io.emit("likeUpdated", { postId, likes: post.like });
		}

		return res.status(200).json(post);
	} catch (error) {
		console.error("like error:", error);
		return res.status(500).json({ message: `like error: ${error.message}` });
	}
};

// Comment on Post
export const comment = async (req, res) => {
	try {
		const postId = req.params.id;
		const userId = req.userId;
		const { content } = req.body;

		const updatedPost = await Post.findByIdAndUpdate(
			postId,
			{
				$push: { comment: { content, user: userId } },
			},
			{ new: true }
		)
			.populate("comment.user", "firstName lastName profileImage headline")
			.populate("author", "firstName lastName profileImage headline userName");

		if (!updatedPost) {
			return res.status(404).json({ message: "Post not found" });
		}

		// Create notification only if commenter is not the author
		if (updatedPost.author._id.toString() !== userId.toString()) {
			await Notification.create({
				receiver: updatedPost.author._id,
				type: "comment",
				relatedUser: userId,
				relatedPost: postId,
			});
		}

		if (io) {
			io.emit("commentAdded", { postId, comments: updatedPost.comment });
		}

		return res.status(200).json(updatedPost);
	} catch (error) {
		console.error("comment error:", error);
		return res.status(500).json({ message: `comment error: ${error.message}` });
	}
};
