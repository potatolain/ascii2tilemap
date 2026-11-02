# Shortcut to do the build so the params are consistent. 
# Called from CI
# Must be run from this directory!

npx @yao-pkg/pkg index.js --targets "latest-linux-x64,latest-linux-arm64,latest-win-x64,latest-macos-arm64,latest-macos-x64" --no-bytecode --public-packages "*" --out-path ./bin --public --sea