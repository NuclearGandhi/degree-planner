import { ThemeProvider } from './contexts/ThemeContext';
import DegreePlanView from './components/flow/DegreePlanView';
import { AuthProvider } from './contexts/AuthContext';
import './App.css';
import { useEffect, useState } from 'react';
import { DegreeTemplate, DegreesFileStructure } from './types/data';
import { fetchDegreeTemplates } from './utils/dataLoader';

function App() {
  const [allTemplatesData, setAllTemplatesData] = useState<Record<string, DegreeTemplate> | null>(null);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const rawTemplatesStructure = await fetchDegreeTemplates();
        // --- BEGIN DEBUG LOG ---
        if (import.meta.env.DEV && rawTemplatesStructure && rawTemplatesStructure['mechanical-engineering-general']) {
          const generalTemplate = rawTemplatesStructure['mechanical-engineering-general'];
          if (generalTemplate && typeof generalTemplate === 'object' && 'semesters' in generalTemplate && !Array.isArray(generalTemplate)) {
            console.debug('[App.tsx loadTemplates] Pristine mechanical-engineering-general semesters from fetch:', generalTemplate.semesters);
            const pristineMandatory = Object.values(generalTemplate.semesters).flat();
            console.debug('[App.tsx loadTemplates] Pristine mechanical-engineering-general mandatory count from fetch:', pristineMandatory.length, pristineMandatory);
          }
        }
        // --- END DEBUG LOG ---
        const templates: Record<string, DegreeTemplate> = {};
        for (const key in rawTemplatesStructure) {
          if (key !== 'globalRules') {
            const potentialTemplate = rawTemplatesStructure[key];
            // Type guard to ensure it's a DegreeTemplate
            if (potentialTemplate && typeof potentialTemplate === 'object' && 'semesters' in potentialTemplate && !Array.isArray(potentialTemplate)) {
              templates[key] = potentialTemplate as DegreeTemplate;
            }
          }
        }
        setAllTemplatesData(templates);
      } catch (error) {
        console.error("Failed to load degree templates:", error);
      }
    };
    loadTemplates();
  }, []);

  return (
    <AuthProvider>
      <ThemeProvider>
        <div dir="rtl" className="App">
          {/* Logo will be here, floating over ReactFlow */}
          {/* ReactFlow component will be here */}
          {/* UI elements like theme toggle, save options will be here - ToggleButton is one */}
          <DegreePlanView allTemplatesData={allTemplatesData} />
        </div>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
