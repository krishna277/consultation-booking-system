import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// 1. Define the client options parameters explicitly
export const clientConfig = {
  datasource: {
    url: env("DATABASE_URL"),
  },
};

// 2. Keep the default command-line export unchanged for the CLI
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "ts-node prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
