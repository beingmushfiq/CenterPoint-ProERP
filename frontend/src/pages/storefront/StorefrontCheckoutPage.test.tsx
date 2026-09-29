import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StorefrontCheckoutPage } from './StorefrontCheckoutPage';
import { api } from '../../lib/api/client';
import { useStorefrontCartStore } from '../../lib/storefront/storefrontCartStore';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useOutletContext: () => ({
      config: {
        currency: 'BDT',
      },
      subdomain: 'slicemart',
    }),
  };
});

vi.mock('../../lib/api/client', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../lib/api/client');
  return {
    ...actual,
    api: {
      get: vi.fn(),
      post: vi.fn(),
    },
  };
});

describe('StorefrontCheckoutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStorefrontCartStore.setState({
      cart: null,
      sessionToken: 'test-session-token',
    });
  });

  it('renders empty cart view when cart has no items', () => {
    render(
      <MemoryRouter>
        <StorefrontCheckoutPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Your cart is empty/i)).toBeInTheDocument();
    expect(screen.getByText(/Return to Catalog/i)).toBeInTheDocument();
  });

  it('renders checkout form when cart has items', () => {
    useStorefrontCartStore.setState({
      cart: {
        id: 1,
        uuid: 'cart-1',
        session_token: 'test-session-token',
        status: 'active',
        item_count: 1,
        coupon_code: null,
        subtotal: '1200.00',
        discount_amount: '0.00',
        tax_amount: '0.00',
        shipping_amount: '0.00',
        total_amount: '1200.00',
        items: [
          {
            id: 10,
            uuid: 'item-10',
            product_id: 1,
            variant_id: null,
            product_name: 'Premium Stainless Kettle',
            quantity: '2',
            unit_price: '600.00',
            line_discount: '0.00',
            tax_amount: '0.00',
            line_total: '1200.00',
          },
        ],
      },
      sessionToken: 'test-session-token',
    });

    render(
      <MemoryRouter>
        <StorefrontCheckoutPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Secure Checkout/i)).toBeInTheDocument();
    expect(screen.getByText('Premium Stainless Kettle')).toBeInTheDocument();
    expect(screen.getByText(/Guest Checkout/i)).toBeInTheDocument();
    expect(screen.getByText(/Customer Account/i)).toBeInTheDocument();
    expect(screen.getByText(/Cash on Delivery/i)).toBeInTheDocument();
    expect(screen.getByText(/bKash Payment/i)).toBeInTheDocument();
  });

  it('supports selecting bKash and generating demo transaction ID', async () => {
    useStorefrontCartStore.setState({
      cart: {
        id: 1,
        uuid: 'cart-1',
        session_token: 'test-session-token',
        status: 'active',
        item_count: 1,
        coupon_code: null,
        subtotal: '500.00',
        discount_amount: '0.00',
        tax_amount: '0.00',
        shipping_amount: '0.00',
        total_amount: '500.00',
        items: [
          {
            id: 10,
            uuid: 'item-10',
            product_id: 1,
            variant_id: null,
            product_name: 'Chef Knife',
            quantity: '1',
            unit_price: '500.00',
            line_discount: '0.00',
            tax_amount: '0.00',
            line_total: '500.00',
          },
        ],
      },
      sessionToken: 'test-session-token',
    });

    render(
      <MemoryRouter>
        <StorefrontCheckoutPage />
      </MemoryRouter>
    );

    // Select bKash option
    const bkashOption = screen.getByText(/bKash Payment/i);
    fireEvent.click(bkashOption);

    // Gateway simulator should display
    expect(screen.getByText(/bkash Gateway Simulator/i)).toBeInTheDocument();

    // Click Generate Demo TxnID button
    const generateBtn = screen.getByText(/Generate Demo TxnID/i);
    fireEvent.click(generateBtn);

    // Should indicate Verified badge
    await waitFor(() => {
      expect(screen.getByTestId('txn-verified-badge')).toBeInTheDocument();
    });
  });

  it('submits checkout successfully and navigates to order confirmation', async () => {
    useStorefrontCartStore.setState({
      cart: {
        id: 1,
        uuid: 'cart-1',
        session_token: 'test-session-token',
        status: 'active',
        item_count: 1,
        coupon_code: null,
        subtotal: '500.00',
        discount_amount: '0.00',
        tax_amount: '0.00',
        shipping_amount: '0.00',
        total_amount: '500.00',
        items: [
          {
            id: 10,
            uuid: 'item-10',
            product_id: 1,
            variant_id: null,
            product_name: 'Chef Knife',
            quantity: '1',
            unit_price: '500.00',
            line_discount: '0.00',
            tax_amount: '0.00',
            line_total: '500.00',
          },
        ],
      },
      sessionToken: 'test-session-token',
    });

    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        data: {
          order_number: 'SO-ONL-20260929-TEST',
          order_uuid: 'uuid-1234',
          total_amount: '500.00',
          currency: 'BDT',
          payment_method: 'cod',
          status: 'pending',
          tracking_token: 'uuid-1234',
        },
      },
    } as unknown as Awaited<ReturnType<typeof api.post>>);

    render(
      <MemoryRouter>
        <StorefrontCheckoutPage />
      </MemoryRouter>
    );

    // Fill required fields
    fireEvent.change(screen.getByPlaceholderText(/John Doe/i), {
      target: { value: 'Aayan Customer' },
    });
    fireEvent.change(screen.getByPlaceholderText(/\+880 1700 000000/i), {
      target: { value: '+8801711223344' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Street address/i), {
      target: { value: '123 Test Boulevard, Banani' },
    });

    // Submit form via submit event on form
    fireEvent.submit(screen.getByTestId('checkout-form'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/store/slicemart/order-confirmed',
        expect.objectContaining({
          state: expect.objectContaining({
            order: expect.objectContaining({
              order_number: 'SO-ONL-20260929-TEST',
            }),
          }),
        })
      );
    });
  });
});
