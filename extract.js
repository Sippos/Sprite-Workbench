import fs from 'fs';

const appSource = fs.readFileSync('src/App.tsx.backup', 'utf-8');

const prefix = `import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { AppSettings, AssetWorkbenchMode, AssetWorkbenchProject, SinglePngAnchor, SinglePngExportSettings, SinglePngFitMode } from "../app/project/ProjectTypes";
import { loadProject, loadSettings, saveProject, saveSettings } from "../app/project/ProjectStore";

// Type definitions from App.tsx
export type Bounds = { x: number; y: number; width: number; height: number; };
export type SpriteFrame = { id: string; fileName: string; image: HTMLImageElement; originalCanvas: HTMLCanvasElement; editCanvas: HTMLCanvasElement; scale: number; offsetX: number; offsetY: number; };
export type AnimationRow = { id: string; name: string; frameRate: number; frames: SpriteFrame[]; lockedCrop: Bounds | null; };
export type BrushMode = "erase" | "restore" | "pick" | "pan";
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
export function colorToHex(color: [number, number, number] | null) { if (!color) return null; return \`#\${color.map((value) => value.toString(16).padStart(2, "0")).join("")}\`; }
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
`;

const lines = appSource.split('\n');
const appStart = lines.findIndex(l => l.startsWith('function App() {'));
const appReturn = lines.findIndex(l => l.includes('return (') && lines.indexOf(l) > appStart);

const helpersStart = lines.findIndex(l => l.startsWith('async function fileToSpriteFrame'));
const helpersCode = lines.slice(helpersStart).join('\n');

const hookBody = lines.slice(appStart + 1, appReturn).join('\n');

const suffix = \`
  return {
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
    importCandidates, setImportCandidates, activeImportId, setActiveImportId,
    stageImportFiles, clearImportCandidates, toggleImportCandidate, setAllImportCandidates, importSelectedCandidates,
    showGuides, setShowGuides, previewTick, pointerPreview, setPointerPreview,
    editorScrollRef, editorCanvasRef, framePreviewCanvasRef, animationPreviewCanvasRef, rowAlignmentCanvasRef, sheetPreviewCanvasRef, singlePngPreviewCanvasRef,
    handleSaveProject, exportProjectJson, importProjectJson, createNewProject,
    addRow, deleteRow, renameRow, updateRowFrameRate, deleteFrame, moveFrame,
    applyRemoveNearWhiteToSelected, applyRemoveNearWhiteToRow,
    applyPickedColorToSelected, applyPickedColorToRow,
    applyCheckerBgToSelected, applyCheckerBgToRow,
    applyHaloToSelected, applyHaloToRow,
    safeCleanupSelected, safeCleanupRow, strongCleanupSelected, strongCleanupRow,
    resetSelectedFrame, resetSelectedRowFrames, resetSelectedFrameTransform, applySelectedTransformToRow,
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
\`;

fs.writeFileSync('src/store/ProjectContext.tsx', prefix + '\nexport function useProjectState() {\n' + hookBody + suffix + '\n' + helpersCode);
