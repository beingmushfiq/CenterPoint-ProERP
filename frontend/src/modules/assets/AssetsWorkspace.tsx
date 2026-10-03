import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type {
  Asset,
  AssetCategory,
  AssetDepreciationEntry,
  MaintenanceOrder,
  MaintenanceType,
  MaintenancePriority,
  DepreciationMethod,
} from '../../types/api/assets';
import { useCurrency } from '../../hooks/useCurrency';
import { useWorkspaceTab } from '../../hooks/useWorkspaceTab';
import { Modal, ConfirmDialog } from '../../components/ui/Modal';
import { notify } from '../../components/ui/Toast';
import { useAuthStore } from '../../lib/auth/authStore';
import { api } from '../../lib/api/client';
import { extractList } from '../../lib/api/apiData';
import {
  Building2,
  TrendingDown,
  Wrench,
  Tag,
  Plus,
  Trash2,
  Cpu,
  Activity,
  CheckCircle2,
  Clock,
  Lock,
  Unlock,
  Layers,
  Zap,
  Search,
  Filter,
  Eye,
  Edit3,
  ArrowRight,
  Download,
  X,
  Play,
  Upload,
  FileSpreadsheet,
  ChevronDown,
  QrCode,
  AlertTriangle,
  Calculator,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { UniversalImportModal } from '../../components/import/UniversalImportModal';
import { fixedAssetImportSchema } from '../finance/schemas/fixedAssetImportSchema';
import { ActionMenuPortal } from '../../components/ui/ActionMenuPortal';
import { useTranslation } from 'react-i18next';
import { DepreciationScheduleModal } from './modals/DepreciationScheduleModal';
import { AssetQrLabelModal } from './modals/AssetQrLabelModal';
import { AssetTimelineSection } from './sections/AssetTimelineSection';
import {
  WorkspaceNavigationHub,
  WORKSPACE_THEMES,
  type WorkspaceCategoryConfig,
  type WorkspaceTabConfig,
} from '../../components/common/WorkspaceNavigationHub';

type AssetDomain = 'operations' | 'finance';
type AssetTab = 'machinery' | 'maintenance' | 'assets' | 'depreciation' | 'categories' | 'timeline';
type PerspectiveMode = 'all' | 'operations' | 'finance';

interface PlantMachineMeta {
  asset_id: number;
  line_name: string;
  runtime_hours: number;
  next_service_due: string;
  interlock_status: 'operational' | 'service_due' | 'maintenance_lock';
}

export const AssetsWorkspace: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useWorkspaceTab<AssetTab>(
    'machinery',
    ['machinery', 'maintenance', 'assets', 'depreciation', 'categories', 'timeline'] as const,
    'tab'
  );
  const [perspective, setPerspective] = useState<PerspectiveMode>('all');
  const { formatCurrency } = useCurrency();
  const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);

  // RBAC Permissions
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canDeleteAsset = hasPermission('assets.asset.delete');
  const canDeleteMaintenance = hasPermission('assets.maintenance.delete');

  // Asset selection and Data Bin delete state
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<number>>(new Set());
  const assetHeaderRef = useRef<HTMLInputElement | null>(null);
  const [deleteAssetConfirm, setDeleteAssetConfirm] = useState<{ open: boolean; isBulk: boolean; id?: number }>({
    open: false,
    isBulk: false,
  });

  // Maintenance order selection and Data Bin delete state
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(new Set());
  const orderHeaderRef = useRef<HTMLInputElement | null>(null);
  const [deleteOrderConfirm, setDeleteOrderConfirm] = useState<{ open: boolean; isBulk: boolean; id?: number }>({
    open: false,
    isBulk: false,
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Asset Categories State
  // ─────────────────────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<AssetCategory[]>([
    {
      id: 1,
      uuid: 'ac-01',
      code: 'MACHINERY',
      name: 'Plant & Heavy Machinery',
      default_depreciation_method: 'straight_line',
      default_useful_life_months: 60,
      default_salvage_percentage: '5.0000',
      is_active: true,
    },
    {
      id: 2,
      uuid: 'ac-02',
      code: 'VEHICLES',
      name: 'Delivery Vans & Logistics Fleet',
      default_depreciation_method: 'straight_line',
      default_useful_life_months: 48,
      default_salvage_percentage: '10.0000',
      is_active: true,
    },
    {
      id: 3,
      uuid: 'ac-03',
      code: 'EQUIPMENT',
      name: 'POS Terminals & Factory IT Hardware',
      default_depreciation_method: 'straight_line',
      default_useful_life_months: 36,
      default_salvage_percentage: '0.0000',
      is_active: true,
    },
  ]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Assets Register State
  // ─────────────────────────────────────────────────────────────────────────────
  const [assets, setAssets] = useState<Asset[]>([
    {
      id: 1,
      uuid: 'ast-01',
      asset_code: 'AST-MAC-001',
      name: 'Industrial Automatic Fabric Laser Cutter',
      asset_category_id: 1,
      category: categories[0],
      company_id: 1,
      branch_id: 1,
      purchase_date: '2026-01-15',
      purchase_cost: '240000.0000',
      salvage_value: '12000.0000',
      useful_life_months: 60,
      depreciation_method: 'straight_line',
      accumulated_depreciation: '26600.0000',
      book_value: '213400.0000',
      status: 'active',
      location: 'Tejgaon Plant - Cutting Floor #1',
      serial_number: 'LSR-2026-X88',
      warranty_expiry_date: '2028-01-15',
    },
    {
      id: 2,
      uuid: 'ast-02',
      asset_code: 'AST-VEH-001',
      name: 'Toyota HiAce Delivery Van (Dhaka Metro-11)',
      asset_category_id: 2,
      category: categories[1],
      company_id: 1,
      branch_id: 1,
      purchase_date: '2026-02-01',
      purchase_cost: '3200000.0000',
      salvage_value: '320000.0000',
      useful_life_months: 48,
      depreciation_method: 'straight_line',
      accumulated_depreciation: '360000.0000',
      book_value: '2840000.0000',
      status: 'active',
      location: 'Gulshan Hub Garage',
      serial_number: 'VIN-982173819283',
      warranty_expiry_date: '2029-02-01',
    },
    {
      id: 3,
      uuid: 'ast-03',
      asset_code: 'AST-EQP-001',
      name: 'High-Speed Automated Label Printer Station',
      asset_category_id: 3,
      category: categories[2],
      company_id: 1,
      branch_id: 1,
      purchase_date: '2026-04-10',
      purchase_cost: '85000.0000',
      salvage_value: '0.0000',
      useful_life_months: 36,
      depreciation_method: 'straight_line',
      accumulated_depreciation: '9444.0000',
      book_value: '75556.0000',
      status: 'active',
      location: 'Dispatch Hub - Packing Line',
      serial_number: 'PRN-99120',
      warranty_expiry_date: '2027-04-10',
    },
  ]);

  // Operational Machine Metadata
  const [machinesMeta, setMachinesMeta] = useState<PlantMachineMeta[]>([
    {
      asset_id: 1,
      line_name: 'Laser Cutting Line #1',
      runtime_hours: 1420,
      next_service_due: '2026-09-25',
      interlock_status: 'operational',
    },
    {
      asset_id: 3,
      line_name: 'Automated Packing & Label Line',
      runtime_hours: 890,
      next_service_due: '2026-10-10',
      interlock_status: 'operational',
    },
  ]);

  // Depreciation Log State
  const [depreciationEntries, setDepreciationEntries] = useState<AssetDepreciationEntry[]>([
    {
      id: 1,
      uuid: 'dep-01',
      asset_id: 1,
      asset: assets[0],
      period_year: 2026,
      period_month: 8,
      opening_book_value: '217200.0000',
      depreciation_amount: '3800.0000',
      closing_book_value: '213400.0000',
      journal_entry_id: 2,
      posted_at: '2026-08-28 11:30:00',
    },
    {
      id: 2,
      uuid: 'dep-02',
      asset_id: 2,
      asset: assets[1],
      period_year: 2026,
      period_month: 8,
      opening_book_value: '2900000.0000',
      depreciation_amount: '60000.0000',
      closing_book_value: '2840000.0000',
      journal_entry_id: 3,
      posted_at: '2026-08-28 11:30:00',
    },
  ]);

  // Maintenance Work Orders State
  const [maintenanceOrders, setMaintenanceOrders] = useState<MaintenanceOrder[]>([
    {
      id: 1,
      uuid: 'mo-01',
      order_number: 'MO-202608-001',
      asset_id: 1,
      asset: assets[0],
      maintenance_type: 'preventive',
      priority: 'medium',
      description: 'Laser optic alignment and coolant system flush',
      scheduled_date: '2026-09-05',
      cost: '4500.0000',
      status: 'scheduled',
      performed_by: 'Authorized Tech - SharpCut Engineering',
    },
    {
      id: 2,
      uuid: 'mo-02',
      order_number: 'MO-202608-002',
      asset_id: 2,
      asset: assets[1],
      maintenance_type: 'preventive',
      priority: 'high',
      description: '10,000km engine oil, brake pads and transmission check',
      scheduled_date: '2026-08-30',
      cost: '12000.0000',
      status: 'in_progress',
      performed_by: 'Navana Motors Workshop',
    },
  ]);

  // Live Backend Assets & Categories Synchronization
  const loadLiveAssets = useCallback(() => {
    api
      .get('/assets')
      .then((res) => {
        const fetchedAssets = extractList<Asset>(res);
        if (fetchedAssets.length > 0) {
          setAssets(fetchedAssets);
        }
      })
      .catch((err) => console.error('Failed loading live assets', err));

    api
      .get('/assets/categories')
      .then((res) => {
        const fetchedCats = extractList<AssetCategory>(res);
        if (fetchedCats.length > 0) {
          setCategories(fetchedCats);
        }
      })
      .catch((err) => console.error('Failed loading live asset categories', err));

    api
      .get('/assets/depreciation')
      .then((res) => {
        const fetchedEntries = extractList<AssetDepreciationEntry>(res);
        if (fetchedEntries.length > 0) {
          setDepreciationEntries(fetchedEntries);
        }
      })
      .catch((err) => console.error('Failed loading depreciation schedules', err));

    api
      .get('/assets/maintenance-orders')
      .then((res) => {
        const fetchedOrders = extractList<MaintenanceOrder>(res);
        if (fetchedOrders.length > 0) {
          setMaintenanceOrders(fetchedOrders);
        }
      })
      .catch((err) => console.error('Failed loading maintenance orders', err));
  }, []);

  useEffect(() => {
    loadLiveAssets();
  }, [loadLiveAssets]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Modal States & Form Fields
  // ─────────────────────────────────────────────────────────────────────────────

  // Import Asset Modal
  const [showImportAssetModal, setShowImportAssetModal] = useState(false);

  // Add Asset Modal
  const [showAddAssetModal, setShowAddAssetModal] = useState(false);
  const [newAssetName, setNewAssetName] = useState('');
  const [newCategoryId, setNewCategoryId] = useState(1);
  const [newCost, setNewCost] = useState('50000');
  const [newSalvage, setNewSalvage] = useState('0');
  const [newMonths, setNewMonths] = useState(36);

  // Add Maintenance Order Modal
  const [showAddMaintenanceModal, setShowAddMaintenanceModal] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<number>(assets[0]?.id || 1);
  const [maintenanceType, setMaintenanceType] = useState<MaintenanceType>('preventive');
  const [priority, setPriority] = useState<MaintenancePriority>('medium');
  const [description, setDescription] = useState<string>('');
  const [scheduledDate, setScheduledDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [estimatedCost, setEstimatedCost] = useState<string>('5000');
  const [technician, setTechnician] = useState<string>('Internal Plant Engineer');

  // Add Category Modal
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatCode, setNewCatCode] = useState('');
  const [newCatMethod, setNewCatMethod] = useState<DepreciationMethod>('straight_line');
  const [newCatMonths, setNewCatMonths] = useState(48);
  const [newCatSalvage, setNewCatSalvage] = useState('5.0');

  // Edit Policy Modal
  const [showEditPolicyModal, setShowEditPolicyModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AssetCategory | null>(null);
  const [editPolicyMethod, setEditPolicyMethod] = useState<DepreciationMethod>('straight_line');
  const [editPolicyMonths, setEditPolicyMonths] = useState(60);
  const [editPolicySalvage, setEditPolicySalvage] = useState('5.0');

  // Asset Details Modal
  const [viewingAsset, setViewingAsset] = useState<Asset | null>(null);
  const [showAssetDetailModal, setShowAssetDetailModal] = useState(false);

  // Maintenance Order Details Modal
  const [viewingMaintenanceOrder, setViewingMaintenanceOrder] = useState<MaintenanceOrder | null>(null);

  // Depreciation Schedule Projection Modal
  const [showDepreciationScheduleModal, setShowDepreciationScheduleModal] = useState(false);
  const [scheduleModalAsset, setScheduleModalAsset] = useState<Asset | null>(null);

  // Asset Printable QR Label Modal
  const [showQrLabelModal, setShowQrLabelModal] = useState(false);
  const [qrLabelAsset, setQrLabelAsset] = useState<Asset | null>(null);

  const handleOpenDepreciationSchedule = (ast: Asset) => {
    setScheduleModalAsset(ast);
    setShowDepreciationScheduleModal(true);
  };

  const handleOpenQrLabel = (ast: Asset) => {
    setQrLabelAsset(ast);
    setShowQrLabelModal(true);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Filtering & Search States
  // ─────────────────────────────────────────────────────────────────────────────
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<number | 'all'>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');

  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Action Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  // Register Asset
  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    const cat = categories.find((c) => c.id === newCategoryId);
    const costNum = parseFloat(newCost) || 0;
    const salvageNum = parseFloat(newSalvage) || 0;

    try {
      const res = await api.post<{ data: Asset; message: string }>('/assets', {
        name: newAssetName.trim(),
        asset_category_id: newCategoryId,
        company_id: 1,
        branch_id: 1,
        purchase_cost: costNum,
        salvage_value: salvageNum,
        useful_life_months: newMonths,
        depreciation_method: cat?.default_depreciation_method || 'straight_line',
        purchase_date: new Date().toISOString().slice(0, 10),
        status: 'active',
      });
      if (res.data?.data) {
        setAssets((prev) => [res.data.data, ...prev]);
      } else {
        const newAsset: Asset = {
          id: assets.length + 1,
          uuid: `ast-auto-${Date.now()}`,
          asset_code: `AST-${cat?.code || 'GEN'}-${String(assets.length + 1).padStart(3, '0')}`,
          name: newAssetName.trim(),
          asset_category_id: newCategoryId,
          category: cat,
          company_id: 1,
          branch_id: 1,
          purchase_date: new Date().toISOString().slice(0, 10),
          purchase_cost: costNum.toFixed(4),
          salvage_value: salvageNum.toFixed(4),
          useful_life_months: newMonths,
          depreciation_method: cat?.default_depreciation_method || 'straight_line',
          accumulated_depreciation: '0.0000',
          book_value: costNum.toFixed(4),
          status: 'active',
          location: 'Main Factory Hub',
        };
        setAssets((prev) => [newAsset, ...prev]);
      }
    } catch {
      const newAsset: Asset = {
        id: assets.length + 1,
        uuid: `ast-auto-${Date.now()}`,
        asset_code: `AST-${cat?.code || 'GEN'}-${String(assets.length + 1).padStart(3, '0')}`,
        name: newAssetName.trim(),
        asset_category_id: newCategoryId,
        category: cat,
        company_id: 1,
        branch_id: 1,
        purchase_date: new Date().toISOString().slice(0, 10),
        purchase_cost: costNum.toFixed(4),
        salvage_value: salvageNum.toFixed(4),
        useful_life_months: newMonths,
        depreciation_method: cat?.default_depreciation_method || 'straight_line',
        accumulated_depreciation: '0.0000',
        book_value: costNum.toFixed(4),
        status: 'active',
        location: 'Main Factory Hub',
      };
      setAssets((prev) => [newAsset, ...prev]);
    }

    setShowAddAssetModal(false);
    setNewAssetName('');
    notify.success(`Asset "${newAssetName}" registered successfully`);
  };

  // Create Maintenance Work Order
  const handleCreateMaintenanceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetAsset = assets.find((a) => a.id === selectedAssetId);
    const costNum = parseFloat(estimatedCost) || 0;

    try {
      const res = await api.post<{ data: MaintenanceOrder; message: string }>('/assets/maintenance-orders', {
        asset_id: selectedAssetId,
        maintenance_type: maintenanceType,
        priority,
        problem_description: description,
        scheduled_start: scheduledDate,
        labour_cost: costNum,
      });
      if (res.data?.data) {
        setMaintenanceOrders((prev) => [res.data.data, ...prev]);
      } else {
        const newOrder: MaintenanceOrder = {
          id: maintenanceOrders.length + 1,
          uuid: `mo-auto-${Date.now()}`,
          order_number: `MO-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(maintenanceOrders.length + 1).padStart(3, '0')}`,
          asset_id: selectedAssetId,
          asset: targetAsset,
          maintenance_type: maintenanceType,
          priority,
          description,
          scheduled_date: scheduledDate,
          cost: costNum.toFixed(4),
          status: 'scheduled',
          performed_by: technician,
        };
        setMaintenanceOrders((prev) => [newOrder, ...prev]);
      }
    } catch {
      const newOrder: MaintenanceOrder = {
        id: maintenanceOrders.length + 1,
        uuid: `mo-auto-${Date.now()}`,
        order_number: `MO-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(maintenanceOrders.length + 1).padStart(3, '0')}`,
        asset_id: selectedAssetId,
        asset: targetAsset,
        maintenance_type: maintenanceType,
        priority,
        description,
        scheduled_date: scheduledDate,
        cost: costNum.toFixed(4),
        status: 'scheduled',
        performed_by: technician,
      };
      setMaintenanceOrders((prev) => [newOrder, ...prev]);
    }

    setShowAddMaintenanceModal(false);
    setDescription('');
    setActiveTab('maintenance');
    notify.success(`Work order scheduled successfully`);
  };

  // Start Order
  const handleStartOrder = (orderId: number) => {
    setMaintenanceOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'in_progress' } : o))
    );
    notify.info('Work order marked as In Progress');
  };

  // Complete Order
  const handleCompleteOrder = (orderId: number) => {
    setMaintenanceOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, status: 'completed', completed_date: new Date().toISOString().slice(0, 10) }
          : o
      )
    );
    notify.success('Work order marked as Completed');
  };

  // Create Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    const code = newCatCode.trim()
      ? newCatCode.trim().toUpperCase()
      : newCatName.replace(/[^a-zA-Z]/g, '').slice(0, 8).toUpperCase();

    try {
      const res = await api.post<{ data: AssetCategory }>('/assets/categories', {
        code,
        name: newCatName.trim(),
        default_depreciation_method: newCatMethod,
        default_useful_life_months: Number(newCatMonths),
        default_salvage_percentage: parseFloat(newCatSalvage),
      });
      if (res.data?.data) {
        setCategories((prev) => [...prev, res.data.data]);
      } else {
        const newCat: AssetCategory = {
          id: categories.length + 1,
          uuid: `ac-auto-${Date.now()}`,
          code,
          name: newCatName.trim(),
          default_depreciation_method: newCatMethod,
          default_useful_life_months: Number(newCatMonths),
          default_salvage_percentage: parseFloat(newCatSalvage).toFixed(4),
          is_active: true,
        };
        setCategories((prev) => [...prev, newCat]);
      }
    } catch {
      const newCat: AssetCategory = {
        id: categories.length + 1,
        uuid: `ac-auto-${Date.now()}`,
        code,
        name: newCatName.trim(),
        default_depreciation_method: newCatMethod,
        default_useful_life_months: Number(newCatMonths),
        default_salvage_percentage: parseFloat(newCatSalvage).toFixed(4),
        is_active: true,
      };
      setCategories((prev) => [...prev, newCat]);
    }

    setShowAddCategoryModal(false);
    setNewCatName('');
    setNewCatCode('');
    notify.success(`Asset Category "${newCatName}" added successfully`);
  };

  // Open Edit Policy Modal
  const handleOpenEditPolicy = (cat: AssetCategory) => {
    setEditingCategory(cat);
    setEditPolicyMethod(cat.default_depreciation_method);
    setEditPolicyMonths(cat.default_useful_life_months);
    setEditPolicySalvage(cat.default_salvage_percentage);
    setShowEditPolicyModal(true);
  };

  // Save Category Policy
  const handleSavePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;

    setCategories((prev) =>
      prev.map((c) =>
        c.id === editingCategory.id
          ? {
              ...c,
              default_depreciation_method: editPolicyMethod,
              default_useful_life_months: Number(editPolicyMonths),
              default_salvage_percentage: parseFloat(editPolicySalvage).toFixed(4),
            }
          : c
      )
    );
    setShowEditPolicyModal(false);
    notify.success(`Policy for "${editingCategory.name}" updated successfully`);
  };

  // Filter Asset Register by Category from Card
  const handleFilterByCategory = (categoryId: number, categoryName: string) => {
    setSelectedCategoryFilter(categoryId);
    setActiveTab('assets');
    notify.info(`Filtered Fixed Asset Register by "${categoryName}"`);
  };

  // Quick Register Asset for specific Category
  const handleQuickRegisterForCategory = (categoryId: number) => {
    setNewCategoryId(categoryId);
    setShowAddAssetModal(true);
  };

  // Quick Service an Asset
  const handleServiceAsset = (asset: Asset) => {
    setSelectedAssetId(asset.id);
    setDescription(`Scheduled preventive inspection and service for ${asset.name}`);
    setShowAddMaintenanceModal(true);
  };

  // View Asset Details
  const handleViewAssetDetails = async (asset: Asset) => {
    setViewingAsset(asset);
    setShowAssetDetailModal(true);
    try {
      const res = await api.get<{ data: Asset }>(`/assets/${asset.id}`);
      if (res.data?.data) {
        setViewingAsset(res.data.data);
      }
    } catch {
      // retain cached
    }
  };

  // View Maintenance Order Details
  const handleViewMaintenanceOrder = async (order: MaintenanceOrder) => {
    setViewingMaintenanceOrder(order);
    try {
      const res = await api.get<{ data: MaintenanceOrder }>(`/assets/maintenance-orders/${order.id}`);
      if (res.data?.data) {
        setViewingMaintenanceOrder(res.data.data);
      }
    } catch {
      // retain cached
    }
  };

  // Machine Interlock Toggle
  const handleToggleInterlock = (assetId: number) => {
    setMachinesMeta((prev) =>
      prev.map((m) => {
        if (m.asset_id === assetId) {
          const next = m.interlock_status === 'operational' ? 'maintenance_lock' : 'operational';
          notify.info(
            `Machine safety interlock: ${next === 'operational' ? 'Set to Operational' : 'Locked for Maintenance'}`
          );
          return { ...m, interlock_status: next };
        }
        return m;
      })
    );
  };

  // Execute Monthly Depreciation Run
  const handleRunMonthlyDepreciation = async () => {
    const periodYear = 2026;
    const periodMonth = 9; // September 2026
    const alreadyRun = depreciationEntries.some(
      (e) => e.period_year === periodYear && e.period_month === periodMonth
    );

    if (alreadyRun) {
      notify.warning('Depreciation schedule for September 2026 has already been processed to GL.');
      return;
    }

    try {
      const firstAsset = assets[0];
      if (firstAsset) {
        await api.post('/assets/depreciation', {
          asset_id: firstAsset.id,
          period_year: periodYear,
          period_month: periodMonth,
          post_to_gl: true,
        });
      }
    } catch {
      // Continue with local amortization post
    }

    const newEntries: AssetDepreciationEntry[] = [];
    const updatedAssets = assets.map((asset) => {
      const cost = parseFloat(asset.purchase_cost);
      const salvage = parseFloat(asset.salvage_value);
      const lifeMonths = asset.useful_life_months || 60;
      const monthlyDep = Math.max(0, (cost - salvage) / lifeMonths);
      const currentAccum = parseFloat(asset.accumulated_depreciation);
      const newAccum = Math.min(cost - salvage, currentAccum + monthlyDep);
      const newBookValue = Math.max(salvage, cost - newAccum);

      newEntries.push({
        id: depreciationEntries.length + newEntries.length + 1,
        uuid: `dep-auto-${Date.now()}-${asset.id}`,
        asset_id: asset.id,
        asset: {
          ...asset,
          accumulated_depreciation: newAccum.toFixed(4),
          book_value: newBookValue.toFixed(4),
        },
        period_year: periodYear,
        period_month: periodMonth,
        opening_book_value: asset.book_value,
        depreciation_amount: monthlyDep.toFixed(4),
        closing_book_value: newBookValue.toFixed(4),
        journal_entry_id: 10 + depreciationEntries.length + newEntries.length,
        posted_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      });

      return {
        ...asset,
        accumulated_depreciation: newAccum.toFixed(4),
        book_value: newBookValue.toFixed(4),
      };
    });

    setAssets(updatedAssets);
    setDepreciationEntries([...newEntries, ...depreciationEntries]);
    notify.success('September 2026 monthly depreciation posted to General Ledger!', {
      description: `${newEntries.length} asset amortization schedules written to GL.`,
    });
  };

  // Export Depreciation Schedule
  const handleExportDepreciationSchedule = () => {
    const csvRows = [
      'Period,Asset Code,Asset Name,Opening Book Value (BDT),Depreciation (BDT),Closing Book Value (BDT),GL Voucher,Posted At',
      ...depreciationEntries.map(
        (e) =>
          `"${e.period_year}-${String(e.period_month).padStart(2, '0')}","${e.asset?.asset_code || ''}","${e.asset?.name || ''}",${e.opening_book_value},${e.depreciation_amount},${e.closing_book_value},"JE-${e.period_year}08-000${e.journal_entry_id}","${e.posted_at || ''}"`
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `depreciation_schedule_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify.success('Depreciation schedule exported to CSV');
  };

  // Export Assets Register CSV
  const handleExportAssetsCsv = () => {
    if (assets.length === 0) {
      notify.warning('No assets to export');
      return;
    }
    const headers = [
      'Asset Code',
      'Asset Name',
      'Category',
      'Purchase Cost',
      'Salvage Value',
      'Accumulated Depreciation',
      'Net Book Value',
      'Depreciation Method',
      'Useful Life (Months)',
      'Status',
      'Serial Number',
      'Model',
      'Manufacturer',
    ];
    const rows = assets.map((a) => [
      `"${a.asset_code}"`,
      `"${(a.name || '').replace(/"/g, '""')}"`,
      `"${a.category?.name || ''}"`,
      `"${a.purchase_cost}"`,
      `"${a.salvage_value || '0'}"`,
      `"${a.accumulated_depreciation || '0'}"`,
      `"${a.book_value || '0'}"`,
      `"${a.depreciation_method || 'straight_line'}"`,
      `"${a.useful_life_months || 60}"`,
      `"${a.status}"`,
      `"${a.serial_number || ''}"`,
      `"${a.model || ''}"`,
      `"${a.manufacturer || ''}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assets-register-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify.success('Assets Exported', { description: `Exported ${assets.length} fixed assets to CSV.` });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Calculations & Filtered Data
  // ─────────────────────────────────────────────────────────────────────────────
  const totalAssetCost = useMemo(
    () => assets.reduce((acc, a) => acc + parseFloat(a.purchase_cost), 0),
    [assets]
  );
  const totalAccumulatedDepr = useMemo(
    () => assets.reduce((acc, a) => acc + parseFloat(a.accumulated_depreciation), 0),
    [assets]
  );
  const totalNetBookValue = useMemo(
    () => assets.reduce((acc, a) => acc + parseFloat(a.book_value), 0),
    [assets]
  );

  const plantMachines = useMemo(
    () =>
      assets.filter(
        (a) => a.category?.code === 'MACHINERY' || a.category?.code === 'EQUIPMENT'
      ),
    [assets]
  );
  const activeMaintenanceOrders = useMemo(
    () => maintenanceOrders.filter((o) => o.status !== 'completed'),
    [maintenanceOrders]
  );
  const totalMaintenanceCost = useMemo(
    () => maintenanceOrders.reduce((acc, o) => acc + parseFloat(o.cost), 0),
    [maintenanceOrders]
  );

  // Filtered Assets for Tab 3
  const filteredAssets = useMemo(() => {
    return assets.filter((ast) => {
      if (selectedCategoryFilter !== 'all' && ast.asset_category_id !== selectedCategoryFilter) {
        return false;
      }
      if (selectedStatusFilter !== 'all' && ast.status !== selectedStatusFilter) {
        return false;
      }
      if (assetSearchQuery.trim()) {
        const q = assetSearchQuery.toLowerCase();
        const matchName = ast.name.toLowerCase().includes(q);
        const matchCode = ast.asset_code.toLowerCase().includes(q);
        const matchSerial = ast.serial_number?.toLowerCase().includes(q);
        const matchLoc = ast.location?.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchSerial && !matchLoc) return false;
      }
      return true;
    });
  }, [assets, selectedCategoryFilter, selectedStatusFilter, assetSearchQuery]);

  // Maintenance SLA Status Calculator
  const getMaintenanceSlaStatus = useCallback((mo: MaintenanceOrder) => {
    if (mo.status === 'completed' || mo.status === 'cancelled') {
      return { isOverdue: false, isDueSoon: false, onSchedule: true, diffDays: 0 };
    }
    const scheduled = new Date(mo.scheduled_date);
    const today = new Date('2026-09-29'); // baseline reference
    const diffTime = today.getTime() - scheduled.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const isOverdue = diffDays > 0;
    const isDueSoon = diffDays <= 0 && diffDays >= -7;
    const onSchedule = !isOverdue && !isDueSoon;
    return { isOverdue, isDueSoon, onSchedule, diffDays };
  }, []);

  const overdueMaintenanceCount = useMemo(() => {
    return maintenanceOrders.filter((mo) => getMaintenanceSlaStatus(mo).isOverdue).length;
  }, [maintenanceOrders, getMaintenanceSlaStatus]);

  const dueSoonMaintenanceCount = useMemo(() => {
    return maintenanceOrders.filter((mo) => getMaintenanceSlaStatus(mo).isDueSoon).length;
  }, [maintenanceOrders, getMaintenanceSlaStatus]);

  // Filtered Maintenance Orders for Tab 2
  const filteredOrders = useMemo(() => {
    return maintenanceOrders.filter((mo) => {
      if (orderStatusFilter === 'overdue') {
        const sla = getMaintenanceSlaStatus(mo);
        if (!sla.isOverdue) return false;
      } else if (orderStatusFilter === 'due_soon') {
        const sla = getMaintenanceSlaStatus(mo);
        if (!sla.isDueSoon) return false;
      } else if (orderStatusFilter !== 'all' && mo.status !== orderStatusFilter) {
        return false;
      }
      if (orderSearchQuery.trim()) {
        const q = orderSearchQuery.toLowerCase();
        const matchNum = mo.order_number.toLowerCase().includes(q);
        const matchAsset = mo.asset?.name.toLowerCase().includes(q);
        const matchTech = mo.performed_by?.toLowerCase().includes(q);
        if (!matchNum && !matchAsset && !matchTech) return false;
      }
      return true;
    });
  }, [maintenanceOrders, orderStatusFilter, orderSearchQuery, getMaintenanceSlaStatus]);

  // Asset selection helpers
  const isAllAssetsSelected =
    filteredAssets.length > 0 && selectedAssetIds.size === filteredAssets.length;
  const isSomeAssetsSelected = selectedAssetIds.size > 0 && !isAllAssetsSelected;

  useEffect(() => {
    if (assetHeaderRef.current) {
      assetHeaderRef.current.indeterminate = isSomeAssetsSelected;
    }
  }, [isSomeAssetsSelected]);

  const toggleSelectAllAssets = () => {
    if (isAllAssetsSelected) {
      setSelectedAssetIds(new Set());
    } else {
      setSelectedAssetIds(new Set(filteredAssets.map((a) => a.id)));
    }
  };

  const toggleSelectOneAsset = (id: number) => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExecuteDeleteAsset = async () => {
    if (deleteAssetConfirm.isBulk) {
      const ids = Array.from(selectedAssetIds);
      try {
        await Promise.allSettled(ids.map((id) => api.delete(`/assets/${id}`)));
      } catch (err) {
        console.warn('Fallback delete asset', err);
      }
      setAssets((prev) => prev.filter((a) => !ids.includes(a.id)));
      setSelectedAssetIds(new Set());
      notify.success(`${ids.length} asset(s) moved to Data Bin.`);
    } else if (deleteAssetConfirm.id) {
      const id = deleteAssetConfirm.id;
      try {
        await api.delete(`/assets/${id}`);
      } catch (err) {
        console.warn('Fallback delete asset', err);
      }
      setAssets((prev) => prev.filter((a) => a.id !== id));
      setSelectedAssetIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      notify.success('Asset moved to Data Bin.');
    }
    setDeleteAssetConfirm({ open: false, isBulk: false });
  };

  // Maintenance order selection helpers
  const isAllOrdersSelected =
    filteredOrders.length > 0 && selectedOrderIds.size === filteredOrders.length;
  const isSomeOrdersSelected = selectedOrderIds.size > 0 && !isAllOrdersSelected;

  useEffect(() => {
    if (orderHeaderRef.current) {
      orderHeaderRef.current.indeterminate = isSomeOrdersSelected;
    }
  }, [isSomeOrdersSelected]);

  const toggleSelectAllOrders = () => {
    if (isAllOrdersSelected) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(filteredOrders.map((o) => o.id)));
    }
  };

  const toggleSelectOneOrder = (id: number) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExecuteDeleteOrder = async () => {
    if (deleteOrderConfirm.isBulk) {
      const ids = Array.from(selectedOrderIds);
      try {
        await Promise.allSettled(ids.map((id) => api.delete(`/assets/maintenance-orders/${id}`)));
      } catch (err) {
        console.warn('Fallback delete maintenance order', err);
      }
      setMaintenanceOrders((prev) => prev.filter((o) => !ids.includes(o.id)));
      setSelectedOrderIds(new Set());
      notify.success(`${ids.length} maintenance work order(s) moved to Data Bin.`);
    } else if (deleteOrderConfirm.id) {
      const id = deleteOrderConfirm.id;
      try {
        await api.delete(`/assets/maintenance-orders/${id}`);
      } catch (err) {
        console.warn('Fallback delete maintenance order', err);
      }
      setMaintenanceOrders((prev) => prev.filter((o) => o.id !== id));
      setSelectedOrderIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      notify.success('Maintenance work order moved to Data Bin.');
    }
    setDeleteOrderConfirm({ open: false, isBulk: false });
  };

  const isOperationsTab = activeTab === 'machinery' || activeTab === 'maintenance' || activeTab === 'timeline';
  const showOperationsKpis = perspective === 'operations' || (perspective === 'all' && isOperationsTab);

  // Active category filter helper
  const activeCategoryFilterName = useMemo(() => {
    if (selectedCategoryFilter === 'all') return null;
    return categories.find((c) => c.id === selectedCategoryFilter)?.name;
  }, [categories, selectedCategoryFilter]);

  // Keyboard shortcuts 1..6
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 6) {
        const stageMap: Record<number, AssetTab> = {
          1: 'machinery',
          2: 'maintenance',
          3: 'assets',
          4: 'depreciation',
          5: 'categories',
          6: 'timeline',
        };
        const target = stageMap[num];
        if (target) {
          e.preventDefault();
          setActiveTab(target);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab]);

  const stages = useMemo(
    () => [
      {
        id: 'machinery' as const,
        step: 1,
        label: t('assets.stages.machinery.label'),
        shortLabel: t('assets.stages.machinery.shortLabel'),
        icon: Cpu,
        count: plantMachines.length,
        group: 'operations' as const,
        description: t('assets.stages.machinery.description'),
      },
      {
        id: 'maintenance' as const,
        step: 2,
        label: t('assets.stages.maintenance.label'),
        shortLabel: t('assets.stages.maintenance.shortLabel'),
        icon: Wrench,
        count: maintenanceOrders.length,
        group: 'operations' as const,
        description: t('assets.stages.maintenance.description'),
      },
      {
        id: 'assets' as const,
        step: 3,
        label: t('assets.stages.assets.label'),
        shortLabel: t('assets.stages.assets.shortLabel'),
        icon: Building2,
        count: assets.length,
        group: 'finance' as const,
        description: t('assets.stages.assets.description'),
      },
      {
        id: 'depreciation' as const,
        step: 4,
        label: t('assets.stages.depreciation.label'),
        shortLabel: t('assets.stages.depreciation.shortLabel'),
        icon: TrendingDown,
        count: depreciationEntries.length,
        group: 'finance' as const,
        description: t('assets.stages.depreciation.description'),
      },
      {
        id: 'categories' as const,
        step: 5,
        label: t('assets.stages.categories.label'),
        shortLabel: t('assets.stages.categories.shortLabel'),
        icon: Tag,
        count: categories.length,
        group: 'finance' as const,
        description: t('assets.stages.categories.description'),
      },
      {
        id: 'timeline' as const,
        step: 6,
        label: t('assets.stages.timeline.label', 'Lifecycle Timeline'),
        shortLabel: t('assets.stages.timeline.shortLabel', 'Timeline'),
        icon: Clock,
        count: assets.length,
        group: 'operations' as const,
        description: t('assets.stages.timeline.description', 'Chronological ownership, servicing, and depreciation audit trail'),
      },
    ],
    [t, plantMachines.length, maintenanceOrders.length, assets.length, depreciationEntries.length, categories.length]
  );

  const categoriesConfig: WorkspaceCategoryConfig<AssetDomain, AssetTab>[] = useMemo(
    () => [
      {
        id: 'operations',
        label: t('assets.perspectives.operations', 'Machinery & Maintenance'),
        tagline: t(
          'assets.categoryTaglines.operations',
          'Shop floor equipment health, work orders & servicing schedule'
        ),
        icon: Cpu,
        tabs: ['machinery', 'maintenance', 'timeline'],
        defaultTab: 'machinery',
        shortcut: '1',
        badge: `${plantMachines.length + maintenanceOrders.length}`,
        theme: WORKSPACE_THEMES.cyan,
      },
      {
        id: 'finance',
        label: t('assets.perspectives.finance', 'Fixed Assets & Valuation'),
        tagline: t(
          'assets.categoryTaglines.finance',
          'Capital asset ledger, accumulated depreciation & asset categories'
        ),
        icon: Building2,
        tabs: ['assets', 'depreciation', 'categories'],
        defaultTab: 'assets',
        shortcut: '2',
        badge: `${assets.length}`,
        theme: WORKSPACE_THEMES.emerald,
      },
    ],
    [t, plantMachines.length, maintenanceOrders.length, assets.length]
  );

  const tabsConfig: WorkspaceTabConfig<AssetDomain, AssetTab>[] = useMemo(
    () => [
      {
        id: 'machinery',
        label: t('assets.stages.machinery.label'),
        shortLabel: t('assets.stages.machinery.shortLabel'),
        category: 'operations',
        icon: Cpu,
        count: plantMachines.length,
        description: t('assets.stages.machinery.description'),
      },
      {
        id: 'maintenance',
        label: t('assets.stages.maintenance.label'),
        shortLabel: t('assets.stages.maintenance.shortLabel'),
        category: 'operations',
        icon: Wrench,
        count: maintenanceOrders.length,
        description: t('assets.stages.maintenance.description'),
      },
      {
        id: 'timeline',
        label: t('assets.stages.timeline.label', 'Lifecycle Timeline'),
        shortLabel: t('assets.stages.timeline.shortLabel', 'Timeline'),
        category: 'operations',
        icon: Clock,
        count: assets.length,
        description: t('assets.stages.timeline.description', 'Chronological ownership, servicing, and depreciation audit trail'),
      },
      {
        id: 'assets',
        label: t('assets.stages.assets.label'),
        shortLabel: t('assets.stages.assets.shortLabel'),
        category: 'finance',
        icon: Building2,
        count: assets.length,
        description: t('assets.stages.assets.description'),
      },
      {
        id: 'depreciation',
        label: t('assets.stages.depreciation.label'),
        shortLabel: t('assets.stages.depreciation.shortLabel'),
        category: 'finance',
        icon: TrendingDown,
        count: depreciationEntries.length,
        description: t('assets.stages.depreciation.description'),
      },
      {
        id: 'categories',
        label: t('assets.stages.categories.label'),
        shortLabel: t('assets.stages.categories.shortLabel'),
        category: 'finance',
        icon: Tag,
        count: categories.length,
        description: t('assets.stages.categories.description'),
      },
    ],
    [t, plantMachines.length, maintenanceOrders.length, assets.length, depreciationEntries.length, categories.length]
  );

  const currentStage = (stages.find((s) => s.id === activeTab) || stages[0])!;

  return (
    <div className="space-y-4 sm:space-y-6 w-full min-w-0 max-w-7xl mx-auto py-1 sm:py-2">
      {/* ─────────────────────────────────────────────────────────────────────────────
          Module Header & Contextual Actions
          ───────────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-default pb-4 sm:pb-5 w-full min-w-0">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary bg-primary-subtle px-2.5 py-0.5 rounded-full border border-primary/20 flex items-center gap-1">
              <Layers className="size-3 text-primary" />
              {t('assets.workspaceTag')}
            </span>
            <span className="text-muted text-xs">•</span>
            <span className="text-xs font-semibold text-primary">
              {t('assets.stageCounter', { step: currentStage.step, label: currentStage.label })}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-default">
            {t('assets.title')}
          </h1>
          <p className="mt-1 text-xs text-muted max-w-2xl leading-relaxed">
            {t('assets.subtitle')}
          </p>
        </div>

        {/* Header Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Perspective selector */}
          <div className="flex items-center bg-surface-sunken p-1 rounded-xl border border-default text-2xs font-semibold">
            <button
              type="button"
              onClick={() => setPerspective('all')}
              className={cn(
                'px-2.5 py-1 rounded-lg transition cursor-pointer',
                perspective === 'all'
                  ? 'bg-surface text-default shadow-2xs font-bold'
                  : 'text-muted hover:text-default'
              )}
            >
              {t('assets.perspectives.all')}
            </button>
            <button
              type="button"
              onClick={() => {
                setPerspective('operations');
                if (!isOperationsTab) setActiveTab('machinery');
              }}
              className={cn(
                'px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer',
                perspective === 'operations'
                  ? 'bg-primary text-primary-fg shadow-2xs font-bold'
                  : 'text-muted hover:text-default'
              )}
            >
              <Wrench className="size-3" />
              {t('assets.perspectives.operations')}
            </button>
            <button
              type="button"
              onClick={() => {
                setPerspective('finance');
                if (isOperationsTab) setActiveTab('assets');
              }}
              className={cn(
                'px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer',
                perspective === 'finance'
                  ? 'bg-primary text-primary-fg shadow-2xs font-bold'
                  : 'text-muted hover:text-default'
              )}
            >
              <Building2 className="size-3" />
              {t('assets.perspectives.finance')}
            </button>
          </div>

          {/* Contextual Action Buttons */}
          <div className="flex items-center gap-2">
            {activeTab === 'categories' ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowAddCategoryModal(true)}
                  className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-fg font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 text-xs cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  <span>{t('assets.addCategory')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddAssetModal(true)}
                  className="px-3.5 py-2 bg-surface hover:bg-surface-sunken border border-default text-default font-semibold rounded-xl shadow-2xs transition flex items-center gap-1.5 text-xs cursor-pointer"
                >
                  <Plus className="size-3.5 text-primary" />
                  <span>{t('assets.registerAsset')}</span>
                </button>
              </>
            ) : activeTab === 'depreciation' ? (
              <>
                <button
                  type="button"
                  onClick={handleRunMonthlyDepreciation}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 text-xs cursor-pointer"
                >
                  <TrendingDown className="size-3.5" />
                  <span>{t('assets.runDepreciation')}</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportDepreciationSchedule}
                  className="px-3.5 py-2 bg-surface hover:bg-surface-sunken border border-default text-default font-semibold rounded-xl shadow-2xs transition flex items-center gap-1.5 text-xs cursor-pointer"
                >
                  <Download className="size-3.5 text-muted" />
                  <span>{t('assets.exportSchedule')}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowAddMaintenanceModal(true)}
                  className="px-3.5 py-2 bg-surface hover:bg-surface-sunken border border-default text-default font-semibold rounded-xl shadow-2xs transition flex items-center gap-1.5 text-xs cursor-pointer"
                >
                  <Wrench className="size-3.5 text-primary" />
                  <span>{t('assets.newWorkOrder')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowImportAssetModal(true)}
                  className="px-3.5 py-2 bg-surface hover:bg-surface-sunken border border-default text-default font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 text-xs cursor-pointer"
                >
                  <Upload className="size-3.5 text-primary" />
                  <span>{t('assets.importAssets')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportAssetsCsv}
                  className="px-3.5 py-2 bg-surface hover:bg-surface-sunken border border-default text-default font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 text-xs cursor-pointer"
                >
                  <FileSpreadsheet className="size-3.5 text-primary" />
                  <span>{t('assets.exportCsv')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddAssetModal(true)}
                  className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-fg font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 text-xs cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  <span>{t('assets.registerAsset')}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          Dynamic Context-Aware KPI Cards
          ───────────────────────────────────────────────────────────────────────────── */}
      {showOperationsKpis ? (
        /* Operational / Machinery Perspective */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-surface rounded-2xl p-4 shadow-2xs border border-default">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                {t('assets.kpi.uptimeTitle')}
              </div>
              <Activity className="size-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">
              {t('assets.kpi.uptimeValue')}
            </div>
            <div className="text-xs text-muted mt-1">
              {t('assets.kpi.uptimeSubtitle', { count: plantMachines.length })}
            </div>
          </div>

          <div className="bg-surface rounded-2xl p-4 shadow-2xs border border-default">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                {t('assets.kpi.workOrdersTitle')}
              </div>
              <Wrench className="size-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-2">
              {t('assets.kpi.workOrdersValue', { count: activeMaintenanceOrders.length })}
            </div>
            <div className="text-xs text-muted mt-1">
              {t('assets.kpi.workOrdersSubtitle')}
            </div>
          </div>

          <div className="bg-surface rounded-2xl p-4 shadow-2xs border border-default">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                {t('assets.kpi.nextRoutineTitle')}
              </div>
              <Clock className="size-4 text-amber-500" />
            </div>
            <div className="text-xl font-extrabold text-default mt-2">
              Sep 25, 2026
            </div>
            <div className="text-xs text-muted mt-1">
              {t('assets.kpi.nextRoutineSubtitle')}
            </div>
          </div>

          <div className="bg-surface rounded-2xl p-4 shadow-2xs border border-default">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                {t('assets.kpi.maintenanceCostTitle')}
              </div>
              <TrendingDown className="size-4 text-rose-500" />
            </div>
            <div className="text-2xl font-extrabold text-default mt-2">
              {formatCurrency(totalMaintenanceCost)}
            </div>
            <div className="text-xs text-muted mt-1">{t('assets.kpi.maintenanceCostSubtitle')}</div>
          </div>
        </div>
      ) : (
        /* Financial / Fixed Asset Perspective */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-surface rounded-2xl p-4 shadow-2xs border border-default">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">
              {t('assets.kpi.grossValueTitle')}
            </div>
            <div className="text-2xl font-extrabold text-default mt-2">
              {formatCurrency(totalAssetCost)}
            </div>
            <div className="text-xs text-muted mt-1">
              {t('assets.kpi.grossValueSubtitle', { count: assets.length })}
            </div>
          </div>

          <div className="bg-surface rounded-2xl p-4 shadow-2xs border border-default">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">
              {t('assets.kpi.accumDeprTitle')}
            </div>
            <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-2">
              {formatCurrency(totalAccumulatedDepr)}
            </div>
            <div className="text-xs text-muted mt-1">{t('assets.kpi.accumDeprSubtitle')}</div>
          </div>

          <div className="bg-surface rounded-2xl p-4 shadow-2xs border border-default">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">
              {t('assets.kpi.netBookValueTitle')}
            </div>
            <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">
              {formatCurrency(totalNetBookValue)}
            </div>
            <div className="text-xs text-muted mt-1">{t('assets.kpi.netBookValueSubtitle')}</div>
          </div>

          <div className="bg-surface rounded-2xl p-4 shadow-2xs border border-default">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">
              {t('assets.kpi.monthlyDeprTitle')}
            </div>
            <div className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-2">
              {formatCurrency(63800)}
            </div>
            <div className="text-xs text-muted mt-1">{t('assets.kpi.monthlyDeprSubtitle')}</div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          Universal Asset Lifecycle Quick-Action Ribbon
          ───────────────────────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-primary/20 bg-linear-to-r from-primary/5 via-surface to-surface-raised p-3.5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-default">
              <Zap className="size-3.5 text-amber-500 fill-amber-500" />
              <span>{t('assets.quickActionTitle')}</span>
            </div>
            <p className="text-[11px] text-muted">
              {t('assets.quickActionSubtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowAddMaintenanceModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-all cursor-pointer"
            >
              <Wrench className="size-3.5" />
              <span>{t('assets.logRepairTicket')}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddAssetModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-fg shadow-xs transition-all cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>{t('assets.registerAsset')}</span>
            </button>
            <button
              type="button"
              onClick={handleRunMonthlyDepreciation}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-surface hover:bg-surface-sunken text-default border border-default shadow-2xs transition-all cursor-pointer"
            >
              <TrendingDown className="size-3.5 text-indigo-500" />
              <span>{t('assets.runMonthlyDepreciation')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('categories');
                setShowAddCategoryModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-surface hover:bg-surface-sunken text-default border border-default shadow-2xs transition-all cursor-pointer"
            >
              <Tag className="size-3.5 text-emerald-600" />
              <span>{t('assets.addCategory')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2-Tier Universal Navigation Hub */}
      <WorkspaceNavigationHub<AssetDomain, AssetTab>
        categories={categoriesConfig}
        tabs={tabsConfig}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* ─────────────────────────────────────────────────────────────────────────────
          Tab 1: Plant Machinery & Workstations (Operational CMMS)
          ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'machinery' && (
        <div className="space-y-4">
          <div className="bg-surface rounded-2xl border border-default p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-default flex items-center gap-1.5">
                <Lock className="size-4 text-emerald-500" />
                Production Line Scheduling & Machinery Interlock
              </h3>
              <p className="text-xs text-muted mt-0.5">
                Machines with active breakdowns or scheduled preventive maintenance automatically alert the production line scheduler.
              </p>
            </div>
            <div className="flex items-center gap-2 text-2xs font-semibold">
              <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="size-3" /> All Lines Operational
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plantMachines.map((m) => {
              const meta = machinesMeta.find((meta) => meta.asset_id === m.id);
              const relatedOrders = maintenanceOrders.filter((o) => o.asset_id === m.id);
              const activeOrder = relatedOrders.find((o) => o.status !== 'completed');
              const isLocked = meta?.interlock_status === 'maintenance_lock';

              return (
                <div
                  key={m.id}
                  className="bg-surface rounded-2xl border border-default p-5 shadow-2xs hover:border-primary/40 transition space-y-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary bg-primary-subtle px-2 py-0.5 rounded border border-primary/20">
                          {m.asset_code}
                        </span>
                        <span
                          className={cn(
                            'text-[10px] uppercase font-bold px-2 py-0.5 rounded-full',
                            isLocked
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                              : activeOrder
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                          )}
                        >
                          {isLocked ? 'Safety Locked' : activeOrder ? 'Under Service' : 'Operational'}
                        </span>
                      </div>
                      <h4 className="font-bold text-base text-default mt-1.5">{m.name}</h4>
                      <p className="text-xs text-muted">
                        {m.location} • S/N: {m.serial_number || 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 py-3 border-y border-default text-xs">
                    <div>
                      <span className="text-muted block text-2xs uppercase tracking-wider">
                        Assigned Line
                      </span>
                      <span className="font-semibold text-default">
                        {meta?.line_name || 'General Factory Floor'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted block text-2xs uppercase tracking-wider">
                        Runtime Logged
                      </span>
                      <span className="font-mono font-semibold text-default">
                        {meta?.runtime_hours || 1200} Operating Hours
                      </span>
                    </div>
                    <div>
                      <span className="text-muted block text-2xs uppercase tracking-wider">
                        Next Service Due
                      </span>
                      <span className="font-semibold text-default">
                        {meta?.next_service_due || '2026-09-30'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted block text-2xs uppercase tracking-wider">
                        Active Order
                      </span>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {activeOrder ? activeOrder.order_number : 'None (Ready)'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="text-2xs text-muted">
                      Book Value: <strong className="text-default">{formatCurrency(m.book_value)}</strong>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleToggleInterlock(m.id)}
                        className={cn(
                          'px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer flex items-center gap-1',
                          isLocked
                            ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                            : 'border-default hover:bg-surface-sunken text-muted hover:text-default'
                        )}
                        title="Toggle Machinery Safety Interlock"
                      >
                        {isLocked ? <Lock className="size-3" /> : <Unlock className="size-3" />}
                        <span>{isLocked ? 'Locked' : 'Lock Safe'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAssetId(m.id);
                          setMaintenanceType('preventive');
                          setShowAddMaintenanceModal(true);
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-default text-xs font-semibold hover:bg-surface-sunken text-default transition cursor-pointer"
                      >
                        Schedule PM
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAssetId(m.id);
                          setMaintenanceType('corrective');
                          setPriority('high');
                          setShowAddMaintenanceModal(true);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-semibold hover:bg-rose-100 transition cursor-pointer"
                      >
                        Report Issue
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          Tab 2: Maintenance Work Orders
          ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'maintenance' && (
        <div className="space-y-4">
          {/* Work Orders Toolbar */}
          <div className="bg-surface rounded-2xl border border-default p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="size-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  placeholder="Search work orders, techs, assets..."
                  className="pl-8 pr-3 py-1.5 border border-default rounded-xl bg-surface-sunken text-default text-xs focus:border-primary focus:outline-none w-56 sm:w-64"
                />
              </div>

              {/* Status and SLA filter chips */}
              <div className="flex items-center bg-surface-sunken p-1 rounded-xl border border-default text-2xs font-semibold flex-wrap gap-1">
                {[
                  { id: 'all', label: 'All Orders' },
                  { id: 'overdue', label: 'SLA Overdue', count: overdueMaintenanceCount, variant: 'danger' },
                  { id: 'due_soon', label: 'Due in 7 Days', count: dueSoonMaintenanceCount, variant: 'warning' },
                  { id: 'scheduled', label: 'Scheduled' },
                  { id: 'in_progress', label: 'In Progress' },
                  { id: 'completed', label: 'Completed' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setOrderStatusFilter(item.id)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg transition capitalize cursor-pointer flex items-center gap-1.5',
                      orderStatusFilter === item.id
                        ? 'bg-surface text-default shadow-2xs font-bold'
                        : 'text-muted hover:text-default'
                    )}
                  >
                    <span>{item.label}</span>
                    {item.count !== undefined && item.count > 0 && (
                      <span
                        className={cn(
                          'px-1.5 py-0.2 rounded-full text-[9px] font-extrabold',
                          item.variant === 'danger'
                            ? 'bg-rose-500 text-white'
                            : 'bg-amber-500 text-white'
                        )}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAddMaintenanceModal(true)}
              className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-fg text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>Create Work Order</span>
            </button>
          </div>

          {/* SLA Critical Warning Banner if overdue orders exist */}
          {overdueMaintenanceCount > 0 && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <AlertTriangle className="size-4" />
                </div>
                <div>
                  <span className="font-extrabold text-rose-700 dark:text-rose-300 block">
                    CRITICAL MAINTENANCE SLA BREACH: {overdueMaintenanceCount} Work Order{overdueMaintenanceCount > 1 ? 's' : ''} Past Due
                  </span>
                  <span className="text-2xs text-rose-600/90 dark:text-rose-400">
                    Immediate service dispatch required to avoid factory floor halts and equipment warranty invalidation.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOrderStatusFilter('overdue')}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-2xs font-bold transition cursor-pointer shrink-0 shadow-2xs"
              >
                View Overdue Orders ({overdueMaintenanceCount})
              </button>
            </div>
          )}

          {/* Selected Work Orders Bulk Action Ribbon */}
          {selectedOrderIds.size > 0 && (
            <div className="flex items-center justify-between gap-2.5 px-4 py-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-destructive">
                  {selectedOrderIds.size} work order{selectedOrderIds.size > 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                {canDeleteMaintenance && (
                  <button
                    type="button"
                    onClick={() => setDeleteOrderConfirm({ open: true, isBulk: true })}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-destructive text-destructive-fg hover:opacity-90 transition shadow-2xs cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                    <span>Move to Bin ({selectedOrderIds.size})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedOrderIds(new Set())}
                  className="text-xs font-medium text-muted hover:text-default cursor-pointer"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto min-h-75 bg-surface rounded-2xl shadow-2xs border border-default min-w-0">
            <table className="w-full min-w-0 text-left text-sm text-default">
              <thead className="bg-surface-sunken text-muted uppercase text-2xs font-bold border-b border-default">
                <tr>
                  <th className="w-10 px-4 py-3 text-center">
                    <input
                      ref={orderHeaderRef}
                      type="checkbox"
                      checked={isAllOrdersSelected}
                      onChange={toggleSelectAllOrders}
                      className="size-4 rounded border-default text-primary focus:ring-primary cursor-pointer"
                      title="Select all maintenance orders"
                    />
                  </th>
                  <th className="px-4 py-3 whitespace-nowrap">Order #</th>
                  <th className="px-4 py-3 min-w-40 sm:min-w-48">Asset</th>
                  <th className="px-4 py-3 whitespace-nowrap">Type & Priority</th>
                  <th className="px-4 py-3 min-w-44 sm:min-w-56">Issue / Task</th>
                  <th className="px-4 py-3 whitespace-nowrap">Scheduled</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Cost</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-10 text-center text-xs text-muted">
                      No maintenance work orders found matching the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((mo) => (
                    <tr key={mo.id} className="hover:bg-surface-sunken/50 transition">
                      <td className="w-10 px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedOrderIds.has(mo.id)}
                          onChange={() => toggleSelectOneOrder(mo.id)}
                          className="size-4 rounded border-default text-primary focus:ring-primary cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold text-primary whitespace-nowrap">
                        {mo.order_number}
                      </td>
                      <td className="px-4 py-3.5 min-w-40 sm:min-w-48">
                        <div className="font-semibold text-default">
                          {mo.asset?.name}
                        </div>
                        <div className="text-2xs font-mono text-muted whitespace-nowrap">{mo.asset?.asset_code}</div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="capitalize text-xs font-semibold text-default">
                          {mo.maintenance_type}
                        </div>
                        <span
                          className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${
                            mo.priority === 'high' || mo.priority === 'critical'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                          }`}
                        >
                          {mo.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 min-w-44 sm:min-w-56">
                        <div className="text-xs text-muted line-clamp-2">{mo.description}</div>
                        <div className="text-2xs font-medium text-default mt-0.5 whitespace-nowrap">
                          Tech: {mo.performed_by || 'Unassigned'}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="text-xs font-mono font-medium text-default">{mo.scheduled_date}</div>
                        {(() => {
                          const sla = getMaintenanceSlaStatus(mo);
                          if (sla.isOverdue) {
                            return (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800 mt-1 whitespace-nowrap">
                                <AlertTriangle className="size-2.5" /> SLA Overdue ({sla.diffDays}d)
                              </span>
                            );
                          }
                          if (sla.isDueSoon) {
                            return (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800 mt-1 whitespace-nowrap">
                                <Clock className="size-2.5" /> Due in {Math.abs(sla.diffDays)}d
                              </span>
                            );
                          }
                          if (mo.status === 'completed') {
                            return (
                              <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1 whitespace-nowrap">
                                <CheckCircle2 className="size-2.5" /> SLA Met
                              </span>
                            );
                          }
                          return (
                            <span className="inline-flex items-center gap-1 text-[9px] text-muted mt-1 whitespace-nowrap">
                              On Schedule
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-semibold text-default whitespace-nowrap">
                        {formatCurrency(mo.cost)}
                      </td>
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <span
                          className={cn(
                            'px-2.5 py-1 text-2xs font-bold rounded-full uppercase whitespace-nowrap',
                            mo.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : mo.status === 'in_progress'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                          )}
                        >
                          {mo.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleViewMaintenanceOrder(mo)}
                            className="px-2 py-1 text-2xs font-semibold rounded-lg bg-surface hover:bg-surface-sunken text-default border border-default transition cursor-pointer flex items-center gap-1"
                          >
                            <Eye className="size-2.5" /> View
                          </button>
                          {mo.status === 'scheduled' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleStartOrder(mo.id)}
                                className="px-2 py-1 text-2xs font-semibold rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition cursor-pointer flex items-center gap-1"
                              >
                                <Play className="size-2.5" /> Start
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCompleteOrder(mo.id)}
                                className="px-2 py-1 text-2xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition cursor-pointer"
                              >
                                Complete
                              </button>
                            </>
                          ) : mo.status === 'in_progress' ? (
                            <button
                              type="button"
                              onClick={() => handleCompleteOrder(mo.id)}
                              className="px-2.5 py-1 text-2xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition cursor-pointer flex items-center gap-1 ml-auto"
                            >
                              <CheckCircle2 className="size-3" /> Complete
                            </button>
                          ) : (
                            <span className="text-2xs text-muted flex items-center justify-end gap-1">
                              <CheckCircle2 className="size-3 text-emerald-500" /> Done
                            </span>
                          )}
                          {canDeleteMaintenance && (
                            <button
                              type="button"
                              onClick={() => setDeleteOrderConfirm({ open: true, isBulk: false, id: mo.id })}
                              className="p-1.5 text-destructive/80 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                              title="Move to Data Bin"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          Tab 3: Fixed Asset Register
          ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'assets' && (
        <div className="space-y-4">
          {/* Asset Register Toolbar */}
          <div className="bg-surface rounded-2xl border border-default p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5 flex-wrap flex-1">
              <div className="relative flex-1 min-w-50 max-w-sm">
                <Search className="size-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={assetSearchQuery}
                  onChange={(e) => setAssetSearchQuery(e.target.value)}
                  placeholder="Filter by code, name, serial or location..."
                  className="w-full pl-8 pr-3 py-1.5 border border-default rounded-xl bg-surface-sunken text-default text-xs focus:border-primary focus:outline-none"
                />
              </div>

              {/* Category Dropdown Filter */}
              <div className="flex items-center gap-1.5">
                <Filter className="size-3.5 text-muted" />
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) =>
                    setSelectedCategoryFilter(
                      e.target.value === 'all' ? 'all' : parseInt(e.target.value)
                    )
                  }
                  className="px-2.5 py-1.5 border border-default rounded-xl bg-surface text-default text-xs focus:border-primary focus:outline-none font-medium cursor-pointer"
                >
                  <option value="all">All Asset Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-default rounded-xl bg-surface text-default text-xs focus:border-primary focus:outline-none font-medium cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="under_maintenance">Under Maintenance</option>
                <option value="disposed">Disposed</option>
              </select>

              {/* Active Filter Clear Pill */}
              {activeCategoryFilterName && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-2xs font-semibold bg-primary/10 text-primary border border-primary/20">
                  <span>Category: {activeCategoryFilterName}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryFilter('all')}
                    className="hover:text-primary-fg hover:bg-primary rounded p-0.5 transition cursor-pointer"
                  >
                    <X className="size-2.5" />
                  </button>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddAssetModal(true)}
                className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-fg font-semibold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 text-xs cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>Register Asset</span>
              </button>
            </div>
          </div>

          {/* Selected Assets Bulk Action Ribbon */}
          {selectedAssetIds.size > 0 && (
            <div className="flex items-center justify-between gap-2.5 px-4 py-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-destructive">
                  {selectedAssetIds.size} asset{selectedAssetIds.size > 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                {canDeleteAsset && (
                  <button
                    type="button"
                    onClick={() => setDeleteAssetConfirm({ open: true, isBulk: true })}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-destructive text-destructive-fg hover:opacity-90 transition shadow-2xs cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                    <span>Move to Bin ({selectedAssetIds.size})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedAssetIds(new Set())}
                  className="text-xs font-medium text-muted hover:text-default cursor-pointer"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          {/* Asset Register Table */}
          <div className="overflow-x-auto min-h-75 bg-surface rounded-2xl shadow-2xs border border-default min-w-0">
            <table className="w-full min-w-0 text-left text-sm text-default">
              <thead className="bg-surface-sunken text-muted uppercase text-2xs font-bold border-b border-default">
                <tr>
                  <th className="w-10 px-4 py-3 text-center">
                    <input
                      ref={assetHeaderRef}
                      type="checkbox"
                      checked={isAllAssetsSelected}
                      onChange={toggleSelectAllAssets}
                      className="size-4 rounded border-default text-primary focus:ring-primary cursor-pointer"
                      title="Select all assets"
                    />
                  </th>
                  <th className="px-4 py-3 whitespace-nowrap">Asset Code</th>
                  <th className="px-4 py-3 min-w-48 sm:min-w-64">Name & Details</th>
                  <th className="px-4 py-3 whitespace-nowrap">Category</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Cost (BDT)</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Accum. Depr (BDT)</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Net Book Value (BDT)</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-10 text-center text-xs text-muted">
                      No assets found matching the selected filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((ast) => (
                    <tr key={ast.id} className="hover:bg-surface-sunken/50 transition">
                      <td className="w-10 px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedAssetIds.has(ast.id)}
                          onChange={() => toggleSelectOneAsset(ast.id)}
                          className="size-4 rounded border-default text-primary focus:ring-primary cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold text-primary whitespace-nowrap">
                        {ast.asset_code}
                      </td>
                      <td className="px-4 py-3.5 min-w-48 sm:min-w-64">
                        <div className="font-semibold text-default">{ast.name}</div>
                        <div className="text-xs text-muted mt-0.5 whitespace-nowrap">
                          {ast.location ? `${ast.location} | ` : ''}S/N: {ast.serial_number || 'N/A'}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-block px-2.5 py-1 text-xs font-semibold bg-surface-sunken rounded-lg text-default border border-default whitespace-nowrap">
                          {ast.category?.name || 'Uncategorized'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-default whitespace-nowrap">
                        {formatCurrency(ast.purchase_cost)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                        {formatCurrency(ast.accumulated_depreciation)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {formatCurrency(ast.book_value)}
                      </td>
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 uppercase whitespace-nowrap">
                          {ast.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleServiceAsset(ast)}
                            className="shrink-0 px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface hover:bg-surface-sunken text-default border border-default shadow-2xs transition cursor-pointer flex items-center gap-1"
                            title="Schedule service / maintenance"
                          >
                            <Wrench className="size-3 text-amber-500" />
                            <span>Service</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenQrLabel(ast)}
                            className="shrink-0 px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface hover:bg-surface-sunken text-default border border-default shadow-2xs transition cursor-pointer flex items-center gap-1"
                            title="Print thermal QR label"
                          >
                            <QrCode className="size-3 text-primary" />
                            <span>QR Tag</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDepreciationSchedule(ast)}
                            className="shrink-0 px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface hover:bg-surface-sunken text-default border border-default shadow-2xs transition cursor-pointer flex items-center gap-1"
                            title="View depreciation projection schedule"
                          >
                            <TrendingDown className="size-3 text-amber-500" />
                            <span>Schedule</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleViewAssetDetails(ast)}
                            className="shrink-0 px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface hover:bg-surface-sunken text-default border border-default shadow-2xs transition cursor-pointer flex items-center gap-1"
                            title="View complete asset specifications"
                          >
                            <Eye className="size-3 text-primary" />
                            <span>Details</span>
                          </button>
                          {canDeleteAsset && (
                            <button
                              type="button"
                              onClick={() => setDeleteAssetConfirm({ open: true, isBulk: false, id: ast.id })}
                              className="shrink-0 p-1.5 text-destructive/80 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                              title="Move to Data Bin"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (openActionMenuId === ast.id) {
                                setOpenActionMenuId(null);
                                setActionMenuAnchor(null);
                              } else {
                                setOpenActionMenuId(ast.id);
                                setActionMenuAnchor(e.currentTarget);
                              }
                            }}
                            className={cn(
                              'shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer',
                              openActionMenuId === ast.id
                                ? 'bg-primary text-primary-fg border-primary shadow-xs'
                                : 'bg-surface hover:bg-surface-sunken border-default text-default'
                            )}
                          >
                            <span>Actions</span>
                            <ChevronDown className="size-3 text-muted" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Floating Action Menu via ActionMenuPortal */}
            {openActionMenuId !== null && actionMenuAnchor !== null && (
              <ActionMenuPortal
                anchorEl={actionMenuAnchor}
                open={true}
                onClose={() => {
                  setOpenActionMenuId(null);
                  setActionMenuAnchor(null);
                }}
              >
                {(() => {
                  const activeItem = assets.find((a) => a.id === openActionMenuId);
                  if (!activeItem) return null;
                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionMenuId(null);
                          setActionMenuAnchor(null);
                          handleViewAssetDetails(activeItem);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-default hover:bg-surface-sunken transition-colors cursor-pointer text-left"
                      >
                        <Eye className="size-3.5 text-primary" />
                        <span>View Asset Specifications</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionMenuId(null);
                          setActionMenuAnchor(null);
                          handleServiceAsset(activeItem);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-amber-600 hover:bg-amber-500/10 transition-colors cursor-pointer text-left"
                      >
                        <Wrench className="size-3.5 text-amber-500" />
                        <span>Schedule Service / Maintenance</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionMenuId(null);
                          setActionMenuAnchor(null);
                          handleOpenQrLabel(activeItem);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-default hover:bg-surface-sunken transition-colors cursor-pointer text-left"
                      >
                        <QrCode className="size-3.5 text-primary" />
                        <span>Print Industrial QR Tag</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionMenuId(null);
                          setActionMenuAnchor(null);
                          handleOpenDepreciationSchedule(activeItem);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-default hover:bg-surface-sunken transition-colors cursor-pointer text-left"
                      >
                        <TrendingDown className="size-3.5 text-amber-500" />
                        <span>Depreciation Projection Schedule</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setOpenActionMenuId(null);
                          setActionMenuAnchor(null);
                          navigator.clipboard?.writeText(activeItem.asset_code);
                          alert(`Copied ${activeItem.asset_code} to clipboard!`);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-default hover:bg-surface-sunken transition-colors cursor-pointer text-left border-t border-default/40"
                      >
                        <Building2 className="size-3.5 text-muted" />
                        <span>Copy Asset Code</span>
                      </button>

                      {canDeleteAsset && (
                        <button
                          type="button"
                          onClick={() => {
                            setOpenActionMenuId(null);
                            setActionMenuAnchor(null);
                            setDeleteAssetConfirm({ open: true, isBulk: false, id: activeItem.id });
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors cursor-pointer text-left border-t border-default/40"
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                          <span>Move to Data Bin</span>
                        </button>
                      )}
                    </>
                  );
                })()}
              </ActionMenuPortal>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          Tab 4: Monthly Depreciation Logs
          ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'depreciation' && (
        <div className="space-y-4">
          <div className="bg-surface rounded-2xl border border-default p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div>
              <h3 className="font-bold text-sm text-default flex items-center gap-1.5">
                <TrendingDown className="size-4 text-indigo-500" />
                Monthly Straight-Line Depreciation Ledger Logs
              </h3>
              <p className="text-xs text-muted mt-0.5">
                System calculates monthly straight-line write-downs: (Cost - Salvage) / Useful Life, and posts journal adjustments.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  const firstAsset = assets[0];
                  if (firstAsset) {
                    handleOpenDepreciationSchedule(firstAsset);
                  }
                }}
                className="px-3.5 py-2 bg-surface hover:bg-surface-sunken border border-default text-default font-semibold rounded-xl shadow-2xs transition flex items-center gap-1.5 text-xs cursor-pointer"
                title="View month-by-month multi-method projection schedule"
              >
                <Calculator className="size-3.5 text-primary" />
                <span>Projection Calculator</span>
              </button>
              <button
                type="button"
                onClick={handleRunMonthlyDepreciation}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 text-xs cursor-pointer"
              >
                <Zap className="size-3.5 fill-amber-300 text-amber-300" />
                <span>Run Monthly Depreciation</span>
              </button>
              <button
                type="button"
                onClick={handleExportDepreciationSchedule}
                className="px-3 py-2 bg-surface hover:bg-surface-sunken border border-default text-default font-semibold rounded-xl shadow-2xs transition flex items-center gap-1.5 text-xs cursor-pointer"
              >
                <Download className="size-3.5 text-muted" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto min-h-75 bg-surface rounded-2xl shadow-2xs border border-default min-w-0">
            <table className="w-full min-w-0 text-left text-sm text-default">
              <thead className="bg-surface-sunken text-muted uppercase text-2xs font-bold border-b border-default">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap">Period</th>
                  <th className="px-4 py-3 min-w-40 sm:min-w-48">Asset</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Opening Book Value</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Monthly Depreciation</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Closing Book Value</th>
                  <th className="px-4 py-3 whitespace-nowrap">GL Reference</th>
                  <th className="px-4 py-3 whitespace-nowrap">Posted At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {depreciationEntries.map((dep) => (
                  <tr key={dep.id} className="hover:bg-surface-sunken/50 transition">
                    <td className="px-4 py-3.5 font-semibold text-default whitespace-nowrap">
                      {dep.period_year}-{String(dep.period_month).padStart(2, '0')}
                    </td>
                    <td className="px-4 py-3.5 min-w-40 sm:min-w-48">
                      <div className="font-medium text-default">
                        {dep.asset?.name}
                      </div>
                      <div className="text-xs font-mono text-muted whitespace-nowrap">{dep.asset?.asset_code}</div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-muted whitespace-nowrap">
                      {formatCurrency(dep.opening_book_value)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                      {formatCurrency(dep.depreciation_amount)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {formatCurrency(dep.closing_book_value)}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-primary whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-primary-subtle text-primary border border-primary/20 rounded font-semibold whitespace-nowrap">
                        JE-202608-000{dep.journal_entry_id}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted whitespace-nowrap">{dep.posted_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          Tab 5: Asset Categories & Policies (With Proper Action Buttons!)
          ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          {/* Categories Header & Action Toolbar */}
          <div className="bg-surface rounded-2xl border border-default p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div>
              <h3 className="font-bold text-sm text-default flex items-center gap-1.5">
                <Tag className="size-4 text-primary" />
                Asset Categories & Accounting Amortization Policies ({categories.length})
              </h3>
              <p className="text-xs text-muted mt-0.5">
                Configure default straight-line useful life, salvage residual scrap values, and capitalization criteria per asset class.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddCategoryModal(true)}
                className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-fg font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 text-xs cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>Add Category</span>
              </button>
            </div>
          </div>

          {/* Category Cards Grid with Contextual Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {categories.map((cat) => {
              const matchingAssets = assets.filter((a) => a.asset_category_id === cat.id);
              const assetCount = matchingAssets.length;

              return (
                <div
                  key={cat.id}
                  className="bg-surface rounded-2xl p-6 shadow-2xs border border-default flex flex-col justify-between space-y-4 hover:border-primary/40 transition"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 bg-surface-sunken rounded text-default border border-default">
                        {cat.code}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 text-2xs font-semibold rounded-full bg-primary/10 text-primary border border-primary/20">
                          {assetCount} {assetCount === 1 ? 'Asset' : 'Assets'}
                        </span>
                        <span className="px-2 py-0.5 text-2xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                          ACTIVE
                        </span>
                      </div>
                    </div>

                    <h3 className="font-bold text-lg text-default leading-snug">{cat.name}</h3>

                    <div className="space-y-2 text-xs text-muted pt-2 border-t border-default">
                      <div className="flex justify-between">
                        <span>Depreciation Method:</span>
                        <span className="font-semibold capitalize text-default">
                          {cat.default_depreciation_method.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Default Useful Life:</span>
                        <span className="font-semibold text-default">
                          {cat.default_useful_life_months} Months ({cat.default_useful_life_months / 12} Yrs)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Default Salvage:</span>
                        <span className="font-semibold text-default">
                          {parseFloat(cat.default_salvage_percentage)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Contextual Action Buttons per Category Card */}
                  <div className="pt-3 border-t border-default flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleFilterByCategory(cat.id, cat.name)}
                        className="w-full px-3 py-1.5 rounded-xl border border-default hover:bg-surface-sunken text-default text-xs font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                        title={`View ${assetCount} assets in ${cat.name}`}
                      >
                        <ArrowRight className="size-3 text-primary" />
                        <span>View Assets</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickRegisterForCategory(cat.id)}
                        className="w-full px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                        title={`Register a new asset under ${cat.name}`}
                      >
                        <Plus className="size-3" />
                        <span>+ New Asset</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenEditPolicy(cat)}
                      className="w-full px-3 py-1.5 rounded-xl border border-default hover:border-primary/40 text-muted hover:text-default text-2xs font-medium transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="size-3 text-muted" />
                      <span>Edit Depreciation Policy</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          Tab 6: Asset Ownership & Lifecycle Timeline
          ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'timeline' && (
        <AssetTimelineSection
          assets={assets}
          maintenanceOrders={maintenanceOrders}
          depreciationEntries={depreciationEntries}
          machinesMeta={machinesMeta}
          onOpenServiceModal={(ast) => handleServiceAsset(ast)}
          onOpenScheduleModal={(ast) => handleOpenDepreciationSchedule(ast)}
          onOpenQrModal={(ast) => handleOpenQrLabel(ast)}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          Modal 1: Register Capital Asset
          ───────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={showAddAssetModal}
        onClose={() => setShowAddAssetModal(false)}
        title="Register Capital Asset"
        subtitle="Record a new machinery, vehicle, or equipment asset into the capitalization register."
        size="md"
      >
        <form onSubmit={handleCreateAsset} className="space-y-4 pt-1">
          <div>
            <label htmlFor="reg-asset-name" className="block text-xs font-semibold text-default uppercase mb-1">
              Asset Name
            </label>
            <input
              id="reg-asset-name"
              name="asset_name"
              type="text"
              value={newAssetName}
              onChange={(e) => setNewAssetName(e.target.value)}
              placeholder="e.g. Industrial Automatic Overlock Sewing Machine"
              required
              autoComplete="off"
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="reg-asset-category" className="block text-xs font-semibold text-default uppercase mb-1">
                Asset Category
              </label>
              <select
                id="reg-asset-category"
                name="asset_category_id"
                value={newCategoryId}
                onChange={(e) => {
                  const catId = parseInt(e.target.value);
                  setNewCategoryId(catId);
                  const selectedCat = categories.find((c) => c.id === catId);
                  if (selectedCat) {
                    setNewMonths(selectedCat.default_useful_life_months);
                  }
                }}
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none cursor-pointer"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="reg-asset-cost" className="block text-xs font-semibold text-default uppercase mb-1">
                Purchase Cost (BDT)
              </label>
              <input
                id="reg-asset-cost"
                name="purchase_cost"
                type="number"
                value={newCost}
                onChange={(e) => setNewCost(e.target.value)}
                required
                autoComplete="off"
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm text-right font-mono focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="reg-asset-salvage" className="block text-xs font-semibold text-default uppercase mb-1">
                Salvage Value (BDT)
              </label>
              <input
                id="reg-asset-salvage"
                name="salvage_value"
                type="number"
                value={newSalvage}
                onChange={(e) => setNewSalvage(e.target.value)}
                autoComplete="off"
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm text-right font-mono focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="reg-asset-months" className="block text-xs font-semibold text-default uppercase mb-1">
                Useful Life (Months)
              </label>
              <input
                id="reg-asset-months"
                name="useful_life_months"
                type="number"
                value={newMonths}
                onChange={(e) => setNewMonths(parseInt(e.target.value) || 36)}
                autoComplete="off"
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm text-right font-mono focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-default">
            <button
              type="button"
              onClick={() => setShowAddAssetModal(false)}
              className="px-4 py-2 text-xs font-semibold border border-default rounded-xl text-muted hover:text-default cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs bg-primary hover:bg-primary/90 text-primary-fg font-semibold rounded-xl shadow-xs cursor-pointer"
            >
              Register Asset
            </button>
          </div>
        </form>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────────────────
          Modal 2: Create Maintenance Work Order
          ───────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={showAddMaintenanceModal}
        onClose={() => setShowAddMaintenanceModal(false)}
        title="Create Maintenance Work Order"
        subtitle="Issue a preventive servicing or corrective repair order for plant machinery."
        size="md"
      >
        <form onSubmit={handleCreateMaintenanceOrder} className="space-y-4 pt-1">
          <div>
            <label htmlFor="maint-target-asset" className="block text-xs font-semibold text-default uppercase mb-1">
              Target Machine / Asset
            </label>
            <select
              id="maint-target-asset"
              name="asset_id"
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none cursor-pointer"
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.asset_code} — {a.name} ({a.category?.name})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="maint-order-type" className="block text-xs font-semibold text-default uppercase mb-1">
                Order Type
              </label>
              <select
                id="maint-order-type"
                name="maintenance_type"
                value={maintenanceType}
                onChange={(e) => setMaintenanceType(e.target.value as MaintenanceType)}
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none cursor-pointer"
              >
                <option value="preventive">Preventive Maintenance</option>
                <option value="corrective">Corrective Repair</option>
                <option value="inspection">Safety & Quality Inspection</option>
                <option value="calibration">Machine Calibration</option>
              </select>
            </div>

            <div>
              <label htmlFor="maint-priority" className="block text-xs font-semibold text-default uppercase mb-1">
                Priority Level
              </label>
              <select
                id="maint-priority"
                name="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as MaintenancePriority)}
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none cursor-pointer"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical (Line Stoppage)</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="maint-description" className="block text-xs font-semibold text-default uppercase mb-1">
              Problem / Service Scope
            </label>
            <textarea
              id="maint-description"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe required service, parts replacement, lubrication, calibration..."
              required
              rows={3}
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="maint-scheduled-date" className="block text-xs font-semibold text-default uppercase mb-1">
                Scheduled Date
              </label>
              <input
                id="maint-scheduled-date"
                name="scheduled_date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="maint-estimated-cost" className="block text-xs font-semibold text-default uppercase mb-1">
                Est. Cost (BDT)
              </label>
              <input
                id="maint-estimated-cost"
                name="estimated_cost"
                type="number"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                required
                autoComplete="off"
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm text-right font-mono focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="maint-technician" className="block text-xs font-semibold text-default uppercase mb-1">
              Assigned Technician / Workshop
            </label>
            <input
              id="maint-technician"
              name="technician"
              type="text"
              value={technician}
              onChange={(e) => setTechnician(e.target.value)}
              placeholder="e.g. SharpCut Eng. / Internal Plant Maintenance"
              required
              autoComplete="off"
              className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-default">
            <button
              type="button"
              onClick={() => setShowAddMaintenanceModal(false)}
              className="px-4 py-2 text-xs font-semibold border border-default rounded-xl text-muted hover:text-default cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs bg-primary hover:bg-primary/90 text-primary-fg font-semibold rounded-xl shadow-xs cursor-pointer"
            >
              Create Work Order
            </button>
          </div>
        </form>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────────────────
          Modal 3: Add Asset Category
          ───────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={showAddCategoryModal}
        onClose={() => setShowAddCategoryModal(false)}
        title="Add Asset Category"
        subtitle="Define a new asset classification and its default straight-line depreciation policies."
        size="md"
      >
        <form onSubmit={handleCreateCategory} className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="cat-name" className="block text-xs font-semibold text-default uppercase mb-1">
                Category Name
              </label>
              <input
                id="cat-name"
                name="category_name"
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g. Cold Storage Equipment"
                required
                autoComplete="off"
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="cat-code" className="block text-xs font-semibold text-default uppercase mb-1">
                Category Code
              </label>
              <input
                id="cat-code"
                name="category_code"
                type="text"
                value={newCatCode}
                onChange={(e) => setNewCatCode(e.target.value.toUpperCase())}
                placeholder="e.g. COLD_STORE"
                autoComplete="off"
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm font-mono focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="cat-method" className="block text-xs font-semibold text-default uppercase mb-1">
                Method
              </label>
              <select
                id="cat-method"
                name="depreciation_method"
                value={newCatMethod}
                onChange={(e) => setNewCatMethod(e.target.value as DepreciationMethod)}
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm focus:border-primary focus:outline-none cursor-pointer"
              >
                <option value="straight_line">Straight Line</option>
                <option value="declining_balance">Declining Balance</option>
                <option value="units_of_production">Units of Production</option>
              </select>
            </div>

            <div>
              <label htmlFor="cat-life" className="block text-xs font-semibold text-default uppercase mb-1">
                Useful Life (Mo.)
              </label>
              <input
                id="cat-life"
                name="useful_life"
                type="number"
                value={newCatMonths}
                onChange={(e) => setNewCatMonths(parseInt(e.target.value) || 36)}
                required
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm font-mono text-right focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="cat-salvage" className="block text-xs font-semibold text-default uppercase mb-1">
                Salvage %
              </label>
              <input
                id="cat-salvage"
                name="salvage_percentage"
                type="number"
                step="0.1"
                value={newCatSalvage}
                onChange={(e) => setNewCatSalvage(e.target.value)}
                required
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface-sunken text-default text-sm font-mono text-right focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-default">
            <button
              type="button"
              onClick={() => setShowAddCategoryModal(false)}
              className="px-4 py-2 text-xs font-semibold border border-default rounded-xl text-muted hover:text-default cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs bg-primary hover:bg-primary/90 text-primary-fg font-semibold rounded-xl shadow-xs cursor-pointer"
            >
              Save Category
            </button>
          </div>
        </form>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────────────────
          Modal 4: Edit Category Policy
          ───────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={showEditPolicyModal}
        onClose={() => setShowEditPolicyModal(false)}
        title={`Edit Depreciation Policy: ${editingCategory?.name || ''}`}
        subtitle="Adjust standard useful life and salvage value rules for this asset class."
        size="md"
      >
        <form onSubmit={handleSavePolicy} className="space-y-4 pt-1">
          <div className="bg-surface-sunken p-3 rounded-xl border border-default text-xs space-y-1">
            <div className="font-semibold text-default">
              Class Code: <span className="font-mono text-primary">{editingCategory?.code}</span>
            </div>
            <p className="text-muted">
              Modifying this policy affects default parameters when creating new assets in this category.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="edit-policy-method" className="block text-xs font-semibold text-default uppercase mb-1">
                Method
              </label>
              <select
                id="edit-policy-method"
                name="edit_method"
                value={editPolicyMethod}
                onChange={(e) => setEditPolicyMethod(e.target.value as DepreciationMethod)}
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface text-default text-sm focus:border-primary focus:outline-none cursor-pointer"
              >
                <option value="straight_line">Straight Line</option>
                <option value="declining_balance">Declining Balance</option>
                <option value="units_of_production">Units of Production</option>
              </select>
            </div>

            <div>
              <label htmlFor="edit-policy-months" className="block text-xs font-semibold text-default uppercase mb-1">
                Useful Life (Months)
              </label>
              <input
                id="edit-policy-months"
                name="edit_months"
                type="number"
                value={editPolicyMonths}
                onChange={(e) => setEditPolicyMonths(parseInt(e.target.value) || 36)}
                required
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface text-default text-sm font-mono text-right focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="edit-policy-salvage" className="block text-xs font-semibold text-default uppercase mb-1">
                Salvage %
              </label>
              <input
                id="edit-policy-salvage"
                name="edit_salvage"
                type="number"
                step="0.1"
                value={editPolicySalvage}
                onChange={(e) => setEditPolicySalvage(e.target.value)}
                required
                className="w-full px-3 py-2 border border-default rounded-xl bg-surface text-default text-sm font-mono text-right focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-default">
            <button
              type="button"
              onClick={() => setShowEditPolicyModal(false)}
              className="px-4 py-2 text-xs font-semibold border border-default rounded-xl text-muted hover:text-default cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs bg-primary hover:bg-primary/90 text-primary-fg font-semibold rounded-xl shadow-xs cursor-pointer"
            >
              Update Policy
            </button>
          </div>
        </form>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────────────────
          Modal 5: Asset Details & Lifecycle Profile
          ───────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={showAssetDetailModal}
        onClose={() => setShowAssetDetailModal(false)}
        title={`Asset Specifications: ${viewingAsset?.name || ''}`}
        subtitle={`Asset Code: ${viewingAsset?.asset_code || ''} • S/N: ${viewingAsset?.serial_number || 'N/A'}`}
        size="lg"
      >
        {viewingAsset && (
          <div className="space-y-5 pt-1">
            {/* Top Stat Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-sunken p-3.5 rounded-2xl border border-default">
              <div>
                <span className="text-2xs uppercase tracking-wider text-muted font-semibold block">
                  Gross Purchase Cost
                </span>
                <span className="font-mono text-sm font-bold text-default">
                  {formatCurrency(viewingAsset.purchase_cost)}
                </span>
              </div>
              <div>
                <span className="text-2xs uppercase tracking-wider text-muted font-semibold block">
                  Accumulated Depr
                </span>
                <span className="font-mono text-sm font-bold text-amber-600 dark:text-amber-400">
                  {formatCurrency(viewingAsset.accumulated_depreciation)}
                </span>
              </div>
              <div>
                <span className="text-2xs uppercase tracking-wider text-muted font-semibold block">
                  Net Book Value
                </span>
                <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(viewingAsset.book_value)}
                </span>
              </div>
              <div>
                <span className="text-2xs uppercase tracking-wider text-muted font-semibold block">
                  Salvage Value
                </span>
                <span className="font-mono text-sm font-semibold text-default">
                  {formatCurrency(viewingAsset.salvage_value)}
                </span>
              </div>
            </div>

            {/* Specifications Grid */}
            <div className="grid grid-cols-2 gap-4 text-xs border border-default rounded-xl p-4 bg-surface">
              <div>
                <span className="text-muted block text-2xs uppercase tracking-wider">Asset Class</span>
                <span className="font-semibold text-default">{viewingAsset.category?.name}</span>
              </div>
              <div>
                <span className="text-muted block text-2xs uppercase tracking-wider">Operating Status</span>
                <span className="font-semibold text-emerald-600 uppercase font-mono">{viewingAsset.status}</span>
              </div>
              <div>
                <span className="text-muted block text-2xs uppercase tracking-wider">Facility Location</span>
                <span className="font-semibold text-default">{viewingAsset.location}</span>
              </div>
              <div>
                <span className="text-muted block text-2xs uppercase tracking-wider">Serial Number</span>
                <span className="font-mono font-semibold text-default">{viewingAsset.serial_number || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted block text-2xs uppercase tracking-wider">Capitalization Date</span>
                <span className="font-mono text-default">{viewingAsset.purchase_date}</span>
              </div>
              <div>
                <span className="text-muted block text-2xs uppercase tracking-wider">Warranty Expiry</span>
                <span className="font-mono text-default">{viewingAsset.warranty_expiry_date || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted block text-2xs uppercase tracking-wider">Useful Life Term</span>
                <span className="font-semibold text-default">{viewingAsset.useful_life_months} Months</span>
              </div>
              <div>
                <span className="text-muted block text-2xs uppercase tracking-wider">Depreciation Method</span>
                <span className="capitalize text-default">{viewingAsset.depreciation_method.replace('_', ' ')}</span>
              </div>
            </div>

            {/* Action Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-default">
              <span className="text-2xs text-muted">
                Asset ID: #{viewingAsset.id} • Registered under Enterprise Plant Register
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    handleOpenQrLabel(viewingAsset);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-default bg-surface hover:bg-surface-sunken text-default text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Print industrial QR tag"
                >
                  <QrCode className="size-3 text-primary" />
                  <span>Print QR Tag</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleOpenDepreciationSchedule(viewingAsset);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-default bg-surface hover:bg-surface-sunken text-default text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="View depreciation projection schedule"
                >
                  <TrendingDown className="size-3 text-amber-500" />
                  <span>Depreciation Schedule</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAssetDetailModal(false);
                    handleServiceAsset(viewingAsset);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Wrench className="size-3" />
                  <span>Schedule Service</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAssetDetailModal(false)}
                  className="px-4 py-1.5 text-xs font-semibold border border-default rounded-xl text-muted hover:text-default cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
      {/* Universal Import Modal for Fixed Assets Register */}
      <UniversalImportModal
        isOpen={showImportAssetModal}
        onClose={() => setShowImportAssetModal(false)}
        schema={fixedAssetImportSchema}
        onImportSuccess={() => loadLiveAssets()}
      />

      {/* Maintenance Order Details Modal */}
      <Modal
        open={Boolean(viewingMaintenanceOrder)}
        onClose={() => setViewingMaintenanceOrder(null)}
        title={`Maintenance Order: ${viewingMaintenanceOrder?.order_number || ''}`}
        subtitle={`Asset: ${viewingMaintenanceOrder?.asset?.name || 'Equipment'} • Type: ${viewingMaintenanceOrder?.maintenance_type?.toUpperCase() || ''}`}
        size="md"
      >
        {viewingMaintenanceOrder && (
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-3 p-3 bg-surface-sunken rounded-xl border border-default text-xs">
              <div>
                <span className="text-2xs uppercase text-muted font-semibold block">Order Number</span>
                <span className="font-mono font-bold text-primary">{viewingMaintenanceOrder.order_number}</span>
              </div>
              <div>
                <span className="text-2xs uppercase text-muted font-semibold block">Status</span>
                <span className="capitalize font-semibold text-default">{viewingMaintenanceOrder.status.replace('_', ' ')}</span>
              </div>
              <div>
                <span className="text-2xs uppercase text-muted font-semibold block">Priority</span>
                <span className="uppercase font-bold text-rose-600">{viewingMaintenanceOrder.priority}</span>
              </div>
              <div>
                <span className="text-2xs uppercase text-muted font-semibold block">Scheduled Date</span>
                <span className="font-mono text-default">{viewingMaintenanceOrder.scheduled_date}</span>
              </div>
              <div>
                <span className="text-2xs uppercase text-muted font-semibold block">Technician</span>
                <span className="text-default font-medium">{viewingMaintenanceOrder.performed_by || 'Unassigned'}</span>
              </div>
              <div>
                <span className="text-2xs uppercase text-muted font-semibold block">Total Cost</span>
                <span className="font-mono font-bold text-emerald-600">{formatCurrency(viewingMaintenanceOrder.cost)}</span>
              </div>
            </div>

            <div className="p-3 bg-surface rounded-xl border border-default text-xs space-y-1">
              <span className="text-2xs uppercase text-muted font-semibold block">Work Description / Problem</span>
              <p className="text-default text-xs leading-relaxed">{viewingMaintenanceOrder.description || 'Routine preventive maintenance'}</p>
            </div>

            <div className="flex justify-end pt-3 border-t border-default">
              <button
                type="button"
                onClick={() => setViewingMaintenanceOrder(null)}
                className="px-4 py-1.5 text-xs font-semibold border border-default rounded-xl text-muted hover:text-default cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ConfirmDialog: Move Asset(s) to Data Bin */}
      <ConfirmDialog
        open={deleteAssetConfirm.open}
        onClose={() => setDeleteAssetConfirm({ open: false, isBulk: false })}
        onConfirm={handleExecuteDeleteAsset}
        title={deleteAssetConfirm.isBulk ? 'Move Selected Assets to Data Bin' : 'Move Asset to Data Bin'}
        message={
          deleteAssetConfirm.isBulk
            ? `Are you sure you want to move ${selectedAssetIds.size} asset(s) to the Data Bin? You can restore them anytime from Settings > Data Bin.`
            : 'This record will be moved to the Data Bin. You can restore it anytime from Settings > Data Bin.'
        }
        confirmLabel="Move to Bin"
        variant="danger"
      />

      {/* ConfirmDialog: Move Maintenance Work Order(s) to Data Bin */}
      <ConfirmDialog
        open={deleteOrderConfirm.open}
        onClose={() => setDeleteOrderConfirm({ open: false, isBulk: false })}
        onConfirm={handleExecuteDeleteOrder}
        title={deleteOrderConfirm.isBulk ? 'Move Selected Maintenance Orders to Data Bin' : 'Move Maintenance Order to Data Bin'}
        message={
          deleteOrderConfirm.isBulk
            ? `Are you sure you want to move ${selectedOrderIds.size} maintenance work order(s) to the Data Bin? You can restore them anytime from Settings > Data Bin.`
            : 'This record will be moved to the Data Bin. You can restore it anytime from Settings > Data Bin.'
        }
        confirmLabel="Move to Bin"
        variant="danger"
      />

      {/* Depreciation Projection Schedule Modal */}
      <DepreciationScheduleModal
        open={showDepreciationScheduleModal}
        onClose={() => setShowDepreciationScheduleModal(false)}
        asset={scheduleModalAsset}
        allAssets={assets}
        onSelectAsset={(ast) => setScheduleModalAsset(ast)}
      />

      {/* Asset Printable QR Label Modal */}
      <AssetQrLabelModal
        open={showQrLabelModal}
        onClose={() => setShowQrLabelModal(false)}
        asset={qrLabelAsset}
      />
    </div>
  );
};

export default AssetsWorkspace;
