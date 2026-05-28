import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/globals.css';
import { initTheme } from '@/state/theme';
import { OptionsApp } from './App';

initTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OptionsApp />
  </StrictMode>,
);
