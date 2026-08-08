import { run_experiment } from "../backend/api/runner";
import {save_config} from "../headless/apiCall";
import * as workerpool from 'workerpool';
import { ExecOptions} from "workerpool/types/types";
import * as path from "node:path";
import {get_results_by_experiment_name, pool as dbPool} from "../backend/database/database";


jest.setTimeout(20000000);

// Keep a reference to any test-created worker pool so we can terminate it
let testPool: import('workerpool').Pool | undefined;
let originalWorkerPool: typeof workerpool.pool | undefined;

// To run those tests we need to run api.ts and have a working database
describe("run_experiment", () => {


    beforeEach( () => {
        const workerPath = path.resolve(__dirname, '../backend/api/worker.ts');
        if (!originalWorkerPool) {
            originalWorkerPool = workerpool.pool;
        }
        testPool = originalWorkerPool(workerPath);

        jest.spyOn(workerpool, 'pool').mockReturnValue(testPool as import('workerpool').Pool);

        jest.spyOn(testPool, 'exec').mockImplementation(
            (method: string | ((...args: any[]) => any), params?: any[] | null, options?: ExecOptions): workerpool.Promise<any> => {
                if (method === 'processExperiment') {
                    return {
                        success: true,
                        tries: params?.[6],
                        totalTokens: 0,
                    } as unknown as workerpool.Promise<any>;
                }
                throw new Error(`Unexpected workerpool method: ${String(method)}`);
            }
        )
    });

    afterEach(async () => {
        if (testPool) {
            try { await testPool.terminate(true); } catch (_) {}
            testPool = undefined;
        }
        jest.restoreAllMocks();
    });

    it("test", async () => {
        const yml = 'files/tabularSimpleEvalFlow.yml';
        const experiment_name = await save_config(yml);
        expect(experiment_name).toBeDefined();
        if (!experiment_name) {
            throw new Error('Expected experiment name to be created');
        }
        await run_experiment(experiment_name, '');
        const results = await get_results_by_experiment_name(experiment_name);
        expect(results).toBeDefined();
    })
});

afterAll(async () => {
    if (dbPool && typeof dbPool.end === 'function') {
        try { await dbPool.end(); } catch (_) {}
    }
});