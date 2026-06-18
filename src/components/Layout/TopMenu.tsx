import React from "react";
import { useProject } from "../../store/ProjectContext";
import { EDITOR_ZOOM_LEVELS } from "../../store/ProjectContext";
import { Save, FolderOpen, Undo2, Redo2, MousePointer2, Eraser, Paintbrush, ZoomIn, ZoomOut, Download, FileUp, PlusSquare, Grid3X3 } from "lucide-react";

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
    stepEditorZoom,
    editorZoom,
    setEditorZoom,
    showLoupe,
    setShowLoupe,
    exportSinglePng,
    exportSheet,
    exportMeta,
    selectedFrame,
    rows
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
        <button type="button" className={brushMode === "erase" ? "activeButton" : ""} onClick={() => setBrushMode("erase")}><Eraser size={16} /> Erase</button>
        <button type="button" className={brushMode === "restore" ? "activeButton" : ""} onClick={() => setBrushMode("restore")}><Paintbrush size={16} /> Restore</button>
        <button type="button" className={brushMode === "pick" ? "activeButton" : ""} onClick={() => setBrushMode("pick")}><MousePointer2 size={16} /> Pick</button>
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
