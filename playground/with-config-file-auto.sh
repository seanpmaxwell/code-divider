#!/usr/bin/env bash
set -euo pipefail;

# Create a temp folder to preserve the originals
rm -rf tmp/with-config-file;
cp -R store/with-config-file/. /tmp/with-config-file/;

cd tmp/with-config-file;
npx ../../;
