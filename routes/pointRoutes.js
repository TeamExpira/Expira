import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { getPointHistory, getPointsProfile } from "../services/pointService.js";

const router = express.Router();

router.use(authenticateToken);

router.get("/profile", async (req, res) => {
  try {
    const result = await getPointsProfile(req.user.id);

    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to fetch points profile." });
  }
});

router.get("/history", async (req, res) => {
  try {
    const result = await getPointHistory(req.user.id);

    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to fetch points history." });
  }
});

export default router;
