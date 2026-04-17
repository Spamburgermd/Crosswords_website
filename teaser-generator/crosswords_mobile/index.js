/**
 * index.js
 * ---------------------------------------------
 * Expo looks for this file by default. It simply registers our App component so Expo Go
 * (or a native build) can bootstrap React Native.
 */
import { Buffer } from 'buffer';
global.Buffer = Buffer;

import { registerRootComponent } from 'expo';

import App from './App';

registerRootComponent(App);
