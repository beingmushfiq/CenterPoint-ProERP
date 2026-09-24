import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProductImageGalleryUploader, type LocalQueuedImage } from './ProductImageGalleryUploader';
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

describe('ProductImageGalleryUploader re-render test', () => {
  it('does not trigger error 301 when re-rendered without existingImages prop', () => {
    const { getByText } = render(<ParentComponent />);
    const btn = getByText(/Increment: 0/);
    fireEvent.click(btn);
    expect(getByText(/Increment: 1/)).toBeInTheDocument();
  });

  it('renders correctly in controlled mode as used in Create Product modal', () => {
    function CreateProductModalSimulator() {
      const [queuedImages, setQueuedImages] = useState<LocalQueuedImage[]>([]);
      const [imageUrl, setImageUrl] = useState('');

      return (
        <div>
          <span data-testid="img-count">{queuedImages.length}</span>
          <ProductImageGalleryUploader
            key="create-uploader"
            queuedImages={queuedImages}
            onQueuedImagesChange={setQueuedImages}
            primaryImageUrl={imageUrl}
            onPrimaryImageChange={setImageUrl}
          />
        </div>
      );
    }

    const { getByTestId, getByPlaceholderText, getByText } = render(<CreateProductModalSimulator />);
    expect(getByTestId('img-count').textContent).toBe('0');

    // Add an image by URL
    const urlInput = getByPlaceholderText(/https:\/\/example\.com/i);
    fireEvent.change(urlInput, { target: { value: 'https://example.com/test.jpg' } });
    const addBtn = getByText(/Add URL/i);
    fireEvent.click(addBtn);

    expect(getByTestId('img-count').textContent).toBe('1');
  });
});
