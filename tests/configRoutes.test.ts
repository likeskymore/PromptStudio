import express from "express";
import { ConfigRoutes } from "../backend/api/modules/experiment_config/route";
import { closeTestServer, request, startTestServer } from "./routeTestHelpers";

jest.mock("../backend/api/modules/experiment_config/service", () => ({
  ExperimentConfigService: {
    save_config: jest.fn(),
  },
}));

describe("ConfigRoutes", () => {
  let server: import("node:http").Server;

  beforeAll(async () => {
    const app = express();
    app.use("/config", ConfigRoutes);
    server = await startTestServer(app);
  });

  afterAll(() => closeTestServer(server));

  it("rejects a request without uploaded files", async () => {
    const response = await request(server, "POST", "/config");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "No files uploaded" });
  });
});
