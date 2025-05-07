import './App.css';
import DegreePlanView from './components/flow/DegreePlanView';
import { ThemeToggleButton } from './components/ui/ThemeToggleButton';
import { Logo } from './components/ui/Logo';

function App() {
  return (
    <div className="app-container" dir="rtl">
      <Logo />
      <ThemeToggleButton />
      {/* Logo will be here, floating over ReactFlow */}
      {/* ReactFlow component will be here */}
      {/* UI elements like theme toggle, save options will be here - ToggleButton is one */}
      <DegreePlanView />
    </div>
  );
}

export default App;
