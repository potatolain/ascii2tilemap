# Shortcut to do the build so the params are consistent. 
# Called from CI
# Must be run from this directory!

npx @yao-pkg/pkg index.js --targets latest-linux-x64 --no-bytecode --public-packages "*" --out-path ./bin --public --sea
npx @yao-pkg/pkg index.js --targets latest-linux-arm64 --no-bytecode --public-packages "*" --out-path ./bin --public --sea
npx @yao-pkg/pkg index.js --targets latest-win-x64 --no-bytecode --public-packages "*" --out-path ./bin --public --sea
npx @yao-pkg/pkg index.js --targets latest-macos-arm64 --no-bytecode --public-packages "*" --out-path ./bin --public --sea
npx @yao-pkg/pkg index.js --targets latest-macos-x64 --no-bytecode --public-packages "*" --out-path ./bin --public --sea
