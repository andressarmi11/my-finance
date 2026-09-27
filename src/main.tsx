import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';
import { IdiomaProvider } from './i18n/idioma';
import { ensureSeedData } from './data/local/seed';
import { materializeRecurringRules } from './data/local/materialize';
import './styles/index.css';

void ensureSeedData().then(() => materializeRecurringRules());
// La ventana por defecto cubre el mes pasado y ~3 adelante. Cuando el
// usuario navega mas alla, cada pantalla pide su mes (ensureMonthMaterialized).

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <IdiomaProvider>
      <RouterProvider router={router} />
    </IdiomaProvider>
  </React.StrictMode>,
);
