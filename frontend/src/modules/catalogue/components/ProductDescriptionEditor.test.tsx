import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProductDescriptionEditor } from './ProductDescriptionEditor';

describe('ProductDescriptionEditor', () => {
  it('renders editor toolbar and controls', () => {
    const onChange = vi.fn();
    render(<ProductDescriptionEditor value="<p>Test</p>" onChange={onChange} />);

    expect(screen.getByTitle('Highlight Background (Palette & Custom Picker)')).toBeInTheDocument();
    expect(screen.getByTitle('Choose Text Color (Palette & Custom Picker)')).toBeInTheDocument();
  });

  it('toggles the highlight picker and allows selecting a color', () => {
    const onChange = vi.fn();
    render(<ProductDescriptionEditor value="<p>Sample text</p>" onChange={onChange} />);

    const highlightBtn = screen.getByTitle('Highlight Background (Palette & Custom Picker)');
    fireEvent.click(highlightBtn);

    // Dropdown header & preset colors should be visible
    expect(screen.getByText('Highlight Text')).toBeInTheDocument();
    expect(screen.getByText('Preset Highlights')).toBeInTheDocument();
    expect(screen.getByText('Custom Background Color')).toBeInTheDocument();

    // Selecting a preset closes the dropdown
    const yellowPreset = screen.getByTitle('Yellow');
    fireEvent.click(yellowPreset);

    expect(screen.queryByText('Highlight Text')).not.toBeInTheDocument();
  });

  it('toggles the text color picker and allows custom color entry', () => {
    const onChange = vi.fn();
    render(<ProductDescriptionEditor value="<p>Sample text</p>" onChange={onChange} />);

    const colorBtn = screen.getByTitle('Choose Text Color (Palette & Custom Picker)');
    fireEvent.click(colorBtn);

    expect(screen.getByText('Text Color')).toBeInTheDocument();
    expect(screen.getByText('Preset Colors')).toBeInTheDocument();
    expect(screen.getByText('Custom Text Color')).toBeInTheDocument();

    // Close button dismisses picker
    const closeBtn = screen.getByTitle('Close');
    fireEvent.click(closeBtn);

    expect(screen.queryByText('Text Color')).not.toBeInTheDocument();
  });
});
