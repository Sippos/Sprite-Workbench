
import { TopMenu } from "./TopMenu";
import { LeftSidebar } from "../Sidebar/LeftSidebar";
import { WorkspaceArea } from "../Workspace/WorkspaceArea";
import { PropertiesPanel } from "../Properties/PropertiesPanel";

export function WorkbenchLayout() {
  return (
    <div className="ide-layout">
      <TopMenu />
      <div className="ide-main">
        <LeftSidebar />
        <WorkspaceArea />
        <PropertiesPanel />
      </div>
    </div>
  );
}
