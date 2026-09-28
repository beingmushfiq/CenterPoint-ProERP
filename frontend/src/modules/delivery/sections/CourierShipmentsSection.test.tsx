import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CourierShipmentsSection, getShipmentSla } from './CourierShipmentsSection';
import type { CourierShipment, CourierProvider } from '../../../types/api/delivery';

describe('CourierShipmentsSection SLA Intelligence', () => {
  const mockProviders: CourierProvider[] = [
    {
      id: 1,
      uuid: 'cp-01',
      code: 'PATHAO',
      name: 'Pathao Courier',
      adapter_class: 'App\\Modules\\Delivery\\Adapters\\PathaoCourierAdapter',
      is_active: true,
      default_charge: '60.0000',
    },
  ];

  const now = Date.now();
  const mockShipments: CourierShipment[] = [
    {
      id: 101,
      uuid: 'shp-101',
      delivery_order_id: 1,
      courier_provider_id: 1,
      provider_name: 'Pathao Courier',
      consignment_id: 'PTH-ON-TRACK',
      status: 'in_transit',
      charge_amount: '60.0000',
      cod_amount: '1000.0000',
      created_at: new Date(now - 12 * 3600 * 1000).toISOString(), // 12h ago -> on_track
    },
    {
      id: 102,
      uuid: 'shp-102',
      delivery_order_id: 2,
      courier_provider_id: 1,
      provider_name: 'Pathao Courier',
      consignment_id: 'PTH-WARNING',
      status: 'in_transit',
      charge_amount: '60.0000',
      cod_amount: '1500.0000',
      created_at: new Date(now - 55 * 3600 * 1000).toISOString(), // 55h ago -> warning (>48h)
    },
    {
      id: 103,
      uuid: 'shp-103',
      delivery_order_id: 3,
      courier_provider_id: 1,
      provider_name: 'Pathao Courier',
      consignment_id: 'PTH-BREACHED',
      status: 'in_transit',
      charge_amount: '60.0000',
      cod_amount: '2000.0000',
      created_at: new Date(now - 90 * 3600 * 1000).toISOString(), // 90h ago -> breached (>72h)
    },
    {
      id: 104,
      uuid: 'shp-104',
      delivery_order_id: 4,
      courier_provider_id: 1,
      provider_name: 'Pathao Courier',
      consignment_id: 'PTH-DELIVERED',
      status: 'delivered',
      charge_amount: '60.0000',
      cod_amount: '500.0000',
      created_at: new Date(now - 80 * 3600 * 1000).toISOString(), // delivered -> completed
    },
  ];

  it('correctly calculates SLA status and elapsed hours via getShipmentSla', () => {
    const onTrack = getShipmentSla(mockShipments[0]!);
    expect(onTrack.status).toBe('on_track');
    expect(onTrack.elapsedHours).toBe(12);

    const warning = getShipmentSla(mockShipments[1]!);
    expect(warning.status).toBe('warning');
    expect(warning.elapsedHours).toBe(55);

    const breached = getShipmentSla(mockShipments[2]!);
    expect(breached.status).toBe('breached');
    expect(breached.elapsedHours).toBe(90);

    const completed = getShipmentSla(mockShipments[3]!);
    expect(completed.status).toBe('completed');
  });

  it('renders SLA filter pills with correct counts', () => {
    render(
      <CourierShipmentsSection
        shipments={mockShipments}
        providers={mockProviders}
        pendingDeliveries={[]}
        onBookShipment={vi.fn()}
        onTrackShipment={vi.fn()}
        onCancelShipment={vi.fn()}
        onOpenLabel={vi.fn()}
      />
    );

    expect(screen.getByText('All Consignments')).toBeInTheDocument();
    expect(screen.getByText(/Critical SLA Breach \(>72h\)/i)).toBeInTheDocument();
    expect(screen.getByText(/SLA At Risk \(>48h\)/i)).toBeInTheDocument();
    expect(screen.getByText(/On Track \(<48h\)/i)).toBeInTheDocument();

    // Verify all 4 consignment rows initially rendered
    expect(screen.getByText('PTH-ON-TRACK')).toBeInTheDocument();
    expect(screen.getByText('PTH-WARNING')).toBeInTheDocument();
    expect(screen.getByText('PTH-BREACHED')).toBeInTheDocument();
    expect(screen.getByText('PTH-DELIVERED')).toBeInTheDocument();
  });

  it('filters consignments when SLA pills are clicked', () => {
    render(
      <CourierShipmentsSection
        shipments={mockShipments}
        providers={mockProviders}
        pendingDeliveries={[]}
        onBookShipment={vi.fn()}
        onTrackShipment={vi.fn()}
        onCancelShipment={vi.fn()}
        onOpenLabel={vi.fn()}
      />
    );

    // Click Critical SLA Breach (>72h) filter
    const breachFilter = screen.getByRole('button', { name: /Critical SLA Breach/i });
    fireEvent.click(breachFilter);

    expect(screen.getByText('PTH-BREACHED')).toBeInTheDocument();
    expect(screen.queryByText('PTH-ON-TRACK')).not.toBeInTheDocument();
    expect(screen.queryByText('PTH-WARNING')).not.toBeInTheDocument();
    expect(screen.queryByText('PTH-DELIVERED')).not.toBeInTheDocument();

    // Click SLA At Risk (>48h) filter
    const warningFilter = screen.getByRole('button', { name: /SLA At Risk/i });
    fireEvent.click(warningFilter);

    expect(screen.getByText('PTH-WARNING')).toBeInTheDocument();
    expect(screen.queryByText('PTH-BREACHED')).not.toBeInTheDocument();
    expect(screen.queryByText('PTH-ON-TRACK')).not.toBeInTheDocument();
  });
});
