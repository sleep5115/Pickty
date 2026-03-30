import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.join(__dirname, '..');
const repoRoot = path.join(frontendRoot, '..');
const destDir = path.join(frontendRoot, 'content', 'legal');

const files = ['TERMS_OF_SERVICE_KO.md', 'PRIVACY_POLICY_KO.md'];

fs.mkdirSync(destDir, { recursive: true });
for (const name of files) {
  const from = path.join(repoRoot, name);
  const to = path.join(destDir, name);
  if (!fs.existsSync(from)) {
    console.warn(`skip (missing): ${from}`);
    continue;
  }
  fs.copyFileSync(from, to);
  console.log(`synced ${name}`);
}
