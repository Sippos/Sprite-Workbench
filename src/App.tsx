import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { AppSettings, AssetWorkbenchMode, AssetWorkbenchProject, SinglePngAnchor, SinglePngExportSettings, SinglePngFitMode } from "./app/project/ProjectTypes";
import { loadProject, loadSettings, saveProject, saveSettings } from "./app/project/ProjectStore";

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

type BrushMode = "erase" | "restore" | "pick" | "pan";

type HistoryChange = {
  frameId: string;
  beforeDataUrl: string;
  afterDataUrl: string;
};

type HistoryEntry = {
  id: string;
  label: string;
  createdAt: string;
  changes: HistoryChange[];
};
type NormalizeMode = "auto" | "locked-row";

type SinglePngPreset = { label: string; width: number; height: number };

type PointerPreview = {
  visible: boolean;
  x: number;
  y: number;
  sourceX: number;
  sourceY: number;
};

type ImportCandidate = {
  id: string;
  file: File;
  url: string;
  selected: boolean;
};

const FRAME_SIZES = [32, 48, 64, 96, 128, 192];
const DEFAULT_COLUMNS = 6;
const EDITOR_ZOOM_LEVELS = [0.25, 0.5, 1, 2, 4, 8];

const SINGLE_PNG_PRESETS: SinglePngPreset[] = [
  { label: "64×64 icon", width: 64, height: 64 },
  { label: "96×96 icon", width: 96, height: 96 },
  { label: "128×128 icon", width: 128, height: 128 },
  { label: "320×80 button", width: 320, height: 80 },
  { label: "420×96 button", width: 420, height: 96 },
  { label: "512×320 panel", width: 512, height: 320 },
  { label: "900×620 large panel", width: 900, height: 620 },
];

const DEFAULT_SINGLE_PNG: SinglePngExportSettings = {
  width: 420,
  height: 96,
  preset: "420×96 button",
  fitMode: "contain",
  scale: 1,
  xOffset: 0,
  yOffset: 0,
  anchor: "center",
  background: "transparent",
  backgroundColor: "#ffffff",
};

function getFrameGuideDefaults(size: number) {
  return {
    feetX: Math.floor(size / 2),
    feetY: Math.floor(size * 0.82),
    collisionRadius: Math.max(6, Math.floor(size * 0.19)),
    collisionOffsetY: Math.floor(size * 0.15),
  };
}

function createId() {
  return crypto.randomUUID();
}

function colorToHex(color: [number, number, number] | null) {
  if (!color) return null;
  return `#${color.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function hexToColor(hex: string | null): [number, number, number] | null {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function rgbToHex(red: number, green: number, blue: number) {
  return "#" + [red, green, blue]
    .map((value) => Math.round(value).toString(16).padStart(2, "0"))
    .join("");
}

function sampleAverageColor(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  sampleSize: number,
  width: number,
  height: number
): [number, number, number] {
  const radius = Math.floor(sampleSize / 2);
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;

  for (let y = centerY - radius; y <= centerY + radius; y++) {
    for (let x = centerX - radius; x <= centerX + radius; x++) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const pixel = context.getImageData(x, y, 1, 1).data;
      red += pixel[0];
      green += pixel[1];
      blue += pixel[2];
      count += 1;
    }
  }

  if (count === 0) return [0, 0, 0];
  return [Math.round(red / count), Math.round(green / count), Math.round(blue / count)];
}

function App() {
  const [assetId, setAssetId] = useState("zarathustra");
  const [frameSize, setFrameSize] = useState(64);
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
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
        setBrushMode("pan");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
        rows: rows.map((row) => ({
          id: row.id,
          name: row.name,
          frameRate: row.frameRate,
          lockedCrop: row.lockedCrop,
          frames: row.frames.map((frame) => ({
            id: frame.id,
            name: frame.fileName,
            imageDataUrl: frame.originalCanvas.toDataURL("image/png"),
            cleanedImageDataUrl: frame.editCanvas.toDataURL("image/png"),
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
    const loadedRows = await Promise.all(
      project.spritesheet.rows.map(async (row) => ({
        id: row.id,
        name: row.name,
        frameRate: row.frameRate,
        lockedCrop: row.lockedCrop,
        frames: await Promise.all(row.frames.map(savedFrameToSpriteFrame)),
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

  async function importSelectedCandidates(rowId: string) {
    const selectedFiles = importCandidates
      .filter((candidate) => candidate.selected)
      .map((candidate) => candidate.file);

    if (selectedFiles.length === 0) {
      setSaveStatus("Select at least one preview image before importing.");
      return;
    }

    await addFramesToRow(rowId, selectedFiles);
    setSaveStatus(`Imported ${selectedFiles.length} image${selectedFiles.length === 1 ? "" : "s"} into the selected row.`);
    clearImportCandidates();
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

    if (brushMode === "pan" || event.button === 1 || event.altKey) {
      beginPan(event);
      return;
    }

    if (brushMode === "erase" || brushMode === "restore") {
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

  return (
    <main className="app">
      <header className="appMenu">
        <div className="menuBrand">
          <strong>Zarathustra Asset Workbench</strong>
          <span>{projectName}</span>
        </div>

        <nav className="menuGroup" aria-label="File actions">
          <span className="menuLabel">File</span>
          <button type="button" onClick={createNewProject}>New</button>
          <button type="button" onClick={handleSaveProject}>Save</button>
          <button type="button" onClick={exportProjectJson}>Save As</button>
          <label className="menuUpload">
            Import Images
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
          <label className="menuUpload">
            Open
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
          <button type="button" onClick={undo} disabled={undoStack.length === 0}>Undo</button>
          <button type="button" onClick={redo} disabled={redoStack.length === 0}>Redo</button>
          <button type="button" className={brushMode === "erase" ? "activeButton" : ""} onClick={() => setBrushMode("erase")}>Erase</button>
          <button type="button" className={brushMode === "restore" ? "activeButton" : ""} onClick={() => setBrushMode("restore")}>Restore</button>
          <button type="button" className={brushMode === "pick" ? "activeButton" : ""} onClick={() => setBrushMode("pick")}>Pick</button>
          <button type="button" className={brushMode === "pan" ? "activeButton" : ""} onClick={() => setBrushMode("pan")}>Pan</button>
        </nav>

        <nav className="menuGroup" aria-label="View actions">
          <span className="menuLabel">View</span>
          <button type="button" onClick={() => stepEditorZoom(-1)}>−</button>
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
          <button type="button" onClick={() => stepEditorZoom(1)}>+</button>
          <button type="button" className={showLoupe ? "activeButton" : ""} onClick={() => setShowLoupe((value) => !value)}>Loupe</button>
        </nav>

        <nav className="menuGroup" aria-label="Export actions">
          <span className="menuLabel">Export</span>
          <button type="button" onClick={exportSinglePng} disabled={!selectedFrame}>PNG</button>
          <button type="button" onClick={exportSheet} disabled={rows.every((row) => row.frames.length === 0)}>Sheet</button>
          <button type="button" onClick={exportMeta} disabled={rows.every((row) => row.frames.length === 0)}>JSON</button>
        </nav>
      </header>

      <section className="hero compactHero">
        <div>
          <p className="eyebrow">{appMode === "single-png" ? "Single PNG Export" : "Spritesheet Export"}</p>
          <h1>Clean, align, preview, export.</h1>
          <p className="subtitle">
            Use the top File/Edit/View bar for normal app actions. Ctrl+S saves locally, Ctrl+Z undoes, Ctrl+Shift+Z redoes.
          </p>
        </div>
      </section>

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

          <label>
            Project name
            <input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
            />
          </label>

          <div className="modeSwitch" role="tablist" aria-label="Workbench mode">
            <button
              className={appMode === "single-png" ? "activeButton" : ""}
              onClick={() => setAppMode("single-png")}
              type="button"
            >
              Single PNG Export
            </button>
            <button
              className={appMode === "spritesheet" ? "activeButton" : ""}
              onClick={() => setAppMode("spritesheet")}
              type="button"
            >
              Spritesheet Export
            </button>
          </div>

          <div className="buttonGrid three">
            <button type="button" onClick={handleSaveProject}>Save local</button>
            <button type="button" onClick={exportProjectJson}>Export file</button>
            <label className="uploadMini importProjectButton">
              Import file
              <input
                type="file"
                accept=".assetworkbench,application/json"
                onChange={(event) => {
                  void importProjectJson(event.target.files);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>

          <p className="info">
            {saveStatus}{lastSavedAt ? ` Last save: ${new Date(lastSavedAt).toLocaleString()}.` : ""}
          </p>

          <div className="grid2">
            <label>
              Frame size
              <select
                value={frameSize}
                onChange={(event) => handleFrameSizeChange(Number(event.target.value))}
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

          {appMode === "single-png" && (
            <>
              <hr />
              <h2>Single PNG export</h2>

              <label>
                Preset
                <select
                  value={singlePng.preset}
                  onChange={(event) => applySinglePngPreset(event.target.value)}
                >
                  {SINGLE_PNG_PRESETS.map((preset) => (
                    <option key={preset.label} value={preset.label}>{preset.label}</option>
                  ))}
                  <option value="Custom">Custom</option>
                </select>
              </label>

              <div className="grid2">
                <label>
                  Output width
                  <input
                    type="number"
                    min={1}
                    value={singlePng.width}
                    onChange={(event) => updateSinglePng({ width: Math.max(1, Number(event.target.value)), preset: "Custom" })}
                  />
                </label>

                <label>
                  Output height
                  <input
                    type="number"
                    min={1}
                    value={singlePng.height}
                    onChange={(event) => updateSinglePng({ height: Math.max(1, Number(event.target.value)), preset: "Custom" })}
                  />
                </label>
              </div>

              <div className="grid2">
                <label>
                  Fit mode
                  <select
                    value={singlePng.fitMode}
                    onChange={(event) => updateSinglePng({ fitMode: event.target.value as SinglePngFitMode })}
                  >
                    <option value="contain">Contain</option>
                    <option value="cover">Cover</option>
                    <option value="original-size">Original size</option>
                    <option value="custom-scale">Custom scale</option>
                  </select>
                </label>

                <label>
                  Anchor
                  <select
                    value={singlePng.anchor}
                    onChange={(event) => updateSinglePng({ anchor: event.target.value as SinglePngAnchor })}
                  >
                    <option value="center">Center</option>
                    <option value="top-left">Top left</option>
                    <option value="bottom-center">Bottom center</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
              </div>

              <label>
                Custom scale: {singlePng.scale.toFixed(2)}
                <input
                  type="range"
                  min="0.05"
                  max="4"
                  step="0.01"
                  value={singlePng.scale}
                  onChange={(event) => updateSinglePng({ scale: Number(event.target.value), fitMode: "custom-scale" })}
                />
              </label>

              <div className="grid2">
                <label>
                  X offset
                  <input
                    type="number"
                    value={singlePng.xOffset}
                    onChange={(event) => updateSinglePng({ xOffset: Number(event.target.value) })}
                  />
                </label>
                <label>
                  Y offset
                  <input
                    type="number"
                    value={singlePng.yOffset}
                    onChange={(event) => updateSinglePng({ yOffset: Number(event.target.value) })}
                  />
                </label>
              </div>

              <div className="grid2">
                <label>
                  Background
                  <select
                    value={singlePng.background}
                    onChange={(event) => updateSinglePng({ background: event.target.value as "transparent" | "solid" })}
                  >
                    <option value="transparent">Transparent</option>
                    <option value="solid">Solid color</option>
                  </select>
                </label>
                <label>
                  Solid color
                  <input
                    type="color"
                    value={singlePng.backgroundColor}
                    onChange={(event) => updateSinglePng({ backgroundColor: event.target.value })}
                  />
                </label>
              </div>
            </>
          )}

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
                    accept="image/png,image/webp,image/jpeg,image/jpg,image/gif,image/bmp,image/*"
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

          <div className="buttonGrid four">
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
            <button
              className={brushMode === "pan" ? "activeButton" : ""}
              onClick={() => setBrushMode("pan")}
            >
              Pan
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

          <div className="grid2">
            <label>
              Editor zoom
              <select value={editorZoom} onChange={(event) => setEditorZoom(Number(event.target.value))}>
                {EDITOR_ZOOM_LEVELS.map((zoom) => (
                  <option key={zoom} value={zoom}>{Math.round(zoom * 100)}%</option>
                ))}
              </select>
            </label>
            <label className="check inlineCheck">
              <input
                type="checkbox"
                checked={showLoupe}
                onChange={(event) => setShowLoupe(event.target.checked)}
              />
              Magnifier
            </label>
          </div>

          <p className="info">Pick mode: click samples 1×1, Shift-click samples 3×3, Ctrl-click samples 5×5. Pan with the Pan tool, middle mouse, or Alt-drag.</p>

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
              onClick={exportSinglePng}
              disabled={!selectedFrame}
            >
              Download single PNG
            </button>
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
          <ImportBrowser
            candidates={importCandidates}
            activeId={activeImportId}
            selectedRowName={selectedRow?.name ?? rows[0]?.name ?? "row"}
            onStageFiles={stageImportFiles}
            onSetActive={setActiveImportId}
            onToggle={toggleImportCandidate}
            onSelectAll={() => setAllImportCandidates(true)}
            onSelectNone={() => setAllImportCandidates(false)}
            onClear={clearImportCandidates}
            onImport={() => importSelectedCandidates(selectedRow?.id ?? rows[0].id)}
          />

          <div className="panel">
            <h2>Frame cleanup editor</h2>
            <p className="hint">Clean or restore pixels here. The same cleaned frame can export as a fixed-size PNG or a spritesheet cell.</p>
            <div className="canvasWrap editorWrap" ref={editorScrollRef}>
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

                  {showLoupe && pointerPreview?.visible && (
                    <BrushLoupe
                      frame={selectedFrame}
                      pointer={pointerPreview}
                      brushSize={brushSize}
                      brushMode={brushMode}
                    />
                  )}
                </div>
              ) : (
                <EmptyState onFiles={stageImportFiles} />
              )}
            </div>
          </div>

          {appMode === "single-png" && (
            <div className="panel">
              <h2>Single PNG export preview</h2>
              <p className="hint">
                Fixed export canvas: {singlePng.width}×{singlePng.height}px. Checkerboard is preview only unless a solid background is selected.
              </p>
              <div className="canvasWrap sheetWrap">
                {selectedFrame ? (
                  <canvas ref={singlePngPreviewCanvasRef} />
                ) : (
                  <div className="empty">Select a cleaned frame to preview a single PNG export.</div>
                )}
              </div>
            </div>
          )}

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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ImportBrowser({
  candidates,
  activeId,
  selectedRowName,
  onStageFiles,
  onSetActive,
  onToggle,
  onSelectAll,
  onSelectNone,
  onClear,
  onImport,
}: {
  candidates: ImportCandidate[];
  activeId: string | null;
  selectedRowName: string;
  onStageFiles: (files: FileList | File[]) => void;
  onSetActive: (id: string) => void;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onClear: () => void;
  onImport: () => void;
}) {
  const activeCandidate = candidates.find((candidate) => candidate.id === activeId) ?? candidates[0] ?? null;
  const selectedCount = candidates.filter((candidate) => candidate.selected).length;

  return (
    <div className="panel importBrowserPanel">
      <div className="panelHeaderRow">
        <div>
          <h2>Image import browser</h2>
          <p className="hint">
            Use this when the Linux/Tauri file picker does not show a useful image preview. Pick a folder or several files, then choose the exact images from thumbnails inside the app.
          </p>
        </div>
        <div className="importActions">
          <label className="uploadMini">
            Choose images
            <input
              type="file"
              accept="image/png,image/webp,image/jpeg,image/jpg,image/gif,image/bmp,image/*"
              multiple
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                if (event.target.files) onStageFiles(event.target.files);
                event.currentTarget.value = "";
              }}
            />
          </label>
          <label className="uploadMini">
            Choose folder
            <input
              type="file"
              accept="image/png,image/webp,image/jpeg,image/jpg,image/gif,image/bmp,image/*"
              multiple
              {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                if (event.target.files) onStageFiles(event.target.files);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {candidates.length === 0 ? (
        <div className="importEmpty">
          <strong>No images staged.</strong>
          <span>Pick a whole folder when the Linux file chooser does not show useful thumbnails.</span>
        </div>
      ) : (
        <div className="importBrowserGrid">
          <div className="importPreviewPane">
            {activeCandidate ? (
              <>
                <img src={activeCandidate.url} alt={activeCandidate.file.name} />
                <div className="importPreviewMeta">
                  <strong>{activeCandidate.file.name}</strong>
                  <span>{formatBytes(activeCandidate.file.size)}</span>
                </div>
              </>
            ) : null}
          </div>

          <div className="importThumbPane">
            <div className="importToolbar">
              <span>{selectedCount} / {candidates.length} selected for “{selectedRowName}”</span>
              <button type="button" onClick={onSelectAll}>All</button>
              <button type="button" onClick={onSelectNone}>None</button>
              <button type="button" onClick={onClear}>Clear</button>
              <button type="button" className="primaryButton" onClick={onImport} disabled={selectedCount === 0}>Import selected</button>
            </div>

            <div className="importThumbGrid">
              {candidates.map((candidate) => (
                <button
                  type="button"
                  key={candidate.id}
                  className={`importThumb ${candidate.id === activeCandidate?.id ? "active" : ""} ${candidate.selected ? "selected" : ""}`}
                  onClick={() => onSetActive(candidate.id)}
                  onDoubleClick={() => onToggle(candidate.id)}
                  title={`${candidate.selected ? "Selected" : "Not selected"}: ${candidate.file.name}`}
                >
                  <img src={candidate.url} alt={candidate.file.name} />
                  <span>{candidate.file.name}</span>
                  <input
                    type="checkbox"
                    checked={candidate.selected}
                    onChange={() => onToggle(candidate.id)}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Select ${candidate.file.name}`}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onFiles }: { onFiles: (files: FileList) => void }) {
  return (
    <label className="emptyDrop">
      <input
        type="file"
        accept="image/png,image/webp,image/jpeg,image/jpg,image/gif,image/bmp,image/*"
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

    const thumbSize = 64;
    const innerSize = 54;
    canvas.width = thumbSize;
    canvas.height = thumbSize;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, thumbSize, thumbSize);
    context.imageSmoothingEnabled = false;
    drawCheckerboard(context, thumbSize, thumbSize, 8);

    let bounds = findVisibleBounds(frame.editCanvas);

    if (bounds.width <= 1 || bounds.height <= 1) {
      bounds = {
        x: 0,
        y: 0,
        width: frame.originalCanvas.width,
        height: frame.originalCanvas.height,
      };
    }

    const safeWidth = Math.max(1, bounds.width);
    const safeHeight = Math.max(1, bounds.height);
    const scale = Math.min(innerSize / safeWidth, innerSize / safeHeight);
    const width = safeWidth * scale;
    const height = safeHeight * scale;

    context.drawImage(
      frame.editCanvas,
      bounds.x,
      bounds.y,
      safeWidth,
      safeHeight,
      thumbSize / 2 - width / 2,
      thumbSize / 2 - height / 2,
      width,
      height
    );
  }, [frame]);

  return <canvas ref={ref} className="thumbCanvas" aria-label={frame.fileName} />;
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
  const [colorText, setColorText] = useState("RGB — / HEX —");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const size = 150;
    const sourceSize = 15;
    const zoom = size / sourceSize;

    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext("2d");
    const sourceContext = frame.editCanvas.getContext("2d");
    if (!context || !sourceContext) return;

    context.imageSmoothingEnabled = false;
    drawCheckerboard(context, size, size, 10);

    const sx = pointer.sourceX - Math.floor(sourceSize / 2);
    const sy = pointer.sourceY - Math.floor(sourceSize / 2);

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

    context.strokeStyle = "rgba(255,255,255,0.22)";
    context.lineWidth = 1;
    for (let index = 0; index <= sourceSize; index++) {
      const position = Math.round(index * zoom);
      context.beginPath();
      context.moveTo(position, 0);
      context.lineTo(position, size);
      context.moveTo(0, position);
      context.lineTo(size, position);
      context.stroke();
    }

    const center = Math.floor(sourceSize / 2) * zoom;
    context.strokeStyle = "rgba(250, 204, 21, 0.98)";
    context.lineWidth = 2;
    context.strokeRect(center, center, zoom, zoom);

    context.strokeStyle =
      brushMode === "erase"
        ? "rgba(248, 113, 113, 0.95)"
        : brushMode === "restore"
          ? "rgba(52, 211, 153, 0.95)"
          : brushMode === "pan"
            ? "rgba(147, 197, 253, 0.95)"
            : "rgba(250, 204, 21, 0.95)";

    context.lineWidth = 2;
    const brushRadius = Math.max(2, (brushSize / 2) * zoom);
    context.beginPath();
    context.arc(size / 2, size / 2, brushRadius, 0, Math.PI * 2);
    context.stroke();

    const pixel = sourceContext.getImageData(pointer.sourceX, pointer.sourceY, 1, 1).data;
    setColorText("RGB " + pixel[0] + ", " + pixel[1] + ", " + pixel[2] + " · " + rgbToHex(pixel[0], pixel[1], pixel[2]));
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
      <div>{brushMode} · {colorText}</div>
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
async function savedFrameToSpriteFrame(frame: AssetWorkbenchProject["spritesheet"]["rows"][number]["frames"][number]): Promise<SpriteFrame> {
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
