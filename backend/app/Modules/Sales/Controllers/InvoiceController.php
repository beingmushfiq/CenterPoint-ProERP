<?php

declare(strict_types=1);

namespace App\Modules\Sales\Controllers;

use App\Core\Tenancy\TenantContext;
use App\Http\Controllers\Controller;
use App\Modules\Sales\Actions\ApproveInvoiceAction;
use App\Modules\Sales\Actions\CreateInvoiceAction;
use App\Modules\Sales\Actions\VoidInvoiceAction;
use App\Modules\Sales\Models\Invoice;
use App\Modules\Sales\Models\InvoiceItem;
use App\Modules\Sales\Requests\StoreInvoiceRequest;
use App\Modules\Sales\Resources\InvoiceResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class InvoiceController extends Controller
{
    public function __construct(
        private readonly CreateInvoiceAction $createInvoice,
        private readonly ApproveInvoiceAction $approveInvoice,
        private readonly VoidInvoiceAction $voidInvoice
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $tenantId = TenantContext::current()->tenantId();

        $query = Invoice::with(['customer', 'items.product'])
            ->where('tenant_id', $tenantId);

        if ($request->filled('status')) {
            $query->where('status', (string) $request->query('status'));
        }

        if ($request->filled('party_id')) {
            $query->where('party_id', (int) $request->query('party_id'));
        }

        if ($request->filled('sales_order_id')) {
            $query->where('sales_order_id', (int) $request->query('sales_order_id'));
        }

        if ($request->filled('q')) {
            $search = (string) $request->query('q');
            $query->where('invoice_number', 'like', "%{$search}%");
        }

        $perPage = $request->integer('per_page', 25);
        $invoices = $query->orderByDesc('invoice_date')
            ->orderByDesc('id')
            ->paginate($perPage);

        return InvoiceResource::collection($invoices);
    }

    public function store(StoreInvoiceRequest $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $validated = $request->validated();

        /** @var array{invoice_date: string, items: list<array{quantity: string, unit_price: string}>} $validated */
        $invoice = $this->createInvoice->execute([
            ...$validated,
            'tenant_id'  => $tenantId,
            'created_by' => (int) $request->user()?->id,
        ]);

        return (new InvoiceResource($invoice))
            ->response()
            ->setStatusCode(201);
    }

    public function show(int $id): InvoiceResource
    {
        $tenantId = TenantContext::current()->tenantId();

        $invoice = Invoice::with(['customer', 'items.product', 'salesOrder'])
            ->where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        return new InvoiceResource($invoice);
    }

    public function approve(int $id, Request $request): InvoiceResource
    {
        $tenantId = TenantContext::current()->tenantId();

        $invoice = Invoice::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $approved = $this->approveInvoice->execute(
            $invoice,
            (int) $request->user()?->id
        );

        return new InvoiceResource($approved);
    }

    public function void(int $id, Request $request): InvoiceResource
    {
        $tenantId = TenantContext::current()->tenantId();

        $invoice = Invoice::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        $request->validate([
            'void_reason' => ['required', 'string', 'max:500'],
        ]);

        $voided = $this->voidInvoice->execute(
            $invoice,
            (int) $request->user()?->id,
            (string) $request->input('void_reason')
        );

        return new InvoiceResource($voided);
    }

    public function bulkImport(Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();
        $userId = \Illuminate\Support\Facades\Auth::id();

        $validated = $request->validate([
            'rows' => ['required', 'array', 'min:1'],
            'rows.*' => ['required', 'array'],
            'mode' => ['nullable', 'string', 'in:skip,upsert'],
        ]);

        $rows = $validated['rows'];
        $mode = $validated['mode'] ?? 'skip';

        $imported = 0;
        $updated = 0;
        $skipped = 0;
        $errors = [];

        // Preload parties for tenant
        $parties = \App\Models\Party::query()
            ->where('tenant_id', $tenantId)
            ->get();
        $partyMap = [];
        foreach ($parties as $p) {
            if ($p->code) {
                $partyMap[strtolower((string) $p->code)] = $p;
            }
            $partyMap[strtolower((string) $p->name)] = $p;
        }

        $chunks = array_chunk($rows, 100);

        foreach ($chunks as $chunkIndex => $chunk) {
            \Illuminate\Support\Facades\DB::transaction(function () use (
                $chunk,
                $chunkIndex,
                $tenantId,
                $userId,
                $mode,
                &$partyMap,
                &$imported,
                &$updated,
                &$skipped,
                &$errors
            ): void {
                $chunkInvoiceNumbers = [];
                foreach ($chunk as $row) {
                    if (!empty($row['invoice_number'])) {
                        $chunkInvoiceNumbers[] = trim((string) $row['invoice_number']);
                    }
                }

                /** @var \Illuminate\Support\Collection<string, Invoice> $existingByNumber */
                $existingByNumber = Invoice::query()
                    ->where('tenant_id', $tenantId)
                    ->whereIn('invoice_number', $chunkInvoiceNumbers)
                    ->get()
                    ->keyBy('invoice_number');

                foreach ($chunk as $i => $row) {
                    $rowNum = ($chunkIndex * 100) + $i + 1;

                    $invoiceNumber = trim((string) ($row['invoice_number'] ?? ''));
                    if ($invoiceNumber === '') {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'invoice_number',
                            'message' => 'Invoice number is required.',
                        ];
                        continue;
                    }

                    $customerKey = trim((string) ($row['customer_code'] ?? $row['party_code'] ?? $row['customer_name'] ?? ''));
                    if ($customerKey === '') {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'customer_code',
                            'message' => 'Customer code or name is required.',
                        ];
                        continue;
                    }

                    $lowerCustomerKey = strtolower($customerKey);
                    if (!isset($partyMap[$lowerCustomerKey])) {
                        // Auto-create customer party if missing
                        $newParty = new \App\Models\Party();
                        $newParty->uuid = (string) \Illuminate\Support\Str::uuid();
                        $newParty->tenant_id = $tenantId;
                        $newParty->code = strtoupper($customerKey);
                        $newParty->name = !empty($row['customer_name']) ? trim((string) $row['customer_name']) : $customerKey;
                        $newParty->is_customer = 1;
                        $newParty->type = 'business';
                        $newParty->status = 'active';
                        $newParty->save();

                        $partyMap[$lowerCustomerKey] = $newParty;
                        $partyMap[strtolower((string) $newParty->code)] = $newParty;
                    }
                    $party = $partyMap[$lowerCustomerKey];

                    $date = !empty($row['invoice_date']) ? trim((string) $row['invoice_date']) : now()->format('Y-m-d');
                    $dueDate = !empty($row['due_date']) ? trim((string) $row['due_date']) : $date;

                    $totalAmountRaw = $row['total_amount'] ?? null;
                    if ($totalAmountRaw === null || !is_numeric($totalAmountRaw) || (float) $totalAmountRaw <= 0) {
                        $errors[] = [
                            'row' => $rowNum,
                            'field' => 'total_amount',
                            'message' => 'Total amount must be a positive number.',
                        ];
                        continue;
                    }
                    $totalAmount = (float) $totalAmountRaw;

                    $paidAmountRaw = $row['paid_amount'] ?? 0;
                    $paidAmount = (is_numeric($paidAmountRaw) && (float) $paidAmountRaw >= 0) ? (float) $paidAmountRaw : 0.0000;

                    // Determine status
                    $rawStatus = !empty($row['status']) ? strtolower(trim((string) $row['status'])) : null;
                    if ($rawStatus && in_array($rawStatus, ['draft', 'posted', 'partially_paid', 'paid', 'void'], true)) {
                        $status = $rawStatus;
                    } elseif ($paidAmount >= $totalAmount) {
                        $status = 'paid';
                    } elseif ($paidAmount > 0) {
                        $status = 'partially_paid';
                    } else {
                        $status = 'posted';
                    }

                    $existingInvoice = $existingByNumber[$invoiceNumber] ?? null;

                    if ($existingInvoice) {
                        if ($mode === 'skip') {
                            $skipped++;
                            continue;
                        }

                        // Upsert
                        $existingInvoice->update([
                            'party_id' => $party->id,
                            'invoice_date' => $date,
                            'due_date' => $dueDate,
                            'subtotal' => number_format($totalAmount, 4, '.', ''),
                            'total_amount' => number_format($totalAmount, 4, '.', ''),
                            'paid_amount' => number_format($paidAmount, 4, '.', ''),
                            'status' => $status,
                            'updated_by' => $userId,
                        ]);

                        $updated++;
                        continue;
                    }

                    // Insert
                    $newInvoice = new Invoice();
                    $newInvoice->uuid = (string) \Illuminate\Support\Str::uuid();
                    $newInvoice->tenant_id = $tenantId;
                    $newInvoice->invoice_number = $invoiceNumber;
                    $newInvoice->party_id = $party->id;
                    $newInvoice->invoice_date = $date;
                    $newInvoice->due_date = $dueDate;
                    $newInvoice->subtotal = number_format($totalAmount, 4, '.', '');
                    $newInvoice->total_amount = number_format($totalAmount, 4, '.', '');
                    $newInvoice->paid_amount = number_format($paidAmount, 4, '.', '');
                    $newInvoice->status = $status;
                    $newInvoice->posted_at = ($status !== 'draft') ? now() : null;
                    $newInvoice->posted_by = ($status !== 'draft') ? $userId : null;
                    $newInvoice->created_by = $userId;
                    $newInvoice->updated_by = $userId;
                    $newInvoice->save();

                    // Create line item for historical opening entry
                    $lineItem = new InvoiceItem();
                    $lineItem->uuid = (string) \Illuminate\Support\Str::uuid();
                    $lineItem->tenant_id = $tenantId;
                    $lineItem->invoice_id = $newInvoice->id;
                    $lineItem->description = !empty($row['notes']) ? (string) $row['notes'] : 'Opening Balance Migration';
                    $lineItem->quantity = '1.0000';
                    $lineItem->unit_price = number_format($totalAmount, 4, '.', '');
                    $lineItem->discount_amount = '0.0000';
                    $lineItem->tax_amount = '0.0000';
                    $lineItem->line_total = number_format($totalAmount, 4, '.', '');
                    $lineItem->sort_order = 1;
                    $lineItem->created_by = $userId;
                    $lineItem->updated_by = $userId;
                    $lineItem->save();

                    $existingByNumber[$invoiceNumber] = $newInvoice;
                    $imported++;
                }
            });
        }

        return response()->json([
            'success' => true,
            'data' => [
                'imported_count' => $imported,
                'updated_count' => $updated,
                'skipped_count' => $skipped,
                'total_processed' => $imported + $updated + $skipped,
                'errors' => $errors,
            ],
            'message' => sprintf(
                'Bulk import completed: %d imported, %d updated, %d skipped.',
                $imported,
                $updated,
                $skipped
            ),
        ]);
    }

    public function destroy(int $id, Request $request): JsonResponse
    {
        $tenantId = TenantContext::current()->tenantId();

        /** @var Invoice $invoice */
        $invoice = Invoice::where('tenant_id', $tenantId)
            ->where('id', $id)
            ->firstOrFail();

        if (in_array($invoice->status, ['paid', 'partially_paid'], true)) {
            return response()->json([
                'message' => 'Cannot delete an invoice that has received payments. Void payments first.',
            ], 422);
        }

        if ($invoice->status === 'approved') {
            $this->voidInvoice->execute(
                $invoice,
                (int) $request->user()?->id,
                'Invoice deleted by user'
            );
            return response()->json([
                'success' => true,
                'message' => 'Approved invoice was voided successfully.',
            ]);
        }

        $invoice->delete();

        return response()->json([
            'success' => true,
            'message' => 'Invoice deleted successfully.',
        ]);
    }
}

