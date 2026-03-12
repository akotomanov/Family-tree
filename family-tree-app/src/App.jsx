import { useState, useCallback, useRef } from 'react';
import { useFamilyData } from './hooks/useFamilyData';
import FamilyTree from './components/FamilyTree';
import Sidebar from './components/Sidebar';
import SearchBar from './components/SearchBar';
import ControlButtons from './components/ControlButtons';
import './App.css';

function App() {
  const { data, loading, error } = useFamilyData();
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const controlsRef = useRef(null);

  // Initialize selected person once data loads
  const [initialized, setInitialized] = useState(false);
  if (data && !initialized) {
    setSelectedPerson(data.rootPerson);
    setSidebarOpen(true);
    setInitialized(true);
  }

  const handlePersonClick = useCallback((personName) => {
    setSelectedPerson(personName);
    setSidebarOpen(true);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  const handleZoomIn = useCallback(() => {
    controlsRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    controlsRef.current?.zoomOut();
  }, []);

  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  const handleHome = useCallback(() => {
    if (data) {
      controlsRef.current?.goHome();
      setSelectedPerson(data.rootPerson);
      setSidebarOpen(true);
    }
  }, [data]);

  if (loading) {
    return <div className="app__loading">Loading family tree...</div>;
  }

  if (error) {
    return (
      <div className="app__error">
        <p>Error loading family data</p>
        <p>{error}</p>
      </div>
    );
  }

  const person = selectedPerson ? data.people[selectedPerson] : null;

  return (
    <div className="app">
      <div className="app__canvas">
        <FamilyTree
          familyData={data}
          selectedPerson={selectedPerson}
          onPersonClick={handlePersonClick}
          controlsRef={controlsRef}
        />
      </div>

      <div className={`app__search ${sidebarOpen ? 'app__search--sidebar-open' : ''}`}>
        <SearchBar people={data.people} onSelect={handlePersonClick} />
      </div>

      <div className={`app__controls ${sidebarOpen ? 'app__controls--sidebar-open' : ''}`}>
        <ControlButtons
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onFullscreen={handleFullscreen}
          onHome={handleHome}
        />
      </div>

      <Sidebar
        person={person}
        isOpen={sidebarOpen}
        onClose={handleCloseSidebar}
        onPersonClick={handlePersonClick}
      />
    </div>
  );
}

export default App;
