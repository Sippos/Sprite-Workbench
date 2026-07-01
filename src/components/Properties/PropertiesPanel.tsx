import { useProject, FRAME_SIZES } from "../../store/ProjectContext";

export function PropertiesPanel() {
  const {
    appMode, setAppMode,
    frameSize, handleFrameSizeChange, columns, setColumns,
    globalScale, setGlobalScale, feetX, setFeetX, feetY, setFeetY,
    collisionRadius, setCollisionRadius, collisionOffsetY, setCollisionOffsetY,
    removeWhiteThreshold, setRemoveWhiteThreshold,
    haloThreshold, setHaloThreshold,
    applyRemoveNearWhiteToSelected, applyRemoveNearWhiteToRow,
    applyHaloToSelected, applyHaloToRow,
    safeCleanupSelected, safeCleanupRow, strongCleanupSelected, strongCleanupRow,
    resetSelectedFrame, resetSelectedRowFrames,
    showGuides, setShowGuides, totalSheetWidth, totalSheetHeight
  } = useProject();

  return (
    <aside className="ide-sidebar ide-sidebar-right">
      <div className="sidebar-header">
        <h2>Properties</h2>
        <div className="modeSwitch" role="tablist">
          <button className={appMode === "spritesheet" ? "activeButton" : ""} onClick={() => setAppMode("spritesheet")}>Sheet</button>
          <button className={appMode === "single-png" ? "activeButton" : ""} onClick={() => setAppMode("single-png")}>Single</button>
        </div>
      </div>

      <div className="properties-content">
        <section className="prop-section">
          <h3>Canvas Setup</h3>
          <div className="grid2">
            <label>Size
              <select value={frameSize} onChange={(e) => handleFrameSizeChange(Number(e.target.value))}>
                {FRAME_SIZES.map(s => <option key={s} value={s}>{s}×{s}</option>)}
              </select>
            </label>
            <label>Columns
              <input type="number" min={1} max={20} value={columns} onChange={(e) => setColumns(Math.max(1, Number(e.target.value)))} />
            </label>
          </div>
          <p className="info">Output: {totalSheetWidth}×{totalSheetHeight}px</p>
        </section>

        <section className="prop-section">
          <h3>Sprite Rigging</h3>
          <label>Global Scale: {globalScale.toFixed(2)}
            <input type="range" min="0.5" max="3" step="0.1" value={globalScale} onChange={(e) => setGlobalScale(Number(e.target.value))} />
          </label>
          <div className="grid2">
            <label>Feet X <input type="number" value={feetX} onChange={(e) => setFeetX(Number(e.target.value))} /></label>
            <label>Feet Y <input type="number" value={feetY} onChange={(e) => setFeetY(Number(e.target.value))} /></label>
            <label>Hitbox Radius <input type="number" value={collisionRadius} onChange={(e) => setCollisionRadius(Number(e.target.value))} /></label>
            <label>Hitbox Offset <input type="number" value={collisionOffsetY} onChange={(e) => setCollisionOffsetY(Number(e.target.value))} /></label>
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={showGuides} onChange={(e) => setShowGuides(e.target.checked)} /> Show Guides
          </label>
        </section>

        <section className="prop-section">
          <h3>Cleanup Tools</h3>
          <div className="tool-group">
            <label>Near White Threshold: {removeWhiteThreshold}
              <input type="range" min="200" max="255" value={removeWhiteThreshold} onChange={(e) => setRemoveWhiteThreshold(Number(e.target.value))} />
            </label>
            <div className="grid2">
              <button onClick={applyRemoveNearWhiteToSelected}>Frame</button>
              <button onClick={applyRemoveNearWhiteToRow}>Row</button>
            </div>
          </div>

          <div className="tool-group">
            <label>Halo Cleanup: {haloThreshold}
              <input type="range" min="150" max="250" value={haloThreshold} onChange={(e) => setHaloThreshold(Number(e.target.value))} />
            </label>
            <div className="grid2">
              <button onClick={applyHaloToSelected}>Frame</button>
              <button onClick={applyHaloToRow}>Row</button>
            </div>
          </div>

          <div className="tool-group">
            <h4>Quick Macros</h4>
            <div className="grid2">
              <button onClick={safeCleanupSelected}>Safe Frame</button>
              <button onClick={safeCleanupRow}>Safe Row</button>
              <button onClick={strongCleanupSelected} className="danger-text">Strong Frame</button>
              <button onClick={strongCleanupRow} className="danger-text">Strong Row</button>
              <button onClick={resetSelectedFrame}>Reset Frame</button>
              <button onClick={resetSelectedRowFrames}>Reset Row</button>
            </div>
          </div>
        </section>


      </div>
    </aside>
  );
}
