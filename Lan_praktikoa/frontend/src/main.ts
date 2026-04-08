import { mount } from 'svelte';
import AppRouter from './AppRouter.svelte';
import './app.css';

const app = mount(AppRouter, {
  target: document.getElementById('app')!
});

export default app;
