<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Notifications\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $userId = $user?->id ?? 1;

        $query = Notification::where('user_id', $userId)
            ->orderBy('created_at', 'desc');

        if ($request->query('unread_only') === 'true' || $request->query('unread_only') === '1') {
            $query->whereNull('read_at');
        }

        $notifications = $query->paginate($request->integer('per_page', 20));

        $unreadCount = Notification::where('user_id', $userId)
            ->whereNull('read_at')
            ->count();

        return response()->json([
            'data' => $notifications->items(),
            'meta' => [
                'unread_count' => $unreadCount,
                'total' => $notifications->total(),
                'current_page' => $notifications->currentPage(),
                'per_page' => $notifications->perPage(),
            ],
        ]);
    }

    public function markAsRead(string $id, Request $request): JsonResponse
    {
        $userId = $request->user()?->id ?? 1;

        /** @var Notification $notification */
        $notification = Notification::where('user_id', $userId)
            ->where(function ($q) use ($id): void {
                $q->where('id', $id)->orWhere('uuid', $id);
            })
            ->firstOrFail();

        $notification->update(['read_at' => now()]);

        return response()->json([
            'message' => 'Notification marked as read.',
            'data' => $notification,
        ]);
    }

    public function markAllAsRead(Request $request): JsonResponse
    {
        $userId = $request->user()?->id ?? 1;

        Notification::where('user_id', $userId)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json([
            'message' => 'All notifications marked as read.',
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => ['nullable', 'integer'],
            'type' => ['required', 'string', 'max:100'],
            'title' => ['nullable', 'string', 'max:255'],
            'title_key' => ['nullable', 'string', 'max:255'],
            'message' => ['nullable', 'string'],
            'body_key' => ['nullable', 'string'],
            'severity' => ['nullable', 'string', 'in:info,success,warning,error'],
            'action_url' => ['nullable', 'string', 'max:500'],
            'params' => ['nullable', 'array'],
        ]);

        $userId = $validated['user_id'] ?? $request->user()?->id ?? 1;

        $notification = Notification::create([
            'user_id' => $userId,
            'type' => $validated['type'],
            'channel' => 'in_app',
            'title_key' => $validated['title'] ?? $validated['title_key'] ?? 'Notification',
            'body_key' => $validated['message'] ?? $validated['body_key'] ?? '',
            'severity' => $validated['severity'] ?? 'info',
            'action_url' => $validated['action_url'] ?? null,
            'params' => $validated['params'] ?? [],
            'sent_at' => now(),
        ]);

        return response()->json([
            'message' => 'Notification created successfully.',
            'data' => $notification,
        ], 201);
    }
}
