import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import HomePage from './components/HomePage';
import SAMSegmentationUI from './components/SAMSegmentationUI';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={
            isAuthenticated ? 
            <Navigate to="/home" replace /> : 
            <LoginPage setIsAuthenticated={setIsAuthenticated} />
          } 
        />
        <Route 
          path="/register" 
          element={
            isAuthenticated ? 
            <Navigate to="/home" replace /> : 
            <RegisterPage setIsAuthenticated={setIsAuthenticated} />
          } 
        />
        <Route 
          path="/home" 
          element={
            isAuthenticated ? 
            <HomePage /> : 
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/segmentation" 
          element={
            isAuthenticated ? 
            <SAMSegmentationUI /> : 
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/" 
          element={<Navigate to={isAuthenticated ? "/home" : "/login"} replace />} 
        />
      </Routes>
    </Router>
  );
}

export default App;