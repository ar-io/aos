#!/bin/bash
set -e

# Clone the ar-io-network-process repo and copy src directory
if [ "$1" = "--reset" ]; then
  echo "Refreshing directory..."
  rm -rf ./src
  echo "Cloning ar-io-network-process repo..."
  git clone -b mainnet-globals https://github.com/ar-io/ar-io-network-process.git tmp-ar-io
  mkdir -p ./src
  cp -r tmp-ar-io/src/* ./src/
  rm -rf tmp-ar-io

  # copy state files from mainnet-csv repo
  echo "Fetching finalized state from mainnet-csv repo..."
  # https://github.com/ar-io/ar-io-mainnet-csvs
  mkdir -p ./state
  git clone https://github.com/ar-io/ar-io-mainnet-csvs tmp-mainnet-csv
  cp -r tmp-mainnet-csv/state/* ./state/
  rm -rf tmp-mainnet-csv
  shift # remove --reset from arguments
fi

# Step 1: Build the project
echo "Running: ao build"
ao build

# Step 2: Run tests
echo "Running: npm run test test/info.test.js"
npm run test test/info.test.js

# if dry run, stop here
if [ "$1" = "--dry-run" ]; then
  exit 0
fi

# Step 3: Publish and capture output
echo "Running: ao publish ... (capturing module ID)"
publish_output=$(ao publish -w ./wallet.json ./process.wasm \
  -t Compute-Limit -v 9000000000000 \
  -t Memory-Limit -v 8589934592 \
  -t Name -v aos-test-2.0.4 \
  -t Module-Format -v wasm64-unknown-emscripten-draft_2024_02_15 \
  --bundler https://up.arweave.net)

# Optionally display the full publish output
echo "$publish_output"

# Step 4: Extract the 43-character alphanumeric module ID
# This pattern will match exactly 43 characters (letters, digits, underscore or hyphen if needed)
MODULE_ID=$(echo "$publish_output" | grep -oE "[A-Za-z0-9_-]{43}")
if [ -z "$MODULE_ID" ]; then
  echo "Error: Could not find a module ID in the publish output."
  exit 1
fi

echo "Extracted Module ID: $MODULE_ID"

# Step 5: Use the module ID in the final command
echo "Running: aos -w ./wallet.json --module=$MODULE_ID"
aos -w ./wallet.json --module=$MODULE_ID
