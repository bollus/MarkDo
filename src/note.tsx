import React from 'react';
import { createRoot } from 'react-dom/client';
import { NoteApp } from './NoteApp';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <NoteApp />
  </React.StrictMode>
);
