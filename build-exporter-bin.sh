# Shortcut to do the build so the params are consistent. 
# Called from CI
# Must be run from this directory!
set -e

npx @yao-pkg/pkg exporter/ascii2retro.cjs --targets node24-linux-x64,node24-linux-arm64,node24-win-x64,node24-macos-arm64,node24-macos-x64 --no-bytecode --public-packages "*" --out-path ./exporter/bin --public