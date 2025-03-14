const router = require("express").Router();
const User = require("../models/User");

//get all users
router.get("/all", async(req, res)=>{
    try {
        const data = await User.find();
        res.status(200).json(data);
    } catch (error) {
        console.log(error);
    }
});

// update user
router.put("/:id", async (req, res)=>{
      if(req.body.userId === req.params.id){
        try {
            if (req.body.username) {
                const existingUser = await User.findOne({ username: req.body.username });
                if (existingUser && existingUser._id.toString() !== req.params.id) {
                  return res.status(400).json("Username already exists");
                }
              }
            await User.findByIdAndUpdate(req.params.id, {
                $set: req.body
            });
            res.status(200).json("Account has been Updated");
        } catch (error) {
            console.log(error);
            return res.status(500).json(err);
        }        
      }else{
        return res.status(403).json("you can only update your account");
      }
});

// delete user
router.delete("/delete/:id", async (req, res) =>{
    if(req.body.userId === req.params.id){
        try {
             await User.findByIdAndDelete(req.params.id);
            res.status(200).send("User has been deleted")
        } catch (error) {
            res.status(500).json(err);

        }
    }else{
        res.status(403).send("you can only delete your account");
    }   
});

// get a user
router.get("/", async (req, res) =>{
    const userId = req.query.userId;
    const username = req.query.username;
   
        try {
            const user = userId ? await User.findById(userId) :
            await User.findOne({username : username}) ;
    
            res.status(200).json(user);
        }catch(error)
        {
            res.status(500).json(error);
        }
});

// get a user
router.get("/email", async (req, res) =>{
    const emailId = req.query.email;
        try {
            const user = await User.findOne({email : emailId}) ;
            res.status(200).json(user);
        }
        catch(error){
            res.status(500).json(error);
        }
});

//get friends
router.get("/friends/:userId", async (req, res)=>{
    try {
        const user = await User.findById(req.params.userId);
        const friends = await Promise.all(
            user.followings.map(friendId =>{
                return User.findById(friendId);
            })
        )
        let friendList = [];
        friends.map((friend) =>{
            const {_id, username, ProfilePicture } = friend;
            friendList.push({_id, username, ProfilePicture});

        });
        res.status(200).json(friendList);
    } catch (error) {
        res.status(500).json(error)
    }
})

// Follow or request to follow a user
router.put("/:id/follow", async (req, res) => {
    if(req.params.id !== req.body.userId){
        try {
            const user = await User.findById(req.params.id);
            const currentUser = await User.findById(req.body.userId);

            // Check if the user is blocked by the current user
            if(currentUser.blockedByMe.includes(req.params.id)){
                return res.status(403).json("You cannot follow a user you have blocked");
            }
            
            if(!user.followers.includes(req.body.userId) && !user.pendingRequests.includes(req.body.userId)){
                if(user.isPrivate){
                    // If the account is private, add to pending requests
                    await user.updateOne({$push:{pendingRequests:req.body.userId}});
                    await currentUser.updateOne({$push:{requestedTo:req.params.id}});
                    res.status(200).json("Follow request sent");
                } else {
                    // If the account is public, follow directly
                    await user.updateOne({$push:{followers:req.body.userId}});
                    await currentUser.updateOne({$push:{followings:req.params.id}});
                    res.status(200).json("User followed successfully");
                }
            } else {
                res.status(403).json("You already follow or have a pending request for this user");
            }
        } catch (error) {
            res.status(500).json(error);
        }
    } else {
        res.status(403).json("You can't follow yourself");
    }
});


// Unfollow a user or cancel follow request
router.put("/:id/unfollow", async (req, res) => {
    if(req.params.id !== req.body.userId){
        try {
            const user = await User.findById(req.params.id);
            const currentUser = await User.findById(req.body.userId);
            
            // Check if the user is blocked by the current user
            if(currentUser.blockedByMe.includes(req.params.id)){
                return res.status(403).json("You cannot unfollow a user you have blocked");
            }

            if(user.followers.includes(req.body.userId)){
                // Unfollow
                await user.updateOne({$pull:{followers:req.body.userId}});
                await currentUser.updateOne({$pull:{followings:req.params.id}});
                res.status(200).json("User unfollowed successfully");
            } else if(user.pendingRequests.includes(req.body.userId)){
                // Cancel follow request
                await user.updateOne({$pull:{pendingRequests:req.body.userId}});
                await currentUser.updateOne({$pull:{requestedTo:req.params.id}});
                res.status(200).json("Follow request cancelled");
            } else {
                res.status(403).json("You don't follow or have a pending request for this user");
            }
        } catch (error) {
            res.status(500).json(error);
        }
    } else {
        res.status(403).json("You can't unfollow yourself");
    }
});


// Accept a follow request
router.put("/:id/accept-request", async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        const requester = await User.findById(req.body.requesterId);
        
        if(user.pendingRequests.includes(req.body.requesterId)){
            await user.updateOne({
                $pull: {pendingRequests: req.body.requesterId},
                $push: {followers: req.body.requesterId}
            });
            await requester.updateOne({
                $pull: {requestedTo: req.params.id},
                $push: {followings: req.params.id}
            });
            res.status(200).json("Follow request accepted");
        } else {
            res.status(403).json("No such pending request");
        }
    } catch (error) {
        res.status(500).json(error);
    }
});

// Reject a follow request
router.put("/:id/reject-request", async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        const requester = await User.findById(req.body.requesterId);
        
        if(user.pendingRequests.includes(req.body.requesterId)){
            await user.updateOne({$pull: {pendingRequests: req.body.requesterId}});
            await requester.updateOne({$pull: {requestedTo: req.params.id}});
            res.status(200).json("Follow request rejected");
        } else {
            res.status(403).json("No such pending request");
        }
    } catch (error) {
        res.status(500).json(error);
    }
});

router.put("/:id/block", async (req, res) => {
    if (req.params.id !== req.body.userId) {
        try {
            const user = await User.findById(req.params.id);
            const currentUser = await User.findById(req.body.userId);

            if (!currentUser.blockedByMe.includes(req.params.id)) {
                // Add the user to the blockedByMe array
                await currentUser.updateOne({ $push: { blockedByMe: req.params.id } });
                // Optionally, you can unfollow the user if they are currently followed
                await currentUser.updateOne({ $pull: { followings: req.params.id } });
                await user.updateOne({ $pull: { followers: req.body.userId } });

                res.status(200).json("User blocked successfully");
            } else {
                res.status(403).json("User is already blocked");
            }
        } catch (error) {
            res.status(500).json(error);
        }
    } else {
        res.status(403).json("You can't block yourself");
    }
});

router.put("/:id/unblock", async (req, res) => {
    if (req.params.id !== req.body.userId) {
        try {
            const currentUser = await User.findById(req.body.userId);

            if (currentUser.blockedByMe.includes(req.params.id)) {
                // Remove the user from the blockedByMe array
                await currentUser.updateOne({ $pull: { blockedByMe: req.params.id } });
                res.status(200).json("User unblocked successfully");
            } else {
                res.status(403).json("User is not blocked");
            }
        } catch (error) {
            res.status(500).json(error);
        }
    } else {
        res.status(403).json("You can't unblock yourself");
    }
});



module.exports = router;