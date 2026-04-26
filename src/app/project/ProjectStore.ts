import type { AppSettings, AssetWorkbenchProject } from "./ProjectTypes";

const PROJECT_KEY = "zarathustra-asset-workbench:current-project";
const SETTINGS_KEY = "zarathustra-asset-workbench:settings";

export const defaultAppSettings: AppSettings = {
  defaultFrameWidth: 128,
  defaultFrameHeight: 128,
  defaultSheetColumns: 6,
  checkerboardEnabled: true,
  backgroundTolerance: 24,
  featherPx: 0,
  eraseBrushSize: 18,
  restoreBrushSize: 18,
  zoomLevel: 100,
};

export function saveProject(project: AssetWorkbenchProject) {
  localStorage.setItem(PROJECT_KEY, JSON.stringify(project));
}

export function loadProject(): AssetWorkbenchProject | null {
  const raw = localStorage.getItem(PROJECT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as AssetWorkbenchProject;
    return parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

export function clearProject() {
  localStorage.removeItem(PROJECT_KEY);
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadSettings(): AppSettings {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return defaultAppSettings;

  try {
    return { ...defaultAppSettings, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return defaultAppSettings;
  }
}
