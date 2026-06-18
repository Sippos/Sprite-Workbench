import React from "react";
import { useProject } from "../../store/ProjectContext";

import { ImportModal } from "./ImportModal";
import { SliceModal } from "./SliceModal";

export function WorkspaceArea() {
  const {
    appMode,
    editorScrollRef,
    editorCanvasRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
    pointerPreview,
    brushMode,
    brushSize,
    framePreviewCanvasRef,
    animationPreviewCanvasRef,
    rowAlignmentCanvasRef,
    sheetPreviewCanvasRef,
    singlePngPreviewCanvasRef,
    selectedFrame,
    rows
  } = useProject();

  return (
    <main className="ide-workspace">
      <ImportModal />
      <SliceModal />
      {appMode === "single-png" ? (
        <div className="workspace-panel">
          <h3>Single PNG Preview</h3>
          <div className="canvasWrap sheetWrap">
            {selectedFrame ? (
              <canvas ref={singlePngPreviewCanvasRef} />
            ) : (
              <div className="empty">Select a cleaned frame to preview a single PNG export.</div>
            )}
          </div>
        </div>
      ) : (
        <div className="workspace-grid">
          <div className="workspace-panel editor-panel">
            <h3>Frame Editor</h3>
            <div
              className="canvasWrap editorWrap"
              ref={editorScrollRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerLeave}
            >
              {selectedFrame ? (
                <div className="editorCanvasShell">
                  <canvas ref={editorCanvasRef} />
                  {pointerPreview?.visible && brushMode !== "pan" && brushMode !== "pick" && (
                    <div
                      className="brushCursor"
                      style={{
                        width: brushSize,
                        height: brushSize,
                        transform: `translate(${pointerPreview.x - brushSize / 2}px, ${pointerPreview.y - brushSize / 2}px)`,
                      }}
                    />
                  )}
                </div>
              ) : (
                <div className="empty">No frame selected.</div>
              )}
            </div>
          </div>

          <div className="workspace-side-previews">
            <div className="workspace-panel">
              <h3>Frame Alignment</h3>
              <div className="canvasWrap previewBox">
                <canvas ref={framePreviewCanvasRef} />
              </div>
            </div>
            <div className="workspace-panel">
              <h3>Animation Playback</h3>
              <div className="canvasWrap previewBox">
                <canvas ref={animationPreviewCanvasRef} />
              </div>
            </div>
          </div>

          <div className="workspace-panel full-width">
            <h3>Row Alignment</h3>
            <div className="canvasWrap sheetWrap">
              <canvas ref={rowAlignmentCanvasRef} />
            </div>
          </div>

          <div className="workspace-panel full-width">
            <h3>Full Spritesheet</h3>
            <div className="canvasWrap sheetWrap">
              <canvas ref={sheetPreviewCanvasRef} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
