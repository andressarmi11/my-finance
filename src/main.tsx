import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';
import { LanguageProvider } from './i18n/language';
import { ensureSeedData } from './data/local/seed';
import { materializeRecurringRules } from './data/local/materialize';
import './styles/index.css';

void ensureSeedData().then(() => materializeRecurringRules());
// The default window covers last month and ~3 ahead. When the
// user navigates further, each screen requests its month (ensureMonthMaterialized).

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LanguageProvider>
      <RouterProvider router={router} />
    </LanguageProvider>
  </React.StrictMode>,
);
