const fs = require('fs');
let code = fs.readFileSync('src/store/ProjectContext.tsx', 'utf-8');

// 1. Add state
code = code.replace(
  'const [importCandidates, setImportCandidates] = useState<ImportCandidate[]>([]);',
  `const [spritesheetToSlice, setSpritesheetToSlice] = useState<ImportCandidate | null>(null);\n  const [importCandidates, setImportCandidates] = useState<ImportCandidate[]>([]);`
);

// 2. Add functions
const functionsToAdd = `
  function stageSpritesheet(file: File) {
    if (!file.type.startsWith("image/") && !/\\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)) {
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

  async function sliceAndImportSpritesheet(cols: number, rows: number, skipEmpty: boolean, targetRowId: string) {
    if (!spritesheetToSlice || cols < 1 || rows < 1) return;

    const image = await loadImage(spritesheetToSlice.file);
    const frameWidth = image.naturalWidth / cols;
    const frameHeight = image.naturalHeight / rows;

    const newFrames: SpriteFrame[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const originalCanvas = document.createElement("canvas");
        originalCanvas.width = frameWidth;
        originalCanvas.height = frameHeight;
        const originalContext = originalCanvas.getContext("2d");
        if (!originalContext) continue;

        originalContext.drawImage(
          image,
          c * frameWidth, r * frameHeight, frameWidth, frameHeight,
          0, 0, frameWidth, frameHeight
        );

        if (skipEmpty) {
          const imgData = originalContext.getImageData(0, 0, frameWidth, frameHeight).data;
          let isEmpty = true;
          for (let i = 3; i < imgData.length; i += 4) {
            if (imgData[i] > 0) {
              isEmpty = false;
              break;
            }
          }
          if (isEmpty) continue;
        }

        const editCanvas = document.createElement("canvas");
        editCanvas.width = frameWidth;
        editCanvas.height = frameHeight;
        const editContext = editCanvas.getContext("2d");
        if (!editContext) continue;
        editContext.drawImage(originalCanvas, 0, 0);

        newFrames.push({
          id: createId(),
          fileName: \`\${spritesheetToSlice.file.name.replace(/\\.[^.]+$/, "")}_\${r}_\${c}\`,
          image,
          originalCanvas,
          editCanvas,
          scale: 1,
          offsetX: 0,
          offsetY: 0,
        });
      }
    }

    setRows((current) =>
      current.map((row) => {
        if (row.id === targetRowId) {
          return { ...row, frames: [...row.frames, ...newFrames] };
        }
        return row;
      })
    );

    cancelSpritesheetSlice();
    setSaveStatus(\`Imported \${newFrames.length} sliced frames.\`);
    
    if (!selectedFrameId && newFrames[0]) {
      setSelectedRowId(targetRowId);
      setSelectedFrameId(newFrames[0].id);
    }
  }
`;

code = code.replace(
  'function stageImportFiles(files: FileList | File[]) {',
  functionsToAdd + '\n  function stageImportFiles(files: FileList | File[]) {'
);

// 3. Export variables
code = code.replace(
  'importCandidates, setImportCandidates, activeImportId, setActiveImportId,',
  `spritesheetToSlice, stageSpritesheet, cancelSpritesheetSlice, sliceAndImportSpritesheet,
    importCandidates, setImportCandidates, activeImportId, setActiveImportId,`
);

fs.writeFileSync('src/store/ProjectContext.tsx', code);
