#!/usr/bin/env bash
# 段階Eの実測。game.ts を単体でトランスパイルしてから回す。
# 依頼・処方・素材・報酬を触ったら必ず走らせて QUOTAS を引き直すこと。
set -euo pipefail
cd "$(dirname "$0")/.."
out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT
npx esbuild src/game.ts --format=esm --outfile="$out/game.built.mjs" --log-level=error
cp scripts/sim.mjs "$out/sim.mjs"
node "$out/sim.mjs"
