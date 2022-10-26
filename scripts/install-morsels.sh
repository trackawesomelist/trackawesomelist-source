#!/bin/bash
set -e
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
BIN_DIR="$SCRIPT_DIR/../bin"
binname="morsels"
mkdir -p $BIN_DIR
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    cd -- /tmp
    curl -OL https://github.com/ang-zeyu/morsels/releases/download/v0.7.3/indexer.x86_64-unknown-linux-gnu.zip
    unzip indexer.x86_64-unknown-linux-gnu.zip -d $BIN_DIR
elif [[ "$OSTYPE" == "darwin"* ]]; then
    # Mac OSX
    cd -- /tmp/
    curl -OL https://github.com/ang-zeyu/morsels/releases/download/v0.7.3/indexer.x86_64-apple-darwin.zip
    unzip indexer.x86_64-apple-darwin.zip -d $BIN_DIR
fi

chmod +x $BIN_DIR/*

echo Install Success.
