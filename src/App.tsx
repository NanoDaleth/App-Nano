import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Ingredients from './components/Ingredients';
import NewRecipe from './components/NewRecipe';
import Recipes from './components/Recipes';
import History from './components/History';
import UserManual from './components/UserManual';
import Cleaning from './components/Cleaning';
import Login from './components/Login';
import { IngredientsProvider } from './context/IngredientsContext';
import { MqttProvider } from './context/MqttContext';
import { AuthProvider, useAuth } from './context/AuthContext';

const ProtectedRoute = ({ children, requireAdmin = false }: { children: React.ReactNode, requireAdmin?: boolean }) => {
  const { role } = useAuth();

  if (!role) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && role !== 'admin') {
    return <Navigate to="/recipes" replace />;
  }

  return <>{children}</>;
};

const AppContent = () => {
  const { role } = useAuth();

  if (!role) {
    return <Login />;
  }

  return (
    <div className="flex flex-col md:flex-row h-screen">
      <Sidebar />
      <main className="flex-1 bg-gray-100 overflow-auto">
        <Routes>
          <Route path="/recipes" element={<Recipes />} />
          <Route
            path="/ingredients"
            element={
              <ProtectedRoute requireAdmin>
                <Ingredients />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute requireAdmin>
                <History />
              </ProtectedRoute>
            }
          />
          <Route
            path="/new-recipe"
            element={
              <ProtectedRoute requireAdmin>
                <NewRecipe />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cleaning"
            element={
              <ProtectedRoute requireAdmin>
                <Cleaning />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manual"
            element={
              <ProtectedRoute requireAdmin>
                <UserManual />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/recipes" replace />} />
        </Routes>
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <MqttProvider>
        <IngredientsProvider>
          <Router>
            <AppContent />
          </Router>
        </IngredientsProvider>
      </MqttProvider>
    </AuthProvider>
  );
}

export default App;