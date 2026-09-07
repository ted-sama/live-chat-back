import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

dotenv.config({ path: path.join(projectRoot, `.env.${process.env.NODE_ENV || "local"}`) });
