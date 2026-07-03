export type AssetWorkbenchMode = "single-png" | "spritesheet";

export type CanvasBackground = "transparent" | "checkerboard" | "solid";
export type SinglePngFitMode = "contain" | "cover" | "original-size" | "custom-scale";
export type SinglePngAnchor = "center" | "top-left" | "bottom-center" | "custom";

export type SinglePngExportSettings = {
  width: number;
  height: number;
  preset: string;
  fitMode: SinglePngFitMode;
  scale: number;
  xOffset: number;
  yOffset: number;
  anchor: SinglePngAnchor;
  background: "transparent" | "solid";
  backgroundColor: string;
};

export type AssetWorkbenchProject = {
  version: 1;
  name: string;
  createdAt: string;
  updatedAt: string;
  mode: AssetWorkbenchMode;
  assetId: string;

  canvas: {
    frameWidth: number;
    frameHeight: number;
    columns: number;
    rows: number;
    padding: number;
    background: CanvasBackground;
  };

  singlePng: SinglePngExportSettings;

  backgroundRemoval: {
    pickedColor: string | null;
    tolerance: number;
    softness: number;
    edgeCleanup: number;
    removeWhiteFringe: boolean;
    removeWhiteThreshold: number;
    checkerBrightness: number;
    checkerNeutrality: number;
    haloThreshold: number;
  };

  spritesheet: {
    normalizeMode: "auto" | "locked-row";
    globalScale: number;
    feetX: number;
    feetY: number;
    collisionRadius: number;
    collisionOffsetY: number;
    showGuides: boolean;
    assets: {
      id: string;
      name: string;
      originalPath?: string;
      imageDataUrl: string;
      cleanedImageDataUrl?: string;
    }[];
    rows: {
      id: string;
      name: string;
      frameRate: number;
      lockedCrop: {
        x: number;
        y: number;
        width: number;
        height: number;
      } | null;
      frames: {
        id: string;
        assetId: string;
        xOffset: number;
        yOffset: number;
        scale: number;
        rotation: number;
        visible: boolean;
      }[];
    }[];
  };

  exports: {
    lastPngPath?: string;
    lastSpritesheetPath?: string;
  };
};

export type AppSettings = {
  defaultFrameWidth: number;
  defaultFrameHeight: number;
  defaultSheetColumns: number;
  checkerboardEnabled: boolean;
  backgroundTolerance: number;
  featherPx: number;
  eraseBrushSize: number;
  restoreBrushSize: number;
  zoomLevel: number;
  lastExportFolder?: string;
};
