// src/App.js
import React from 'react';
import './App.css';
import SAImportScheduleView from './components/SAImportScheduleView';

function App() {
  return (
    <div className="min-h-screen bg-gray-900">
      <main>
        <SAImportScheduleView />
      </main>
    </div>
  );
}

export default App;