import { saveToText, loadFromText, exportAs, parseTextToBinary, exportTextFile } from "./fileUtils";
import { describe, it, expect } from "@jest/globals";
import { parseCommonJSFromString, structuredClone } from "./testUtils";

const face = `xxxxxxxx
xxxxxxxx
xoxxxxox
xxxxxxxx
xoxxxxox
xoooooox
xxxxxxxx
xxxxxxxx
xxxxxxxb`
  // Finagle into the format the app uses, array of arrays
  .split("\n")
  .map((r) => r.split(""));

const faceObj = {
  name: "Smiley Face",
  width: 8,
  height: 9,
  outputSize: 8,
  asciiOffset: "0",
  data: face,
  translations: { " ": "0", x: "1", o: "0x2", b: null },
};

const faceData = `Name: Smiley Face
Width: 8
Height: 9
Output Size: 8
ASCII Offset: 0

xxxxxxxx
xxxxxxxx
xoxxxxox
xxxxxxxx
xoxxxxox
xoooooox
xxxxxxxx
xxxxxxxx
xxxxxxxb

 : 0
x: 1
o: 0x2
b: null`;

const faceDataNoTranslationTable = `Name: Smiley Face
Width: 8
Height: 9
Output Size: 8
ASCII Offset: 0

xxxxxxxx
xxxxxxxx
xoxxxxox
xxxxxxxx
xoxxxxox
xoooooox
xxxxxxxx
xxxxxxxx
xxxxxxxb

`;

const translatedSmilieRawBin = [
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2,
  1, 1, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 98,
];
describe("saveToText", () => {
  it("does a basic export correctly", () => {
    expect(saveToText(faceObj)).toEqual(faceData);
  });

  it("Fails on empty", () => {
    expect(() => saveToText({})).toThrow(/Missing required parameters/);
  });
  it("Fails on missing width or height", () => {
    const obj = structuredClone(faceObj);
    delete obj.width;
    expect(() => saveToText(obj)).toThrow(/Missing required parameters/);
    const obj2 = structuredClone(faceObj);
    delete obj2.height;
    expect(() => saveToText(obj2)).toThrow(/Missing required parameters/);
  });
  it("Fails on missing outputSize", () => {
    const obj = structuredClone(faceObj);
    delete obj.outputSize;
    expect(() => saveToText(obj)).toThrow(/Missing required parameters/);
  });
  it("Fails on missing data", () => {
    const obj = structuredClone(faceObj);
    obj.data = "no";
    expect(() => saveToText(obj)).toThrow(/Data missing/);
  });
  it("Handles empty translation table", () => {
    const obj = structuredClone(faceObj);
    delete obj.translations;
    expect(saveToText(obj)).toEqual(faceDataNoTranslationTable);
  });
});

describe("loadFromText", () => {
  describe("Does a basic import correctly", () => {
    it("Loads text config correctly", () => {
      const obj = loadFromText(faceData);

      expect(obj.name).toEqual("Smiley Face");
    });
    it("Loads numeric config correctly", () => {
      const obj = loadFromText(faceData);
      expect(obj.width).toEqual(8);
      expect(obj.height).toEqual(9);
      expect(obj.outputSize).toEqual(8);
      expect(obj.asciiOffset).toEqual("0");
    });
    it("Loads translation table correctly", () => {
      const obj = loadFromText(faceData);
      expect(obj.translations).toEqual({ " ": "0", x: "1", o: "0x2", b: null });
    });
    it("Handles a lack of translation table correctly", () => {
      const obj = loadFromText(faceDataNoTranslationTable);
      expect(obj.translations).toEqual({});
    });
    it("Fails on invalid values", () => {
      expect(() => loadFromText(faceData.replace("Width: 8", "Width: dace"))).toThrow(/Failed parsing.*Width/i);
      expect(() => loadFromText(faceData.replace("Height: 9", "Height: tall"))).toThrow(/Failed parsing.*Height/i);
      expect(() => loadFromText(faceData.replace("Output Size: 8", "Output Size: orangutan"))).toThrow(
        /Failed parsing.*Output Size/i,
      );
      expect(() => loadFromText(faceData.replace("ASCII Offset: 0", "ASCII Offset: orangutan"))).toThrow(
        /Failed parsing.*ASCII Offset/i,
      );
    });
    it("Fails on missing required keys", () => {
      expect(() => loadFromText(faceData.replace("Width: 8", "Unused: 8"))).toThrow(/Width.*not provided/i);
      expect(() => loadFromText(faceData.replace("Height: 9", "Unused: 9"))).toThrow(/Height.*not provided/i);
      expect(() => loadFromText(faceData.replace("Output Size: 8", "Unused: 8"))).toThrow(/Output Size not provided/i);
      expect(() => loadFromText(faceData.replace("ASCII Offset: 0", "Unused: 8"))).toThrow(
        /ASCII Offset not provided/i,
      );
    });
    it("Fails with a useful message on invalid keys", () => {
      expect(() => loadFromText(faceData.replace("Width: 8", "Width 8"))).toThrow(/Parameters section is corrupted!/i);
      expect(() => loadFromText(faceData.replace("Height: 9", "Unused 9"))).toThrow(
        /Parameters section is corrupted!/i,
      );
      expect(() => loadFromText(faceData.replace("x: 1", "x 1"))).toThrow(/Translations section is corrupted!/i);
    });
  });
});

describe("exportAs", () => {
  it("handles invalid type", () => {
    expect(() => exportAs("blagoonga", faceObj)).toThrow(/Unknown export type/i);
  });
  it("Raw binary export", () => {
    expect(exportAs("bin", faceObj)).toEqual(new Uint8Array(translatedSmilieRawBin));
    const obj = structuredClone(faceObj);
    obj.outputSize = 16;
    expect(exportAs("bin", obj)).toEqual(new Uint16Array(translatedSmilieRawBin));
    obj.outputSize = 32;
    expect(exportAs("bin", obj)).toEqual(new Uint32Array(translatedSmilieRawBin));
    obj.outputSize = 64;
    expect(exportAs("bin", obj)).toEqual(new BigUint64Array(translatedSmilieRawBin.map((a) => BigInt(a))));
  });

  it("js export", () => {
    expect(parseCommonJSFromString(exportAs("js", faceObj))).toEqual({
      width: 8,
      height: 9,
      name: "Smiley Face",
      outputSize: 8,
      asciiOffset: 0,
      data: translatedSmilieRawBin,
    });

    // 64 bit is a bit special due to js limitations...
    const obj = structuredClone(faceObj);
    obj.outputSize = 64;
    const bigIntResult = parseCommonJSFromString(exportAs("js", obj));
    const expectedResult = {
      width: 8,
      height: 9,
      name: "Smiley Face",
      outputSize: 64,
      asciiOffset: 0,
      data: new BigUint64Array(translatedSmilieRawBin.map((a) => BigInt(a))),
    };
    // and jest limitations
    bigIntResult.data = bigIntResult.data.toString();
    expectedResult.data = expectedResult.data.toString();
    expect(bigIntResult).toEqual(expectedResult);
  });
  it("json export", () => {
    expect(JSON.parse(exportAs("json", faceObj))).toEqual({
      width: 8,
      height: 9,
      name: "Smiley Face",
      outputSize: 8,
      asciiOffset: 0,
      data: translatedSmilieRawBin,
    });
    const obj = structuredClone(faceObj);
    // 64 bit is a bit special due to js limitations...
    obj.outputSize = 64;
    expect(() => exportAs("json", obj)).toThrow(/64 bit json exports are not supported/i);
  });

  it("c export", () => {
    const expectedC = `#define SMILEY_FACE_WIDTH 8
#define SMILEY_FACE_HEIGHT 9
#define SMILEY_FACE_OUTPUT_SIZE 8
#define SMILEY_FACE_ASCII_OFFSET 0
const unsigned char smiley_face[] = {
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 2, 1, 1, 1, 1, 2, 1, 1, 2, 2, 2, 2, 2, 2, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 98
};`;
    expect(exportAs("c", faceObj)).toEqual(expectedC);
  });

  it("csv export", () => {
    expect(exportAs("csv", faceObj)).toEqual(translatedSmilieRawBin.join(","));
  });
  it("ascii export", () => {
    expect(exportAs("ascii", faceObj)).toEqual(`xxxxxxxx
xxxxxxxx
xoxxxxox
xxxxxxxx
xoxxxxox
xoooooox
xxxxxxxx
xxxxxxxx
xxxxxxxb`);
  });
});

describe("parseTextToBinary", () => {
  it("Parses an empty string as 0", () => expect(parseTextToBinary("", 8)).toEqual(0));
  it("Parses 0 as 0", () => expect(parseTextToBinary("0", 8)).toEqual(0));
  it("Parses 10 as 10", () => expect(parseTextToBinary("10", 8)).toEqual(10));
  it("parses -10 as -10", () => expect(parseTextToBinary("-10")).toEqual(-10));
  it("Parses hex $10 as 16", () => expect(parseTextToBinary("$10", 8)).toEqual(16));
  it("Parses hex -$10 as -16", () => expect(parseTextToBinary("-$10", 8)).toEqual(-16));
  it("Parses hex 0x10 as 16", () => expect(parseTextToBinary("0x10", 8)).toEqual(16));
  it("Parses hex -0x10 as -16", () => expect(parseTextToBinary("-0x10", 8)).toEqual(-16));
  it("Parses bin 0b1100 as 12", () => expect(parseTextToBinary("0b1100", 8)).toEqual(12));
  it("Parses bin -0b1100 as 12", () => expect(parseTextToBinary("-0b1100", 8)).toEqual(-12));
  it("Parses bin %1100 as 12", () => expect(parseTextToBinary("%1100", 8)).toEqual(12));
  it("Parses bin -%1100 as 12", () => expect(parseTextToBinary("-%1100", 8)).toEqual(-12));
  it("Parses BigInt 10 as BigInt", () => expect(parseTextToBinary("10", 64)).toEqual(BigInt(10)));
});

describe("exportTextFile", () => {
  it("handles invalid type", () => {
    expect(() => exportTextFile(faceData, "blagoonga")).toThrow(/Unknown export type/i);
  });
  it("Raw binary export", () => {
    expect(exportTextFile(faceData, "bin")).toEqual(new Uint8Array(translatedSmilieRawBin));
  });

  it("js export", () => {
    expect(parseCommonJSFromString(exportTextFile(faceData, "js"))).toEqual({
      width: 8,
      height: 9,
      name: "Smiley Face",
      outputSize: 8,
      asciiOffset: 0,
      data: translatedSmilieRawBin,
    });
  });

  it("json export", () => {
    expect(JSON.parse(exportTextFile(faceData, "json"))).toEqual({
      width: 8,
      height: 9,
      name: "Smiley Face",
      outputSize: 8,
      asciiOffset: 0,
      data: translatedSmilieRawBin,
    });
    const obj = structuredClone(faceObj);
    // 64 bit is a bit special due to js limitations...
    obj.outputSize = 64;
    expect(() => exportAs("json", obj)).toThrow(/64 bit json exports are not supported/i);
  });

  it("c export", () => {
    const expectedC = `#define SMILEY_FACE_WIDTH 8
#define SMILEY_FACE_HEIGHT 9
#define SMILEY_FACE_OUTPUT_SIZE 8
#define SMILEY_FACE_ASCII_OFFSET 0
const unsigned char smiley_face[] = {
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 2, 1, 1, 1, 1, 2, 1, 1, 2, 2, 2, 2, 2, 2, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 98
};`;
    expect(exportTextFile(faceData, "c")).toEqual(expectedC);
  });

  it("csv export", () => {
    expect(exportTextFile(faceData, "csv")).toEqual(translatedSmilieRawBin.join(","));
  });
  it("ascii export", () => {
    expect(exportTextFile(faceData, "ascii")).toEqual(`xxxxxxxx
xxxxxxxx
xoxxxxox
xxxxxxxx
xoxxxxox
xoooooox
xxxxxxxx
xxxxxxxx
xxxxxxxb`);
  });
});
