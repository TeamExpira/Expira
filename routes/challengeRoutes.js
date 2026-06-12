import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { completeChallenge, getActiveChallengesForUser } from "../services/challengeService.js";
import { awardChallengePoints } from "../services/pointService.js";

const router = express.Router();

router.use(authenticateToken);

router.get("/", async (req, res) => {
  try {
    const challenges = await getActiveChallengesForUser(req.user.id);
    res.json(challenges);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to fetch challenges." });
  }
});

router.post("/:productId/complete", async (req, res) => {
  try {
    const result = await completeChallenge({
      productId: req.params.productId,
      userId: req.user.id,
    });

    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    const pointsResult = await awardChallengePoints({
      userId: req.user.id,
      product: result.product,
      daysRemaining: result.daysRemaining,
      awardedAt: result.completedAt,
    });

    if (pointsResult.error) {
      return res.status(pointsResult.error.status).json({ message: pointsResult.error.message });
    }

    res.json({
      success: true,
      message: "Challenge completed successfully",
      productId: result.product._id.toString(),
      completedAt: result.completedAt,
      pointsAwarded: pointsResult.pointsAwarded,
      totalPoints: pointsResult.totalPoints,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to complete challenge." });
  }
});

export default router;
