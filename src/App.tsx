import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";

type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type SpriteFrame = {
  id: string;
  fileName: string;
  image: HTMLImageElement;
  originalCanvas: HTMLCanvasElement;
  editCanvas: HTMLCanvasElement;
  scale: number;
  offsetX: number;
  offsetY: number;
};

type AnimationRow = {
  id: string;
  name: string;
  frameRate: number;
  frames: SpriteFrame[];
  lockedCrop: Bounds | null;
};

type BrushMode = "erase" | "restore" | "pick";
type NormalizeMode = "auto" | "locked-row";

type PointerPreview = {
  visible: boolean;
  x: number;
  y: number;
  sourceX: number;
  sourceY: number;
};

const FRAME_SIZES = [32, 48, 64, 96, 128];
const DEFAULT_COLUMNS = 6;

function createId() {
  return crypto.randomUUID();
}

function App() {
  const [assetId, setAssetId] = useState("zarathustra");
  const [frameSize, setFrameSize] = useState(64);
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [normalizeMode, setNormalizeMode] = useState<NormalizeMode>("locked-row");

  const [rows, setRows] = useState<AnimationRow[]>([
    { id: createId(), name: "idle", frameRate: 6, frames: [], lockedCrop: null },
    { id: createId(), name: "walk", frameRate: 10, frames: [], lockedCrop: null },
  ]);

  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);

  const [globalScale, setGlobalScale] = useState(1);
  const [feetX, setFeetX] = useState(32);
  const [feetY, setFeetY] = useState(52);
  const [collisionRadius, setCollisionRadius] = useState(12);
  const [collisionOffsetY, setCollisionOffsetY] = useState(10);

  const [removeWhiteThreshold, setRemoveWhiteThreshold] = useState(246);
  const [pickedColor, setPickedColor] = useState<[number, number, number] | null>(null);
  const [colorTolerance, setColorTolerance] = useState(24);

  const [checkerBrightness, setCheckerBrightness] = useState(218);
  const [checkerNeutrality, setCheckerNeutrality] = useState(42);
  const [haloThreshold, setHaloThreshold] = useState(205);

  const [brushMode, setBrushMode] = useState<BrushMode>("erase");
  const [brushSize, setBrushSize] = useState(18);

  const [showGuides, setShowGuides] = useState(true);
  const [previewTick, setPreviewTick] = useState(0);
  const [pointerPreview, setPointerPreview] = useState<PointerPreview | null>(null);

  const editorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const framePreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rowAlignmentCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sheetPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const isPaintingRef = useRef(false);

  const selectedRow = useMemo(() => {
    return rows.find((row) => row.id === selectedRowId) ?? rows[0] ?? null;
  }, [rows, selectedRowId]);

  const selectedFrame = useMemo(() => {
    for (const row of rows) {
      const found = row.frames.find((frame) => frame.id === selectedFrameId);
      if (found) return found;
    }

    return selectedRow?.frames[0] ?? null;
  }, [rows, selectedFrameId, selectedRow]);

  useEffect(() => {
    setFeetX(Math.floor(frameSize / 2));
    setFeetY(Math.floor(frameSize * 0.82));
    setCollisionRadius(Math.max(6, Math.floor(frameSize * 0.19)));
    setCollisionOffsetY(Math.floor(frameSize * 0.15));
  }, [frameSize]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPreviewTick((value) => value + 1);
    }, 140);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    drawAll();
  }, [
    rows,
    selectedFrameId,
    selectedRowId,
    frameSize,
    columns,
    normalizeMode,
    globalScale,
    feetX,
    feetY,
    collisionRadius,
    collisionOffsetY,
    showGuides,
    previewTick,
    pointerPreview,
  ]);

  async function addFramesToRow(rowId: string, files: FileList | File[]) {
    const newFrames = await Promise.all(Array.from(files).map(fileToSpriteFrame));

    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              frames: [...row.frames, ...newFrames],
            }
          : row
      )
    );

    if (!selectedFrameId && newFrames[0]) {
      setSelectedRowId(rowId);
      setSelectedFrameId(newFrames[0].id);
    }
  }

  function addRow() {
    const newRow: AnimationRow = {
      id: createId(),
      name: `anim_${rows.length + 1}`,
      frameRate: 8,
      frames: [],
      lockedCrop: null,
    };

    setRows((current) => [...current, newRow]);
    setSelectedRowId(newRow.id);
  }

  function deleteRow(rowId: string) {
    setRows((current) => current.filter((row) => row.id !== rowId));

    if (selectedRowId === rowId) {
      setSelectedRowId(null);
      setSelectedFrameId(null);
    }
  }

  function renameRow(rowId: string, name: string) {
    setRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, name } : row))
    );
  }

  function updateRowFrameRate(rowId: string, frameRate: number) {
    setRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, frameRate } : row))
    );
  }

  function deleteFrame(rowId: string, frameId: string) {
    setRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? { ...row, frames: row.frames.filter((frame) => frame.id !== frameId) }
          : row
      )
    );

    if (selectedFrameId === frameId) {
      setSelectedFrameId(null);
    }
  }

  function moveFrame(rowId: string, frameId: string, direction: -1 | 1) {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== rowId) return row;

        const index = row.frames.findIndex((frame) => frame.id === frameId);
        const nextIndex = index + direction;

        if (index < 0 || nextIndex < 0 || nextIndex >= row.frames.length) {
          return row;
        }

        const frames = [...row.frames];
        const [removed] = frames.splice(index, 1);
        frames.splice(nextIndex, 0, removed);

        return { ...row, frames };
      })
    );
  }

  function updateSelectedFramePatch(patch: Partial<SpriteFrame>) {
    if (!selectedFrame) return;

    setRows((current) =>
      current.map((row) => ({
        ...row,
        frames: row.frames.map((frame) =>
          frame.id === selectedFrame.id ? { ...frame, ...patch } : frame
        ),
      }))
    );
  }

  function forceRerenderRows() {
    setRows((current) =>
      current.map((row) => ({
        ...row,
        frames: [...row.frames],
      }))
    );
  }

  function applyRemoveNearWhiteToSelected() {
    if (!selectedFrame) return;
    removeNearWhite(selectedFrame.editCanvas, removeWhiteThreshold);
    forceRerenderRows();
  }

  function applyRemoveNearWhiteToRow() {
    if (!selectedRow) return;

    for (const frame of selectedRow.frames) {
      removeNearWhite(frame.editCanvas, removeWhiteThreshold);
    }

    forceRerenderRows();
  }

  function applyPickedColorToSelected() {
    if (!selectedFrame || !pickedColor) return;
    removeColor(selectedFrame.editCanvas, pickedColor, colorTolerance);
    forceRerenderRows();
  }

  function applyPickedColorToRow() {
    if (!selectedRow || !pickedColor) return;

    for (const frame of selectedRow.frames) {
      removeColor(frame.editCanvas, pickedColor, colorTolerance);
    }

    forceRerenderRows();
  }

  function applyCheckerBgToSelected() {
    if (!selectedFrame) return;

    removeConnectedLightBackground(selectedFrame.editCanvas, {
      brightness: checkerBrightness,
      neutrality: checkerNeutrality,
    });

    forceRerenderRows();
  }

  function applyCheckerBgToRow() {
    if (!selectedRow) return;

    for (const frame of selectedRow.frames) {
      removeConnectedLightBackground(frame.editCanvas, {
        brightness: checkerBrightness,
        neutrality: checkerNeutrality,
      });
    }

    forceRerenderRows();
  }

  function applyHaloToSelected() {
    if (!selectedFrame) return;
    removeWhiteHalo(selectedFrame.editCanvas, haloThreshold, 2);
    forceRerenderRows();
  }

  function applyHaloToRow() {
    if (!selectedRow) return;

    for (const frame of selectedRow.frames) {
      removeWhiteHalo(frame.editCanvas, haloThreshold, 2);
    }

    forceRerenderRows();
  }

  function safeCleanupSelected() {
    if (!selectedFrame) return;
    runSafeCleanup(selectedFrame.editCanvas);
    forceRerenderRows();
  }

  function safeCleanupRow() {
    if (!selectedRow) return;

    for (const frame of selectedRow.frames) {
      runSafeCleanup(frame.editCanvas);
    }

    forceRerenderRows();
  }

  function strongCleanupSelected() {
    if (!selectedFrame) return;
    runStrongCleanup(selectedFrame.editCanvas);
    forceRerenderRows();
  }

  function strongCleanupRow() {
    if (!selectedRow) return;

    for (const frame of selectedRow.frames) {
      runStrongCleanup(frame.editCanvas);
    }

    forceRerenderRows();
  }

  function resetSelectedFrame() {
    if (!selectedFrame) return;

    const context = selectedFrame.editCanvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, selectedFrame.editCanvas.width, selectedFrame.editCanvas.height);
    context.drawImage(selectedFrame.originalCanvas, 0, 0);

    forceRerenderRows();
  }

  function resetSelectedRowFrames() {
    if (!selectedRow) return;

    for (const frame of selectedRow.frames) {
      const context = frame.editCanvas.getContext("2d");
      if (!context) continue;

      context.clearRect(0, 0, frame.editCanvas.width, frame.editCanvas.height);
      context.drawImage(frame.originalCanvas, 0, 0);
    }

    forceRerenderRows();
  }

  function resetSelectedFrameTransform() {
    if (!selectedFrame) return;

    updateSelectedFramePatch({
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    });
  }

  function applySelectedTransformToRow() {
    if (!selectedFrame || !selectedRow) return;

    setRows((current) =>
      current.map((row) =>
        row.id === selectedRow.id
          ? {
              ...row,
              frames: row.frames.map((frame) => ({
                ...frame,
                scale: selectedFrame.scale,
                offsetX: selectedFrame.offsetX,
                offsetY: selectedFrame.offsetY,
              })),
            }
          : row
      )
    );
  }

  function lockCropFromSelectedFrame() {
    if (!selectedRow || !selectedFrame) return;

    const crop = findVisibleBounds(selectedFrame.editCanvas);

    setRows((current) =>
      current.map((row) =>
        row.id === selectedRow.id ? { ...row, lockedCrop: crop } : row
      )
    );

    setNormalizeMode("locked-row");
  }

  function lockCropFromRowUnion() {
    if (!selectedRow || selectedRow.frames.length === 0) return;

    const crop = unionFrameBounds(selectedRow.frames.map((frame) => findVisibleBounds(frame.editCanvas)));

    setRows((current) =>
      current.map((row) =>
        row.id === selectedRow.id ? { ...row, lockedCrop: crop } : row
      )
    );

    setNormalizeMode("locked-row");
  }

  function clearSelectedRowCrop() {
    if (!selectedRow) return;

    setRows((current) =>
      current.map((row) =>
        row.id === selectedRow.id ? { ...row, lockedCrop: null } : row
      )
    );
  }

  function drawAll() {
    drawEditorCanvas();
    drawSelectedFramePreview();
    drawAnimationPreview();
    drawRowAlignmentPreview();
    drawSheetPreview();
  }

  function drawEditorCanvas() {
    const canvas = editorCanvasRef.current;
    if (!canvas || !selectedFrame) return;

    const source = selectedFrame.editCanvas;
    const maxSize = 520;
    const scale = Math.min(maxSize / source.width, maxSize / source.height, 2);

    canvas.width = Math.round(source.width * scale);
    canvas.height = Math.round(source.height * scale);

    const context = canvas.getContext("2d");
    if (!context) return;

    context.imageSmoothingEnabled = false;
    drawCheckerboard(context, canvas.width, canvas.height, 16);
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
  }

  function getSelectedFrameBoundsForDrawing(frame: SpriteFrame, row: AnimationRow | null) {
    return getFrameBoundsForDrawing(frame, row, normalizeMode);
  }

  function drawSelectedFramePreview() {
    const canvas = framePreviewCanvasRef.current;
    if (!canvas || !selectedFrame) return;

    drawNormalizedFramePreview(canvas, {
      frame: selectedFrame,
      row: selectedRow,
      frameSize,
      normalizeMode,
      globalScale,
      feetX,
      feetY,
      collisionRadius,
      collisionOffsetY,
      showGuides,
    });
  }

  function drawAnimationPreview() {
    const canvas = animationPreviewCanvasRef.current;
    if (!canvas || !selectedRow || selectedRow.frames.length === 0) return;

    const index = previewTick % selectedRow.frames.length;
    const frame = selectedRow.frames[index];

    drawNormalizedFramePreview(canvas, {
      frame,
      row: selectedRow,
      frameSize,
      normalizeMode,
      globalScale,
      feetX,
      feetY,
      collisionRadius,
      collisionOffsetY,
      showGuides,
    });
  }

  function drawRowAlignmentPreview() {
    const canvas = rowAlignmentCanvasRef.current;
    if (!canvas || !selectedRow || selectedRow.frames.length === 0) return;

    drawRowAlignmentSheet(canvas, {
      row: selectedRow,
      frameSize,
      columns,
      normalizeMode,
      globalScale,
      feetX,
      feetY,
      collisionRadius,
      collisionOffsetY,
      showGuides,
    });
  }

  function drawSheetPreview() {
    const canvas = sheetPreviewCanvasRef.current;
    if (!canvas) return;

    drawSpriteSheet(canvas, {
      rows,
      frameSize,
      columns,
      normalizeMode,
      globalScale,
      feetX,
      feetY,
      drawGrid: true,
    });
  }

  function getEditorSourcePoint(event: React.PointerEvent) {
    const canvas = editorCanvasRef.current;
    if (!canvas || !selectedFrame) return null;

    const rect = canvas.getBoundingClientRect();

    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    const x = (canvasX / rect.width) * selectedFrame.editCanvas.width;
    const y = (canvasY / rect.height) * selectedFrame.editCanvas.height;

    return {
      x: Math.floor(x),
      y: Math.floor(y),
      canvasX,
      canvasY,
    };
  }

  function paintAt(event: React.PointerEvent) {
    const point = getEditorSourcePoint(event);
    if (!point || !selectedFrame) return;

    setPointerPreview({
      visible: true,
      x: point.canvasX,
      y: point.canvasY,
      sourceX: point.x,
      sourceY: point.y,
    });

    if (brushMode === "pick") {
      const context = selectedFrame.editCanvas.getContext("2d");
      if (!context) return;

      const pixel = context.getImageData(point.x, point.y, 1, 1).data;
      setPickedColor([pixel[0], pixel[1], pixel[2]]);
      return;
    }

    const context = selectedFrame.editCanvas.getContext("2d");
    if (!context) return;

    context.save();
    context.beginPath();
    context.arc(point.x, point.y, brushSize / 2, 0, Math.PI * 2);
    context.closePath();

    if (brushMode === "erase") {
      context.globalCompositeOperation = "destination-out";
      context.fill();
    }

    if (brushMode === "restore") {
      context.clip();
      context.globalCompositeOperation = "source-over";
      context.drawImage(selectedFrame.originalCanvas, 0, 0);
    }

    context.restore();
    forceRerenderRows();
  }

  function handlePointerDown(event: React.PointerEvent) {
    isPaintingRef.current = true;
    paintAt(event);
  }

  function handlePointerMove(event: React.PointerEvent) {
    const point = getEditorSourcePoint(event);

    if (point) {
      setPointerPreview({
        visible: true,
        x: point.canvasX,
        y: point.canvasY,
        sourceX: point.x,
        sourceY: point.y,
      });
    }

    if (!isPaintingRef.current) return;
    paintAt(event);
  }

  function handlePointerUp() {
    isPaintingRef.current = false;
  }

  function handlePointerLeave() {
    isPaintingRef.current = false;
    setPointerPreview(null);
  }

  function exportSheet() {
    const canvas = document.createElement("canvas");

    drawSpriteSheet(canvas, {
      rows,
      frameSize,
      columns,
      normalizeMode,
      globalScale,
      feetX,
      feetY,
      drawGrid: false,
    });

    canvas.toBlob((blob) => {
      if (!blob) return;
      downloadBlob(blob, `${assetId}_sheet_${frameSize}x${frameSize}.png`);
    }, "image/png");
  }

  function exportMeta() {
    const meta = createMetadata({
      assetId,
      rows,
      frameSize,
      columns,
      feetX,
      feetY,
      collisionRadius,
      collisionOffsetY,
    });

    const blob = new Blob([JSON.stringify(meta, null, 2)], {
      type: "application/json",
    });

    downloadBlob(blob, `${assetId}_meta.json`);
  }

  function copyPhaserSnippet() {
    const meta = createMetadata({
      assetId,
      rows,
      frameSize,
      columns,
      feetX,
      feetY,
      collisionRadius,
      collisionOffsetY,
    });

    let frameOffset = 0;

    const animationCode = rows
      .map((row) => {
        const frameCount = Math.min(row.frames.length, columns);
        const frames = Array.from(
          { length: frameCount },
          (_, index) => frameOffset + index
        );

        frameOffset += columns;

        return `this.anims.create({
  key: "${assetId}_${row.name}",
  frames: this.anims.generateFrameNumbers("${assetId}", {
    frames: [${frames.join(", ")}]
  }),
  frameRate: ${row.frameRate},
  repeat: -1
});`;
      })
      .join("\n\n");

    const snippet = `this.load.spritesheet("${assetId}", "assets/${meta.image}", {
  frameWidth: ${frameSize},
  frameHeight: ${frameSize}
});

${animationCode}`;

    navigator.clipboard.writeText(snippet);
  }

  const totalSheetWidth = frameSize * columns;
  const totalSheetHeight = frameSize * rows.length;

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Sprite Sheet Builder</p>
          <h1>Stable frame builder with locked crops</h1>
          <p className="subtitle">
            Clean backgrounds without changing sprite dimensions. Lock a row crop
            once, then erase, restore, align, and export consistent Phaser sheets.
          </p>
        </div>
      </header>

      <section className="layout">
        <aside className="panel sidebar">
          <h2>Project</h2>

          <label>
            Asset ID
            <input
              value={assetId}
              onChange={(event) => setAssetId(event.target.value)}
            />
          </label>

          <div className="grid2">
            <label>
              Frame size
              <select
                value={frameSize}
                onChange={(event) => setFrameSize(Number(event.target.value))}
              >
                {FRAME_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}×{size}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Columns
              <input
                type="number"
                min={1}
                max={20}
                value={columns}
                onChange={(event) =>
                  setColumns(Math.max(1, Number(event.target.value)))
                }
              />
            </label>
          </div>

          <p className="info">
            Output: {totalSheetWidth}×{totalSheetHeight}px
          </p>

          <label>
            Normalize mode
            <select
              value={normalizeMode}
              onChange={(event) => setNormalizeMode(event.target.value as NormalizeMode)}
            >
              <option value="locked-row">Locked row crop</option>
              <option value="auto">Auto visible bounds</option>
            </select>
          </label>

          <label>
            Global scale: {globalScale.toFixed(2)}
            <input
              type="range"
              min="0.2"
              max="2.5"
              step="0.01"
              value={globalScale}
              onChange={(event) => setGlobalScale(Number(event.target.value))}
            />
          </label>

          <hr />

          <h2>Rows</h2>

          <div className="rowList">
            {rows.map((row) => (
              <div
                key={row.id}
                className={`rowCard ${selectedRow?.id === row.id ? "selected" : ""}`}
                onClick={() => {
                  setSelectedRowId(row.id);
                  setSelectedFrameId(row.frames[0]?.id ?? null);
                }}
              >
                <div className="rowHeader">
                  <input
                    value={row.name}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => renameRow(row.id, event.target.value)}
                  />
                  <button
                    className="small danger"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteRow(row.id);
                    }}
                    disabled={rows.length <= 1}
                  >
                    ×
                  </button>
                </div>

                <div className="grid2">
                  <label>
                    FPS
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={row.frameRate}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) =>
                        updateRowFrameRate(row.id, Number(event.target.value))
                      }
                    />
                  </label>

                  <label>
                    Frames
                    <input value={row.frames.length} readOnly />
                  </label>
                </div>

                <p className="cropInfo">
                  Crop:{" "}
                  {row.lockedCrop
                    ? `${row.lockedCrop.x},${row.lockedCrop.y} ${row.lockedCrop.width}×${row.lockedCrop.height}`
                    : "not locked"}
                </p>

                <label
                  className="uploadMini"
                  onClick={(event) => event.stopPropagation()}
                >
                  Add frames
                  <input
                    type="file"
                    accept="image/png,image/webp,image/jpeg"
                    multiple
                    onChange={(event) => {
                      if (event.target.files) {
                        addFramesToRow(row.id, event.target.files);
                      }

                      event.currentTarget.value = "";
                    }}
                  />
                </label>

                <div className="thumbRow">
                  {row.frames.map((frame, index) => (
                    <button
                      key={frame.id}
                      className={`thumb ${
                        selectedFrame?.id === frame.id ? "active" : ""
                      }`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedRowId(row.id);
                        setSelectedFrameId(frame.id);
                      }}
                      title={frame.fileName}
                    >
                      <FrameThumb frame={frame} />
                      <span>{index}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button onClick={addRow}>Add animation row</button>

          <hr />

          <h2>Row crop lock</h2>

          <p className="info">
            This is the important part. Locking the row crop prevents background
            cleanup from changing scale.
          </p>

          <div className="buttonStack">
            <button disabled={!selectedFrame} onClick={lockCropFromSelectedFrame}>
              Lock crop from selected frame
            </button>
            <button disabled={!selectedRow || selectedRow.frames.length === 0} onClick={lockCropFromRowUnion}>
              Lock crop from row union
            </button>
            <button disabled={!selectedRow?.lockedCrop} onClick={clearSelectedRowCrop}>
              Clear row crop
            </button>
          </div>

          <hr />

          <h2>Selected frame</h2>

          {selectedFrame ? (
            <>
              <p className="info">{selectedFrame.fileName}</p>

              <label>
                Frame scale: {selectedFrame.scale.toFixed(2)}
                <input
                  type="range"
                  min="0.2"
                  max="3"
                  step="0.01"
                  value={selectedFrame.scale}
                  onChange={(event) =>
                    updateSelectedFramePatch({
                      scale: Number(event.target.value),
                    })
                  }
                />
              </label>

              <div className="grid2">
                <label>
                  Offset X
                  <input
                    type="number"
                    value={selectedFrame.offsetX}
                    onChange={(event) =>
                      updateSelectedFramePatch({
                        offsetX: Number(event.target.value),
                      })
                    }
                  />
                </label>

                <label>
                  Offset Y
                  <input
                    type="number"
                    value={selectedFrame.offsetY}
                    onChange={(event) =>
                      updateSelectedFramePatch({
                        offsetY: Number(event.target.value),
                      })
                    }
                  />
                </label>
              </div>

              <div className="buttonGrid">
                <button onClick={resetSelectedFrameTransform}>
                  Reset transform
                </button>
                <button onClick={applySelectedTransformToRow}>
                  Apply transform to row
                </button>
              </div>

              {selectedRow && (
                <div className="buttonGrid">
                  <button
                    onClick={() =>
                      moveFrame(selectedRow.id, selectedFrame.id, -1)
                    }
                  >
                    Move left
                  </button>
                  <button
                    onClick={() => moveFrame(selectedRow.id, selectedFrame.id, 1)}
                  >
                    Move right
                  </button>
                  <button
                    className="danger"
                    onClick={() => deleteFrame(selectedRow.id, selectedFrame.id)}
                  >
                    Delete frame
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="info">Select or upload a frame.</p>
          )}

          <hr />

          <h2>Cleanup presets</h2>

          <p className="info">
            For your checkerboard images, start with Safe cleanup row. Use Strong
            only if the white border remains.
          </p>

          <div className="buttonGrid">
            <button disabled={!selectedFrame} onClick={safeCleanupSelected}>
              Safe selected
            </button>
            <button disabled={!selectedRow} onClick={safeCleanupRow}>
              Safe row
            </button>
            <button disabled={!selectedFrame} onClick={strongCleanupSelected}>
              Strong selected
            </button>
            <button disabled={!selectedRow} onClick={strongCleanupRow}>
              Strong row
            </button>
          </div>

          <hr />

          <h2>Manual cleanup</h2>

          <div className="buttonGrid three">
            <button
              className={brushMode === "erase" ? "activeButton" : ""}
              onClick={() => setBrushMode("erase")}
            >
              Erase
            </button>
            <button
              className={brushMode === "restore" ? "activeButton" : ""}
              onClick={() => setBrushMode("restore")}
            >
              Restore
            </button>
            <button
              className={brushMode === "pick" ? "activeButton" : ""}
              onClick={() => setBrushMode("pick")}
            >
              Pick
            </button>
          </div>

          <label>
            Brush size: {brushSize}px
            <input
              type="range"
              min="4"
              max="140"
              step="1"
              value={brushSize}
              onChange={(event) => setBrushSize(Number(event.target.value))}
            />
          </label>

          <label>
            Checker brightness: {checkerBrightness}
            <input
              type="range"
              min="160"
              max="255"
              step="1"
              value={checkerBrightness}
              onChange={(event) => setCheckerBrightness(Number(event.target.value))}
            />
          </label>

          <label>
            Checker neutrality: {checkerNeutrality}
            <input
              type="range"
              min="5"
              max="100"
              step="1"
              value={checkerNeutrality}
              onChange={(event) => setCheckerNeutrality(Number(event.target.value))}
            />
          </label>

          <div className="buttonGrid">
            <button disabled={!selectedFrame} onClick={applyCheckerBgToSelected}>
              Remove checker selected
            </button>
            <button disabled={!selectedRow} onClick={applyCheckerBgToRow}>
              Remove checker row
            </button>
          </div>

          <label>
            White threshold: {removeWhiteThreshold}
            <input
              type="range"
              min="160"
              max="255"
              step="1"
              value={removeWhiteThreshold}
              onChange={(event) =>
                setRemoveWhiteThreshold(Number(event.target.value))
              }
            />
          </label>

          <div className="buttonGrid">
            <button disabled={!selectedFrame} onClick={applyRemoveNearWhiteToSelected}>
              Remove white selected
            </button>
            <button disabled={!selectedRow} onClick={applyRemoveNearWhiteToRow}>
              Remove white row
            </button>
          </div>

          <label>
            Halo threshold: {haloThreshold}
            <input
              type="range"
              min="150"
              max="255"
              step="1"
              value={haloThreshold}
              onChange={(event) => setHaloThreshold(Number(event.target.value))}
            />
          </label>

          <div className="buttonGrid">
            <button disabled={!selectedFrame} onClick={applyHaloToSelected}>
              Remove halo selected
            </button>
            <button disabled={!selectedRow} onClick={applyHaloToRow}>
              Remove halo row
            </button>
          </div>

          <label>
            Picked color tolerance: {colorTolerance}
            <input
              type="range"
              min="0"
              max="160"
              step="1"
              value={colorTolerance}
              onChange={(event) => setColorTolerance(Number(event.target.value))}
            />
          </label>

          {pickedColor && (
            <div className="pickedColor">
              <span
                style={{
                  background: `rgb(${pickedColor[0]}, ${pickedColor[1]}, ${pickedColor[2]})`,
                }}
              />
              RGB {pickedColor.join(", ")}
            </div>
          )}

          <div className="buttonGrid">
            <button
              disabled={!selectedFrame || !pickedColor}
              onClick={applyPickedColorToSelected}
            >
              Remove picked selected
            </button>
            <button
              disabled={!selectedRow || !pickedColor}
              onClick={applyPickedColorToRow}
            >
              Remove picked row
            </button>
          </div>

          <div className="buttonGrid">
            <button disabled={!selectedFrame} onClick={resetSelectedFrame}>
              Reset selected image
            </button>
            <button disabled={!selectedRow} onClick={resetSelectedRowFrames}>
              Reset row images
            </button>
          </div>

          <hr />

          <h2>Gameplay metadata</h2>

          <div className="grid2">
            <label>
              Feet X
              <input
                type="number"
                value={feetX}
                onChange={(event) => setFeetX(Number(event.target.value))}
              />
            </label>

            <label>
              Feet Y
              <input
                type="number"
                value={feetY}
                onChange={(event) => setFeetY(Number(event.target.value))}
              />
            </label>

            <label>
              Collision radius
              <input
                type="number"
                value={collisionRadius}
                onChange={(event) =>
                  setCollisionRadius(Number(event.target.value))
                }
              />
            </label>

            <label>
              Collision Y offset
              <input
                type="number"
                value={collisionOffsetY}
                onChange={(event) =>
                  setCollisionOffsetY(Number(event.target.value))
                }
              />
            </label>
          </div>

          <label className="check">
            <input
              type="checkbox"
              checked={showGuides}
              onChange={(event) => setShowGuides(event.target.checked)}
            />
            Show guides
          </label>

          <hr />

          <h2>Export</h2>

          <div className="buttonStack">
            <button
              onClick={exportSheet}
              disabled={rows.every((row) => row.frames.length === 0)}
            >
              Download sheet.png
            </button>
            <button
              onClick={exportMeta}
              disabled={rows.every((row) => row.frames.length === 0)}
            >
              Download meta.json
            </button>
            <button
              onClick={copyPhaserSnippet}
              disabled={rows.every((row) => row.frames.length === 0)}
            >
              Copy Phaser snippet
            </button>
          </div>
        </aside>

        <section className="workspace">
          <div className="panel">
            <h2>Frame cleanup editor</h2>
            <p className="hint">
              The editor changes pixels, but locked row crop keeps exported sprite
              dimensions stable.
            </p>

            <div className="canvasWrap editorWrap">
              {selectedFrame ? (
                <div className="editorCanvasShell">
                  <canvas
                    ref={editorCanvasRef}
                    className="editorCanvas"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerLeave}
                  />

                  {pointerPreview?.visible && (
                    <BrushLoupe
                      frame={selectedFrame}
                      pointer={pointerPreview}
                      brushSize={brushSize}
                      brushMode={brushMode}
                    />
                  )}
                </div>
              ) : (
                <EmptyState
                  onFiles={(files) =>
                    addFramesToRow(selectedRow?.id ?? rows[0].id, files)
                  }
                />
              )}
            </div>
          </div>

          <div className="previewGrid">
            <div className="panel">
              <h2>Selected normalized frame</h2>
              <div className="canvasWrap previewBox">
                {selectedFrame ? (
                  <canvas ref={framePreviewCanvasRef} />
                ) : (
                  <div className="empty">No frame selected.</div>
                )}
              </div>
            </div>

            <div className="panel">
              <h2>Selected row animation preview</h2>
              <div className="canvasWrap previewBox">
                {selectedRow && selectedRow.frames.length > 0 ? (
                  <canvas ref={animationPreviewCanvasRef} />
                ) : (
                  <div className="empty">No frames in selected row.</div>
                )}
              </div>
            </div>
          </div>

          <div className="panel">
            <h2>Selected row alignment check</h2>
            <p className="hint">
              This is the main quality check. All frames should have the same feet
              position, size, and collision guide.
            </p>

            <div className="canvasWrap sheetWrap">
              {selectedRow && selectedRow.frames.length > 0 ? (
                <canvas ref={rowAlignmentCanvasRef} />
              ) : (
                <div className="empty">No frames in selected row.</div>
              )}
            </div>
          </div>

          <div className="panel">
            <h2>Spritesheet preview</h2>
            <p className="hint">
              Exported dimensions are always fixed: frame size × columns and frame
              size × rows.
            </p>

            <div className="canvasWrap sheetWrap">
              <canvas ref={sheetPreviewCanvasRef} />
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function EmptyState({ onFiles }: { onFiles: (files: FileList) => void }) {
  return (
    <label className="emptyDrop">
      <input
        type="file"
        accept="image/png,image/webp,image/jpeg"
        multiple
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          if (event.target.files) onFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />
      <strong>Upload animation frames</strong>
      <span>Choose several PNGs for the selected row.</span>
    </label>
  );
}

function FrameThumb({ frame }: { frame: SpriteFrame }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    canvas.width = 48;
    canvas.height = 48;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.imageSmoothingEnabled = false;
    drawCheckerboard(context, 48, 48, 8);

    const bounds = findVisibleBounds(frame.editCanvas);
    const scale = Math.min(38 / bounds.width, 38 / bounds.height);
    const width = bounds.width * scale;
    const height = bounds.height * scale;

    context.drawImage(
      frame.editCanvas,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      24 - width / 2,
      24 - height / 2,
      width,
      height
    );
  }, [frame]);

  return <canvas ref={ref} />;
}

function BrushLoupe({
  frame,
  pointer,
  brushSize,
  brushMode,
}: {
  frame: SpriteFrame;
  pointer: PointerPreview;
  brushSize: number;
  brushMode: BrushMode;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const size = 128;
    const zoom = 4;
    const sourceSize = size / zoom;

    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.imageSmoothingEnabled = false;
    drawCheckerboard(context, size, size, 8);

    const sx = pointer.sourceX - sourceSize / 2;
    const sy = pointer.sourceY - sourceSize / 2;

    context.drawImage(
      frame.editCanvas,
      sx,
      sy,
      sourceSize,
      sourceSize,
      0,
      0,
      size,
      size
    );

    context.strokeStyle =
      brushMode === "erase"
        ? "rgba(248, 113, 113, 0.95)"
        : brushMode === "restore"
          ? "rgba(52, 211, 153, 0.95)"
          : "rgba(250, 204, 21, 0.95)";

    context.lineWidth = 2;

    const brushRadius = Math.max(2, (brushSize / 2) * zoom);

    context.beginPath();
    context.arc(size / 2, size / 2, brushRadius, 0, Math.PI * 2);
    context.stroke();

    context.strokeStyle = "rgba(255,255,255,0.75)";
    context.beginPath();
    context.moveTo(size / 2 - 8, size / 2);
    context.lineTo(size / 2 + 8, size / 2);
    context.moveTo(size / 2, size / 2 - 8);
    context.lineTo(size / 2, size / 2 + 8);
    context.stroke();
  }, [frame, pointer, brushSize, brushMode]);

  return (
    <div
      className="brushLoupe"
      style={{
        left: pointer.x + 24,
        top: pointer.y + 24,
      }}
    >
      <canvas ref={canvasRef} />
      <div>{brushMode}</div>
    </div>
  );
}

async function fileToSpriteFrame(file: File): Promise<SpriteFrame> {
  const image = await loadImage(file);

  const originalCanvas = document.createElement("canvas");
  originalCanvas.width = image.naturalWidth;
  originalCanvas.height = image.naturalHeight;

  const originalContext = originalCanvas.getContext("2d");
  if (!originalContext) throw new Error("Could not create canvas.");

  originalContext.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
  originalContext.drawImage(image, 0, 0);

  const editCanvas = document.createElement("canvas");
  editCanvas.width = originalCanvas.width;
  editCanvas.height = originalCanvas.height;

  const editContext = editCanvas.getContext("2d");
  if (!editContext) throw new Error("Could not create edit canvas.");

  editContext.clearRect(0, 0, editCanvas.width, editCanvas.height);
  editContext.drawImage(originalCanvas, 0, 0);

  return {
    id: createId(),
    fileName: file.name,
    image,
    originalCanvas,
    editCanvas,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Could not read file."));

    reader.onload = () => {
      const image = new Image();

      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not load image."));
      image.src = String(reader.result);
    };

    reader.readAsDataURL(file);
  });
}

function findVisibleBounds(canvas: HTMLCanvasElement): Bounds {
  const context = canvas.getContext("2d");

  if (!context) {
    return { x: 0, y: 0, width: canvas.width, height: canvas.height };
  }

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = 0;
  let maxY = 0;
  let found = false;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const alpha = data[(y * canvas.width + x) * 4 + 3];

      if (alpha > 10) {
        found = true;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (!found) {
    return { x: 0, y: 0, width: canvas.width, height: canvas.height };
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX + 1),
    height: Math.max(1, maxY - minY + 1),
  };
}

function unionFrameBounds(boundsList: Bounds[]): Bounds {
  if (boundsList.length === 0) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const bounds of boundsList) {
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  }

  return {
    x: Math.floor(minX),
    y: Math.floor(minY),
    width: Math.max(1, Math.ceil(maxX - minX)),
    height: Math.max(1, Math.ceil(maxY - minY)),
  };
}

function getFrameBoundsForDrawing(
  frame: SpriteFrame,
  row: AnimationRow | null,
  normalizeMode: NormalizeMode
): Bounds {
  if (normalizeMode === "locked-row" && row?.lockedCrop) {
    return row.lockedCrop;
  }

  return findVisibleBounds(frame.editCanvas);
}

function runSafeCleanup(canvas: HTMLCanvasElement) {
  removeConnectedLightBackground(canvas, {
    brightness: 218,
    neutrality: 42,
  });

  removeNearWhite(canvas, 248);
  removeWhiteHalo(canvas, 210, 2);
}

function runStrongCleanup(canvas: HTMLCanvasElement) {
  removeConnectedLightBackground(canvas, {
    brightness: 195,
    neutrality: 58,
  });

  removeNearWhite(canvas, 244);
  removeWhiteHalo(canvas, 190, 3);
}

function removeNearWhite(canvas: HTMLCanvasElement, threshold: number) {
  const context = canvas.getContext("2d");
  if (!context) return;

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];

    if (red >= threshold && green >= threshold && blue >= threshold) {
      data[index + 3] = 0;
    }
  }

  context.putImageData(imageData, 0, 0);
}

function removeColor(
  canvas: HTMLCanvasElement,
  color: [number, number, number],
  tolerance: number
) {
  const context = canvas.getContext("2d");
  if (!context) return;

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const toleranceSquared = tolerance * tolerance;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];

    const distanceSquared =
      Math.pow(red - color[0], 2) +
      Math.pow(green - color[1], 2) +
      Math.pow(blue - color[2], 2);

    if (distanceSquared <= toleranceSquared) {
      data[index + 3] = 0;
    }
  }

  context.putImageData(imageData, 0, 0);
}

function removeConnectedLightBackground(
  canvas: HTMLCanvasElement,
  options: {
    brightness: number;
    neutrality: number;
  }
) {
  const context = canvas.getContext("2d");
  if (!context) return;

  const width = canvas.width;
  const height = canvas.height;

  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;

  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  function push(x: number, y: number) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;

    const pixelIndex = y * width + x;

    if (visited[pixelIndex]) return;
    visited[pixelIndex] = 1;

    const dataIndex = pixelIndex * 4;
    if (!isLightBackgroundPixel(data, dataIndex, options.brightness, options.neutrality)) {
      return;
    }

    queue[tail++] = pixelIndex;
  }

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }

  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  while (head < tail) {
    const pixelIndex = queue[head++];
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);

    data[pixelIndex * 4 + 3] = 0;

    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  context.putImageData(imageData, 0, 0);
}

function isLightBackgroundPixel(
  data: Uint8ClampedArray,
  index: number,
  brightness: number,
  neutrality: number
) {
  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  const alpha = data[index + 3];

  if (alpha <= 5) return false;

  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const average = (red + green + blue) / 3;

  const isNeutral = max - min <= neutrality;
  const isBright = average >= brightness;
  const isAlmostWhite = red >= 245 && green >= 245 && blue >= 245;

  return (isNeutral && isBright) || isAlmostWhite;
}

function removeWhiteHalo(
  canvas: HTMLCanvasElement,
  threshold: number,
  passes: number
) {
  const context = canvas.getContext("2d");
  if (!context) return;

  for (let pass = 0; pass < passes; pass++) {
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const nextAlpha = new Uint8ClampedArray(canvas.width * canvas.height);

    for (let i = 0; i < nextAlpha.length; i++) {
      nextAlpha[i] = data[i * 4 + 3];
    }

    for (let y = 1; y < canvas.height - 1; y++) {
      for (let x = 1; x < canvas.width - 1; x++) {
        const pixelIndex = y * canvas.width + x;
        const dataIndex = pixelIndex * 4;

        const alpha = data[dataIndex + 3];
        if (alpha <= 5) continue;

        const red = data[dataIndex];
        const green = data[dataIndex + 1];
        const blue = data[dataIndex + 2];

        const max = Math.max(red, green, blue);
        const min = Math.min(red, green, blue);
        const average = (red + green + blue) / 3;

        const brightNeutral = average >= threshold && max - min <= 55;
        const transparentNeighbor =
          data[((y - 1) * canvas.width + x) * 4 + 3] <= 5 ||
          data[((y + 1) * canvas.width + x) * 4 + 3] <= 5 ||
          data[(y * canvas.width + x - 1) * 4 + 3] <= 5 ||
          data[(y * canvas.width + x + 1) * 4 + 3] <= 5;

        if (brightNeutral && transparentNeighbor) {
          nextAlpha[pixelIndex] = 0;
        }
      }
    }

    for (let i = 0; i < nextAlpha.length; i++) {
      data[i * 4 + 3] = nextAlpha[i];
    }

    context.putImageData(imageData, 0, 0);
  }
}

function drawNormalizedFramePreview(
  canvas: HTMLCanvasElement,
  options: {
    frame: SpriteFrame;
    row: AnimationRow | null;
    frameSize: number;
    normalizeMode: NormalizeMode;
    globalScale: number;
    feetX: number;
    feetY: number;
    collisionRadius: number;
    collisionOffsetY: number;
    showGuides: boolean;
  }
) {
  const scale = Math.max(3, Math.floor(320 / options.frameSize));

  canvas.width = options.frameSize * scale;
  canvas.height = options.frameSize * scale;

  const context = canvas.getContext("2d");
  if (!context) return;

  context.imageSmoothingEnabled = false;
  drawCheckerboard(context, canvas.width, canvas.height, 16);

  context.save();
  context.scale(scale, scale);

  drawFrameIntoCell(context, {
    frame: options.frame,
    row: options.row,
    frameSize: options.frameSize,
    normalizeMode: options.normalizeMode,
    globalScale: options.globalScale,
    feetX: options.feetX,
    feetY: options.feetY,
    cellX: 0,
    cellY: 0,
  });

  if (options.showGuides) {
    drawGuides(context, options);
  }

  context.restore();
}

function drawRowAlignmentSheet(
  canvas: HTMLCanvasElement,
  options: {
    row: AnimationRow;
    frameSize: number;
    columns: number;
    normalizeMode: NormalizeMode;
    globalScale: number;
    feetX: number;
    feetY: number;
    collisionRadius: number;
    collisionOffsetY: number;
    showGuides: boolean;
  }
) {
  const visibleFrames = options.row.frames.slice(0, options.columns);
  const previewScale = Math.max(2, Math.floor(160 / options.frameSize));

  canvas.width = Math.max(1, options.frameSize * visibleFrames.length * previewScale);
  canvas.height = options.frameSize * previewScale;

  const context = canvas.getContext("2d");
  if (!context) return;

  context.imageSmoothingEnabled = false;
  drawCheckerboard(context, canvas.width, canvas.height, 16);

  context.save();
  context.scale(previewScale, previewScale);

  visibleFrames.forEach((frame, index) => {
    const cellX = index * options.frameSize;

    drawFrameIntoCell(context, {
      frame,
      row: options.row,
      frameSize: options.frameSize,
      normalizeMode: options.normalizeMode,
      globalScale: options.globalScale,
      feetX: options.feetX,
      feetY: options.feetY,
      cellX,
      cellY: 0,
    });

    context.strokeStyle = "rgba(255,255,255,0.35)";
    context.strokeRect(
      cellX + 0.5,
      0.5,
      options.frameSize - 1,
      options.frameSize - 1
    );

    if (options.showGuides) {
      drawGuidesAtCell(context, {
        cellX,
        cellY: 0,
        frameSize: options.frameSize,
        feetX: options.feetX,
        feetY: options.feetY,
        collisionRadius: options.collisionRadius,
        collisionOffsetY: options.collisionOffsetY,
      });
    }

    context.fillStyle = "rgba(255,255,255,0.75)";
    context.font = "8px sans-serif";
    context.fillText(String(index), cellX + 3, 10);
  });

  context.restore();
}

function drawSpriteSheet(
  canvas: HTMLCanvasElement,
  options: {
    rows: AnimationRow[];
    frameSize: number;
    columns: number;
    normalizeMode: NormalizeMode;
    globalScale: number;
    feetX: number;
    feetY: number;
    drawGrid: boolean;
  }
) {
  canvas.width = options.frameSize * options.columns;
  canvas.height = options.frameSize * options.rows.length;

  const context = canvas.getContext("2d");
  if (!context) return;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = false;

  for (let rowIndex = 0; rowIndex < options.rows.length; rowIndex++) {
    const row = options.rows[rowIndex];

    for (
      let columnIndex = 0;
      columnIndex < Math.min(row.frames.length, options.columns);
      columnIndex++
    ) {
      const frame = row.frames[columnIndex];

      drawFrameIntoCell(context, {
        frame,
        row,
        frameSize: options.frameSize,
        normalizeMode: options.normalizeMode,
        globalScale: options.globalScale,
        feetX: options.feetX,
        feetY: options.feetY,
        cellX: columnIndex * options.frameSize,
        cellY: rowIndex * options.frameSize,
      });
    }
  }

  if (options.drawGrid) {
    context.strokeStyle = "rgba(255,255,255,0.18)";
    context.lineWidth = 1;

    for (let x = 0; x <= canvas.width; x += options.frameSize) {
      context.beginPath();
      context.moveTo(x + 0.5, 0);
      context.lineTo(x + 0.5, canvas.height);
      context.stroke();
    }

    for (let y = 0; y <= canvas.height; y += options.frameSize) {
      context.beginPath();
      context.moveTo(0, y + 0.5);
      context.lineTo(canvas.width, y + 0.5);
      context.stroke();
    }
  }
}

function drawFrameIntoCell(
  context: CanvasRenderingContext2D,
  options: {
    frame: SpriteFrame;
    row: AnimationRow | null;
    frameSize: number;
    normalizeMode: NormalizeMode;
    globalScale: number;
    feetX: number;
    feetY: number;
    cellX: number;
    cellY: number;
  }
) {
  const {
    frame,
    row,
    frameSize,
    normalizeMode,
    globalScale,
    feetX,
    feetY,
    cellX,
    cellY,
  } = options;

  const source = frame.editCanvas;
  const bounds = getFrameBoundsForDrawing(frame, row, normalizeMode);

  const maxVisibleWidth = frameSize * 0.72;
  const maxVisibleHeight = frameSize * 0.84;

  const baseScale = Math.min(
    maxVisibleWidth / bounds.width,
    maxVisibleHeight / bounds.height
  );

  const finalScale = baseScale * frame.scale * globalScale;

  const drawWidth = bounds.width * finalScale;
  const drawHeight = bounds.height * finalScale;

  const x = cellX + feetX - drawWidth / 2 + frame.offsetX;
  const y = cellY + feetY - drawHeight + frame.offsetY;

  context.drawImage(
    source,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    x,
    y,
    drawWidth,
    drawHeight
  );
}

function drawGuides(
  context: CanvasRenderingContext2D,
  options: {
    frameSize: number;
    feetX: number;
    feetY: number;
    collisionRadius: number;
    collisionOffsetY: number;
  }
) {
  drawGuidesAtCell(context, {
    cellX: 0,
    cellY: 0,
    ...options,
  });
}

function drawGuidesAtCell(
  context: CanvasRenderingContext2D,
  options: {
    cellX: number;
    cellY: number;
    frameSize: number;
    feetX: number;
    feetY: number;
    collisionRadius: number;
    collisionOffsetY: number;
  }
) {
  context.save();

  context.strokeStyle = "rgba(255, 255, 255, 0.5)";
  context.strokeRect(
    options.cellX + 0.5,
    options.cellY + 0.5,
    options.frameSize - 1,
    options.frameSize - 1
  );

  context.strokeStyle = "rgba(52, 211, 153, 0.95)";
  context.beginPath();
  context.moveTo(options.cellX + options.feetX - 5, options.cellY + options.feetY);
  context.lineTo(options.cellX + options.feetX + 5, options.cellY + options.feetY);
  context.moveTo(options.cellX + options.feetX, options.cellY + options.feetY - 5);
  context.lineTo(options.cellX + options.feetX, options.cellY + options.feetY + 5);
  context.stroke();

  context.strokeStyle = "rgba(96, 165, 250, 0.95)";
  context.beginPath();
  context.arc(
    options.cellX + options.frameSize / 2,
    options.cellY + options.frameSize / 2 + options.collisionOffsetY,
    options.collisionRadius,
    0,
    Math.PI * 2
  );
  context.stroke();

  context.restore();
}

function drawCheckerboard(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  cellSize: number
) {
  context.clearRect(0, 0, width, height);

  for (let y = 0; y < height; y += cellSize) {
    for (let x = 0; x < width; x += cellSize) {
      const even = (x / cellSize + y / cellSize) % 2 === 0;
      context.fillStyle = even ? "#202636" : "#161b27";
      context.fillRect(x, y, cellSize, cellSize);
    }
  }
}

function createMetadata(options: {
  assetId: string;
  rows: AnimationRow[];
  frameSize: number;
  columns: number;
  feetX: number;
  feetY: number;
  collisionRadius: number;
  collisionOffsetY: number;
}) {
  let frameOffset = 0;

  const animations: Record<string, unknown> = {};

  for (const row of options.rows) {
    const frameCount = Math.min(row.frames.length, options.columns);

    animations[row.name] = {
      frames: Array.from({ length: frameCount }, (_, index) => frameOffset + index),
      frameRate: row.frameRate,
      repeat: -1,
    };

    frameOffset += options.columns;
  }

  return {
    id: options.assetId,
    image: `${options.assetId}_sheet_${options.frameSize}x${options.frameSize}.png`,
    frameWidth: options.frameSize,
    frameHeight: options.frameSize,
    columns: options.columns,
    rows: options.rows.length,
    origin: {
      x: 0.5,
      y: 0.5,
    },
    feetAnchor: {
      x: options.feetX,
      y: options.feetY,
    },
    collision: {
      type: "circle",
      radius: options.collisionRadius,
      offsetX: 0,
      offsetY: options.collisionOffsetY,
    },
    animations,
  };
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();

  link.remove();
  URL.revokeObjectURL(url);
}

export default App;