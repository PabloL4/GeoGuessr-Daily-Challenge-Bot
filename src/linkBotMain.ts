import { startLinkBot } from "./discord/linkBot.js";
import dotenv from "dotenv";
dotenv.config();

startLinkBot().catch((e) => {
  console.error(e);
  process.exit(1);
});
