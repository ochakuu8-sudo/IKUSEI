import { mkdtempSync, readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
// Windowsでも同じモジュールを検証。npm依存のtscを使い、追加の変換器は不要。
const out = mkdtempSync(join(tmpdir(), 'ikusei-'));
function compile(dir, target) {
  mkdirSync(target, { recursive: true });
  for (const file of readdirSync(dir, { withFileTypes: true })) {
    if (file.isDirectory()) compile(join(dir, file.name), join(target, file.name));
    else if (file.name.endsWith('.ts') && !file.name.endsWith('.d.ts') && file.name !== 'art.ts') {
      const js = ts.transpileModule(readFileSync(join(dir, file.name), 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
      }).outputText.replace(/(from\s+['"])(\.[^'"]+)(['"])/g, '$1$2.mjs$3');
      writeFileSync(join(target, file.name.replace(/\.ts$/, '.mjs')), js);
    }
  }
}
try {
  compile('src', out);
  const entry = process.argv[2] === "ui" ? "tests/ui.test.mjs" : process.argv[2] === 'test' ? 'tests/engine.test.mjs' : 'scripts/sim.mjs';
  const source = readFileSync(entry, 'utf8').replace(/from ['"]@game\/([^'"]+)['"]/g, (_, path) => `from '${pathToFileURL(join(out, path + '.mjs')).href}'`);
  writeFileSync(join(out, 'run.mjs'), source);
  await import(pathToFileURL(resolve(out, 'run.mjs')).href);
} finally { rmSync(out, { recursive: true, force: true }); }
