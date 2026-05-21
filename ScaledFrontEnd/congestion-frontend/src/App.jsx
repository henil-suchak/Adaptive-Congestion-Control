import { Routes, Route } from 'react-router-dom';
import NavBar from './components/NavBar';
import HomePage from './pages/HomePage';
import InferenceArenaPage from './pages/InferenceArenaPage';
import TrainingLabPage from './pages/TrainingLabPage';

function App() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <NavBar />
      
      {/* This is the dynamic container. The pages swap in and out right here. */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/arena" element={<InferenceArenaPage />} />
          <Route path="/lab" element={<TrainingLabPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;