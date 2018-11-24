import { resolve, dirname } from "path";
import { execSync } from "child_process";

import { copyFileSync, emptyDirSync } from "fs-extra";

const tsconfigPath = resolve(__dirname, "../tsconfig.json");
const { compilerOptions } = require(tsconfigPath);
const dest = resolve(dirname(tsconfigPath), compilerOptions.outDir);

emptyDirSync(dest);

const files = [
  "README.md",
  "package-lock.json",
  "package.json",
];

files.forEach(file => copyFileSync(file, `${dest}/${file}`));

execSync("tsc");
