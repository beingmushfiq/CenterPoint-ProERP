import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StorefrontHomePage } from './StorefrontHomePage';
import { api } from '../../lib/api/client';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => ({
      config: {
        store_name: 'SliceMart Test Store',
        tagline: 'Fresh Slices Daily',
        primary_color: '#10b981',
      },
      subdomain: 'slicemart',
    }),
  };
});

vi.mock('../../lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('StorefrontHomePage Dynamic CMS Blocks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders default fallback blocks when CMS returns no blocks', async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url.includes('/storefront/products')) {
        return { data: { data: [] } } as unknown as Awaited<ReturnType<typeof api.get>>;
      }
      if (url.includes('/storefront/categories')) {
        return { data: { data: [] } } as unknown as Awaited<ReturnType<typeof api.get>>;
      }
      if (url.includes('/storefront/pages/home')) {
        return { data: { data: { blocks: [] } } } as unknown as Awaited<ReturnType<typeof api.get>>;
      }
      return { data: {} } as unknown as Awaited<ReturnType<typeof api.get>>;
    });

    render(
      <MemoryRouter>
        <StorefrontHomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Designed for Excellence, Crafted for Longevity/i)).toBeInTheDocument();
    });

    // Check default block elements
    expect(screen.getByText(/Explore Catalog/i)).toBeInTheDocument();
    expect(screen.getByText(/Reliable Dispatch/i)).toBeInTheDocument();
  });

  it('renders custom CMS blocks when provided by API', async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url.includes('/storefront/products')) {
        return { data: { data: [] } } as unknown as Awaited<ReturnType<typeof api.get>>;
      }
      if (url.includes('/storefront/categories')) {
        return { data: { data: [] } } as unknown as Awaited<ReturnType<typeof api.get>>;
      }
      if (url.includes('/storefront/pages/home')) {
        return {
          data: {
            data: {
              blocks: [
                {
                  id: 'blk-custom-hero',
                  type: 'hero_banner',
                  title: 'Ultra Artisanal Bakery',
                  subtitle: 'Custom baked daily with organic heritage grains',
                  primaryCtaText: 'Shop Artisanal Bread',
                  primaryCtaLink: '/catalog',
                },
                {
                  id: 'blk-custom-faq',
                  type: 'faq',
                  title: 'Artisan Baking FAQ',
                  faqItems: [
                    { q: 'Is fermentation 48 hours?', a: 'Yes, naturally leavened for 48 hours.' },
                  ],
                },
              ],
            },
          },
        } as unknown as Awaited<ReturnType<typeof api.get>>;
      }
      return { data: {} } as unknown as Awaited<ReturnType<typeof api.get>>;
    });

    render(
      <MemoryRouter>
        <StorefrontHomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Ultra Artisanal Bakery')).toBeInTheDocument();
    });

    expect(screen.getByText('Custom baked daily with organic heritage grains')).toBeInTheDocument();
    expect(screen.getByText('Shop Artisanal Bread')).toBeInTheDocument();
    expect(screen.getByText('Artisan Baking FAQ')).toBeInTheDocument();
    expect(screen.getByText('Is fermentation 48 hours?')).toBeInTheDocument();
  });
});
