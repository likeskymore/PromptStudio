import express, { Router } from 'express';
import { ExperimentRoutes } from '../modules/experiment/experiment.route';
import { ConfigRoutes } from '../modules/config/config.route';
import { TokenRoutes } from '../modules/tokens/tokens.route';
const router = express.Router();

const apiRoutes: { path: string; route: Router }[] = [
  {
    path: '/config',
    route: ConfigRoutes,
  },
  {
    path: '/experiments',
    route: ExperimentRoutes,
  },
  {
    path: '/total_tokens',
    route: TokenRoutes,
  },
];

apiRoutes.forEach(route => router.use(route.path, route.route));

export default router;