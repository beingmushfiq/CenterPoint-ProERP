# 04 — API Mismatches, Duplications & Route Redundancies

**Status:** Completed  
**Date:** September 2026  
**Total Redundant Actions:** **51 controller actions** registered across **115 route entries**

---

## 1. Major Duplicate Route Sets on Backend

The table below lists the most significant duplicate route sets discovered in `routes.json`:

| Controller Action | Canonical URI | Duplicate URI(s) | Impact / Risk |
|---|---|---|---|
| `BillOfMaterialController@index` | `api/v1/boms` | `api/v1/bill-of-materials` | Route bloat; frontend uncertainty |
| `BillOfMaterialController@store` | `api/v1/boms` | `api/v1/bill-of-materials` | Duplicate POST handler |
| `BillOfMaterialController@bulkImport` | `api/v1/boms/bulk-import` | `api/v1/bill-of-materials/bulk-import` | Duplicate import route |
| `BillOfMaterialController@show` | `api/v1/boms/{billOfMaterial:uuid}` | `api/v1/bill-of-materials/{billOfMaterial:uuid}` | Route ambiguity |
| `BillOfMaterialController@update` | `api/v1/boms/{billOfMaterial:uuid}` | `api/v1/bill-of-materials/{billOfMaterial:uuid}` | Duplicate PATCH handler |
| `BillOfMaterialController@destroy` | `api/v1/boms/{billOfMaterial:uuid}` | `api/v1/bill-of-materials/{billOfMaterial:uuid}` | Duplicate DELETE handler |
| `EmployeeController@index` | `api/v1/hr/employees` | `api/v1/workforce/employees` | Module confusion (HR vs Workforce) |
| `EmployeeController@store` | `api/v1/hr/employees` | `api/v1/workforce/employees` | Duplicate POST handler |
| `EmployeeController@show` | `api/v1/hr/employees/{id}` | `api/v1/workforce/employees/{id}` | Duplicate GET handler |
| `EmployeeController@toggleStatus` | `api/v1/hr/employees/{id}/status` [PATCH] | `api/v1/hr/employees/{id}/toggle-status` [POST] | HTTP verb inconsistency |
| `GoodsReceiptController@index` | `api/v1/purchasing/goods-receipts` | `api/v1/purchasing/receipts` | Inconsistent naming |
| `GoodsReceiptController@store` | `api/v1/purchasing/goods-receipts` | `api/v1/purchasing/receipts` | Inconsistent naming |
| `GoodsReceiptController@show` | `api/v1/purchasing/goods-receipts/{id}` | `api/v1/purchasing/receipts/{id}` | Inconsistent naming |
| `CourierShipmentController@index` | `api/v1/delivery/shipments` | `api/v1/logistics/shipments` | Domain naming overlap |
| `CourierShipmentController@show` | `api/v1/delivery/shipments/{shipment}` | `api/v1/logistics/shipments/{shipment}` | Domain naming overlap |
| `TenantCouponController@*` (8 actions) | `api/v1/sales/coupons` | `api/v1/storefront/coupons` | Overlap between Admin & Storefront |
| `PlatformSupportController@*` (5 actions)| `api/v1/platform/support/tickets` | `api/v1/platform/support-tickets` | Hyphenated vs hierarchical |
| `ReportRegistryController@index` | `api/v1/reports` | `api/v1/reports/definitions` | Duplicate registry endpoint |
| `AssetController@bulkImport` | `api/v1/assets/bulk-import` | `api/v1/finance/fixed-assets/bulk-import` | Domain overlap (Assets vs Finance) |
| `JournalEntryController@bulkImport` | `api/v1/finance/journal-entries/bulk-import` | `api/v1/finance/journal/bulk-import` | Plural vs singular alias |
| `AttendanceController@index` | `api/v1/hr/attendances` | `api/v1/hr/attendance` | Plural vs singular alias |
| `AttendanceController@store` | `api/v1/hr/attendances` | `api/v1/hr/attendance` | Plural vs singular alias |
| `AttendanceController@bulkImport` | `api/v1/hr/attendances/bulk-import` | `api/v1/hr/attendance/bulk-import` | Plural vs singular alias |
| `StorefrontManifestController@manifest` | `api/v1/storefront/manifest.json` | `manifest.json`, `store/{subdomain}/manifest.json` | Triplicate registration |
| `StorefrontRobotsController` | `api/v1/storefront/robots.txt` | `robots.txt`, `store/{subdomain}/robots.txt` | Triplicate registration |
| `StorefrontSitemapController@*` (4 actions)| `api/v1/storefront/sitemap*.xml` | `sitemap*.xml`, `store/{subdomain}/sitemap*.xml` | Triplicate registration |

---

## 2. Frontend Catch-Fallback Antipatterns

Because developers encountered route naming mismatches in staging, defensive fallback chains were introduced into frontend code:

```typescript
// 1. CouponsTab.tsx:214
api.get<any>(`/sales/coupons/${coupon.id}`)
   .catch(() => api.get<any>(`/storefront/coupons/${coupon.id}`));

// 2. ModuleManagerSection.tsx:177
await api.put('/tenant/modules/batch', payload)
   .catch(() => api.post('/tenant/modules/batch', payload));

// 3. ReportsWorkspace.tsx:140
api.get<ReportDefinition[]>('/reports/definitions')
   .catch(() => api.get<ReportDefinition[]>('/reports'));

// 4. GoodsReceiptsSection.tsx:244
api.post('/purchasing/goods-receipts', newGrn)
   .catch(() => api.post('/purchasing/receipts', newGrn));

// 5. BillOfMaterialsSection.tsx:162, 217, 235
api.post('/boms', body).catch(() => api.post('/bill-of-materials', body));
api.patch(`/boms/${id}`, body).catch(() => api.patch(`/bill-of-materials/${id}`, body));
api.delete(`/boms/${id}`).catch(() => api.delete(`/bill-of-materials/${id}`));

// 6. PlatformSupportWorkspace.tsx:121, 143, 162
api.post('/platform/support/tickets', payload)
   .catch(() => api.post('/platform/support-tickets', payload));

// 7. hrApi.ts:375, 394
api.post('/hr/attendance', payload).catch(() => api.post('/hr/attendances', payload));
api.get(`/hr/leave-requests${qs}`).catch(() => api.get(`/hr/leaves${qs}`));
```

**Remediation Plan:** Standardize canonical endpoints in the backend, alias the old routes with an HTTP `Deprecation: true` header for one release cycle, and clean up the frontend call sites to use only the canonical routes.

---

## 3. Response Envelope Mismatches

The official `API_CONTRACT.md` dictates that every 2xx response must conform to:
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "correlation_id": "...",
    "pagination": { "page": 1, "per_page": 20, "total": 100, "total_pages": 5, "has_more": true }
  }
}
```

### Discovered Violations
1. `AssetController.php` (`index`): Returns `response()->json($assets)` where `$assets` is a raw Laravel `LengthAwarePaginator`. The output shape is `{ "current_page": 1, "data": [...], "total": ... }`. This lacks the outer `"meta"` key, causing frontend tables to lose total row count and pagination controls!
2. `ReportDataController.php`: Returns the runner array directly `{ report, columns, data, pagination, summary, meta }` without the standard envelope top-level keys.
3. Multiple controllers return `{ data, message }` instead of `{ success: true, data, meta: { correlation_id } }`.

---

## 4. Parameter Mismatches: `{uuid}` vs `{id}`

- In `api/v1/boms/{billOfMaterial:uuid}`, the route requires a UUID string.
- In `api/v1/assets/{id}`, the route requires an integer ID.
- In `api/v1/hr/employees/{id}`, the route requires an integer ID.
- In `api/v1/production/batches/{id}`, the route accepts both integer ID or UUID depending on the action.
**Standardization:** All public/tenant resource URLs must standardize on UUIDs for external and API visibility, preventing sequential ID enumeration attacks.
