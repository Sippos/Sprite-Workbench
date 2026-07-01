
import { useProject } from "../../store/ProjectContext";
import { FRAME_SIZES, SINGLE_PNG_PRESETS } from "../../store/ProjectContext";
import type { SinglePngAnchor, SinglePngFitMode } from "../../app/project/ProjectTypes";

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
    singlePng, updateSinglePng, applySinglePngPreset,
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

        {appMode === "single-png" && (
          <section className="prop-section">
            <h3>Single PNG Export</h3>
            <label>Preset
              <select value={singlePng.preset} onChange={(e) => applySinglePngPreset(e.target.value)}>
                {SINGLE_PNG_PRESETS.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
                <option value="Custom">Custom</option>
              </select>
            </label>
            <div className="grid2">
              <label>Width <input type="number" min={1} value={singlePng.width} onChange={(e) => updateSinglePng({ width: Number(e.target.value), preset: "Custom" })} /></label>
              <label>Height <input type="number" min={1} value={singlePng.height} onChange={(e) => updateSinglePng({ height: Number(e.target.value), preset: "Custom" })} /></label>
              <label>Fit Mode
                <select value={singlePng.fitMode} onChange={(e) => updateSinglePng({ fitMode: e.target.value as SinglePngFitMode })}>
                  <option value="contain">Contain</option>
                  <option value="cover">Cover</option>
                  <option value="original-size">Original</option>
                  <option value="custom-scale">Scale</option>
                </select>
              </label>
              <label>Anchor
                <select value={singlePng.anchor} onChange={(e) => updateSinglePng({ anchor: e.target.value as SinglePngAnchor })}>
                  <option value="center">Center</option>
                  <option value="top-left">Top Left</option>
                  <option value="bottom-center">Bottom</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
            </div>
            {singlePng.fitMode === "custom-scale" && (
              <label>Scale: {singlePng.scale.toFixed(2)}
                <input type="range" min="0.05" max="4" step="0.01" value={singlePng.scale} onChange={(e) => updateSinglePng({ scale: Number(e.target.value) })} />
              </label>
            )}
            <div className="grid2">
              <label>Offset X <input type="number" value={singlePng.xOffset} onChange={(e) => updateSinglePng({ xOffset: Number(e.target.value) })} /></label>
              <label>Offset Y <input type="number" value={singlePng.yOffset} onChange={(e) => updateSinglePng({ yOffset: Number(e.target.value) })} /></label>
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
