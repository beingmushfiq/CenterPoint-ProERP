import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Boxes,
  ChevronRight,
  Package,
  Plus,
  Search,
  Tags,
  Warehouse as WarehouseIcon,
} from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api/client';
import { QueryBoundary } from '../components/patterns/QueryBoundary';
import { AsyncButton } from '../components/ui/AsyncButton';
import { Button } from '../components/ui/Button';
import { FormGroup, Input, Select } from '../components/ui/FormElements';
import { Modal } from '../components/ui/Modal';
import { isApiError } from '../lib/api/errors';
import { useAuthStore } from '../lib/auth/authStore';
import type { Brand, Category, Product, Warehouse } from '../types/api/catalog';

type Section = 'products' | 'categories' | 'brands' | 'warehouses';
type Row = Product | Category | Brand | Warehouse;

const sections: Array<{ id: Section; label: string; icon: typeof Package }> = [
  { id: 'products', label: 'Products', icon: Package },
  { id: 'categories', label: 'Categories', icon: Tags },
  { id: 'brands', label: 'Brands', icon: Boxes },
  { id: 'warehouses', label: 'Warehouses', icon: WarehouseIcon },
];

function endpoint(section: Section): string {
  return `/${section}`;
}

function useCatalogue(section: Section, search: string) {
  return useQuery({
    queryKey: ['catalogue', section, search],
    queryFn: ({ signal }) =>
      api.get<Row[]>(endpoint(section), {
        signal,
        ...(search.length >= 2 ? { params: { q: search } } : {}),
      }),
  });
}

function rowLabel(section: Section, row: Row): string {
  if (section === 'products') return `${(row as Product).name} · ${(row as Product).sku}`;
  const item = row as Category | Brand | Warehouse;
  return `${item.name} · ${item.code}`;
}

function rowMeta(section: Section, row: Row): string {
  if (section === 'products') return (row as Product).status;
  const item = row as Category | Brand | Warehouse;
  return item.is_active ? 'Active' : 'Inactive';
}

interface WarehouseDraft {
  code: string;
  name: string;
  type: string;
}

function mutationErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.code === 'DUPLICATE') return 'That warehouse code is already in use.';
    if (error.code === 'VALIDATION_FAILED') return 'Check the required fields and try again.';
    if (error.code === 'FORBIDDEN') return 'You do not have permission to create warehouses.';
  }
  return 'The warehouse could not be created. Try again.';
}

export default function CataloguePage() {
  const { hasPermission } = useAuthStore();
  const canCreateWarehouse = hasPermission('inventory.warehouse.create');

  const [section, setSection] = useState<Section>('products');
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [draft, setDraft] = useState<WarehouseDraft>({ code: '', name: '', type: 'general' });
  const queryClient = useQueryClient();
  const query = useCatalogue(section, search.trim());
  const rows = query.data?.data ?? [];
  const createWarehouse = useMutation({
    mutationFn: () => api.post<Warehouse>('/warehouses', draft),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['catalogue', 'warehouses'] });
      setDraft({ code: '', name: '', type: 'general' });
      setIsCreateOpen(false);
    },
  });

  const isFormValid = draft.code.trim().length > 0 && draft.name.trim().length > 0;

  return (
    <main className="bg-base text-default min-h-dvh">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-muted text-xs font-semibold tracking-[0.12em] uppercase">
              Master data
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Catalogue workspace</h1>
            <p className="text-muted mt-2 max-w-xl text-sm">
              Keep the records that production, purchasing, and sales depend on in one quiet place.
            </p>
          </div>
        </header>

        <nav className="border-default flex gap-1 border-b overflow-x-auto no-scrollbar scroll-smooth -mx-6 px-6 sm:mx-0 sm:px-0" aria-label="Catalogue sections">
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors min-h-11 cursor-pointer ${section === id ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-default'}`}
              aria-current={section === id ? 'page' : undefined}
            >
              <Icon size={16} aria-hidden="true" /> {label}
            </button>
          ))}
        </nav>

        <section className="flex flex-col gap-5" aria-labelledby="records-heading">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 id="records-heading" className="text-lg font-semibold">
              {sections.find((item) => item.id === section)?.label}
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 w-full sm:w-auto">
              <Input
                aria-label="Search catalogue"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name or code"
                leftElement={<Search size={16} />}
                className="w-full sm:max-w-sm"
              />
              {section === 'warehouses' && canCreateWarehouse && (
                <Button
                  type="button"
                  size="sm"
                  leftIcon={<Plus />}
                  onClick={() => setIsCreateOpen(true)}
                  className="w-full sm:w-auto min-h-10"
                >
                  Add warehouse
                </Button>
              )}
            </div>
          </div>
          <QueryBoundary
            status={query.status}
            error={query.error}
            data={rows}
            isFetching={query.isFetching}
            hasActiveFilters={search.trim().length >= 2}
          >
            <div className="border-default overflow-hidden rounded-(--card-radius) border bg-surface">
              {rows.length === 0 ? (
                <p className="text-muted px-6 py-12 text-center text-sm">No records yet.</p>
              ) : (
                <ul className="divide-default divide-y">
                  {rows.map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-4 px-4 sm:px-5 py-3.5 sm:py-4 min-h-12">
                      <div>
                        <p className="font-medium text-sm">{rowLabel(section, row)}</p>
                        <p className="text-muted mt-1 text-xs">{rowMeta(section, row)}</p>
                      </div>
                      <ChevronRight className="text-subtle shrink-0" size={17} aria-hidden="true" />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </QueryBoundary>
        </section>
      </div>
      <Modal
        open={isCreateOpen}
        onClose={() => {
          if (!createWarehouse.isPending) setIsCreateOpen(false);
        }}
        title="Add warehouse"
        isDirty={draft.code !== '' || draft.name !== ''}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreateOpen(false)}
              disabled={createWarehouse.isPending}
            >
              Cancel
            </Button>
            <AsyncButton
              type="button"
              onClick={async () => {
                await createWarehouse.mutateAsync();
              }}
              disabled={!isFormValid || !canCreateWarehouse}
              errorMessage={mutationErrorMessage(createWarehouse.error)}
            >
              Create warehouse
            </AsyncButton>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FormGroup label="Code" required id="warehouse-code">
            <Input
              id="warehouse-code"
              value={draft.code}
              onChange={(event) =>
                setDraft((current) => ({ ...current, code: event.target.value }))
              }
              maxLength={32}
              autoFocus
            />
          </FormGroup>
          <FormGroup label="Name" required id="warehouse-name">
            <Input
              id="warehouse-name"
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({ ...current, name: event.target.value }))
              }
              maxLength={191}
            />
          </FormGroup>
          <FormGroup label="Type" id="warehouse-type">
            <Select
              id="warehouse-type"
              value={draft.type}
              onChange={(event) =>
                setDraft((current) => ({ ...current, type: event.target.value }))
              }
            >
              <option value="general">General</option>
              <option value="raw_material">Raw material</option>
              <option value="finished_goods">Finished goods</option>
              <option value="packaging">Packaging</option>
              <option value="quarantine">Quarantine</option>
              <option value="scrap">Scrap</option>
              <option value="transit">Transit</option>
            </Select>
          </FormGroup>
        </div>
      </Modal>
    </main>
  );
}
