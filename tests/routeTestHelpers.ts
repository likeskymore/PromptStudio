import http from "node:http";

export function startTestServer(
  handler: http.RequestListener,
): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, () => resolve(server));
  });
}

export function request(
  server: http.Server,
  method: string,
  path: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Test server is not listening");
  }

  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port: address.port, method, path },
      (res) => {
        let response = "";
        res.on("data", (chunk) => {
          response += chunk;
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            body: JSON.parse(response) as Record<string, unknown>,
          });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

export function closeTestServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
