import express from "express";
import { getTotalTokenCountForExperiment } from "../../configHandler";

const router = express.Router();

router.get("/:experiment_name", async (req, res) => {
  try {
    const experiment_name = req.params.experiment_name;
    const total_tokens = await getTotalTokenCountForExperiment(experiment_name);
    res.json({ total_tokens });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export const TokenRoutes = router;
