import { useState } from "react";
import { TOOL_TYPES, BOX_STYLES } from "./constants.js";

export default function ToolSelector({ activeTool, setActiveTool, activeDrawCharacter, boxStyle, setBoxStyle }) {
  return (
    <div className="tool-selector">
      <div className={`tool ${activeTool === "draw" ? "active" : ""}`} onClick={() => setActiveTool("draw")}>
        <div className="name">Draw</div>
        <input id="activeDrawCharacter" type="text" value={activeDrawCharacter} disabled />
        <div className="settings">
          <fieldset role="group">
            <label htmlFor="activeDrawCharacter">Character (type to change)</label>
          </fieldset>
        </div>
      </div>
      <div className={`tool ${activeTool === "select" ? "active" : ""}`} onClick={() => setActiveTool("select")}>
        <div className="name">Select</div>
      </div>
      <div className={`tool ${activeTool === "box" ? "active" : ""}`} onClick={() => setActiveTool("box")}>
        <div className="name">Box</div>
        <div className="settings">
          <fieldset role="group">
            <label htmlFor="boxStyle">Box Style</label>
            <select
              id="boxStyle"
              aria-label="Choose a box style"
              onChange={(e) => setBoxStyle(e.target.value)}
              value={boxStyle}
            >
              {BOX_STYLES.map((o) => (
                <option key={o.name} value={o.name}>
                  {o.name}
                </option>
              ))}
            </select>
          </fieldset>
        </div>
      </div>
      <div className={`tool ${activeTool === "text" ? "active" : ""}`} onClick={() => setActiveTool("text")}>
        <div className="name">Type</div>
      </div>
    </div>
  );
}
