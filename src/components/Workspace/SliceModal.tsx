import { useState, useRef, useEffect } from "react";
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
  
  const [gridLinesX, setGridLinesX] = useState<number[]>([]);
  const [gridLinesY, setGridLinesY] = useState<number[]>([]);
  const [deselectedFrames, setDeselectedFrames] = useState<Set<string>>(new Set());

  const [skipEmpty, setSkipEmpty] = useState(true);
  const [autoCenter, setAutoCenter] = useState(true);
  const [removeWhiteBg, setRemoveWhiteBg] = useState(true);
  const [importRow, setImportRow] = useState(0);
  const [importCol, setImportCol] = useState(0);
  const [targetRowId, setTargetRowId] = useState<string | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);

  const defaultTarget = selectedRow?.id ?? (rows.length > 0 ? rows[0].id : "NEW");
  const effectiveTargetRowId = targetRowId ?? defaultTarget;

  useEffect(() => {
    const lines = [];
    for (let i = 1; i < cols; i++) lines.push(i / cols);
    setGridLinesX(lines);
  }, [cols]);

  useEffect(() => {
    const lines = [];
    for (let i = 1; i < sliceRows; i++) lines.push(i / sliceRows);
    setGridLinesY(lines);
  }, [sliceRows]);

  if (!spritesheetToSlice) return null;

  const startDrag = (e: React.PointerEvent, axis: 'x' | 'y', index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    
    const onMove = (moveEvent: PointerEvent) => {
       if (axis === 'x') {
         const fraction = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
         setGridLinesX(prev => {
            const next = [...prev];
            next[index] = fraction;
            return next;
         });
       } else {
         const fraction = Math.max(0, Math.min(1, (moveEvent.clientY - rect.top) / rect.height));
         setGridLinesY(prev => {
            const next = [...prev];
            next[index] = fraction;
            return next;
         });
       }
    };
    const onUp = () => {
       window.removeEventListener('pointermove', onMove);
       window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const toggleSelection = (r: number, c: number) => {
    const key = `${r}_${c}`;
    setDeselectedFrames(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSlice = () => {
    const framesToExtract = [];
    for (let r = 0; r < sliceRows; r++) {
      if (importRow > 0 && r !== importRow - 1) continue;
      
      for (let c = 0; c < cols; c++) {
        if (importCol > 0 && c !== importCol - 1) continue;
        if (deselectedFrames.has(`${r}_${c}`)) continue;
        
        const startX = c === 0 ? 0 : gridLinesX[c - 1];
        const endX = c === cols - 1 ? 1 : gridLinesX[c];
        const startY = r === 0 ? 0 : gridLinesY[r - 1];
        const endY = r === sliceRows - 1 ? 1 : gridLinesY[r];
        
        framesToExtract.push({
          r, c,
          startX: Math.min(startX, endX),
          endX: Math.max(startX, endX),
          startY: Math.min(startY, endY),
          endY: Math.max(startY, endY)
        });
      }
    }
    
    sliceAndImportSpritesheet(
      framesToExtract, 
      skipEmpty, 
      autoCenter, 
      removeWhiteBg, 
      effectiveTargetRowId
    );
  };

  const renderGrid = () => {
    const elements = [];
    // Render cells
    for (let r = 0; r < sliceRows; r++) {
      const startY = r === 0 ? 0 : gridLinesY[r - 1];
      const endY = r === sliceRows - 1 ? 1 : gridLinesY[r];
      
      for (let c = 0; c < cols; c++) {
        const startX = c === 0 ? 0 : gridLinesX[c - 1];
        const endX = c === cols - 1 ? 1 : gridLinesX[c];
        
        const isDeselected = deselectedFrames.has(`${r}_${c}`);
        const isIgnored = (importRow > 0 && r !== importRow - 1) || (importCol > 0 && c !== importCol - 1);
        
        const realStartX = Math.min(startX, endX);
        const realEndX = Math.max(startX, endX);
        const realStartY = Math.min(startY, endY);
        const realEndY = Math.max(startY, endY);

        elements.push(
          <div 
            key={`cell_${r}_${c}`}
            onClick={() => !isIgnored && toggleSelection(r, c)}
            style={{
              position: 'absolute',
              left: `${realStartX * 100}%`,
              top: `${realStartY * 100}%`,
              width: `${(realEndX - realStartX) * 100}%`,
              height: `${(realEndY - realStartY) * 100}%`,
              border: '1px solid rgba(56, 189, 248, 0.5)',
              backgroundColor: isIgnored ? 'rgba(0,0,0,0.5)' : (isDeselected ? 'rgba(239, 68, 68, 0.3)' : 'transparent'),
              cursor: isIgnored ? 'not-allowed' : 'pointer',
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isDeselected && !isIgnored && (
              <span style={{ color: 'red', fontSize: '32px', fontWeight: 'bold', textShadow: '0 0 4px black' }}>✕</span>
            )}
          </div>
        );
      }
    }
    
    // Render draggable X lines
    gridLinesX.forEach((x, i) => {
      elements.push(
        <div 
          key={`line_x_${i}`}
          onPointerDown={(e) => startDrag(e, 'x', i)}
          style={{
            position: 'absolute',
            left: `${x * 100}%`,
            top: 0,
            bottom: 0,
            width: '8px',
            marginLeft: '-4px',
            cursor: 'col-resize',
            backgroundColor: 'rgba(56, 189, 248, 0.5)',
            zIndex: 10
          }}
        />
      );
    });

    // Render draggable Y lines
    gridLinesY.forEach((y, i) => {
      elements.push(
        <div 
          key={`line_y_${i}`}
          onPointerDown={(e) => startDrag(e, 'y', i)}
          style={{
            position: 'absolute',
            top: `${y * 100}%`,
            left: 0,
            right: 0,
            height: '8px',
            marginTop: '-4px',
            cursor: 'row-resize',
            backgroundColor: 'rgba(56, 189, 248, 0.5)',
            zIndex: 10
          }}
        />
      );
    });
    
    return elements;
  };

  return (
    <div className="import-modal-overlay">
      <div className="import-modal-content slice-modal-content">
        <div className="import-modal-header">
          <h2>Slice Spritesheet</h2>
          <p>Define grid dimensions, adjust lines by dragging, and click cells to toggle selection.</p>
        </div>
        
        <div className="sliceBrowserGrid">
          <div className="slicePreviewPane">
            <div className="slicePreviewWrapper" ref={wrapperRef} style={{ position: 'relative' }}>
              <img src={spritesheetToSlice.url} alt="Spritesheet preview" style={{ display: 'block', width: '100%', height: 'auto', pointerEvents: 'none' }} />
              {renderGrid()}
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
              <label title="0 means import all rows. Set to a specific number (e.g. 1) to only import that row.">
                Specific Row (0=All)
                <input 
                  type="number" 
                  min={0}
                  max={sliceRows}
                  value={importRow} 
                  onChange={(e) => setImportRow(Math.max(0, Math.min(sliceRows, Number(e.target.value))))} 
                />
              </label>
              <label title="0 means import all columns. Set to a specific number (e.g. 1) to only import that column.">
                Specific Col (0=All)
                <input 
                  type="number" 
                  min={0}
                  max={cols}
                  value={importCol} 
                  onChange={(e) => setImportCol(Math.max(0, Math.min(cols, Number(e.target.value))))} 
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
              <label className="checkbox" title="Removes solid or near-white backgrounds during import.">
                <input 
                  type="checkbox" 
                  checked={removeWhiteBg} 
                  onChange={(e) => setRemoveWhiteBg(e.target.checked)} 
                /> 
                Remove white background (Clean)
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
              <p>Total Frames: <strong>{cols * sliceRows - deselectedFrames.size}</strong></p>
              <button type="button" onClick={cancelSpritesheetSlice}>Cancel</button>
              <button 
                type="button" 
                className="primaryButton" 
                onClick={handleSlice}
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
