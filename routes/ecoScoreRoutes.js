import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
  getEcoScoreAnalytics,
  getMonthlyEcoScoreAnalytics,
} from "../services/ecoScoreService.js";

const router = express.Router();

router.use(authenticateToken);

router.get("/", async (req, res) => {
  try {
    const result = await getEcoScoreAnalytics(req.user.id);

    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to fetch eco score analytics." });
  }
});

router.get("/monthly", async (req, res) => {
  try {
    const result = await getMonthlyEcoScoreAnalytics(req.user.id);

    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to fetch monthly eco score analytics." });
  }
});

export default router;
