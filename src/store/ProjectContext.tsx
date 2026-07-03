/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { AppSettings, AssetWorkbenchMode, AssetWorkbenchProject, SinglePngExportSettings } from "../app/project/ProjectTypes";
import { loadProject, loadSettings, saveProject, saveSettings } from "../app/project/ProjectStore";

// Type definitions from App.tsx
export type Bounds = { x: number; y: number; width: number; height: number; };
export type SpriteFrame = { id: string; assetId?: string; fileName: string; image: HTMLImageElement; originalCanvas: HTMLCanvasElement; editCanvas: HTMLCanvasElement; scale: number; offsetX: number; offsetY: number; };
export type AnimationRow = { id: string; name: string; frameRate: number; frames: SpriteFrame[]; lockedCrop: Bounds | null; };
export type BrushMode = "erase" | "restore" | "pick" | "pan" | "pencil";
export type HistoryChange = { frameId: string; beforeDataUrl: string; afterDataUrl: string; };
export type HistoryEntry = { id: string; label: string; createdAt: string; changes: HistoryChange[]; };
export type NormalizeMode = "auto" | "locked-row";
export type SinglePngPreset = { label: string; width: number; height: number };
export type PointerPreview = { visible: boolean; x: number; y: number; sourceX: number; sourceY: number; };
export type ImportCandidate = { id: string; file: File; url: string; selected: boolean; };

export const FRAME_SIZES = [32, 48, 64, 96, 128, 192];
export const DEFAULT_COLUMNS = 6;
export const EDITOR_ZOOM_LEVELS = [0.25, 0.5, 1, 2, 4, 8];

export const SINGLE_PNG_PRESETS: SinglePngPreset[] = [
  { label: "64×64 icon", width: 64, height: 64 },
  { label: "96×96 icon", width: 96, height: 96 },
  { label: "128×128 icon", width: 128, height: 128 },
  { label: "320×80 button", width: 320, height: 80 },
  { label: "420×96 button", width: 420, height: 96 },
  { label: "512×320 panel", width: 512, height: 320 },
  { label: "900×620 large panel", width: 900, height: 620 },
];

export const DEFAULT_SINGLE_PNG: SinglePngExportSettings = {
  width: 420, height: 96, preset: "420×96 button", fitMode: "contain",
  scale: 1, xOffset: 0, yOffset: 0, anchor: "center",
  background: "transparent", backgroundColor: "#ffffff",
};

export function getFrameGuideDefaults(size: number) {
  return { feetX: Math.floor(size / 2), feetY: Math.floor(size * 0.82), collisionRadius: Math.max(6, Math.floor(size * 0.19)), collisionOffsetY: Math.floor(size * 0.15), };
}
export function createId() { return crypto.randomUUID(); }
export function colorToHex(color: [number, number, number] | null) { if (!color) return null; return `#${color.map((value) => value.toString(16).padStart(2, "0")).join("")}`; }
export function hexToColor(hex: string | null): [number, number, number] | null { if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return null; return [ Number.parseInt(hex.slice(1, 3), 16), Number.parseInt(hex.slice(3, 5), 16), Number.parseInt(hex.slice(5, 7), 16), ]; }
export function rgbToHex(red: number, green: number, blue: number) { return "#" + [red, green, blue].map((value) => Math.round(value).toString(16).padStart(2, "0")).join(""); }
export function sampleAverageColor(context: CanvasRenderingContext2D, centerX: number, centerY: number, sampleSize: number, width: number, height: number): [number, number, number] { const radius = Math.floor(sampleSize / 2); let red = 0; let green = 0; let blue = 0; let count = 0; for (let y = centerY - radius; y <= centerY + radius; y++) { for (let x = centerX - radius; x <= centerX + radius; x++) { if (x < 0 || y < 0 || x >= width || y >= height) continue; const pixel = context.getImageData(x, y, 1, 1).data; red += pixel[0]; green += pixel[1]; blue += pixel[2]; count += 1; } } if (count === 0) return [0, 0, 0]; return [Math.round(red / count), Math.round(green / count), Math.round(blue / count)]; }

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function useProjectState() {

  const [assetId, setAssetId] = useState("zarathustra");
  const [frameSize, setFrameSize] = useState(64);
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [assets, setAssets] = useState<SpriteFrame[]>([]);
  const [appMode, setAppMode] = useState<AssetWorkbenchMode>("spritesheet");
  const [projectName, setProjectName] = useState("Zarathustra Asset Workbench");
  const [projectCreatedAt, setProjectCreatedAt] = useState(() => new Date().toISOString());
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState("No project saved yet.");
  const [settings] = useState<AppSettings>(() => loadSettings());
  const [singlePng, setSinglePng] = useState<SinglePngExportSettings>(DEFAULT_SINGLE_PNG);
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
  const [editorZoom, setEditorZoom] = useState(1);
  const [showLoupe, setShowLoupe] = useState(true);
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);
  const [spritesheetToSlice, setSpritesheetToSlice] = useState<ImportCandidate | null>(null);
  const [importCandidates, setImportCandidates] = useState<ImportCandidate[]>([]);
  const [activeImportId, setActiveImportId] = useState<string | null>(null);

  const [showGuides, setShowGuides] = useState(true);
  const [previewTick, setPreviewTick] = useState(0);
  const [pointerPreview, setPointerPreview] = useState<PointerPreview | null>(null);
  const editorScrollRef = useRef<HTMLDivElement | null>(null);
  const editorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const framePreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rowAlignmentCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sheetPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const singlePngPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const isPaintingRef = useRef(false);
  const activePaintHistoryRef = useRef<{ frameId: string; beforeDataUrl: string } | null>(null);
  const isPanningRef = useRef(false);
  const spacePanRef = useRef(false);
  const panStartRef = useRef({ pointerX: 0, pointerY: 0, scrollLeft: 0, scrollTop: 0 });

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
    void hydrateSavedProject();
  }, []);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

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
    editorZoom,
    singlePng,
    appMode,
  ]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT";

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        handleSaveProject();
      }

      if (!isTyping && event.key === " ") {
        event.preventDefault();
        spacePanRef.current = true;
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key === " ") {
        spacePanRef.current = false;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [undoStack, redoStack, rows, selectedFrame, brushMode]);

  function updateSinglePng(patch: Partial<SinglePngExportSettings>) {
    setSinglePng((current) => ({ ...current, ...patch }));
  }

  function findFrameById(frameId: string) {
    for (const row of rows) {
      const frame = row.frames.find((item) => item.id === frameId);
      if (frame) return frame;
    }

    return null;
  }

  function snapshotFrames(frames: SpriteFrame[]) {
    return frames.map((frame) => ({
      frameId: frame.id,
      beforeDataUrl: frame.editCanvas.toDataURL("image/png"),
    }));
  }

  function pushHistory(label: string, changes: HistoryChange[]) {
    if (changes.length === 0) return;

    setUndoStack((current) => [
      ...current.slice(-49),
      {
        id: createId(),
        label,
        createdAt: new Date().toISOString(),
        changes,
      },
    ]);
    setRedoStack([]);
  }

  async function restoreFrameDataUrl(frameId: string, dataUrl: string) {
    const frame = findFrameById(frameId);
    if (!frame) return;

    const image = await loadImageFromDataUrl(dataUrl);
    const context = frame.editCanvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, frame.editCanvas.width, frame.editCanvas.height);
    context.drawImage(image, 0, 0, frame.editCanvas.width, frame.editCanvas.height);
  }

  async function restoreHistoryEntry(entry: HistoryEntry, direction: "undo" | "redo") {
    for (const change of entry.changes) {
      await restoreFrameDataUrl(
        change.frameId,
        direction === "undo" ? change.beforeDataUrl : change.afterDataUrl
      );
    }

    forceRerenderRows();
  }

  function undo() {
    const entry = undoStack[undoStack.length - 1];
    if (!entry) return;

    void restoreHistoryEntry(entry, "undo");
    setUndoStack((current) => current.slice(0, -1));
    setRedoStack((current) => [...current, entry]);
  }

  function redo() {
    const entry = redoStack[redoStack.length - 1];
    if (!entry) return;

    void restoreHistoryEntry(entry, "redo");
    setRedoStack((current) => current.slice(0, -1));
    setUndoStack((current) => [...current, entry]);
  }

  function commitCanvasHistory(label: string, before: { frameId: string; beforeDataUrl: string }[]) {
    const changes = before
      .map((snapshot) => {
        const frame = findFrameById(snapshot.frameId);
        if (!frame) return null;

        return {
          frameId: snapshot.frameId,
          beforeDataUrl: snapshot.beforeDataUrl,
          afterDataUrl: frame.editCanvas.toDataURL("image/png"),
        };
      })
      .filter((change): change is HistoryChange => change !== null)
      .filter((change) => change.beforeDataUrl !== change.afterDataUrl);

    pushHistory(label, changes);
  }

  function createNewProject() {
    const idleRow: AnimationRow = { id: createId(), name: "idle", frameRate: 6, frames: [], lockedCrop: null };
    const walkRow: AnimationRow = { id: createId(), name: "walk", frameRate: 10, frames: [], lockedCrop: null };
    const guideDefaults = getFrameGuideDefaults(64);

    setProjectName("Zarathustra Asset Workbench");
    setProjectCreatedAt(new Date().toISOString());
    setLastSavedAt(null);
    setSaveStatus("New unsaved project.");
    setRows([idleRow, walkRow]);
    setSelectedRowId(idleRow.id);
    setSelectedFrameId(null);
    setFrameSize(64);
    setFeetX(guideDefaults.feetX);
    setFeetY(guideDefaults.feetY);
    setCollisionRadius(guideDefaults.collisionRadius);
    setCollisionOffsetY(guideDefaults.collisionOffsetY);
    setUndoStack([]);
    setRedoStack([]);
  }

  function stepEditorZoom(direction: -1 | 1) {
    const currentIndex = EDITOR_ZOOM_LEVELS.findIndex((value) => value === editorZoom);
    const fallbackIndex = EDITOR_ZOOM_LEVELS.reduce((best, value, index) => {
      return Math.abs(value - editorZoom) < Math.abs(EDITOR_ZOOM_LEVELS[best] - editorZoom) ? index : best;
    }, 0);
    const index = currentIndex >= 0 ? currentIndex : fallbackIndex;
    const next = Math.min(EDITOR_ZOOM_LEVELS.length - 1, Math.max(0, index + direction));
    setEditorZoom(EDITOR_ZOOM_LEVELS[next]);
  }

  function applySinglePngPreset(label: string) {
    if (label === "Custom") {
      updateSinglePng({ preset: "Custom" });
      return;
    }

    const preset = SINGLE_PNG_PRESETS.find((item) => item.label === label);
    if (!preset) return;

    updateSinglePng({
      preset: preset.label,
      width: preset.width,
      height: preset.height,
    });
  }

  function buildProjectSnapshot(): AssetWorkbenchProject {
    const now = new Date().toISOString();

    return {
      version: 1,
      name: projectName,
      createdAt: projectCreatedAt,
      updatedAt: now,
      mode: appMode,
      assetId,
      canvas: {
        frameWidth: frameSize,
        frameHeight: frameSize,
        columns,
        rows: rows.length,
        padding: 0,
        background: "transparent",
      },
      singlePng,
      backgroundRemoval: {
        pickedColor: colorToHex(pickedColor),
        tolerance: colorTolerance,
        softness: settings.featherPx,
        edgeCleanup: haloThreshold,
        removeWhiteFringe: true,
        removeWhiteThreshold,
        checkerBrightness,
        checkerNeutrality,
        haloThreshold,
      },
      spritesheet: {
        normalizeMode,
        globalScale,
        feetX,
        feetY,
        collisionRadius,
        collisionOffsetY,
        showGuides,
        assets: assets.map((asset) => ({
          id: asset.id,
          name: asset.fileName,
          imageDataUrl: asset.originalCanvas.toDataURL("image/png"),
          cleanedImageDataUrl: asset.editCanvas.toDataURL("image/png"),
        })),
        rows: rows.map((row) => ({
          id: row.id,
          name: row.name,
          frameRate: row.frameRate,
          lockedCrop: row.lockedCrop,
          frames: row.frames.map((frame) => ({
            id: frame.id,
            assetId: frame.assetId ?? frame.id,
            xOffset: frame.offsetX,
            yOffset: frame.offsetY,
            scale: frame.scale,
            rotation: 0,
            visible: true,
          })),
        })),
      },
      exports: {},
    };
  }

  function handleSaveProject() {
    const project = buildProjectSnapshot();
    saveProject(project);
    setLastSavedAt(project.updatedAt);
    setSaveStatus(`Saved locally at ${new Date(project.updatedAt).toLocaleTimeString()}.`);
  }

  async function hydrateSavedProject() {
    const project = loadProject();
    if (!project) return;

    try {
      await applyProject(project);
      setSaveStatus(`Loaded local project: ${project.name}.`);
    } catch (error) {
      console.error(error);
      setSaveStatus("Could not load the saved local project.");
    }
  }

  async function applyProject(project: AssetWorkbenchProject) {
    const loadedAssets = project.spritesheet.assets 
      ? await Promise.all(project.spritesheet.assets.map(savedAssetToSpriteFrame))
      : [];

    const loadedRows = await Promise.all(
      project.spritesheet.rows.map(async (row) => ({
        id: row.id,
        name: row.name,
        frameRate: row.frameRate,
        lockedCrop: row.lockedCrop,
        frames: await Promise.all(row.frames.map(async (frame) => {
          // Backward compatibility for old projects
          if ('imageDataUrl' in frame) {
            return await savedFrameToSpriteFrame(frame as any);
          }
          const asset = loadedAssets.find(a => a.id === frame.assetId);
          if (!asset) throw new Error("Missing asset");
          return {
            ...asset,
            id: frame.id,
            assetId: frame.assetId,
            scale: frame.scale,
            offsetX: frame.xOffset,
            offsetY: frame.yOffset
          };
        })),
      }))
    );

    setProjectName(project.name);
    setProjectCreatedAt(project.createdAt);
    setLastSavedAt(project.updatedAt);
    setAppMode(project.mode);
    setAssetId(project.assetId);
    setFrameSize(project.canvas.frameWidth);
    setColumns(project.canvas.columns);
    setSinglePng(project.singlePng ?? DEFAULT_SINGLE_PNG);
    setNormalizeMode(project.spritesheet.normalizeMode);
    setGlobalScale(project.spritesheet.globalScale);
    setFeetX(project.spritesheet.feetX);
    setFeetY(project.spritesheet.feetY);
    setCollisionRadius(project.spritesheet.collisionRadius);
    setCollisionOffsetY(project.spritesheet.collisionOffsetY);
    setShowGuides(project.spritesheet.showGuides);
    setPickedColor(hexToColor(project.backgroundRemoval.pickedColor));
    setColorTolerance(project.backgroundRemoval.tolerance);
    setRemoveWhiteThreshold(project.backgroundRemoval.removeWhiteThreshold);
    setCheckerBrightness(project.backgroundRemoval.checkerBrightness);
    setCheckerNeutrality(project.backgroundRemoval.checkerNeutrality);
    setHaloThreshold(project.backgroundRemoval.haloThreshold);
    setAssets(loadedAssets);
    setRows(loadedRows.length > 0 ? loadedRows : [{ id: createId(), name: "idle", frameRate: 6, frames: [], lockedCrop: null }]);
    setSelectedRowId(loadedRows[0]?.id ?? null);
    setSelectedFrameId(loadedRows[0]?.frames[0]?.id ?? null);
  }

  function exportProjectJson() {
    const project = buildProjectSnapshot();
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    downloadBlob(blob, `${project.name.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}.assetworkbench`);
  }

  async function importProjectJson(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    try {
      const project = JSON.parse(await file.text()) as AssetWorkbenchProject;
      await applyProject(project);
      saveProject(project);
      setSaveStatus(`Imported ${file.name} and saved it locally.`);
    } catch (error) {
      console.error(error);
      setSaveStatus("Could not import that .assetworkbench file.");
    }
  }



  
  function stageSpritesheet(file: File) {
    if (!file.type.startsWith("image/") && !/\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)) {
      setSaveStatus("Unsupported image file for slicing.");
      return;
    }
    setSpritesheetToSlice({
      id: createId(),
      file,
      url: URL.createObjectURL(file),
      selected: true,
    });
  }

  function cancelSpritesheetSlice() {
    if (spritesheetToSlice) {
      URL.revokeObjectURL(spritesheetToSlice.url);
      setSpritesheetToSlice(null);
    }
  }

  async function sliceAndImportSpritesheet(
    framesToExtract: { r: number, c: number, startX: number, startY: number, endX: number, endY: number }[], 
    skipEmpty: boolean, 
    autoCenter: boolean, 
    removeWhiteBg: boolean
  ) {
    if (!spritesheetToSlice || framesToExtract.length === 0) return;

    const image = await loadImage(spritesheetToSlice.file);
    const imgW = image.naturalWidth;
    const imgH = image.naturalHeight;

    const newFrames: SpriteFrame[] = [];

    for (const frame of framesToExtract) {
      const pxStartX = Math.floor(frame.startX * imgW);
      const pxEndX = Math.floor(frame.endX * imgW);
      const pxStartY = Math.floor(frame.startY * imgH);
      const pxEndY = Math.floor(frame.endY * imgH);
      
      const frameWidth = pxEndX - pxStartX;
      const frameHeight = pxEndY - pxStartY;

      if (frameWidth <= 0 || frameHeight <= 0) continue;

      const originalCanvas = document.createElement("canvas");
      originalCanvas.width = frameWidth;
      originalCanvas.height = frameHeight;
      const originalContext = originalCanvas.getContext("2d");
      if (!originalContext) continue;

      originalContext.drawImage(
        image,
        pxStartX, pxStartY, frameWidth, frameHeight,
        0, 0, frameWidth, frameHeight
      );

      if (removeWhiteBg) {
        removeNearWhite(originalCanvas, 246);
      }

      let minX = frameWidth, minY = frameHeight, maxX = 0, maxY = 0;
      const imgData = originalContext.getImageData(0, 0, frameWidth, frameHeight).data;
      let isEmpty = true;
      
      for (let y = 0; y < frameHeight; y++) {
        for (let x = 0; x < frameWidth; x++) {
          const i = (y * frameWidth + x) * 4;
          if (imgData[i + 3] > 0) {
            isEmpty = false;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (skipEmpty && isEmpty) continue;

      const editCanvas = document.createElement("canvas");
      editCanvas.width = frameWidth;
      editCanvas.height = frameHeight;
      const editContext = editCanvas.getContext("2d");
      if (!editContext) continue;

      if (autoCenter && !isEmpty) {
        const contentWidth = maxX - minX + 1;
        const contentHeight = Math.max(1, maxY - minY + 1);
        const targetX = Math.floor((frameWidth - contentWidth) / 2);
        const targetY = Math.floor((frameHeight - contentHeight) / 2);
        
        const centeredCanvas = document.createElement("canvas");
        centeredCanvas.width = frameWidth;
        centeredCanvas.height = frameHeight;
        const centeredContext = centeredCanvas.getContext("2d");
        if (centeredContext) {
          centeredContext.drawImage(
            originalCanvas,
            minX, minY, contentWidth, contentHeight,
            targetX, targetY, contentWidth, contentHeight
          );
          originalContext.clearRect(0, 0, frameWidth, frameHeight);
          originalContext.drawImage(centeredCanvas, 0, 0);
        }
      }
      
      editContext.drawImage(originalCanvas, 0, 0);

      newFrames.push({
        id: createId(),
        fileName: `${spritesheetToSlice.file.name.replace(/\.[^.]+$/, "")}_${frame.r}_${frame.c}`,
        image,
          originalCanvas,
          editCanvas,
          scale: 1,
          offsetX: 0,
          offsetY: 0,
        });
      }

    setAssets((current) => [...current, ...newFrames]);

    cancelSpritesheetSlice();
    setSaveStatus(`Imported ${newFrames.length} sliced frames into the Asset Library.`);
    
    if (!selectedFrameId && newFrames[0]) {
      setSelectedFrameId(newFrames[0].id);
    }
  }

  function stageImportFiles(files: FileList | File[]) {
    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)
    );

    if (imageFiles.length === 0) {
      setSaveStatus("No supported image files were selected.");
      return;
    }

    setImportCandidates((current) => {
      for (const candidate of current) URL.revokeObjectURL(candidate.url);

      return imageFiles.map((file, index) => ({
        id: createId(),
        file,
        url: URL.createObjectURL(file),
        selected: index === 0,
      }));
    });

    setActiveImportId(null);
    setSaveStatus(`Previewing ${imageFiles.length} image${imageFiles.length === 1 ? "" : "s"}. Select the frames you want, then import them.`);
  }

  function handleFrameSizeChange(size: number) {
    const guideDefaults = getFrameGuideDefaults(size);

    setFrameSize(size);
    setFeetX(guideDefaults.feetX);
    setFeetY(guideDefaults.feetY);
    setCollisionRadius(guideDefaults.collisionRadius);
    setCollisionOffsetY(guideDefaults.collisionOffsetY);
  }

  function clearImportCandidates() {
    setImportCandidates((current) => {
      for (const candidate of current) URL.revokeObjectURL(candidate.url);
      return [];
    });
    setActiveImportId(null);
  }

  function toggleImportCandidate(candidateId: string) {
    setImportCandidates((current) =>
      current.map((candidate) =>
        candidate.id === candidateId ? { ...candidate, selected: !candidate.selected } : candidate
      )
    );
  }

  function setAllImportCandidates(selected: boolean) {
    setImportCandidates((current) => current.map((candidate) => ({ ...candidate, selected })));
  }

  async function importSelectedCandidates() {
    const selectedFiles = importCandidates
      .filter((candidate) => candidate.selected)
      .map((candidate) => candidate.file);

    if (selectedFiles.length === 0) {
      setSaveStatus("Select at least one preview image before importing.");
      return;
    }

    const newFrames = await Promise.all(selectedFiles.map(fileToSpriteFrame));
    setAssets((current) => [...current, ...newFrames]);
    setSaveStatus(`Imported ${selectedFiles.length} image${selectedFiles.length === 1 ? "" : "s"} into the Asset Library.`);
    clearImportCandidates();
  }

  function addAssetToRow(assetId: string, rowId: string) {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;

    const newFrame = { ...asset, id: createId() };
    setRows((current) =>
      current.map((row) =>
        row.id === rowId ? { ...row, frames: [...row.frames, newFrame] } : row
      )
    );
    if (!selectedFrameId) {
      setSelectedFrameId(newFrame.id);
    }
  }

  function deleteAsset(assetId: string) {
    setAssets((current) => current.filter((a) => a.id !== assetId));
    // Optionally remove instances of this asset from rows
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

  function flipFrameHorizontal() {
    if (!selectedFrame) return;

    const editBefore = selectedFrame.editCanvas.toDataURL();

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = selectedFrame.editCanvas.width;
    tempCanvas.height = selectedFrame.editCanvas.height;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    tempCtx.drawImage(selectedFrame.editCanvas, 0, 0);
    const editCtx = selectedFrame.editCanvas.getContext("2d");
    if (editCtx) {
      editCtx.clearRect(0, 0, selectedFrame.editCanvas.width, selectedFrame.editCanvas.height);
      editCtx.save();
      editCtx.scale(-1, 1);
      editCtx.translate(-selectedFrame.editCanvas.width, 0);
      editCtx.drawImage(tempCanvas, 0, 0);
      editCtx.restore();
    }

    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.drawImage(selectedFrame.originalCanvas, 0, 0);
    const origCtx = selectedFrame.originalCanvas.getContext("2d");
    if (origCtx) {
      origCtx.clearRect(0, 0, selectedFrame.originalCanvas.width, selectedFrame.originalCanvas.height);
      origCtx.save();
      origCtx.scale(-1, 1);
      origCtx.translate(-selectedFrame.originalCanvas.width, 0);
      origCtx.drawImage(tempCanvas, 0, 0);
      origCtx.restore();
    }

    pushHistory("Flip Horizontal", [{
      frameId: selectedFrame.id,
      beforeDataUrl: editBefore,
      afterDataUrl: selectedFrame.editCanvas.toDataURL(),
    }]);

    setPreviewTick((t) => t + 1);
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
    const before = snapshotFrames([selectedFrame]);
    removeNearWhite(selectedFrame.editCanvas, removeWhiteThreshold);
    commitCanvasHistory("Remove white from selected frame", before);
    forceRerenderRows();
  }

  function applyRemoveNearWhiteToRow() {
    if (!selectedRow) return;
    const before = snapshotFrames(selectedRow.frames);

    for (const frame of selectedRow.frames) {
      removeNearWhite(frame.editCanvas, removeWhiteThreshold);
    }

    commitCanvasHistory("Remove white from row", before);
    forceRerenderRows();
  }

  function applyPickedColorToSelected() {
    if (!selectedFrame || !pickedColor) return;
    const before = snapshotFrames([selectedFrame]);
    removeColor(selectedFrame.editCanvas, pickedColor, colorTolerance);
    commitCanvasHistory("Remove picked color from selected frame", before);
    forceRerenderRows();
  }

  function applyPickedColorToRow() {
    if (!selectedRow || !pickedColor) return;
    const before = snapshotFrames(selectedRow.frames);

    for (const frame of selectedRow.frames) {
      removeColor(frame.editCanvas, pickedColor, colorTolerance);
    }

    commitCanvasHistory("Remove picked color from row", before);
    forceRerenderRows();
  }

  function applyCheckerBgToSelected() {
    if (!selectedFrame) return;
    const before = snapshotFrames([selectedFrame]);

    removeConnectedLightBackground(selectedFrame.editCanvas, {
      brightness: checkerBrightness,
      neutrality: checkerNeutrality,
    });

    commitCanvasHistory("Remove checker background from selected frame", before);
    forceRerenderRows();
  }

  function applyCheckerBgToRow() {
    if (!selectedRow) return;
    const before = snapshotFrames(selectedRow.frames);

    for (const frame of selectedRow.frames) {
      removeConnectedLightBackground(frame.editCanvas, {
        brightness: checkerBrightness,
        neutrality: checkerNeutrality,
      });
    }

    commitCanvasHistory("Remove checker background from row", before);
    forceRerenderRows();
  }

  function applyHaloToSelected() {
    if (!selectedFrame) return;
    const before = snapshotFrames([selectedFrame]);
    removeWhiteHalo(selectedFrame.editCanvas, haloThreshold, 2);
    commitCanvasHistory("Remove halo from selected frame", before);
    forceRerenderRows();
  }

  function applyHaloToRow() {
    if (!selectedRow) return;
    const before = snapshotFrames(selectedRow.frames);

    for (const frame of selectedRow.frames) {
      removeWhiteHalo(frame.editCanvas, haloThreshold, 2);
    }

    commitCanvasHistory("Remove halo from row", before);
    forceRerenderRows();
  }

  function safeCleanupSelected() {
    if (!selectedFrame) return;
    const before = snapshotFrames([selectedFrame]);
    runSafeCleanup(selectedFrame.editCanvas);
    commitCanvasHistory("Safe cleanup selected frame", before);
    forceRerenderRows();
  }

  function safeCleanupRow() {
    if (!selectedRow) return;
    const before = snapshotFrames(selectedRow.frames);

    for (const frame of selectedRow.frames) {
      runSafeCleanup(frame.editCanvas);
    }

    commitCanvasHistory("Safe cleanup row", before);
    forceRerenderRows();
  }

  function strongCleanupSelected() {
    if (!selectedFrame) return;
    const before = snapshotFrames([selectedFrame]);
    runStrongCleanup(selectedFrame.editCanvas);
    commitCanvasHistory("Strong cleanup selected frame", before);
    forceRerenderRows();
  }

  function strongCleanupRow() {
    if (!selectedRow) return;
    const before = snapshotFrames(selectedRow.frames);

    for (const frame of selectedRow.frames) {
      runStrongCleanup(frame.editCanvas);
    }

    commitCanvasHistory("Strong cleanup row", before);
    forceRerenderRows();
  }

  function resetSelectedFrame() {
    if (!selectedFrame) return;
    const before = snapshotFrames([selectedFrame]);

    const context = selectedFrame.editCanvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, selectedFrame.editCanvas.width, selectedFrame.editCanvas.height);
    context.drawImage(selectedFrame.originalCanvas, 0, 0);

    commitCanvasHistory("Reset selected frame", before);
    forceRerenderRows();
  }

  function resetSelectedRowFrames() {
    if (!selectedRow) return;
    const before = snapshotFrames(selectedRow.frames);

    for (const frame of selectedRow.frames) {
      const context = frame.editCanvas.getContext("2d");
      if (!context) continue;

      context.clearRect(0, 0, frame.editCanvas.width, frame.editCanvas.height);
      context.drawImage(frame.originalCanvas, 0, 0);
    }

    commitCanvasHistory("Reset selected row images", before);
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

  function drawSinglePngPreview() {
    const canvas = singlePngPreviewCanvasRef.current;
    if (!canvas || !selectedFrame) return;

    const previewScale = Math.min(1, 760 / singlePng.width, 460 / singlePng.height);
    const scale = Math.max(0.15, previewScale);

    canvas.width = Math.max(1, Math.round(singlePng.width * scale));
    canvas.height = Math.max(1, Math.round(singlePng.height * scale));

    const context = canvas.getContext("2d");
    if (!context) return;

    context.imageSmoothingEnabled = false;
    drawCheckerboard(context, canvas.width, canvas.height, 16);

    const exportCanvas = createSinglePngCanvas(selectedFrame, singlePng);
    context.drawImage(exportCanvas, 0, 0, canvas.width, canvas.height);
  }

  function exportSinglePng() {
    if (!selectedFrame) return;

    const canvas = createSinglePngCanvas(selectedFrame, singlePng);
    canvas.toBlob((blob) => {
      if (!blob) return;
      downloadBlob(blob, `${assetId}_${selectedFrame.fileName.replace(/\.[^.]+$/, "")}_${singlePng.width}x${singlePng.height}.png`);
    }, "image/png");
  }

  function drawAll() {
    drawEditorCanvas();
    drawSelectedFramePreview();
    drawAnimationPreview();
    drawRowAlignmentPreview();
    drawSheetPreview();
    drawSinglePngPreview();
  }

  function drawEditorCanvas() {
    const canvas = editorCanvasRef.current;
    if (!canvas || !selectedFrame) return;

    const source = selectedFrame.editCanvas;
    const zoom = Math.max(0.25, editorZoom);

    canvas.width = Math.max(1, Math.round(source.width * zoom));
    canvas.height = Math.max(1, Math.round(source.height * zoom));

    const context = canvas.getContext("2d");
    if (!context) return;

    context.imageSmoothingEnabled = false;
    drawCheckerboard(context, canvas.width, canvas.height, Math.max(8, Math.round(16 * zoom)));
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
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
      x: Math.min(selectedFrame.editCanvas.width - 1, Math.max(0, Math.floor(x))),
      y: Math.min(selectedFrame.editCanvas.height - 1, Math.max(0, Math.floor(y))),
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

    if (brushMode === "pan") return;

    if (brushMode === "pick") {
      const context = selectedFrame.editCanvas.getContext("2d");
      if (!context) return;

      const sampleSize = event.ctrlKey ? 5 : event.shiftKey ? 3 : 1;
      const color = sampleAverageColor(context, point.x, point.y, sampleSize, selectedFrame.editCanvas.width, selectedFrame.editCanvas.height);
      setPickedColor(color);
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

    if (brushMode === "pencil") {
      context.globalCompositeOperation = "source-over";
      if (pickedColor) {
        context.fillStyle = `rgb(${pickedColor[0]}, ${pickedColor[1]}, ${pickedColor[2]})`;
      } else {
        context.fillStyle = "black";
      }
      context.fill();
    }

    context.restore();
    forceRerenderRows();
  }

  function beginPan(event: React.PointerEvent) {
    const scroll = editorScrollRef.current;
    if (!scroll) return;

    isPanningRef.current = true;
    panStartRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      scrollLeft: scroll.scrollLeft,
      scrollTop: scroll.scrollTop,
    };
  }

  function updatePan(event: React.PointerEvent) {
    const scroll = editorScrollRef.current;
    if (!scroll) return;

    const start = panStartRef.current;
    scroll.scrollLeft = start.scrollLeft - (event.clientX - start.pointerX);
    scroll.scrollTop = start.scrollTop - (event.clientY - start.pointerY);
  }

  function handlePointerDown(event: React.PointerEvent) {
    event.currentTarget.setPointerCapture(event.pointerId);

    if (brushMode === "pan" || event.button === 1 || event.altKey || spacePanRef.current) {
      beginPan(event);
      return;
    }

    if (brushMode === "erase" || brushMode === "restore" || brushMode === "pencil") {
      activePaintHistoryRef.current = selectedFrame
        ? { frameId: selectedFrame.id, beforeDataUrl: selectedFrame.editCanvas.toDataURL("image/png") }
        : null;
    }

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

    if (isPanningRef.current) {
      updatePan(event);
      return;
    }

    if (!isPaintingRef.current) return;
    paintAt(event);
  }

  function finishPointerAction() {
    if (isPaintingRef.current && activePaintHistoryRef.current && selectedFrame) {
      commitCanvasHistory("Manual " + brushMode, [activePaintHistoryRef.current]);
    }

    activePaintHistoryRef.current = null;
    isPaintingRef.current = false;
    isPanningRef.current = false;
  }

  function handlePointerUp() {
    finishPointerAction();
  }

  function handlePointerLeave() {
    finishPointerAction();
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

  return {
    assets, setAssets,
    assetId, setAssetId, frameSize, handleFrameSizeChange, columns, setColumns, appMode, setAppMode,
    projectName, setProjectName, projectCreatedAt, lastSavedAt, saveStatus,
    settings, singlePng, updateSinglePng, applySinglePngPreset,
    normalizeMode, setNormalizeMode,
    rows, setRows, selectedRowId, setSelectedRowId, selectedFrameId, setSelectedFrameId,
    selectedRow, selectedFrame,
    globalScale, setGlobalScale, feetX, setFeetX, feetY, setFeetY,
    collisionRadius, setCollisionRadius, collisionOffsetY, setCollisionOffsetY,
    removeWhiteThreshold, setRemoveWhiteThreshold, pickedColor, setPickedColor, colorTolerance, setColorTolerance,
    checkerBrightness, setCheckerBrightness, checkerNeutrality, setCheckerNeutrality, haloThreshold, setHaloThreshold,
    brushMode, setBrushMode, brushSize, setBrushSize, editorZoom, setEditorZoom, stepEditorZoom, showLoupe, setShowLoupe,
    undoStack, redoStack, undo, redo,
    spritesheetToSlice, stageSpritesheet, cancelSpritesheetSlice, sliceAndImportSpritesheet,
    importCandidates, setImportCandidates, activeImportId, setActiveImportId,
    stageImportFiles, clearImportCandidates, toggleImportCandidate, setAllImportCandidates, importSelectedCandidates,
    showGuides, setShowGuides, previewTick, pointerPreview, setPointerPreview,
    editorScrollRef, editorCanvasRef, framePreviewCanvasRef, animationPreviewCanvasRef, rowAlignmentCanvasRef, sheetPreviewCanvasRef, singlePngPreviewCanvasRef,
    handleSaveProject, exportProjectJson, importProjectJson, createNewProject,
    addRow, deleteRow, renameRow, updateRowFrameRate, deleteFrame, moveFrame, addAssetToRow, deleteAsset, flipFrameHorizontal,
    applyRemoveNearWhiteToSelected, applyRemoveNearWhiteToRow,
    applyPickedColorToSelected, applyPickedColorToRow,
    applyCheckerBgToSelected, applyCheckerBgToRow,
    applyHaloToSelected, applyHaloToRow,
    safeCleanupSelected, safeCleanupRow, strongCleanupSelected, strongCleanupRow,
    resetSelectedFrame, resetSelectedRowFrames, resetSelectedFrameTransform, applySelectedTransformToRow,
    updateSelectedFramePatch,
    lockCropFromSelectedFrame, lockCropFromRowUnion, clearSelectedRowCrop,
    exportSinglePng, exportSheet, exportMeta, copyPhaserSnippet,
    handlePointerDown, handlePointerMove, handlePointerUp, handlePointerLeave,
    totalSheetWidth, totalSheetHeight
  };
}

export type ProjectContextType = ReturnType<typeof useProjectState>;
export const ProjectContext = createContext<ProjectContextType | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const state = useProjectState();
  return <ProjectContext.Provider value={state}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
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
async function savedAssetToSpriteFrame(savedAsset: { id: string; name: string; imageDataUrl: string; cleanedImageDataUrl?: string }): Promise<SpriteFrame> {
  const image = await loadImageFromDataUrl(savedAsset.imageDataUrl);

  const originalCanvas = document.createElement("canvas");
  originalCanvas.width = image.naturalWidth;
  originalCanvas.height = image.naturalHeight;

  const originalContext = originalCanvas.getContext("2d");
  if (!originalContext) throw new Error("Could not create restored original canvas.");
  originalContext.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
  originalContext.drawImage(image, 0, 0);

  const cleanedImage = await loadImageFromDataUrl(savedAsset.cleanedImageDataUrl ?? savedAsset.imageDataUrl);
  const editCanvas = document.createElement("canvas");
  editCanvas.width = cleanedImage.naturalWidth;
  editCanvas.height = cleanedImage.naturalHeight;

  const editContext = editCanvas.getContext("2d");
  if (!editContext) throw new Error("Could not create restored edit canvas.");
  editContext.clearRect(0, 0, editCanvas.width, editCanvas.height);
  editContext.drawImage(cleanedImage, 0, 0);

  return {
    id: savedAsset.id,
    fileName: savedAsset.name,
    image,
    originalCanvas,
    editCanvas,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  };
}

// Keep for backward compatibility
async function savedFrameToSpriteFrame(frame: any): Promise<SpriteFrame> {
  const image = await loadImageFromDataUrl(frame.imageDataUrl);

  const originalCanvas = document.createElement("canvas");
  originalCanvas.width = image.naturalWidth;
  originalCanvas.height = image.naturalHeight;

  const originalContext = originalCanvas.getContext("2d");
  if (!originalContext) throw new Error("Could not create restored original canvas.");
  originalContext.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
  originalContext.drawImage(image, 0, 0);

  const cleanedImage = await loadImageFromDataUrl(frame.cleanedImageDataUrl ?? frame.imageDataUrl);
  const editCanvas = document.createElement("canvas");
  editCanvas.width = cleanedImage.naturalWidth;
  editCanvas.height = cleanedImage.naturalHeight;

  const editContext = editCanvas.getContext("2d");
  if (!editContext) throw new Error("Could not create restored edit canvas.");
  editContext.clearRect(0, 0, editCanvas.width, editCanvas.height);
  editContext.drawImage(cleanedImage, 0, 0);

  return {
    id: frame.id,
    fileName: frame.name,
    image,
    originalCanvas,
    editCanvas,
    scale: frame.scale,
    offsetX: frame.xOffset,
    offsetY: frame.yOffset,
  };
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load stored image."));
    image.src = dataUrl;
  });
}

function createSinglePngCanvas(frame: SpriteFrame, options: SinglePngExportSettings) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(options.width));
  canvas.height = Math.max(1, Math.round(options.height));

  const context = canvas.getContext("2d");
  if (!context) return canvas;

  context.clearRect(0, 0, canvas.width, canvas.height);

  if (options.background === "solid") {
    context.fillStyle = options.backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  context.imageSmoothingEnabled = false;

  const bounds = findVisibleBounds(frame.editCanvas);
  const containScale = Math.min(canvas.width / bounds.width, canvas.height / bounds.height);
  const coverScale = Math.max(canvas.width / bounds.width, canvas.height / bounds.height);

  let scale = 1;
  if (options.fitMode === "contain") scale = containScale;
  if (options.fitMode === "cover") scale = coverScale;
  if (options.fitMode === "original-size") scale = 1;
  if (options.fitMode === "custom-scale") scale = options.scale;

  const drawWidth = bounds.width * scale;
  const drawHeight = bounds.height * scale;

  let x = canvas.width / 2 - drawWidth / 2 + options.xOffset;
  let y = canvas.height / 2 - drawHeight / 2 + options.yOffset;

  if (options.anchor === "top-left") {
    x = options.xOffset;
    y = options.yOffset;
  }

  if (options.anchor === "bottom-center") {
    x = canvas.width / 2 - drawWidth / 2 + options.xOffset;
    y = canvas.height - drawHeight + options.yOffset;
  }

  context.drawImage(
    frame.editCanvas,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    x,
    y,
    drawWidth,
    drawHeight
  );

  return canvas;
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


