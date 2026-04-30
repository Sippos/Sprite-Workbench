# Sprite Workbench

Sprite Workbench is a local desktop/web tool for preparing game sprite assets. It helps import PNG frames, clean backgrounds, align animation rows, preview spritesheets, and export metadata/snippets for game engines.

## Tech Stack

- React
- TypeScript
- Vite
- Tauri 2

## Development

Install dependencies:

```bash
npm install
```

Run the web app:

```bash
npm run dev
```

Run the desktop app:

```bash
npm run tauri dev
```

Build the frontend:

```bash
npm run build
```

Build the Tauri app:

```bash
npm run tauri build
```

## Repository Notes

Generated folders such as `node_modules`, `dist`, and `src-tauri/target` are intentionally ignored and should not be committed.
