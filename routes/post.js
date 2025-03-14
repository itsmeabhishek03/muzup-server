const router = require("express").Router();
const Post = require("../models/Post");
const User = require("../models/User");
const mongoose = require("mongoose");

// Create a post
router.post("/", async (req, res) => {
  const newPost = new Post(req.body);
  try {
    const post = await newPost.save();
    res.status(200).json(post);
  } catch (error) {
    res.status(500).send(error);
  }
});

// Update a post
router.put("/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (post.userId === req.body.userId) {
      await post.updateOne({ $set: req.body });
      res.status(200).json("Your post has been updated");
    } else {
      res.status(403).json("You can only update your post");
    }
  } catch (error) {
    return res.status(500).json(error);
  }
});

// Delete a post
router.delete("/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (post.userId === req.body.userId) {
      await post.deleteOne();
      res.status(200).json("Post has been deleted");
    } else {
      res.status(403).json("You can only delete your post");
    }
  } catch (error) {
    res.status(500).json(error);
  }
});

// Like/Dislike a post
router.put("/:id/like", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post.likes.includes(req.body.userId)) {
      await post.updateOne({ $push: { likes: req.body.userId } });
      res.status(200).json("The post has been liked");
    } else {
      await post.updateOne({ $pull: { likes: req.body.userId } });
      res.status(200).json("The post has been disliked");
    }
  } catch (error) {
    res.status(500).json(error);
  }
});

// Get a post
router.get("/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    res.status(200).json(post);
  } catch (error) {
    res.status(500).json(error);
  }
});


// Get timeline posts
router.get("/timeline/:userId", async (req, res) => {
  try {
    const currentUser = await User.findById(req.params.userId);
    const userPosts = await Post.find({ userId: currentUser._id }).sort({createdAt: -1});
    const friendPosts = await Promise.all(
      currentUser.followings.map((friendId) => {
        return Post.find({ userId: friendId }).sort({createdAt: -1})
      })
    );
    // let response = [...userPosts, ...friendPosts]
    const timelinePosts = userPosts.concat(...friendPosts).sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.status(200).json(timelinePosts);
  } catch (error) {
    res.status(500).json(error);
  }
});


// Get all posts of a user
router.get("/profile/:username", async (req, res) => {
  try {
    const currentUser = await User.findOne({ username: req.params.username });
    const userPosts = await Post.find({ userId: currentUser._id });
    res.status(200).json(userPosts);
  } catch (error) {
    res.status(500).json(error);
  }
});

// Get comments of a Post with pagination
router.get("/all/:postId", async (req, res) => {
  try {
    const postId = mongoose.Types.ObjectId(req.params.postId);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 4;
    const skip = (page - 1) * limit;

    const post = await Post.findById(postId);
    
    if (!post) {
      return res.status(404).json("Post Doesn't Exist");
    }

    const totalComments = post.comments.length;
    const comments = post.comments.slice(skip, skip + limit);

    res.status(200).json({
      comments,
      currentPage: page,
      totalPages: Math.ceil(totalComments / limit),
      hasMore: skip + limit < totalComments
    });
  } catch (error) {
    res.status(500).json(error);
  }
});

//add a comment
router.post("/:id/comment", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json("Post not found");
    }
    
    // Extract data from request body
    const { id, name, text } = req.body;
    
    // Create comment object with correct field name (userId instead of id)
    const comment = {
      userId: mongoose.Types.ObjectId(id), // Convert id to userId
      name: name,
      text: text,
      likes: [],
      replies: []
    };

    // Add comment to post
    post.comments.push(comment);

    // Save the updated post
    const updatedPost = await post.save();
    
    // Return the newly added comment
    res.status(200).json(updatedPost.comments[updatedPost.comments.length-1]);
  } catch (error) {
    console.log(error);
    res.status(500).json(error);
  }
});


// Delete a comment from a post
router.delete("/:postId/comment/:commentId", async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json("Post not found");
    }
    const commentIndex = post.comments.findIndex(
      (comment) => comment._id.toString() === req.params.commentId
    );
    if (commentIndex === -1) {
      return res.status(404).json("Comment not found");
    }
    if (post.comments[commentIndex].id.toString() !== req.body.userId) {
      return res.status(403).json("You can only delete your own comment");
    }
    post.comments.splice(commentIndex, 1);
    await post.save();

    res.status(200).json("Comment has been deleted");
  } catch (error) {
    res.status(500).json(error);
  }
});


// Add a reply to a comment
router.post("/:postId/comment/:commentId/reply", async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json("Post not found");
    }

    const comment = post.comments.id(req.params.commentId);
    
    if (!comment) {
      return res.status(404).json("Comment not found");
    }

    const { userId, name, text, replyToId } = req.body;
    
    // Generate a new unique ID for this reply
    const replyId = new mongoose.Types.ObjectId();
    
    const reply = {
      _id: replyId,
      userId: mongoose.Types.ObjectId(userId),
      parentComment: req.params.commentId,
      replyToId: replyToId, // ID of the comment/reply this is responding to
      name: name,
      text: text,
      likes: []
    };

    // Initialize replies array if it doesn't exist
    if (!comment.replies) {
      comment.replies = [];
    }

    // Find the index of the comment we're replying to
    const replyToIndex = comment.replies.findIndex(r => r._id.toString() === replyToId);
    
    if (replyToIndex !== -1) {
      // Insert right after the reply we're responding to
      comment.replies.splice(replyToIndex + 1, 0, reply);
    } else {
      // If replying to the main comment or reply not found, add to the end
      comment.replies.push(reply);
    }

    const updatedPost = await post.save();
    const updatedComment = updatedPost.comments.id(req.params.commentId);
    
    // Return the newly added reply
    const newReply = updatedComment.replies.find(r => r._id.toString() === replyId.toString());
    res.status(200).json(newReply);
  } catch (error) {
    console.log(error);
    res.status(500).json(error);
  }
});

// Delete a reply from a comment
router.delete("/:postId/comment/:commentId/reply/:replyId", async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json("Post not found");
    }

    const comment = post.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json("Comment not found");
    }

    const reply = comment.replies.id(req.params.replyId);
    if (!reply) {
      return res.status(404).json("Reply not found");
    }

    // Check if the user is authorized to delete the reply
    if (reply.userId.toString() !== req.body.userId) {
      return res.status(403).json("You can only delete your own reply");
    }

    // Remove the reply
    comment.replies.pull(reply._id);
    await post.save();

    res.status(200).json("Reply has been deleted");
  } catch (error) {
    console.log(error);
    res.status(500).json(error);
  }
});

// Like/Unlike a reply
router.put("/:postId/comment/:commentId/reply/:replyId/like", async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json("Post not found");
    }

    const comment = post.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json("Comment not found");
    }

    const reply = comment.replies.id(req.params.replyId);
    if (!reply) {
      return res.status(404).json("Reply not found");
    }

    if (!reply.likes.includes(req.body.userId)) {
      // Like the reply
      reply.likes.push(req.body.userId);
      await post.save();
      res.status(200).json("Reply has been liked");
    } else {
      // Unlike the reply
      reply.likes = reply.likes.filter(id => id !== req.body.userId);
      await post.save();
      res.status(200).json("Reply has been unliked");
    }
  } catch (error) {
    console.log(error);
    res.status(500).json(error);
  }
});

// Get replies for a comment with pagination
router.get("/:postId/comment/:commentId/replies", async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json("Post not found");
    }

    const comment = post.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json("Comment not found");
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 4;
    const skip = (page - 1) * limit;

    const totalReplies = comment.replies.length;
    const replies = comment.replies.slice(skip, skip + limit);

    res.status(200).json({
      replies,
      currentPage: page,
      totalPages: Math.ceil(totalReplies / limit),
      hasMore: skip + limit < totalReplies
    });
  } catch (error) {
    console.log(error);
    res.status(500).json(error);
  }
});

router.put("/:postId/comment/:commentId/like", async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json("Post not found");
    }

    const comment = post.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json("Comment not found");
    }

    let likes = comment.likes;

    if (!likes.includes(req.body.userId)) {
      // Like the reply
      likes.push(req.body.userId);
      await post.save();
      res.status(200).json("Reply has been liked");
    } else {
      // Unlike the reply
      likes = likes.filter(id => id !== req.body.userId);
      await post.save();
      res.status(200).json("Reply has been unliked");
    }
  } catch (error) {
    console.log(error);
    res.status(500).json(error);
  }
});

module.exports = router;

