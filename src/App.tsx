import { ThemeProvider } from './contexts/ThemeContext';
import DegreePlanView from './components/flow/DegreePlanView';
import { AuthProvider } from './contexts/AuthContext';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <div dir="rtl" className="App">
          {/* Logo will be here, floating over ReactFlow */}
          {/* ReactFlow component will be here */}
          {/* UI elements like theme toggle, save options will be here - ToggleButton is one */}
          <DegreePlanView />
        </div>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
