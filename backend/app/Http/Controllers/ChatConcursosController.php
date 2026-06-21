<?php

namespace App\Http\Controllers;

use App\Services\GeminiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class ChatConcursosController extends Controller
{
    public function __construct(private readonly GeminiService $gemini)
    {
    }

    public function __invoke(Request $request): JsonResponse
    {
        $data = $request->validate([
            'pergunta' => ['required', 'string', 'max:3000'],
            'session_id' => ['nullable', 'string', 'max:80'],
            'option' => ['nullable', 'string', 'max:120'],
        ]);

        $session = $this->resolveSession($data['session_id'] ?? null, $data['option'] ?? null);
        $effectiveOption = $this->resolveEffectiveOption(
            sessionId: $session['id'],
            question: $data['pergunta'],
            option: $data['option'] ?? null,
        );

        if ($effectiveOption !== ($data['option'] ?? null)) {
            $this->updateSessionOption($session['id'], $effectiveOption);
        }

        $this->storeMessage(
            sessionId: $session['id'],
            senderType: 'visitor',
            senderName: null,
            message: $data['pergunta'],
            metadata: [
                'option' => $effectiveOption,
            ],
        );

        $humanProtocol = $this->humanProtocolIntent($data['pergunta'], $effectiveOption);

        if ($humanProtocol !== null) {
            $this->storeMessage(
                sessionId: $session['id'],
                senderType: 'bot',
                senderName: 'Assistente Tecnico',
                message: $humanProtocol['resposta'],
                metadata: [
                    'requires_ticket' => true,
                    'suggested_area_key' => $humanProtocol['suggested_area_key'],
                    'option' => $effectiveOption,
                ],
            );

            return response()->json([
                'success' => true,
                'session_id' => $session['session_uuid'],
                'resposta' => $humanProtocol['resposta'],
                'fontes_usadas' => [],
                'catalog_results' => [],
                'study_options' => [],
                'requires_ticket' => true,
                'suggested_area_key' => $humanProtocol['suggested_area_key'],
                'option' => $effectiveOption,
            ]);
        }

        try {
            $result = $this->gemini->answerQuestion($data['pergunta'], $effectiveOption);
        } catch (RuntimeException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
                'session_id' => $session['session_uuid'],
                'resposta' => 'Nao consegui consultar a base de editais neste momento.',
                'fontes_usadas' => [],
            ], 503);
        } catch (Throwable) {
            return response()->json([
                'success' => false,
                'message' => 'Nao foi possivel consultar a IA agora.',
                'session_id' => $session['session_uuid'],
                'resposta' => 'Nao consegui consultar a base de editais neste momento.',
                'fontes_usadas' => [],
            ], 502);
        }

        $this->storeMessage(
            sessionId: $session['id'],
            senderType: 'bot',
            senderName: 'Assistente Tecnico',
            message: $result['resposta'],
            metadata: [
                'fontes_usadas' => $result['fontes_usadas'],
                'catalog_results' => $result['catalog_results'] ?? [],
                'study_options' => $result['study_options'] ?? [],
                'option' => $effectiveOption,
            ],
        );

        return response()->json([
            'success' => true,
            'session_id' => $session['session_uuid'],
            'resposta' => $result['resposta'],
            'fontes_usadas' => $result['fontes_usadas'],
            'catalog_results' => $result['catalog_results'] ?? [],
            'study_options' => $result['study_options'] ?? [],
            'option' => $effectiveOption,
        ]);
    }

    private function resolveSession(?string $sessionUuid, ?string $option): array
    {
        $sessionUuid = $sessionUuid ?: (string) Str::uuid();
        $existing = DB::table('chat_sessions')->where('session_uuid', $sessionUuid)->first();

        if ($existing) {
            if ($option) {
                DB::table('chat_sessions')
                    ->where('id', $existing->id)
                    ->update([
                        'selected_option' => $option,
                        'updated_at' => now(),
                    ]);
            }

            return [
                'id' => $existing->id,
                'session_uuid' => $existing->session_uuid,
            ];
        }

        $id = DB::table('chat_sessions')->insertGetId([
            'session_uuid' => $sessionUuid,
            'selected_option' => $option,
            'channel' => 'web',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return [
            'id' => $id,
            'session_uuid' => $sessionUuid,
        ];
    }

    private function resolveEffectiveOption(int $sessionId, string $question, ?string $option): ?string
    {
        if ($option === 'montar_plano_estudos') {
            return $option;
        }

        $normalizedQuestion = $this->normalizeText($question);

        if ($this->hasDirectStudyPlanIntent($normalizedQuestion)) {
            return 'montar_plano_estudos';
        }

        $recentMessages = DB::table('chat_messages')
            ->where('session_id', $sessionId)
            ->orderByDesc('id')
            ->limit(8)
            ->pluck('message')
            ->all();

        if ($recentMessages === []) {
            return $option;
        }

        $history = $this->normalizeText(implode(' ', array_map('strval', $recentMessages)));

        if (! $this->historySuggestsStudyPlan($history)) {
            return $option;
        }

        if ($this->looksLikeContestReference($normalizedQuestion)) {
            return 'montar_plano_estudos';
        }

        return $option;
    }

    private function updateSessionOption(int $sessionId, ?string $option): void
    {
        if (! $option) {
            return;
        }

        DB::table('chat_sessions')
            ->where('id', $sessionId)
            ->update([
                'selected_option' => $option,
                'updated_at' => now(),
            ]);
    }

    private function humanProtocolIntent(string $question, ?string $option): ?array
    {
        $text = $this->normalizeText($question.' '.$option);
        $area = null;

        if ($this->containsAnyTerm($text, ['laudo', 'parecer', 'nota tecnica', 'pericial'])) {
            $area = 'laudoParecer';
        } elseif ($this->containsAnyTerm($text, ['acao', 'judicial', 'liminar', 'mandado', 'processo'])) {
            $area = 'acaoBanca';
        } elseif ($this->containsAnyTerm($text, [
            'recurso',
            'revisao',
            'redacao',
            'discursiva',
            'espelho',
            'nota',
            'gabarito',
            'eliminacao',
            'indeferimento',
        ])) {
            $area = 'recursoRevisao';
        } elseif ($this->containsAnyTerm($text, [
            'falar com perita',
            'falar com uma perita',
            'perita',
            'pericia',
            'perita humana',
            'analise profissional',
            'atendimento humano',
            'abrir protocolo',
            'quero abrir protocolo',
        ])) {
            $area = 'peritaHumana';
        }

        if (! $area) {
            return null;
        }

        return [
            'suggested_area_key' => $area,
            'resposta' => 'Entendi. Esse pedido envolve revisao/analise tecnica e atendimento humano, entao nao vou tratar como plano de estudos nem como consulta simples de edital. Vou abrir a coleta de protocolo para uma perita humana avaliar. Informe nome, e-mail, telefone, concurso, banca, cargo, fase, prazo e um resumo do que aconteceu. Se houver edital, espelho de correcao, texto da redacao, nota ou decisao da banca, anexe tambem.',
        ];
    }

    private function hasDirectStudyPlanIntent(string $normalizedQuestion): bool
    {
        return str_contains($normalizedQuestion, 'plano')
            || str_contains($normalizedQuestion, 'estudo')
            || str_contains($normalizedQuestion, 'cronograma');
    }

    private function historySuggestsStudyPlan(string $history): bool
    {
        return str_contains($history, 'plano')
            || str_contains($history, 'estudo')
            || str_contains($history, 'cronograma')
            || str_contains($history, 'preparacao')
            || str_contains($history, 'qual concurso')
            || str_contains($history, 'informe o concurso');
    }

    private function looksLikeContestReference(string $normalizedQuestion): bool
    {
        return str_contains($normalizedQuestion, 'concurso')
            || str_contains($normalizedQuestion, 'edital')
            || str_contains($normalizedQuestion, 'preparando')
            || str_contains($normalizedQuestion, 'preparar')
            || str_contains($normalizedQuestion, 'preparacao')
            || preg_match('/\b(20\d{2}|cbm|pm|pc|pcdf|pge|detran|sedes|marinha|guarda|seap|tce|sefaz|fapeal|nav)\b/', $normalizedQuestion) === 1;
    }

    private function containsAnyTerm(string $text, array $terms): bool
    {
        foreach ($terms as $term) {
            if ($this->containsTerm($text, $term)) {
                return true;
            }
        }

        return false;
    }

    private function containsTerm(string $text, string $term): bool
    {
        if (str_contains($term, ' ')) {
            return str_contains($text, $term);
        }

        return preg_match('/(^|[^a-z0-9])'.preg_quote($term, '/').'([^a-z0-9]|$)/', $text) === 1;
    }

    private function normalizeText(string $value): string
    {
        $value = mb_strtolower($value);
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);

        return $ascii === false ? $value : $ascii;
    }

    private function storeMessage(
        int $sessionId,
        string $senderType,
        ?string $senderName,
        string $message,
        ?array $metadata = null,
    ): void {
        DB::table('chat_messages')->insert([
            'session_id' => $sessionId,
            'sender_type' => $senderType,
            'sender_name' => $senderName,
            'message' => $message,
            'metadata' => $metadata ? json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
