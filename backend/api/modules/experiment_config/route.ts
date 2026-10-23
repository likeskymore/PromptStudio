import express from "express";
import { ExperimentConfigService } from "./service";
import multer from "multer";

/** Accepts a YAML experiment configuration and its referenced upload files. */
const router = express.Router();

const upload = multer({ dest: "uploads/" });

router.post("/", upload.any(), async (req, res) => {
  /** Saves the uploaded configuration and returns HTTP 201 with the experiment name. */
  try {
    if (!req.files || !Array.isArray(req.files)) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const yamlFile = req.files.find((f) => f.fieldname === "yaml");

    if (!yamlFile) {
      return res
        .status(400)
        .json({ error: "Missing YAML config file (fieldname='yaml')" });
    }

    const fileMap: Record<string, Express.Multer.File[]> = {};

    for (const f of req.files) {
      if (!fileMap[f.fieldname]) {
        fileMap[f.fieldname] = [];
      }
      fileMap[f.fieldname].push(f);
    }

    const experiment_name = await ExperimentConfigService.save_config(yamlFile.path, fileMap);

    return res.status(201).json({ experiment_name });
  } catch (error) {
    console.error("CONFIG ERROR:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export const ConfigRoutes = router;
