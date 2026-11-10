import { useState, useEffect, useRef } from "react";

import ToolSelector from "./ToolSelector.js";
import ExtraCharacterTable from "./ExtaCharacterTable.js";
import InfoDialog from "./InfoDialog.js";
import useLocalStorageState from "./useLocalStorageState.js";
import { saveToText, loadFromText, exportAs, parseTextToBinary, knownExportTypes, exportNames } from "./fileUtils.js";
import {
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  CHAR_SIZE_W_BORDER_PX_X,
  CHAR_SIZE_W_BORDER_PX_Y,
  TOOL_TYPES,
  BOX_STYLES,
  UNDO_LIMIT,
} from "./constants.js";
import { downloadFile } from "./webUtils.js";
import ResizeDialog from "./ResizeDialog.js";
import pkgJson from "../package.json";

function buildDefaultData() {
  const data = [];
  for (let i = 0; i < DEFAULT_HEIGHT; i++) {
    data.push([]);
    for (let j = 0; j < DEFAULT_WIDTH; j++) {
      data[i].push(" ");
    }
  }
  return data;
}

function getCharacterPosition(event) {
  const editorRect = event.target.closest(".editor-wrap")?.getBoundingClientRect();
  if (!editorRect) {
    return { charX: null, charY: null, eventX: null, eventY: null };
  }
  const eventX = event.clientX - editorRect.left - 4,
    eventY = event.clientY - editorRect.top - 4,
    charX = Math.floor(eventX / CHAR_SIZE_W_BORDER_PX_X),
    charY = Math.floor(eventY / CHAR_SIZE_W_BORDER_PX_Y);

  return { eventX, eventY, charX, charY };
}

function drawBox(data, boxStyle, x1, y1, x2, y2) {
  const box = BOX_STYLES[boxStyle],
    minX = Math.min(x1, x2),
    maxX = Math.max(x1, x2),
    minY = Math.min(y1, y2),
    maxY = Math.max(y1, y2);

  return data.map((row, rowId) => {
    return row.map((col, colId) => {
      if (rowId === minY && colId === minX) {
        return box.tl;
      } else if (rowId == minY && colId === maxX) {
        return box.tr;
      } else if (rowId === maxY && colId === minX) {
        return box.bl;
      } else if (rowId === maxY && colId === maxX) {
        return box.br;
      } else if ((rowId === minY || rowId === maxY) && colId >= minX && colId <= maxX) {
        return box.horz;
      } else if ((colId === minX || colId === maxX) && rowId >= minY && rowId <= maxY) {
        return box.vert;
      }

      return col;
    });
  });
}

// Rebuild the array backing ascii
function rebuildArray(arr, width, height) {
  const newArray = [];
  arr.forEach((row, rowId) => {
    if (rowId < height) {
      newArray.push([]);
      row.forEach((col, colId) => {
        if (colId < width) {
          newArray[rowId].push(col);
        }
      });
      while (newArray[rowId].length < width) {
        newArray[rowId].push(" ");
      }
    }
  });
  while (newArray.length < height) {
    newArray.push([]);
    while (newArray[newArray.length - 1].length < width) {
      newArray[newArray.length - 1].push(" ");
    }
  }
  return newArray;
}

// Track where the mouse is for some animation affects that
// we don't want to tie to state updates.
function movePasteDiv(event) {
  const pasteDiv = document.getElementById("paste-div");
  if (!pasteDiv) {
    return;
  }
  pasteDiv.style.top = `${event.pageY}px`;
  pasteDiv.style.left = `${event.pageX}px`;
}

export default function Main() {
  const defaultData = buildDefaultData();
  const [name, setNameRaw] = useLocalStorageState("name");
  const [nameValid, setNameValid] = useState(true);
  const [width, setWidth] = useLocalStorageState("width", DEFAULT_WIDTH);
  const [height, setHeight] = useLocalStorageState("height", DEFAULT_HEIGHT);
  const [data, setDataInternal] = useLocalStorageState("drawingdata", defaultData);
  const [outputSize, setOutputSize] = useLocalStorageState("outputSize", 8);
  const [asciiOffset, setAsciiOffset] = useLocalStorageState("asciiOffset", "0");
  const [activeTool, setActiveToolData] = useLocalStorageState("activeTool", TOOL_TYPES[0]);
  const [activeTileX, setActiveTileX] = useState(null);
  const [activeTileY, setActiveTileY] = useState(null);
  const [activeToolStartXY, setActiveToolStartXY] = useState(null);
  const [activeToolEndXY, setActiveToolEndXY] = useState(null);
  const [activeDrawCharacter, setActiveDrawCharacter] = useState("x");
  const [mouseIsDown, setMouseIsDown] = useState(false);
  const [boxStyle, setBoxStyle] = useState("Default");
  const [asciiOffsetValid, setAsciiOffsetValid] = useState(true);
  const [translations, setTranslations] = useLocalStorageState("translations", {});
  const [translationsDebounce, setTranslationsDebounce] = useState(true);
  const [showResizeDialog, setShowResizeDialog] = useState(false);
  const [currentDialog, setCurrentDialog] = useState({});
  const [currentPaste, setCurrentPaste] = useState(null);
  const [undoHistory, setUndoHistory] = useState([{ data }]);
  const [undoPosition, setUndoPosition] = useState(0);

  const pasteDiv = useRef(null);

  const asciiOffsetParsed = parseTextToBinary(asciiOffset, outputSize) || 0;
  useEffect(() => {
    window.addEventListener("mouseup", onReleaseEditor);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("cut", onCut);
    window.addEventListener("copy", onCopy);
    window.addEventListener("paste", onPaste);
    window.addEventListener("mousemove", movePasteDiv);

    return () => {
      window.removeEventListener("mouseup", onReleaseEditor);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("cut", onCut);
      window.removeEventListener("copy", onCopy);
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("mousemove", movePasteDiv);
    };
  });

  function setName(name) {
    setNameRaw(name);
    setNameValid(/^([\w ])+$/.test(name));
  }

  function showDialog(title, content, onOk = () => {}, onCancel = () => {}) {
    setCurrentDialog({ title, content, onOk, onCancel, onClose: hideDialog });
  }

  function hideDialog() {
    setCurrentDialog({});
  }

  // Wrapper to store history, so we can restore it as needed.
  function setData(newData) {
    let newUndoHistory;
    if (undoPosition !== undoHistory.length - 1) {
      newUndoHistory = undoHistory.slice(0, undoPosition + 1);
    } else {
      newUndoHistory = [...undoHistory];
    }
    newUndoHistory.push({ data: newData });
    if (newUndoHistory.length > UNDO_LIMIT) {
      newUndoHistory.shift();
    }
    setUndoHistory(newUndoHistory);
    setUndoPosition(newUndoHistory.length - 1);
    setDataInternal(newData);
  }

  function undoData() {
    if (undoPosition > 0) {
      setUndoPosition(undoPosition - 1);
    } else {
      return;
    }
    setDataInternal(undoHistory[undoPosition - 1].data);
  }

  function redoData() {
    if (undoPosition < undoHistory.length - 1) {
      setUndoPosition(undoPosition + 1);
    } else {
      return;
    }
    setDataInternal(undoHistory[undoPosition + 1].data);
  }

  function clearData() {
    const content = (
        <p>
          Are you sure you want to clear your data? You can't undo this! Make sure to save your data first if you
          haven't.
        </p>
      ),
      onOk = () => {
        setWidth(DEFAULT_WIDTH);
        setHeight(DEFAULT_HEIGHT);
        setName("");
        setData(buildDefaultData());
        setActiveTool(TOOL_TYPES[0]);
        setOutputSize(8);
        setAsciiOffset("0");
        setTranslations({});
      };
    showDialog("Are you sure?", content, onOk);
  }

  function writeCharacter(x, y, character) {
    if (data[y][x] === character) {
      return;
    }
    const data2 = structuredClone(data);
    data2[y][x] = character;
    setData(data2);
    rebuildTranslations();
  }

  function doEditorAction(event) {
    if (!event.target) {
      return;
    }

    const { charX, charY } = getCharacterPosition(event);

    if (charX < 0 || charX >= width || charY < 0 || charY >= height) {
      // out of bounds
      return;
    }
    // Right click, just always grab the tile and exit.
    if (event.button === 2) {
      setActiveDrawCharacter(data[charY][charX]);
      event.preventDefault();
      return;
    }

    if (event.button === 0) {
      switch (activeTool) {
        case "draw":
          if (event.button === 0) {
            writeCharacter(charX, charY, activeDrawCharacter);
          }
          break;
        case "text":
        case "box":
        case "select":
          setActiveTileX(charX);
          setActiveTileY(charY);
          break;
      }
    }
  }

  function onClickEditor(event) {
    if (event.button !== 0) {
      return;
    }
    if (activeTool === "select" && currentPaste) {
      event.preventDefault();
      const { charX, charY } = getCharacterPosition(event);
      replaceWithPaste(charX, charY, currentPaste);
    }
  }

  function onMouseDownEditor(event) {
    if (event.button === 0) {
      setMouseIsDown(true);
    }
    if (activeTool === "box" || activeTool === "select") {
      const { charX, charY } = getCharacterPosition(event);
      setActiveToolStartXY([charX, charY]);
      setActiveToolEndXY(null);
      setActiveTileX(charX);
      setActiveTileY(charY);
      return;
    }
    doEditorAction(event);
  }

  function convertToPasteable(str) {
    if (!str || typeof str !== "string" || str.length < 1) {
      return null;
    }
    const lines = str.split(/[\r\n]+/),
      maxLen = Math.max(...lines.map((l) => l.length));
    for (let i = 0; i < lines.length; i++) {
      while (lines[i].length < maxLen) {
        lines[i] += " ";
      }
      lines[i] = lines[i].split("");
    }
    return lines;
  }

  function replaceWithPaste(x, y, txt) {
    const newData = structuredClone(data);
    for (let newY = 0; newY < txt.length; newY++) {
      for (let newX = 0; newX < txt[0].length; newX++) {
        if (newY + y < newData.length && newX + x < newData[0].length) {
          newData[newY + y][newX + x] = txt[newY][newX];
        }
      }
    }
    setData(newData);
  }

  function onCut(event) {
    event.ascii2retroIsCut = true;
    return onCopy(event);
  }

  function onCopy(event) {
    // Ignore the event if the user is typing in a text input or textarea
    const targetTag = event.target.tagName;
    if (targetTag === "INPUT" || targetTag === "TEXTAREA" || event.target.isContentEditable) {
      return;
    }
    event.preventDefault();
    const modData = structuredClone(data);
    if (activeTool === "select") {
      if (activeToolStartXY && activeToolEndXY) {
        const lines = [],
          minX = Math.min(activeToolStartXY[0], activeToolEndXY[0]),
          maxX = Math.max(activeToolStartXY[0], activeToolEndXY[0]),
          minY = Math.min(activeToolStartXY[1], activeToolEndXY[1]),
          maxY = Math.max(activeToolStartXY[1], activeToolEndXY[1]);

        data.forEach((row, rowId) => {
          if (rowId >= minY && rowId <= maxY) {
            lines.push([]);
            row.forEach((col, colId) => {
              if (colId >= minX && colId <= maxX) {
                lines[lines.length - 1].push(col);
                modData[rowId][colId] = " ";
              }
            });
          }
        });

        setCurrentPaste(lines);
        setActiveToolStartXY(null);
        setActiveToolEndXY(null);

        if (event.ascii2retroIsCut) {
          setData(modData);
        }

        // Put it on the real clipboard too, in case you want to use it outside the app
        let cbString = lines.map((l) => l.join("")).join("\n");
        event.clipboardData.setData("text/plain", cbString);
      }
    }
  }

  function onPaste(event) {
    // Ignore the event if the user is typing in a text input or textarea
    const targetTag = event.target.tagName;
    if (targetTag === "INPUT" || targetTag === "TEXTAREA" || event.target.isContentEditable) {
      return;
    }
    event.preventDefault();
    const txt = convertToPasteable((event.clipboardData || window.clipboardData).getData("text"));
    if (!txt) {
      return;
    }
    if (activeTool === "text") {
      replaceWithPaste(activeTileX, activeTileY, txt);
      return;
    } else if (activeTool === "select") {
      setCurrentPaste(txt);
      setActiveToolStartXY(null);
      setActiveToolEndXY(null);
    }
  }

  function onReleaseEditor(event) {
    setMouseIsDown(false);
    if (activeToolStartXY) {
      if (activeTool === "box") {
        setData(
          drawBox(
            data,
            BOX_STYLES.findIndex((b) => b.name === boxStyle),
            activeTileX,
            activeTileY,
            activeToolStartXY[0],
            activeToolStartXY[1],
          ),
        );
        setActiveToolStartXY(null);
      } else if (activeTool === "select") {
        const { charX, charY } = getCharacterPosition(event);

        if (typeof charX !== "undefined") {
          setActiveToolEndXY([charX, charY]);
        }
      }
    }
  }

  function onKeyDown(event) {
    // Ignore the event if the user is typing in a text input or textarea
    const targetTag = event.target.tagName;
    if (targetTag === "INPUT" || targetTag === "TEXTAREA" || event.target.isContentEditable) {
      return;
    }

    // Global shortcuts
    if (event.metaKey || event.ctrlKey) {
      switch (event.key) {
        case "Z":
          redoData();
          event.preventDefault();
          break;
        case "z":
          undoData();
          event.preventDefault();
          break;
        case "y":
          redoData();
          event.preventDefault();
          break;
      }
    }

    switch (activeTool) {
      case "draw":
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
          setActiveDrawCharacter(event.key);
          event.preventDefault();
        }
        break;
      case "text":
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
          writeCharacter(activeTileX, activeTileY, event.key);
          event.preventDefault();
          if (activeTileX + 1 < width) {
            setActiveTileX(activeTileX + 1);
          } else if (activeTileY < height) {
            setActiveTileX(0);
            setActiveTileY(activeTileY + 1);
          }
        } else {
          switch (event.key) {
            case "Backspace":
              if (activeTileX > 0) {
                writeCharacter(activeTileX - 1, activeTileY, " ");
                setActiveTileX(activeTileX - 1);
              } else if (activeTileY > 0) {
                writeCharacter(width - 1, activeTileY - 1, " ");
                setActiveTileX(width - 1);
                setActiveTileY(activeTileY - 1);
              }
              break;
            case "ArrowLeft":
              if (activeTileX > 0) {
                setActiveTileX(activeTileX - 1);
              }
              break;
            case "ArrowRight":
              if (activeTileX < width) {
                setActiveTileX(activeTileX + 1);
              }
              break;
            case "ArrowUp":
              if (activeTileY > 0) {
                setActiveTileY(activeTileY - 1);
              }
              break;
            case "ArrowDown":
              if (activeTileY < height) {
                setActiveTileY(activeTileY + 1);
              }
              break;
            default:
              // unhandled. SKIP the preventDefault by returning
              return;
          }
          event.preventDefault();
        }
      case "select":
        if (event.key === "Escape") {
          setCurrentPaste(null);
        }
        break;
    }
  }

  function onClickSave() {
    if (!nameValid) {
      showDialog(
        "Invalid name",
        <p>Names can only contain letters, numbers and spaces. Please remove other characters.</p>,
      );
      return;
    }
    const txtData = saveToText({ name, width, height, data, outputSize, asciiOffset, translations });
    downloadFile(`${name}.txt`, "text/plain", txtData);
  }

  async function onClickLoad(event) {
    const file = event.target.files[0];
    if (!file) return; // No file, nothing to do!

    try {
      // Read the file directly as text
      const textData = await file.text();

      const newData = loadFromText(textData);
      setName(newData.name);
      setWidth(newData.width);
      setHeight(newData.height);
      setData(newData.data);
      setOutputSize(newData.outputSize);
      setAsciiOffset(newData.asciiOffset);
      setTranslations(newData.translations);
    } catch (error) {
      showDialog(
        "Error Reading File",
        <>
          <p>Encountered an error reading the file:</p>
          <p>{error.toString()}</p>
        </>,
      );
    }
  }

  function setTranslation(key, value) {
    const newTranslations = structuredClone(translations);
    newTranslations[key] = value;
    setTranslations(newTranslations);
  }

  function rebuildTranslations() {
    clearTimeout(translationsDebounce);
    setTranslationsDebounce(setTimeout(rebuildTranslationsInternal, 250));
  }

  function setActiveTool(value) {
    setActiveToolData(value);
    setActiveToolStartXY(null);
    setActiveToolEndXY(null);
    setCurrentPaste(null);
  }

  function rebuildTranslationsInternal() {
    const usedChars = {},
      newTranslations = structuredClone(translations);
    data.forEach((row) => {
      row.forEach((chr) => {
        usedChars[chr] = 1;
      });
    });
    let hasUpdated = false;
    Object.keys(usedChars).forEach((char) => {
      if (!(char in newTranslations)) {
        hasUpdated = true;
        newTranslations[char] = null;
      }
    });
    if (hasUpdated) {
      setTranslations(newTranslations);
    }
  }

  function onClickExport(expType) {
    if (!nameValid) {
      showDialog(
        "Invalid name",
        <p>Names can only contain letters, numbers and spaces. Please remove other characters.</p>,
      );
    }
    // Validate all translations
    let invalidTranslationFound = false;
    Object.keys(translations).forEach((transKey) => {
      if (
        !invalidTranslationFound &&
        translations[transKey] !== null &&
        parseTextToBinary(translations[transKey], outputSize) === null
      ) {
        invalidTranslationFound = true;
        showDialog(
          "Invalid translation found",
          <>
            <p>
              The translation for character "{transKey}" is invalid. It must be something that can be parsed as a
              number, including hex starting with $ or 0x, and binary starting with 0b or %.
            </p>
            <p> Provided: "{translations[transKey]}"</p>
          </>,
        );
      }
    });
    if (invalidTranslationFound) {
      return;
    }
    const exportRes = exportAs(expType, { name, width, height, outputSize, data, translations, asciiOffset });
    let contentType = "text/plain",
      extension = expType;
    switch (expType) {
      case "raw":
        contentType = "application/octet-stream";
        break;
      case "ascii":
        extension = "txt";
        break;
    }
    downloadFile(`${name}.${extension}`, contentType, exportRes);
  }

  function validateAsciiOffset(event) {
    setAsciiOffsetValid(!isNaN(parseTextToBinary(event.target.value, outputSize)));
    setAsciiOffset(event.target.value);
  }

  function doResize(width, height) {
    setWidth(width);
    setHeight(height);
    setData(rebuildArray(data, width, height));
    setShowResizeDialog(false);
  }

  return (
    <>
      <InfoDialog {...currentDialog} />
      {showResizeDialog ? (
        <ResizeDialog width={width} height={height} onOk={doResize} onClose={() => setShowResizeDialog(false)} />
      ) : (
        <></>
      )}
      <div className="container">
        <h1>ascii2tilemap</h1>
        <div className="project-description">
          A little tool to help you create tilemaps for your retro and retro-styled games in the simplest way possible!
          Draw something with text, then export to binary/code. Or, use the generated text to convert it yourself using
          the{" "}
          <a href="http://gh.nes.science/ascii2tilemap/releases" target="_blank">
            tools on Github
          </a>
          !
        </div>
        <fieldset role="group">
          <label htmlFor="pname">Project name </label>
          <input
            id="pname"
            type="text"
            placeholder="Name"
            onChange={(e) => setName(e.target.value)}
            value={name}
            aria-invalid={!nameValid}
          />
        </fieldset>
        <div className="button-bar">
          <input id="import-file" type="file" className="" accept=".txt" onChange={onClickLoad} />
          <label htmlFor="import-file" role="button" className="secondary">
            Load
          </label>
          <button className="secondary" onClick={onClickSave}>
            Save
          </button>
          <details className="dropdown">
            <summary className="secondary" role="button">
              Export
            </summary>
            <ul>
              {exportNames.map((exp, expId) => (
                <li key={exp} onClick={() => onClickExport(knownExportTypes[expId])}>
                  {exp}
                </li>
              ))}
            </ul>
          </details>

          <button className="secondary" onClick={() => setShowResizeDialog(true)}>
            Resize
          </button>
          <button className="outline secondary" onClick={clearData}>
            Clear Data
          </button>
        </div>
      </div>
      <div className="container-fluid editor-container">
        <article className="tools card">
          <h3>Tools</h3>
          <ToolSelector
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            activeDrawCharacter={activeDrawCharacter}
            setActiveDrawCharacter={setActiveDrawCharacter}
            boxStyle={boxStyle}
            setBoxStyle={setBoxStyle}
          />
          <ExtraCharacterTable setActiveDrawCharacter={setActiveDrawCharacter} visible={activeTool === "draw"} />
        </article>
        <article className="editor">
          <div
            className="editor-wrap"
            onClick={onClickEditor}
            onMouseDown={onMouseDownEditor}
            onContextMenu={(e) => e.preventDefault()}
            onMouseMove={(e) => (mouseIsDown ? doEditorAction(e) : null)}
          >
            {/* TODO: This isn't exactly efficient... */}
            {data.map((row, rowId) => (
              <div key={rowId} className="row">
                {row.map((chr, chrId) => {
                  let isActive = false;
                  if (activeTool === "text") {
                    isActive = rowId === activeTileY && chrId === activeTileX;
                  } else if (activeTool === "box" && activeToolStartXY) {
                    const minX = Math.min(activeToolStartXY[0], activeTileX),
                      maxX = Math.max(activeToolStartXY[0], activeTileX),
                      minY = Math.min(activeToolStartXY[1], activeTileY),
                      maxY = Math.max(activeToolStartXY[1], activeTileY);

                    isActive =
                      ((rowId === minY || rowId === maxY) && chrId >= minX && chrId <= maxX) ||
                      ((chrId === minX || chrId === maxX) && rowId >= minY && rowId <= maxY);
                  } else if (activeTool === "select" && activeToolStartXY) {
                    // still selecting
                    const minX = Math.min(
                        activeToolStartXY[0],
                        activeTileX,
                        activeToolEndXY?.[0] ?? Number.MAX_SAFE_INTEGER,
                      ),
                      maxX = Math.max(activeToolStartXY[0], activeTileX, activeToolEndXY?.[0] ?? 0),
                      minY = Math.min(
                        activeToolStartXY[1],
                        activeTileY,
                        activeToolEndXY?.[1] ?? Number.MAX_SAFE_INTEGER,
                      ),
                      maxY = Math.max(activeToolStartXY[1], activeTileY, activeToolEndXY?.[1] ?? 0);

                    isActive = chrId >= minX && chrId <= maxX && rowId >= minY && rowId <= maxY;
                  }
                  return (
                    <div key={chrId} className={`character ${isActive ? "active" : ""}`}>
                      {chr}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </article>
      </div>
      <div className="container">
        <article className="translations">
          <h3>Translations</h3>
          <fieldset>
            <legend data-tooltip="This is the size in bytes of each output value in the exports. Mostly used for binary formats.">
              Binary File Output Size
            </legend>
            <input
              type="radio"
              id="output-size-8"
              name="output-size"
              onChange={() => setOutputSize(8)}
              value={8}
              checked={outputSize === 8}
            />
            <label htmlFor="output-size-8">8 Bit (byte)</label>
            <input
              type="radio"
              id="output-size-16"
              name="output-size"
              onChange={() => setOutputSize(16)}
              value={16}
              checked={outputSize === 16}
            />
            <label htmlFor="output-size-16">16 Bit</label>
            <input
              type="radio"
              id="output-size-32"
              name="output-size"
              onChange={() => setOutputSize(32)}
              value={32}
              checked={outputSize === 32}
            />
            <label htmlFor="output-size-32">32 Bit</label>
            <input
              type="radio"
              id="output-size-64"
              name="output-size"
              onChange={() => setOutputSize(64)}
              value={64}
              checked={outputSize === 64}
            />
            <label htmlFor="output-size-64">64 Bit</label>
          </fieldset>
          <fieldset>
            <label data-tooltip="A set number of bytes to add/remove from the ascii table. Use a prefix of 0x to signify hexidecimal. A negative will subtract instead of add.">
              ASCII table offset{" "}
              <input
                type="text"
                value={asciiOffset}
                onChange={validateAsciiOffset}
                aria-invalid={!asciiOffsetValid ? "true" : "false"}
              />
            </label>
          </fieldset>
          {/* TODO: Allow removing unused translations? */}
          <div className="translation-table">
            {Object.keys(translations)
              .sort()
              .map((character) => {
                return (
                  <fieldset key={character}>
                    <label htmlFor={`translation-char-${character}`}>
                      {character === " " ? <em style={{ color: "gray" }}>Space</em> : character}
                    </label>
                    <input
                      id={`translation-char-${character}`}
                      value={translations[character] ?? ""}
                      placeholder={`Default (${character.charCodeAt(0) + asciiOffsetParsed})`}
                      onChange={(event) => setTranslation(character, event.target.value)}
                    />
                  </fieldset>
                );
              })}
          </div>
        </article>
      </div>
      <article className="footer container">
        Created in 2026 by Sarah Parker <br />
        <a href="https://igwgames.com">Homepage</a> &bull;{" "}
        <a href="https://gh.nes.science/ascii2tilemap">Source code</a>
        <small className="version">Version {pkgJson.version}</small>
      </article>
      <div className="paste-div" id="paste-div" ref={pasteDiv}>
        <div className="paste-wrap">
          {currentPaste?.map((row, rowId) => {
            return (
              <div className="row">
                {row.map((col, colId) => {
                  return <div className="character">{col}</div>;
                })}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
