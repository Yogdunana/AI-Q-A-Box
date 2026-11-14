import { createAiProvider } from "./ai/index.ts";
import { buildApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { openDatabase } from "./db.ts";
import { migrate } from "./migrate.ts";

const config = loadConfig(process.env);
const db = openDatabase(config.databasePath);
migrate(db);
db.prepare("DELETE FROM rate_hits WHERE at_ms < ?").run(Date.now() - 24 * 60 * 60 * 1000);
db.prepare("DELETE FROM submission_guards WHERE created_at < ?").run(
  new Date(Date.now() - config.guardRetentionMs).toISOString(),
);

const app = buildApp({ db, config, ai: createAiProvider(config) });

await app.listen({ host: config.host, port: config.port });
app.log.info(
  { host: config.host, port: config.port, ai: config.aiProvider, publicReplies: config.publicRepliesEnabled },
  "api listening",
);

async function shutdown(): Promise<void> {
  await app.close();
  db.close();
}

process.on("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});
process.on("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});
