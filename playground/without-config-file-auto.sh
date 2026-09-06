#!/usr/bin/env bash
set -euo pipefail;

## NOTE ##
# To run this you need be inside the playground directory.

# Build first
cd ../;
npm run build;
cd ./playground;

# Create a temp folder to preserve the originals
rm -rf tmp/without-config-file;
cp -R store/without-config-file/. tmp/without-config-file/;

# Make the .tmp directory the current working directory
cd tmp/without-config-file;
npx ../../;
