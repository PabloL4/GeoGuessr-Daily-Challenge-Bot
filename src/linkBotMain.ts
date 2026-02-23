// import { startLinkBot } from "./discord/linkBot.js";
// import dotenv from "dotenv";
// dotenv.config();

// startLinkBot().catch((e) => {
//   console.error(e);
//   process.exit(1);
// });

import dotenv from "dotenv";
dotenv.config();

import { startLinkBot } from "./discord/linkBot.js";

startLinkBot().catch((e) => {
  console.error(e);
  process.exit(1);
});
