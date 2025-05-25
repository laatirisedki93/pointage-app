import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './components/Login';
import Admin from './components/Admin';
import QrAdmin from './components/QrAdmin';
import Pointage from './components/Pointage';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import AlertsManager from './components/AlertsManager';
import ValidationManager from './components/ValidationManager';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/pointage" element={<Pointage />} />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/qr-admin" 
            element={
              <ProtectedRoute>
                <QrAdmin />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/old-dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/alerts" 
            element={
              <ProtectedRoute>
                <AlertsManager />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/validation" 
            element={
              <ProtectedRoute>
                <ValidationManager />
              </ProtectedRoute>
            } 
          />
          <Route path="/" element={<Login />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
