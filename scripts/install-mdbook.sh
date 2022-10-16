#!/bin/sh

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd );
BIN_DIR="$SCRIPT_DIR/../bin"
binname="mdbook-epub"
mkdir -p $BIN_DIR
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  cd -- /tmp
  # curl -OL https://github.com/theowenyoung/$binname/releases/latest/download/$binname-x86_64-unknown-linux-gnu.tar.gz
  # tar -xf /tmp/$binname-x86_64-unknown-linux-gnu.tar.gz -C $BIN_DIR
  curl -OL https://github.com/rust-lang/mdBook/releases/download/v0.4.21/mdbook-v0.4.21-x86_64-unknown-linux-gnu.tar.gz
  tar -xf /tmp/mdbook-v0.4.21-x86_64-unknown-linux-gnu.tar.gz -C $BIN_DIR
  # curl -OL https://github.com/HollowMan6/mdbook-pdf/releases/download/v0.1.3/mdbook-pdf-v0.1.3-x86_64-unknown-linux-gnu.zip
  # unzip /tmp/mdbook-pdf-v0.1.3-x86_64-unknown-linux-gnu.zip -d $BIN_DIR
elif [[ "$OSTYPE" == "darwin"* ]]; then
# Mac OSX
  cd -- /tmp/
  # curl -OL https://github.com/theowenyoung/$binname/releases/latest/download/$binname-x86_64-apple-darwin.zip
  # unzip -o /tmp/$binname-x86_64-apple-darwin.zip -d $BIN_DIR
  curl -OL https://github.com/rust-lang/mdBook/releases/download/v0.4.21/mdbook-v0.4.21-x86_64-apple-darwin.tar.gz
  tar -xf /tmp/mdbook-v0.4.21-x86_64-apple-darwin.tar.gz -C $BIN_DIR
  # curl -OL https://github.com/HollowMan6/mdbook-pdf/releases/download/v0.1.3/mdbook-pdf-v0.1.3-x86_64-apple-darwin.zip
  # unzip -o /tmp/mdbook-pdf-v0.1.3-x86_64-apple-darwin.zip -d $BIN_DIR
fi;

chmod +x $BIN_DIR/*

echo Install Success.

echo Run \`make buildbook\` to build to book-dist folder
