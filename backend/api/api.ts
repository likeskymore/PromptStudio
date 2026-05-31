// @ts-ignore
import express from 'express';

// @ts-ignore
import multer from 'multer';
import {run_experiment} from "./runner";
import {getTotalTokenCountForExperiment, save_config} from "./configHandler";

const app = express();
const port = 3001;

app.use(express.json());

const upload = multer({ dest: 'uploads/' });

/**
 * Endpoint to upload a YAML configuration file and other files.
 * It saves the configuration and returns the experiment name.
 */
app.post('/config', upload.any(), async (req, res) => {
    try {
        if (!req.files || !Array.isArray(req.files)) {
            return res.status(400).json({ error: "No files uploaded" });
        }

        const yamlFile = req.files.find(f => f.fieldname === 'yaml');

        if (!yamlFile) {
            return res.status(400).json({ error: "Missing YAML config file (fieldname='yaml')" });
        }

        const fileMap: Record<string, Express.Multer.File[]> = {};

        for (const f of req.files) {
            if (!fileMap[f.fieldname]) {
                fileMap[f.fieldname] = [];
            }
            fileMap[f.fieldname].push(f);
        }

        const experiment_name = await save_config(yamlFile.path, fileMap);

        return res.status(201).json({ experiment_name });

    } catch (error) {
        console.error("CONFIG ERROR:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * Endpoint to run an experiment by its names.
 * The experiment must be already saved in the database.
 */
app.get('/run_experiment/:name', async (req, res) => {
    try{
        const experiment_name = req.params.name;
        const api_keys = req.query.api_keys as string;
        await run_experiment(experiment_name, api_keys);
        res.status(200).json({ message: `Experiment ${experiment_name} started.` });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

/**
 * Endpoint to get the total token count for a specific experiment before running it.
 */
app.get('/total_tokens/:experiment_name', async (req, res) => {
    try{
        const experiment_name = req.params.experiment_name;
        const total_tokens = await getTotalTokenCountForExperiment(experiment_name);
        res.json({ total_tokens });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})


app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
