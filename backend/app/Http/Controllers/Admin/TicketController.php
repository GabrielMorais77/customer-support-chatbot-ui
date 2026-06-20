<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Ticket;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TicketController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'status' => ['nullable', Rule::in(Ticket::STATUSES)],
            'search' => ['nullable', 'string', 'max:160'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Ticket::query()
            ->withCount('messages')
            ->withCount('attachments')
            ->latest();

        if (! empty($data['status'])) {
            $query->where('status', $data['status']);
        }

        if (! empty($data['search'])) {
            $search = $data['search'];
            $query->where(function ($inner) use ($search): void {
                $inner->where('protocol', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('subject', 'like', "%{$search}%");
            });
        }

        $paginator = $query->paginate($data['per_page'] ?? 20);

        return response()->json([
            'success' => true,
            'tickets' => $paginator->getCollection()
                ->map(fn (Ticket $ticket): array => $this->serializeTicketSummary($ticket))
                ->values(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function show(Ticket $ticket): JsonResponse
    {
        $ticket->load(['messages', 'feedback', 'attachments']);

        return response()->json([
            'success' => true,
            'ticket' => $this->serializeTicket($ticket),
        ]);
    }

    public function updateStatus(Request $request, Ticket $ticket): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(Ticket::STATUSES)],
        ]);

        $updates = ['status' => $data['status']];

        if ($data['status'] === 'closed') {
            $updates['closed_at'] = $ticket->closed_at ?? now();
        } elseif ($ticket->status === 'closed') {
            $updates['closed_at'] = null;
        }

        $ticket->update($updates);

        $ticket->messages()->create([
            'sender_type' => 'system',
            'sender_name' => 'Sistema',
            'message' => "Status alterado para {$data['status']}.",
        ]);

        return response()->json([
            'success' => true,
            'ticket' => $this->serializeTicketSummary($ticket->fresh()),
        ]);
    }

    public function storeMessage(Request $request, Ticket $ticket): JsonResponse
    {
        $data = $request->validate([
            'message' => ['required', 'string', 'max:5000'],
        ]);

        $admin = $request->attributes->get('admin_user');

        $message = $ticket->messages()->create([
            'sender_type' => 'agent',
            'sender_name' => $admin?->name ?? 'Atendente',
            'message' => $data['message'],
        ]);

        $ticket->update([
            'status' => 'answered',
            'closed_at' => null,
        ]);

        return response()->json([
            'success' => true,
            'message' => $this->serializeMessage($message),
            'ticket' => $this->serializeTicketSummary($ticket->fresh()),
        ], 201);
    }

    private function serializeTicketSummary(Ticket $ticket): array
    {
        return [
            'id' => $ticket->id,
            'protocol' => $ticket->protocol,
            'name' => $ticket->name,
            'email' => $ticket->email,
            'phone' => $ticket->phone,
            'area' => $ticket->area,
            'subject' => $ticket->subject,
            'status' => $ticket->status,
            'priority' => $ticket->priority,
            'estimated_response_at' => $ticket->estimated_response_at?->toISOString(),
            'closed_at' => $ticket->closed_at?->toISOString(),
            'created_at' => $ticket->created_at?->toISOString(),
            'updated_at' => $ticket->updated_at?->toISOString(),
            'messages_count' => $ticket->messages_count ?? $ticket->messages()->count(),
            'attachments_count' => $ticket->attachments_count ?? $ticket->attachments()->count(),
        ];
    }

    private function serializeTicket(Ticket $ticket): array
    {
        return [
            ...$this->serializeTicketSummary($ticket),
            'description' => $ticket->description,
            'messages' => $ticket->messages->map(fn ($message): array => $this->serializeMessage($message))->values(),
            'attachments' => $ticket->attachments->map(fn ($attachment): array => $this->serializeAttachment($attachment))->values(),
            'feedback' => $ticket->feedback ? [
                'rating' => $ticket->feedback->rating,
                'stars' => $ticket->feedback->stars,
                'comment' => $ticket->feedback->comment,
                'created_at' => $ticket->feedback->created_at?->toISOString(),
            ] : null,
        ];
    }

    private function serializeMessage($message): array
    {
        return [
            'id' => $message->id,
            'sender_type' => $message->sender_type,
            'sender_name' => $message->sender_name,
            'message' => $message->message,
            'created_at' => $message->created_at?->toISOString(),
        ];
    }

    private function serializeAttachment($attachment): array
    {
        return [
            'id' => $attachment->id,
            'uploaded_by' => $attachment->uploaded_by,
            'original_name' => $attachment->original_name,
            'mime_type' => $attachment->mime_type,
            'size' => $attachment->size,
            'created_at' => $attachment->created_at?->toISOString(),
        ];
    }
}
