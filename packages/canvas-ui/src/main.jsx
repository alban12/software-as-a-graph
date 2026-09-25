import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import CanvasErrorBoundary from './components/CanvasErrorBoundary';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CanvasErrorBoundary>
      <App />
    </CanvasErrorBoundary>
  </React.StrictMode>
);
