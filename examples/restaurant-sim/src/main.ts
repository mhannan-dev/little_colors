import { mount } from 'svelte';
import App from '../../../apps/desktop/src/lib/features/counter-rush/App.svelte';

mount(App, { target: document.getElementById('app')! });
