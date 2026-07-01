import { useProject } from "../../store/ProjectContext";

import { ImportModal } from "./ImportModal";
import { SliceModal } from "./SliceModal";

export function WorkspaceArea() {
  const {
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
    frameSize,
    setFeetX,
    setFeetY,
  } = useProject();

  return (
    <main className="ide-workspace">
      <ImportModal />
      <SliceModal />
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
              <canvas 
                ref={framePreviewCanvasRef} 
                onPointerDown={(e) => {
                  const canvas = framePreviewCanvasRef.current;
                  if (!canvas) return;
                  const rect = canvas.getBoundingClientRect();
                  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
                  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
                  const scale = Math.max(3, Math.floor(320 / frameSize));
                  setFeetX(Math.round(x / scale));
                  setFeetY(Math.round(y / scale));
                }}
                style={{ cursor: "crosshair" }}
                title="Click to place the character pivot (feet)"
              />
            </div>
          </div>
          <div className="workspace-panel">
            <h3>Animation Playback</h3>
            <div className="canvasWrap previewBox">
              <canvas ref={animationPreviewCanvasRef} />
            </div>
          </div>
          <div className="workspace-panel">
            <h3>Single PNG Preview</h3>
            <div className="canvasWrap previewBox">
              <canvas ref={singlePngPreviewCanvasRef} />
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
    </main>
  );
}
