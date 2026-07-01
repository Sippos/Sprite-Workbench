import { useState } from "react";
import { useProject } from "../../store/ProjectContext";

export function SliceModal() {
  const {
    spritesheetToSlice,
    cancelSpritesheetSlice,
    sliceAndImportSpritesheet,
    selectedRow,
    rows
  } = useProject();

  const [cols, setCols] = useState(1);
  const [sliceRows, setSliceRows] = useState(1);
  const [skipEmpty, setSkipEmpty] = useState(true);
  const [autoCenter, setAutoCenter] = useState(true);
  const [targetRowId, setTargetRowId] = useState<string | null>(null);

  const defaultTarget = selectedRow?.id ?? (rows.length > 0 ? rows[0].id : "NEW");
  const effectiveTargetRowId = targetRowId ?? defaultTarget;

  if (!spritesheetToSlice) return null;

  // Calculate the grid overlay styling
  const gridStyle = {
    display: "grid",
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gridTemplateRows: `repeat(${sliceRows}, 1fr)`,
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: "none" as const,
  };

  const gridCells = Array.from({ length: cols * sliceRows }, (_, i) => (
    <div key={i} style={{ border: "1px solid rgba(56, 189, 248, 0.5)", boxSizing: "border-box" }} />
  ));

  return (
    <div className="import-modal-overlay">
      <div className="import-modal-content slice-modal-content">
        <div className="import-modal-header">
          <h2>Slice Spritesheet</h2>
          <p>Define the grid dimensions to split this sheet into individual frames.</p>
        </div>
        
        <div className="sliceBrowserGrid">
          <div className="slicePreviewPane">
            <div className="slicePreviewWrapper">
              <img src={spritesheetToSlice.url} alt="Spritesheet preview" />
              <div style={gridStyle}>
                {gridCells}
              </div>
            </div>
          </div>

          <div className="sliceSettingsPane">
            <div className="prop-section">
              <h3>Grid Settings</h3>
              <label>
                Columns
                <input 
                  type="number" 
                  min={1} 
                  value={cols} 
                  onChange={(e) => setCols(Math.max(1, Number(e.target.value)))} 
                />
              </label>
              <label>
                Rows
                <input 
                  type="number" 
                  min={1} 
                  value={sliceRows} 
                  onChange={(e) => setSliceRows(Math.max(1, Number(e.target.value)))} 
                />
              </label>
              <label className="checkbox">
                <input 
                  type="checkbox" 
                  checked={skipEmpty} 
                  onChange={(e) => setSkipEmpty(e.target.checked)} 
                /> 
                Skip empty transparent frames
              </label>
              <label className="checkbox">
                <input 
                  type="checkbox" 
                  checked={autoCenter} 
                  onChange={(e) => setAutoCenter(e.target.checked)} 
                /> 
                Auto-center cropped content
              </label>
            </div>

            <div className="sliceActions">
              <label>
                Target
                <select value={effectiveTargetRowId} onChange={(e) => setTargetRowId(e.target.value)}>
                  {rows.map(row => (
                    <option key={row.id} value={row.id}>Row: {row.name}</option>
                  ))}
                  <option value="NEW">Create New Animation</option>
                </select>
              </label>
              <p>Total Frames: <strong>{cols * sliceRows}</strong></p>
              <button type="button" onClick={cancelSpritesheetSlice}>Cancel</button>
              <button 
                type="button" 
                className="primaryButton" 
                onClick={() => sliceAndImportSpritesheet(cols, sliceRows, skipEmpty, autoCenter, effectiveTargetRowId)}
              >
                Slice & Import
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
