import React, { ChangeEvent } from "react";
import { useProject } from "../../store/ProjectContext";
import type { ImportCandidate } from "../../store/ProjectContext"; // Wait, it's defined in ProjectTypes, let's just grab it from context where we exported it

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImportModal() {
  const {
    importCandidates,
    activeImportId,
    selectedRow,
    rows,
    stageImportFiles,
    setActiveImportId,
    toggleImportCandidate,
    setAllImportCandidates,
    clearImportCandidates,
    importSelectedCandidates,
  } = useProject();

  if (importCandidates.length === 0) return null;

  const activeCandidate = importCandidates.find((candidate) => candidate.id === activeImportId) ?? importCandidates[0] ?? null;
  const selectedCount = importCandidates.filter((candidate) => candidate.selected).length;
  const selectedRowName = selectedRow?.name ?? rows[0]?.name ?? "row";
  const targetRowId = selectedRow?.id ?? rows[0]?.id;

  return (
    <div className="import-modal-overlay">
      <div className="import-modal-content">
        <div className="import-modal-header">
          <h2>Image Import Browser</h2>
          <p>Select the exact images from the thumbnails inside the app.</p>
        </div>
        
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
              <span>{selectedCount} / {importCandidates.length} selected for “{selectedRowName}”</span>
              <button type="button" onClick={() => setAllImportCandidates(true)}>All</button>
              <button type="button" onClick={() => setAllImportCandidates(false)}>None</button>
              <button type="button" onClick={clearImportCandidates}>Cancel</button>
              <button type="button" className="primaryButton" onClick={() => importSelectedCandidates(targetRowId)} disabled={selectedCount === 0 || !targetRowId}>Import selected</button>
            </div>

            <div className="importThumbGrid">
              {importCandidates.map((candidate) => (
                <button
                  type="button"
                  key={candidate.id}
                  className={`importThumb ${candidate.id === activeCandidate?.id ? "active" : ""} ${candidate.selected ? "selected" : ""}`}
                  onClick={() => setActiveImportId(candidate.id)}
                  onDoubleClick={() => toggleImportCandidate(candidate.id)}
                  title={`${candidate.selected ? "Selected" : "Not selected"}: ${candidate.file.name}`}
                >
                  <img src={candidate.url} alt={candidate.file.name} />
                  <span>{candidate.file.name}</span>
                  <input
                    type="checkbox"
                    checked={candidate.selected}
                    onChange={() => toggleImportCandidate(candidate.id)}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Select ${candidate.file.name}`}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
