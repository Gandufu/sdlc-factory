import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/tokens.css';
import './styles/shell.css';
import './styles/pages.css';
import './styles/operations.css';
import './styles/workspace.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);
