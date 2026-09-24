import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

describe('App Root Component', () => {
  it('renders application provider shell without throwing', () => {
    expect(() => render(<App />)).not.toThrow();
  });
});
