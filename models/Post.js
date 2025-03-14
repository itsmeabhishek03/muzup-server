const mongoose = require("mongoose");

// Reply Schema
const replySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    parentComment: {
        id: String,
    },
    replyingTo:{
        id: String,
    },
    replyToId: {
        type: mongoose.Schema.Types.ObjectId,
        // This can be null if replying to the main comment
      },
    name: {
        type: String
    },
    text: {
        type: String,
        required: true
    },
    likes: {
        type: Array,
        default: []
    }
}, {
    timestamps: true
});

// Comment Schema with replies
const commentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String
    },
    text: {
        type: String,
        required: true
    },
    likes: {
        type: Array,
        default: []
    },
    replies: [replySchema]
}, {
    timestamps: true
});

// Post Schema
const PostSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    caption: {
        type: String,
        maxlength: 50
    },
    img: {
        type: String
    },
    likes: {
        type: Array,
        default: []
    },
    songId: {
        type: String,
        required: false
    },
    comments: [commentSchema]
}, {
    timestamps: true
});

module.exports = mongoose.model("Post", PostSchema);