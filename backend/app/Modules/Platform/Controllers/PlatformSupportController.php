<?php

declare(strict_types=1);

namespace App\Modules\Platform\Controllers;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\PlatformSupportTicket;
use App\Models\PlatformSupportTicketNote;
use App\Models\Tenant;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PlatformSupportController extends Controller
{
    /**
     * List all support tickets cross-tenant with filters.
     */
    public function index(Request $request): JsonResponse
    {
        $query = PlatformSupportTicket::with([
            'tenant:id,name,slug',
            'assignee:id,name,email',
            'creator:id,name,email',
        ])->withCount('notes')->latest('id');

        if ($request->filled('tenant_id')) {
            $query->where('tenant_id', (int) $request->input('tenant_id'));
        }

        if ($request->filled('status') && $request->input('status') !== 'all') {
            $query->where('status', (string) $request->input('status'));
        }

        if ($request->filled('priority') && $request->input('priority') !== 'all') {
            $query->where('priority', (string) $request->input('priority'));
        }

        if ($request->filled('assigned_to')) {
            $query->where('assigned_to', (int) $request->input('assigned_to'));
        }

        if ($request->filled('search')) {
            $search = '%'.trim((string) $request->input('search')).'%';
            $query->where(function ($q) use ($search): void {
                $q->where('ticket_number', 'like', $search)
                    ->orWhere('title', 'like', $search)
                    ->orWhere('description', 'like', $search)
                    ->orWhereHas('tenant', function ($tq) use ($search): void {
                        $tq->where('name', 'like', $search)
                            ->orWhere('slug', 'like', $search);
                    });
            });
        }

        $perPage = min(max((int) $request->input('per_page', 25), 1), 100);
        $paginator = $query->paginate($perPage);

        $counts = [
            'open' => PlatformSupportTicket::where('status', 'open')->count(),
            'in_progress' => PlatformSupportTicket::where('status', 'in_progress')->count(),
            'resolved' => PlatformSupportTicket::where('status', 'resolved')->count(),
            'urgent' => PlatformSupportTicket::where('priority', 'urgent')->whereIn('status', ['open', 'in_progress'])->count(),
        ];

        return response()->json([
            'success' => true,
            'data' => $paginator->items(),
            'counts' => $counts,
            'meta' => [
                'pagination' => [
                    'total' => $paginator->total(),
                    'page' => $paginator->currentPage(),
                    'per_page' => $paginator->perPage(),
                    'total_pages' => $paginator->lastPage(),
                ],
                'correlation_id' => (string) $request->header('X-Correlation-Id', ''),
                'timestamp' => Carbon::now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Create a new support ticket.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tenant_id' => 'required|integer|exists:tenants,id',
            'title' => 'required|string|max:255',
            'description' => 'required|string',
            'category' => 'nullable|string|in:billing,technical,bug,feature_request,general',
            'priority' => 'nullable|string|in:low,normal,medium,high,urgent',
            'assigned_to' => 'nullable|integer|exists:users,id',
        ]);

        $ticketNumber = 'TKT-'.Carbon::now()->format('Ym').'-'.strtoupper(Str::random(5));

        $ticket = PlatformSupportTicket::create([
            'uuid' => (string) Str::uuid(),
            'ticket_number' => $ticketNumber,
            'tenant_id' => $validated['tenant_id'],
            'title' => $validated['title'],
            'description' => $validated['description'],
            'category' => $validated['category'] ?? 'technical',
            'priority' => $validated['priority'] ?? 'medium',
            'status' => 'open',
            'assigned_to' => $validated['assigned_to'] ?? null,
            'created_by' => $request->user()?->id,
        ]);

        AuditLog::withoutTenantScope()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $request->user()?->id,
            'action' => \App\Core\Audit\AuditAction::Created,
            'auditable_type' => 'PlatformSupportTicket',
            'auditable_id' => $ticket->id,
            'ip' => $request->ip() ?? '127.0.0.1',
            'user_agent' => $request->userAgent() ?? 'Master SaaS Admin',
            'created_at' => Carbon::now(),
            'after' => ['ticket_number' => $ticket->ticket_number, 'tenant_id' => $ticket->tenant_id],
        ]);

        return response()->json([
            'success' => true,
            'message' => "Ticket {$ticket->ticket_number} created successfully.",
            'data' => $ticket->load(['tenant:id,name,slug', 'assignee:id,name,email']),
        ], 201);
    }

    /**
     * Show ticket details with conversation thread.
     */
    public function show(int $id): JsonResponse
    {
        $ticket = PlatformSupportTicket::with([
            'tenant:id,name,slug',
            'assignee:id,name,email',
            'creator:id,name,email',
            'notes.author:id,name,email',
        ])->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $ticket,
        ]);
    }

    /**
     * Update ticket status, priority, or assignee.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $ticket = PlatformSupportTicket::findOrFail($id);

        $validated = $request->validate([
            'status' => 'nullable|string|in:open,in_progress,waiting_tenant,resolved,closed',
            'priority' => 'nullable|string|in:low,normal,medium,high,urgent',
            'category' => 'nullable|string|in:billing,technical,bug,feature_request,general',
            'assigned_to' => 'nullable|integer|exists:users,id',
        ]);

        if (isset($validated['status']) && $validated['status'] === 'resolved' && $ticket->status !== 'resolved') {
            $ticket->resolved_at = Carbon::now();
        } elseif (isset($validated['status']) && $validated['status'] !== 'resolved') {
            $ticket->resolved_at = null;
        }

        $ticket->update(array_filter($validated, fn ($v) => $v !== null));

        return response()->json([
            'success' => true,
            'message' => "Ticket {$ticket->ticket_number} updated.",
            'data' => $ticket->fresh()->load(['tenant:id,name,slug', 'assignee:id,name,email']),
        ]);
    }

    /**
     * Add a note / reply to a ticket.
     */
    public function addNote(Request $request, int $id): JsonResponse
    {
        $ticket = PlatformSupportTicket::findOrFail($id);

        $validated = $request->validate([
            'note' => 'required|string',
            'is_internal' => 'nullable|boolean',
        ]);

        $note = PlatformSupportTicketNote::create([
            'ticket_id' => $ticket->id,
            'note' => $validated['note'],
            'is_internal' => $validated['is_internal'] ?? true,
            'created_by' => $request->user()?->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Note added to ticket.',
            'data' => $note->load('author:id,name,email'),
        ], 201);
    }
}
