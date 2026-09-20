export interface User {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  is_platform_admin: boolean;
  locale: string;
  theme: string;
  density: string;
  landing_page: string;
  tenant_id: number | null;
  default_company_id: number | null;
  default_branch_id: number | null;
  default_factory_id: number | null;
  default_warehouse_id: number | null;
  role?: string;
  roles?: string[];
  phone?: string;
  role_label?: string;
  department?: string;
}

export interface TenantInfo {
  id: number;
  uuid: string;
  name: string;
  slug: string;
  subdomain?: string;
  status: string;
  currency_code: string;
  currency_symbol?: string;
  timezone: string;
  logo_url?: string;
  branding?: Record<string, unknown> | null;
}

export interface BranchInfo {
  id: number;
  uuid: string;
  code: string;
  name: string;
  is_head_office: boolean;
}

export interface LoginResponseData {
  user: User;
  tenant: TenantInfo;
  access_token: string;
  token_type: string;
  expires_in: number;
  permissions: string[];
}

export interface MeResponseData {
  user: User;
  tenant: TenantInfo | null;
  branches: BranchInfo[];
  active_branch: BranchInfo | null;
  permissions: string[];
}
