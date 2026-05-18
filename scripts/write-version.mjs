import { writeFileSync } from "fs";
writeFileSync("dist/version.json", JSON.stringify({ build: Date.now() }));
console.log("dist/version.json written");
