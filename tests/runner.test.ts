import {save_config} from "../headless/apiCall";
import * as workerpool from 'workerpool';
import * as path from "node:path";
import {get_results_by_experiment_name, pool as dbPool} from "../backend/database/database";
import { run_experiment } from "../backend/api/runner";


jest.setTimeout(200000);

jest.mock('workerpool', () => {
    const actual = jest.requireActual('workerpool');
    return { ...actual, pool: jest.fn() } as unknown;
});

let testPool: import('workerpool').Pool | undefined;
let originalWorkerPool: typeof workerpool.pool

describe("run_experiment", () => {


    beforeEach( () => {
        const workerPath = path.resolve(__dirname, '../backend/api/worker.ts');
        if (!originalWorkerPool) {
            originalWorkerPool = (jest.requireActual('workerpool') as any).pool;
        }
        testPool = originalWorkerPool(workerPath);

        (workerpool.pool as jest.Mock).mockReturnValue(testPool as import('workerpool').Pool);

        const delay = 2000;
        jest.spyOn(testPool, 'exec').mockImplementation(
            (method, params) => {
                if (method === 'processExperiment') {
                    return new Promise(resolve => {
                        setTimeout(() => {
                            resolve({
                                success: true,
                                tries: params?.[6],
                                totalTokens: 0,
                            });
                        }, delay);
                    }) as unknown as workerpool.Promise<any>;
                }

                throw new Error(`Unexpected workerpool method: ${String(method)}`);
            }
        );
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