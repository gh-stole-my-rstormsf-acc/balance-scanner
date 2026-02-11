import './styles.css';
import { initApp } from './app.js';

initApp().catch((error) => {
  // Keep failure visible in console for local debugging.
  console.error('App boot failed:', error);
});
