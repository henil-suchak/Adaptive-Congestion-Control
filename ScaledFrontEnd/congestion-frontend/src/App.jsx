import { Routes, Route, Navigate } from 'react-router-dom';
import NavBar from './components/NavBar';
import HomePage from './pages/HomePage';
import InferenceArenaPage from './pages/InferenceArenaPage';
import TrainingLabPage from './pages/TrainingLabPage';
import TopologyBuilderPage from './pages/TopologyBuilderPage';
import LoginPage from './pages/LoginPage';
import { AuthService } from './services/api';

/**
 * Protected Route wrapper — redirects to /login if not authenticated.
 */
function ProtectedRoute({ children }) {
  if (!AuthService.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <NavBar />
      
      {/* This is the dynamic container. The pages swap in and out right here. */}
      <main className="p-6">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/arena" element={
            <ProtectedRoute>
              <InferenceArenaPage />
            </ProtectedRoute>
          } />
          <Route path="/lab" element={
            <ProtectedRoute>
              <TrainingLabPage />
            </ProtectedRoute>
          } />
          <Route path="/topology" element={
            <ProtectedRoute>
              <TopologyBuilderPage />
            </ProtectedRoute>
          } />
        </Routes>
      </main>
    </div>
  );
}

export default App;