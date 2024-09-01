import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import LoginPage from './logInPage';
import SAMSegmentationUI from './SAMSegmentationUI';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if a token exists in localStorage
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
            <Navigate to="/segmentation" replace /> : 
            <LoginPage setIsAuthenticated={setIsAuthenticated} />
          } 
        />
        <Route 
          path="/segmentation" 
          element={
            isAuthenticated ? 
            <SAMSegmentationUI setIsAuthenticated={setIsAuthenticated} /> : 
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/" 
          element={<Navigate to={isAuthenticated ? "/segmentation" : "/login"} replace />} 
        />
      </Routes>
    </Router>
  );
}

export default App;