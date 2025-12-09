import '@testing-library/jest-dom';

// Polyfill for ai-sdk TransformStream in jsdom
const { TransformStream } = require('stream/web');
Object.assign(globalThis, { TransformStream });