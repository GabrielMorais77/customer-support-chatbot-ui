<?php

namespace App\Http\Controllers;

use App\Services\AssistantChatService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AssistantController extends Controller
{
    public function __construct(private readonly AssistantChatService $assistant)
    {
    }

    public function chat(Request $request): JsonResponse
    {
        $data = $request->validate([
            'message' => ['required', 'string', 'max:3000'],
            'area' => ['nullable', 'string', 'max:120'],
            'history' => ['nullable', 'array', 'max:8'],
            'history.*.role' => ['required_with:history', 'string', 'in:user,assistant'],
            'history.*.content' => ['required_with:history', 'string', 'max:1200'],
        ]);

        $result = $this->assistant->reply(
            message: $data['message'],
            area: $data['area'] ?? null,
            history: $data['history'] ?? [],
        );

        return response()->json([
            'success' => true,
            'reply' => $result['reply'],
            'source' => $result['source'],
            'triage' => $result['triage'],
        ]);
    }
}
