const router = require("express").Router();
const { calculateMatchPercentage } = require("../utils/MatchCalculator");


router.get('/:userId1/:userId2', async (req, res) => {
    const { userId1, userId2 } = req.params;
    try {
      const matchPercentage = await calculateMatchPercentage(userId1, userId2); // Your matching function
      res.json({ matchPercentage });
    } catch (error) {
      res.status(500).json({ error: 'Error calculating match percentage' });
      console.log(error);
    }
  });

module.exports = router;