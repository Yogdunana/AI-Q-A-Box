import { loadConfig } from "./config.ts";
import { openDatabase } from "./db.ts";
import { migrate } from "./migrate.ts";

const config = loadConfig(process.env);
const db = openDatabase(config.databasePath);
const applied = migrate(db);
db.close();
console.log(applied.length > 0 ? `applied ${applied.join(", ")}` : "migrations already applied");
