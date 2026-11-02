// Quick command line tool for handling exports using the project's code.
// Compiled to binary using @yao-pkg/pkg (modern fork)

import { knownExportTypes, loadFromText, exportAs } from "../src/fileUtils.js";

import fs from "fs";

function out() {
  console.info("[ascii2retro] [info]", ...arguments);
}
function error() {
  console.info("[ascii2retro] [error]", ...arguments);
}

function printUsage() {
  out("Usage: ascii2retro [output type] [path/to/input-file.txt] [path/to/save/to]");
  out("Example: ./ascii2retro json myfile.txt myfile.json");
  out("Available export types: " + knownExportTypes.join(", "));
}

if (process.argv.length !== 5) {
  error("Incorrect number of arguments!");
  printUsage();
  process.exit(1);
}

const extension = process.argv[2].toLowerCase(),
  inputFile = process.argv[3],
  outputFile = process.argv[4];

if (knownExportTypes.indexOf(extension) === -1) {
  error("Unknown export type:", extension);
  printUsage();
  process.exit(1);
}

let inputContents;
try {
  inputContents = fs.readFileSync(inputFile).toString();
  if (inputContents.length === 0) throw new Error("Empty file");
} catch (e) {
  error("Failed to read input file: ", inputFile);
  error("Exception", e.toString());
  printUsage();
  process.exit(1);
}

let inputParsed;

try {
  inputParsed = loadFromText(inputContents);
} catch (e) {
  error("Importing failed! Error follows");
  error(e.toString());
  process.exit(1);
}

let outputContent;
try {
  outputContent = exportAs(extension, inputParsed);
} catch (e) {
  error("Unable to build output contents! Error follows");
  error(e.toString());
  process.exit(1);
}

try {
  fs.writeFileSync(outputFile, outputContent);
} catch (e) {
  error("Writing output file failed! Error follows");
  error(e.toString());
  process.exit(1);
}

out("Export successfully written to", outputFile + "!");
