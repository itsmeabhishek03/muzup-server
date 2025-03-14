const express = require("express");
const app = express();
const http = require("http");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const dotenv = require("dotenv");
const server = http.createServer(app); // Create HTTP server
const io = require("socket.io")(server, {
  // Pass the server instance to socket.io
  cors: {
    origin: "http://localhost:3000",
  },
});
const authRoute = require("./routes/auth");
const userRoute = require("./routes/user");
const postRoute = require("./routes/post");
const storyRoute = require("./routes/story");
const conversationRoute = require("./routes/conversation");
const messageRoute = require("./routes/message");
const matchMakerRoute = require("./routes/matchmaker");
const {
  updateRecentlyPlayed,
  updateTopArtistsAndTracks,
} = require("./utils/spotifyUpdate");

dotenv.config();

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Connected To DB");
    server.listen(5555, () => {
      // Use server instance here
      console.log(`BACKEND PORT START`);
      updateRecentlyPlayed();
      updateTopArtistsAndTracks();
    });
  })
  .catch((error) => {
    console.log(error);
  });

// Middleware
app.use(express.json());
app.use(cors({ credentials: true }));
app.use(bodyParser.json());

// Routes
app.use("/api/auth/", authRoute);
app.use("/api/user/", userRoute);
app.use("/api/post/", postRoute);
app.use("/api/story/", storyRoute);
app.use("/api/conversation", conversationRoute);
app.use("/api/messages", messageRoute);
app.use("/api/match", matchMakerRoute);

const Message = require("./models/Message");

let users = [];

const addUser = (userId, socketId) => {
  if (!users.some((user) => user.userId === userId)) {
    users.push({ userId, socketId });
    console.log(`User added: ${userId} with socketId: ${socketId}`);
  }
};

const removeUser = (socketId) => {
  users = users.filter((user) => user.socketId !== socketId);
};

const getUser = (userId) => {
  return users.find((user) => user.userId === userId);
};

io.on("connection", (socket) => {
  // Add user
  socket.on("addUser", (userId) => {
    addUser(userId, socket.id);
    io.emit("getUsers", users);
    console.log(users);
  });

  // Send and get message
  socket.on(
    "sendMessage",
    async ({ sender, receiverId, text, conversationId, messageId }) => {
      const receiverSocket = getUser(receiverId);
      const senderSocket = getUser(sender);

      try {
        // 1. First emit 'sent' status to sender
        if (senderSocket) {
          io.to(senderSocket.socketId).emit("messageStatus", {
            messageId,
            status: "sent",
          });
        }

        // 2. Send message to receiver if online
        if (receiverSocket) {
          io.to(receiverSocket.socketId).emit("getMessage", {
            sender,
            text,
            conversationId,
            messageId,
          });

          // 3. Update status to 'delivered' in database
          const res = await Message.findByIdAndUpdate(messageId, {
            status: "delivered",
          });
          console.log(res);
          // 4. Emit 'delivered' status to sender when receiver is online
          if (senderSocket) {
            io.to(senderSocket.socketId).emit("messageStatus", {
              messageId,
              status: "delivered",
            });
          }
        }
      } catch (error) {
        console.error("Error in sendMessage:", error);
        if (senderSocket) {
          io.to(senderSocket.socketId).emit("messageError", {
            messageId,
            error: "Failed to send message",
          });
        }
      }
    }
  );

  // Handle message seen status
  socket.on(
    "messageSeen",
    async ({ sender, receiverId, conversationId, messageId }) => {
      try {
        console.log("seened", sender);
        // Update message status in database
        await Message.findByIdAndUpdate(messageId, {
          status: "seen",
        });

        // Notify sender
        const senderSocket = getUser(sender);
        if (senderSocket) {
          io.to(senderSocket.socketId).emit("messageStatus", {
            messageId,
            status: "seen",
            conversationId,
          });
        }
      } catch (error) {
        console.error("Error updating message seen status:", error);
      }
    }
  );

  // Handle typing events
  socket.on("typing", ({ senderId, receiverId, conversationId }) => {
    const user = getUser(receiverId);
    if (user) {
      io.to(user.socketId).emit("userTyping", { senderId, conversationId });
    }
  });

  socket.on("stopTyping", ({ senderId, receiverId, conversationId }) => {
    const user = getUser(receiverId);
    if (user) {
      io.to(user.socketId).emit("userStoppedTyping", {
        senderId,
        conversationId,
      });
    }
  });

  // Add this handler to your backend socket.io code
  socket.on("messageDelivered", async ({ messageId, senderId, receiverId }) => {
    try {
      // Update message status in database
      await Message.findByIdAndUpdate(messageId, {
        status: "delivered",
      });

      // Notify sender that message was delivered
      const senderSocket = getUser(senderId);
      if (senderSocket) {
        io.to(senderSocket.socketId).emit("messageStatus", {
          messageId,
          status: "delivered",
        });
      }
    } catch (error) {
      console.error("Error updating message delivered status:", error);
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("a user disconnected");
    removeUser(socket.id);
    io.emit("getUsers", users);
  });
});
