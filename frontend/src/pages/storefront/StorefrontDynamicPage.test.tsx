import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { StorefrontDynamicPage } from './StorefrontDynamicPage';
import { api } from '../../lib/api/client';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => ({
      config: {
        name: 'Acoustic Labs Pro',
        currency: 'USD',
        primary_color: '#10b981',
      },
      subdomain: 'acousticlabs',
    }),
  };
});

vi.mock('../../lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('StorefrontDynamicPage Electronics CMS Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders rich electronics About Us fallback with The Hardware Manifesto and quality journey', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Not found'));

    render(
      <MemoryRouter initialEntries={['/store/acousticlabs/pages/about-us']}>
        <Routes>
          <Route path="/store/:subdomain/pages/:slug" element={<StorefrontDynamicPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Engineered for Permanence. Built Without Compromise./i)).toBeInTheDocument();
    });

    expect(screen.getByText(/The Hardware Manifesto/i)).toBeInTheDocument();
    expect(screen.getByText(/The Monolithic Lifecycle/i)).toBeInTheDocument();
    expect(screen.getByText(/6061-T6 Billet Milling/i)).toBeInTheDocument();
  });

  it('renders rich electronics Warranty Support fallback with 2-Year Precision Care', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Not found'));

    render(
      <MemoryRouter initialEntries={['/store/acousticlabs/pages/warranty-support']}>
        <Routes>
          <Route path="/store/:subdomain/pages/:slug" element={<StorefrontDynamicPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/2-Year Precision Care & Rapid Replacement/i)).toBeInTheDocument();
    });

    expect(screen.getAllByText(/24-Hour Cross-Shipment/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Right-to-Repair Friendly/i)).toBeInTheDocument();
  });

  it('renders rich electronics Custom Lab fallback with Bespoke Studio Hardware', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Not found'));

    render(
      <MemoryRouter initialEntries={['/store/acousticlabs/pages/custom-lab']}>
        <Routes>
          <Route path="/store/:subdomain/pages/:slug" element={<StorefrontDynamicPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/The Custom Hardware Lab/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Pantone Billet Anodizing/i)).toBeInTheDocument();
    expect(screen.getByText(/Bespoke Commission Roadmap/i)).toBeInTheDocument();
  });

  it('renders custom database blocks through StorefrontBlockRenderer when available', async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url.includes('/storefront/pages/special-edition')) {
        return {
          data: {
            title: 'Special Edition Studio Pack',
            slug: 'special-edition',
            page_type: 'content',
            meta_title: 'Special Edition Studio Pack — Acoustic Labs',
            blocks: [
              {
                id: 'b_custom_hero',
                type: 'hero_banner',
                badge: 'Limited Run',
                title: 'Titanium Acoustic Rig',
                subtitle: 'Precision machined studio package with bit-perfect DAC.',
                cta_text: 'Explore Rig',
                cta_url: '#rig',
              },
              {
                id: 'b_custom_faq',
                type: 'faq',
                title: 'Rig Specifications',
                faqs: [
                  { q: 'Is it compatible with Linux & macOS?', a: 'Yes, 100% driverless UAC2 compliance.' },
                ],
              },
            ],
          },
        } as unknown as Awaited<ReturnType<typeof api.get>>;
      }
      return { data: { data: [] } } as unknown as Awaited<ReturnType<typeof api.get>>;
    });

    render(
      <MemoryRouter initialEntries={['/store/acousticlabs/pages/special-edition']}>
        <Routes>
          <Route path="/store/:subdomain/pages/:slug" element={<StorefrontDynamicPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Titanium Acoustic Rig/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Precision machined studio package with bit-perfect DAC./i)).toBeInTheDocument();
    expect(screen.getByText(/Rig Specifications/i)).toBeInTheDocument();
    expect(screen.getByText(/Is it compatible with Linux & macOS\?/i)).toBeInTheDocument();
  });
});
