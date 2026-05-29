import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import PartnerDashboard from './components/PartnerDashboard';

const PrivateRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div>Carregando...</div>;
  
  if (!user) return <Navigate to="/login" />;
  
  if (allowedRoles && !allowedRoles.includes(user.user_type)) {
    return <Navigate to="/" />;
  }
  
  return children;
};

function AppRoutes() {
  const { user } = useAuth();
  
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/partner/*"
        element={
          <PrivateRoute allowedRoles={['partner']}>
            <PartnerDashboard />
          </PrivateRoute>
        }
      />
      <Route path="/" element={
        user ? (
          user.user_type === 'partner' ? <Navigate to="/partner" /> :
          user.user_type === 'admin' ? <Navigate to="/admin" /> :
          <Navigate to="/client" />
        ) : <Navigate to="/login" />
      } />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;