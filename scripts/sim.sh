#!/usr/bin/env bash
# Compatibility entry point. npm run sim uses this same Node runner directly.
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/run.mjs sim
