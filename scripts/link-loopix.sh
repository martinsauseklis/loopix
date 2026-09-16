#!/usr/bin/env bash
# Copy the built loopix packages into node_modules as REAL directories.
# Not symlinks: a symlink widens Next's turbopack root, which breaks @swc/helpers
# resolution (loopix README). Re-run after rebuilding loopix.
set -euo pipefail
SRC="${1:-../loopix}"
for pkg in core nextjs agent; do
  dest="node_modules/@loopix/$pkg"
  rm -rf "$dest"; mkdir -p "$dest"
  cp -r "$SRC/packages/$pkg/dist" "$dest/dist"
  cp "$SRC/packages/$pkg/package.json" "$dest/package.json"
done
# the CLI: `pnpm loopix …`
mkdir -p node_modules/.bin
ln -sf ../@loopix/agent/dist/cli.js node_modules/.bin/loopix
chmod +x node_modules/@loopix/agent/dist/cli.js
echo "linked loopix from $SRC"
