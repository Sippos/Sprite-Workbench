
import { useProject } from "../../store/ProjectContext";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";

export function LeftSidebar() {
  const {
    rows,
    selectedRowId,
    setSelectedRowId,
    selectedFrameId,
    setSelectedFrameId,
    addRow,
    deleteRow,
    renameRow,
    updateRowFrameRate,
    deleteFrame,
    moveFrame,
  } = useProject();

  return (
    <aside className="ide-sidebar ide-sidebar-left">
      <div className="sidebar-header">
        <h2>Animations</h2>
        <button type="button" onClick={addRow} title="Add Animation Row" className="icon-btn"><Plus size={16} /></button>
      </div>

      <div className="rowList">
        {rows.map((row) => (
          <div
            key={row.id}
            className={`rowCard ${selectedRowId === row.id ? "activeRow" : ""}`}
            onClick={() => {
              if (selectedRowId !== row.id) {
                setSelectedRowId(row.id);
                setSelectedFrameId(row.frames[0]?.id ?? null);
              }
            }}
          >
            <div className="rowHeader">
              <input
                value={row.name}
                onChange={(event) => renameRow(row.id, event.target.value)}
                placeholder="Animation Name"
                className="row-name-input"
              />
              <div className="row-controls">
                <input
                  type="number"
                  min={1}
                  value={row.frameRate}
                  onChange={(event) => updateRowFrameRate(row.id, Number(event.target.value))}
                  title="Frame Rate"
                  className="fps-input"
                />
                <span className="fps-label">fps</span>
                <button type="button" className="icon-btn danger" onClick={(e) => { e.stopPropagation(); deleteRow(row.id); }}><Trash2 size={14} /></button>
              </div>
            </div>

            {selectedRowId === row.id && (
              <div className="thumbRow">
                {row.frames.length === 0 ? (
                  <div className="empty">No frames</div>
                ) : (
                  row.frames.map((frame, index) => (
                    <div
                      key={frame.id}
                      className={`thumbCell ${selectedFrameId === frame.id ? "activeThumb" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFrameId(frame.id);
                      }}
                    >
                      <img src={frame.editCanvas.toDataURL("image/png")} alt={`Frame ${index}`} />
                      <div className="thumbActions">
                        <button type="button" onClick={(e) => { e.stopPropagation(); moveFrame(row.id, frame.id, -1); }} disabled={index === 0}><ChevronUp size={12} /></button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); moveFrame(row.id, frame.id, 1); }} disabled={index === row.frames.length - 1}><ChevronDown size={12} /></button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); deleteFrame(row.id, frame.id); }}><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
