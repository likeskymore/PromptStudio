import express, { Router } from "express";
import { ExperimentRoutes } from "../modules/experiment/route";
import { ConfigRoutes } from "../modules/experiment_config/route";
import { ExperimentStateRoutes } from "../modules/experiment_state/route";
const router = express.Router();

const apiRoutes: { path: string; route: Router }[] = [
  {
    path: "/config",
    route: ConfigRoutes,
  },
  {
    path: "/experiments",
    route: ExperimentRoutes,
  },
  {
    path: "/experiment_states",
    route: ExperimentStateRoutes,
  },
];

apiRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
