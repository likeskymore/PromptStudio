import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { Prisma, PrismaClient } from "../../generated/prisma/client";

const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  connectionLimit: 5,
  minimumIdle: 1,
  acquireTimeout: 50_000,
  initializationTimeout: 50_000,
  connectTimeout: 50_000,
});
export const prisma = new PrismaClient({ adapter });
  
export type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export const getClient = (connection?: DatabaseClient): DatabaseClient =>
  connection ?? prisma;


// import "dotenv/config";
// import { readFileSync } from "node:fs";
// import { fileURLToPath } from "node:url";
// import { PrismaMariaDb } from "@prisma/adapter-mariadb";
// import { Prisma, PrismaClient } from "../../generated/prisma/client";

// const credentials = JSON.parse(
//   readFileSync(
//     fileURLToPath(new URL("../../credentials.json", import.meta.url)),
//     "utf-8",
//   ),
// );

// const adapter = new PrismaMariaDb({
//   ...credentials.database,
//   connectionLimit: 5,
// });
// export const prisma = new PrismaClient({ adapter });
  
// export type DatabaseClient = PrismaClient | Prisma.TransactionClient;

// export const getClient = (connection?: DatabaseClient): DatabaseClient =>
//   connection ?? prisma;