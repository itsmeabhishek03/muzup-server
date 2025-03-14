const router = require("express").Router();
const Message = require("../models/Message");
// add
router.post("/", async (req, res) => {
  const newMessage = new Message(req.body);
  try {
    const savedMessage = await newMessage.save();
    res.status(200).json(savedMessage);
  } catch (error) {
    res.status(500).json(error);
  }
});

//get
router.get("/:conversationId", async (req, res) => {
  try {
    const message = await Message.find({
      conversationId: req.params.conversationId,
    });
    res.status(200).json(message);
  } catch (error) {
    res.status(500).json(error);
  }
});

// Update message status
router.put("/status/:messageId", async (req, res) => {
  try {
    const { status } = req.body;

    // Validate status is one of the enum values
    if (!["sent", "delivered", "seen"].includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    // Update the message status
    const updatedMessage = await Message.findByIdAndUpdate(
      req.params.messageId,
      {
        status: status,
      },
      { new: true }
    );

    if (!updatedMessage) {
      return res.status(404).json({ error: "Message not found" });
    }

    res.status(200).json(updatedMessage);
  } catch (error) {
    res.status(500).json(error);
  }
});

module.exports = router;
