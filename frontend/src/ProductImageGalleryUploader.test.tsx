import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProductImageGalleryUploader } from './modules/catalogue/components/ProductImageGalleryUploader';
import { useState } from 'react';

function ParentComponent() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <button onClick={() => setCount((c) => c + 1)}>Increment: {count}</button>
      <ProductImageGalleryUploader />
    </div>
  );
}

describe('ProductImageGalleryUploader root test', () => {
  it('does not trigger error 301 when re-rendered without existingImages prop', () => {
    const { getByText } = render(<ParentComponent />);
    const btn = getByText(/Increment: 0/);
    fireEvent.click(btn);
    expect(getByText(/Increment: 1/)).toBeInTheDocument();
  });
});
