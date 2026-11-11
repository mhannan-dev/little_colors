import { mount } from 'svelte';
import '@fontsource/hind-siliguri/400.css';
import './style.css';
import SoccerMatch from '../src/lib/features/world-soccer/SoccerMatch.svelte';

mount(SoccerMatch, { target: document.getElementById('app')! });
