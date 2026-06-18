
import { ProjectProvider } from "./store/ProjectContext";
import { WorkbenchLayout } from "./components/Layout/WorkbenchLayout";
import "./ide-styles.css";

function App() {
  return (
    <ProjectProvider>
      <WorkbenchLayout />
    </ProjectProvider>
  );
}

export default App;
