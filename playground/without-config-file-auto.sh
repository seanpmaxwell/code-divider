#!/usr/bin/env bash
set -euo pipefail;

## NOTE ##
# To run this you need be inside the playground directory.

# Build first
cd ../;
npm run build;
cd ./playground;

# Create a temp folder to preserve the originals
rm -rf without-config-file.tmp/;
cp -R without-config-file/. without-config-file.tmp/;

# Make the .tmp directory the current working directory
cd without-config-file.tmp/;
npx ../../;
