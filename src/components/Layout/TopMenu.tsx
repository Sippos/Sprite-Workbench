
import { useProject, colorToHex, hexToColor, EDITOR_ZOOM_LEVELS } from "../../store/ProjectContext";
import { Save, FolderOpen, Undo2, Redo2, MousePointer2, Eraser, Paintbrush, ZoomIn, ZoomOut, Download, FileUp, PlusSquare, Grid3X3, Pencil, FlipHorizontal } from "lucide-react";

export function TopMenu() {
  const {
    projectName,
    createNewProject,
    handleSaveProject,
    exportProjectJson,
    importProjectJson,
    stageImportFiles,
    stageSpritesheet,
    undo,
    redo,
    undoStack,
    redoStack,
    brushMode,
    setBrushMode,
    brushSize,
    setBrushSize,
    stepEditorZoom,
    editorZoom,
    setEditorZoom,
    showLoupe,
    setShowLoupe,
    exportSinglePng,
    exportSheet,
    exportMeta,
    selectedFrame,
    rows,
    pickedColor,
    setPickedColor,
    flipFrameHorizontal
  } = useProject();

  return (
    <header className="ide-topbar">
      <div className="menuBrand">
        <strong>Sprite Workbench</strong>
        <span>{projectName}</span>
      </div>

      <nav className="menuGroup" aria-label="File actions">
        <span className="menuLabel">File</span>
        <button type="button" onClick={createNewProject} title="New Project"><PlusSquare size={16} /> New</button>
        <button type="button" onClick={handleSaveProject} title="Save Local"><Save size={16} /> Save</button>
        <button type="button" onClick={exportProjectJson} title="Save As File"><Download size={16} /> Save As</button>
        <label className="menuUpload" title="Import Images">
          <FileUp size={16} /> Import Images
          <input
            type="file"
            accept="image/png,image/webp,image/jpeg,image/jpg,image/gif,image/bmp,image/*"
            multiple
            onChange={(event) => {
              if (event.target.files) stageImportFiles(event.target.files);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <label className="menuUpload" title="Slice Spritesheet">
          <Grid3X3 size={16} /> Slice Sheet
          <input
            type="file"
            accept="image/png,image/webp,image/jpeg,image/jpg,image/gif,image/bmp,image/*"
            onChange={(event) => {
              if (event.target.files && event.target.files.length > 0) {
                stageSpritesheet(event.target.files[0]);
              }
              event.currentTarget.value = "";
            }}
          />
        </label>
        <label className="menuUpload" title="Open Project">
          <FolderOpen size={16} /> Open
          <input
            type="file"
            accept=".assetworkbench,application/json"
            onChange={(event) => {
              void importProjectJson(event.target.files);
              event.currentTarget.value = "";
            }}
          />
        </label>
      </nav>

      <nav className="menuGroup" aria-label="Edit actions">
        <span className="menuLabel">Edit</span>
        <button type="button" onClick={undo} disabled={undoStack.length === 0}><Undo2 size={16} /> Undo</button>
        <button type="button" onClick={redo} disabled={redoStack.length === 0}><Redo2 size={16} /> Redo</button>
        <button type="button" onClick={flipFrameHorizontal} disabled={!selectedFrame} title="Flip Horizontal"><FlipHorizontal size={16} /></button>
        <button type="button" className={brushMode === "pencil" ? "activeButton" : ""} onClick={() => setBrushMode("pencil")}><Pencil size={16} /> Pencil</button>
        <button type="button" className={brushMode === "erase" ? "activeButton" : ""} onClick={() => setBrushMode("erase")}><Eraser size={16} /> Erase</button>
        <button type="button" className={brushMode === "restore" ? "activeButton" : ""} onClick={() => setBrushMode("restore")}><Paintbrush size={16} /> Restore</button>
        
        {(brushMode === "erase" || brushMode === "restore" || brushMode === "pencil") && (
          <label className="menuLabel" style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "4px", marginRight: "4px", textTransform: "none" }}>
            Size
            <input 
              type="number" 
              min={1} 
              max={200} 
              value={brushSize} 
              onChange={(e) => setBrushSize(Math.max(1, Number(e.target.value)))} 
              style={{ width: "50px", padding: "2px 4px", fontSize: "12px", background: "var(--bg-dark)", color: "var(--text-main)", border: "1px solid var(--border-color)", borderRadius: "4px" }}
            />
          </label>
        )}

        <button type="button" className={brushMode === "pick" ? "activeButton" : ""} onClick={() => setBrushMode("pick")}><MousePointer2 size={16} /> Pick</button>
        <input 
          type="color" 
          value={colorToHex(pickedColor) ?? "#000000"} 
          onChange={(e) => setPickedColor(hexToColor(e.target.value))}
          style={{ width: "24px", height: "24px", padding: "0", border: "none", cursor: "pointer", background: "none", alignSelf: "center", marginLeft: "4px" }}
          title="Active Color"
        />
        <button type="button" className={brushMode === "pan" ? "activeButton" : ""} onClick={() => setBrushMode("pan")}>Pan</button>
      </nav>

      <nav className="menuGroup" aria-label="View actions">
        <span className="menuLabel">View</span>
        <button type="button" onClick={() => stepEditorZoom(-1)}><ZoomOut size={16} /></button>
        <select
          className="zoomSelect"
          value={editorZoom}
          onChange={(event) => setEditorZoom(Number(event.target.value))}
          aria-label="Editor zoom"
        >
          {EDITOR_ZOOM_LEVELS.map((zoom) => (
            <option key={zoom} value={zoom}>{Math.round(zoom * 100)}%</option>
          ))}
        </select>
        <button type="button" onClick={() => stepEditorZoom(1)}><ZoomIn size={16} /></button>
        <button type="button" className={showLoupe ? "activeButton" : ""} onClick={() => setShowLoupe((value) => !value)}>Loupe</button>
      </nav>

      <nav className="menuGroup" aria-label="Export actions">
        <span className="menuLabel">Export</span>
        <button type="button" onClick={exportSinglePng} disabled={!selectedFrame}>Export PNG</button>
        <button type="button" onClick={exportSheet} disabled={rows.every((row) => row.frames.length === 0)}>Export Sheet</button>
        <button type="button" onClick={exportMeta} disabled={rows.every((row) => row.frames.length === 0)}>Export JSON</button>
      </nav>
    </header>
  );
}
