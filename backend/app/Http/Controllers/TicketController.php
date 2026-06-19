<?php

namespace App\Http\Controllers;

use App\Models\Ticket;
use App\Models\TicketFeedback;
use App\Services\TicketTriageAdvisor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TicketController extends Controller
{
    public function __construct(private readonly TicketTriageAdvisor $advisor)
    {
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'email' => ['required', 'email', 'max:180'],
            'phone' => ['nullable', 'string', 'max:40'],
            'area' => ['required', 'string', 'max:160'],
            'subject' => ['required', 'string', 'max:180'],
            'description' => ['required', 'string', 'max:5000'],
        ]);

        $ticket = DB::transaction(function () use ($data): Ticket {
            $priority = $this->advisor->suggestPriority($data);
            $ticket = Ticket::query()->create([
                ...$data,
                'protocol' => $this->nextProtocol(),
                'status' => 'open',
                'priority' => $priority,
                'estimated_response_at' => now()->addHours($this->advisor->estimatedResponseHours($priority)),
            ]);

            $ticket->messages()->create([
                'sender_type' => 'system',
                'sender_name' => 'Sistema',
                'message' => 'Chamado aberto pelo atendimento digital.',
            ]);

            $ticket->messages()->create([
                'sender_type' => 'visitor',
                'sender_name' => $ticket->name,
                'message' => $ticket->description,
            ]);

            return $ticket;
        });

        return response()->json([
            'success' => true,
            'ticket' => [
                'protocol' => $ticket->protocol,
                'status' => $ticket->status,
                'priority' => $ticket->priority,
                'estimated_response_at' => $ticket->estimated_response_at?->toISOString(),
            ],
        ], 201);
    }

    public function lookup(Request $request): JsonResponse
    {
        $data = $request->validate([
            'protocol' => ['required', 'string', 'max:32'],
            'email' => ['required', 'email', 'max:180'],
        ]);

        $ticket = Ticket::query()
            ->with(['messages', 'feedback'])
            ->where('protocol', $data['protocol'])
            ->where('email', $data['email'])
            ->first();

        if (! $ticket) {
            return response()->json([
                'success' => false,
                'message' => 'Chamado nao encontrado para este protocolo e e-mail.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'ticket' => $this->serializeTicket($ticket),
        ]);
    }

    public function storeMessage(Request $request, string $protocol): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:180'],
            'message' => ['required', 'string', 'max:5000'],
        ]);

        $ticket = Ticket::query()
            ->where('protocol', $protocol)
            ->where('email', $data['email'])
            ->first();

        if (! $ticket) {
            return response()->json([
                'success' => false,
                'message' => 'Chamado nao encontrado para este protocolo e e-mail.',
            ], 404);
        }

        if ($ticket->status === 'closed') {
            return response()->json([
                'success' => false,
                'message' => 'Chamado encerrado. Abra um novo atendimento para enviar outra mensagem.',
            ], 422);
        }

        $message = $ticket->messages()->create([
            'sender_type' => 'visitor',
            'sender_name' => $ticket->name,
            'message' => $data['message'],
        ]);

        $ticket->update([
            'status' => $ticket->status === 'answered' ? 'waiting' : $ticket->status,
        ]);

        return response()->json([
            'success' => true,
            'message' => $this->serializeMessage($message),
            'ticket' => [
                'protocol' => $ticket->protocol,
                'status' => $ticket->fresh()->status,
            ],
        ], 201);
    }

    public function storeFeedback(Request $request, string $protocol): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:180'],
            'rating' => ['required', 'integer', 'min:1', 'max:10'],
            'stars' => ['required', 'integer', 'min:1', 'max:5'],
            'comment' => ['nullable', 'string', 'max:2000'],
        ]);

        $ticket = Ticket::query()
            ->where('protocol', $protocol)
            ->where('email', $data['email'])
            ->first();

        if (! $ticket) {
            return response()->json([
                'success' => false,
                'message' => 'Chamado nao encontrado para este protocolo e e-mail.',
            ], 404);
        }

        $feedback = TicketFeedback::query()->updateOrCreate(
            ['ticket_id' => $ticket->id],
            [
                'rating' => $data['rating'],
                'stars' => $data['stars'],
                'comment' => $data['comment'] ?? null,
            ],
        );

        $ticket->update([
            'status' => 'closed',
            'closed_at' => $ticket->closed_at ?? now(),
        ]);

        return response()->json([
            'success' => true,
            'feedback' => [
                'rating' => $feedback->rating,
                'stars' => $feedback->stars,
                'comment' => $feedback->comment,
            ],
            'ticket' => [
                'protocol' => $ticket->protocol,
                'status' => 'closed',
            ],
        ]);
    }

    private function nextProtocol(): string
    {
        $year = now()->year;
        $lastTicket = Ticket::query()
            ->where('protocol', 'like', "MIT-{$year}-%")
            ->orderByDesc('id')
            ->first();

        $lastSequence = $lastTicket
            ? (int) substr($lastTicket->protocol, -6)
            : 0;

        return sprintf('MIT-%d-%06d', $year, $lastSequence + 1);
    }

    private function serializeTicket(Ticket $ticket): array
    {
        return [
            'id' => $ticket->id,
            'protocol' => $ticket->protocol,
            'name' => $ticket->name,
            'email' => $ticket->email,
            'phone' => $ticket->phone,
            'area' => $ticket->area,
            'subject' => $ticket->subject,
            'description' => $ticket->description,
            'status' => $ticket->status,
            'priority' => $ticket->priority,
            'estimated_response_at' => $ticket->estimated_response_at?->toISOString(),
            'closed_at' => $ticket->closed_at?->toISOString(),
            'created_at' => $ticket->created_at?->toISOString(),
            'updated_at' => $ticket->updated_at?->toISOString(),
            'messages' => $ticket->messages->map(fn ($message): array => $this->serializeMessage($message))->values(),
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
}
