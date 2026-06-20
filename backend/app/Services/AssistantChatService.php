<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Throwable;

class AssistantChatService
{
    public function reply(string $message, ?string $area = null, array $history = []): array
    {
        if ($this->canUseOpenRouter()) {
            try {
                return [
                    'reply' => $this->openRouterReply($message, $area, $history),
                    'source' => 'openrouter',
                ];
            } catch (Throwable) {
                // The MVP must stay usable even when the free provider is unavailable or rate-limited.
            }
        }

        return [
            'reply' => $this->localReply($message, $area),
            'source' => 'local',
        ];
    }

    private function canUseOpenRouter(): bool
    {
        return (bool) env('OPENROUTER_API_KEY');
    }

    private function openRouterReply(string $message, ?string $area, array $history): string
    {
        $messages = [
            [
                'role' => 'system',
                'content' => $this->systemPrompt($area),
            ],
        ];

        foreach (array_slice($history, -6) as $item) {
            $messages[] = [
                'role' => $item['role'],
                'content' => $item['content'],
            ];
        }

        $messages[] = [
            'role' => 'user',
            'content' => $message,
        ];

        $response = Http::withToken(env('OPENROUTER_API_KEY'))
            ->acceptJson()
            ->asJson()
            ->withHeaders([
                'HTTP-Referer' => env('APP_URL', 'http://localhost:8000'),
                'X-OpenRouter-Title' => 'Assistente Tecnico para Concursos Publicos',
            ])
            ->timeout(18)
            ->post('https://openrouter.ai/api/v1/chat/completions', [
                'model' => env('OPENROUTER_MODEL', 'deepseek/deepseek-r1:free'),
                'messages' => $messages,
                'temperature' => 0.3,
                'max_tokens' => 450,
            ])
            ->throw()
            ->json();

        $reply = $response['choices'][0]['message']['content'] ?? null;

        if (! is_string($reply) || trim($reply) === '') {
            throw new \RuntimeException('Empty AI response.');
        }

        return trim($reply);
    }

    private function systemPrompt(?string $area): string
    {
        $context = $area ? "Frente selecionada: {$area}." : 'Frente ainda nao selecionada.';

        return <<<PROMPT
Voce e um assistente tecnico 24/7 para concursos publicos. {$context}
Atue como primeira camada de triagem, orientacao e preparacao de casos para perita humana.
Pode explicar edital, requisitos, datas, etapas, estudos, revisoes, documentos, recursos simples e estrategia de prova.
Nao substitua advogado, nao substitua perita, nao assine laudo, nao prometa aprovacao, anulacao de questao ou vitoria judicial.
Para laudo, parecer, eliminacao controversa, cotas, PCD, heteroidentificacao, pericia medica, TAF, avaliacao psicologica, prova oral, processo judicial ou prazo urgente, oriente a organizar documentos e encaminhar para analise humana.
Responda em portugues do Brasil, de forma curta, pratica e segura.
PROMPT;
    }

    private function localReply(string $message, ?string $area): string
    {
        $text = $this->normalize($message.' '.$area);

        if (str_contains($text, 'laudo') || str_contains($text, 'parecer')) {
            return 'Para laudo ou parecer, eu organizo a triagem, mas a emissao precisa da perita humana. Separe finalidade, prazo, edital, prova, decisao da banca, fato controvertido e perguntas tecnicas.';
        }

        if (str_contains($text, 'recurso') || str_contains($text, 'gabarito') || str_contains($text, 'questao')) {
            return 'Para recurso, envie edital, caderno de prova, questao, gabarito, alternativa marcada, fundamento tecnico, bibliografia e prazo. Posso ajudar na estrutura, sem prometer anulacao ou deferimento.';
        }

        if (str_contains($text, 'estudo') || str_contains($text, 'cronograma') || str_contains($text, 'simulado')) {
            return 'Para montar um plano, preciso do concurso, banca, cargo, data da prova, horas por dia, nivel atual e materias fracas. A base sera ciclo semanal, revisoes e simulados.';
        }

        if (str_contains($text, 'edital') || str_contains($text, 'cargo') || str_contains($text, 'requisito')) {
            return 'Para analisar edital, informe concurso, banca, cargo, sua formacao e duvida principal. Eu organizo requisitos, datas, etapas, materias, criterios de aprovacao e riscos.';
        }

        if (str_contains($text, 'acao') || str_contains($text, 'judicial') || str_contains($text, 'liminar')) {
            return 'Isso pode exigir avaliacao juridica. Posso organizar o caso com fatos, fase, decisao da banca, prazo, recurso administrativo, documentos e prejuizo concreto para analise humana.';
        }

        return 'Posso ajudar com edital, plano de estudos, duvidas simples, recursos, revisao de prova e triagem para perita humana. Conte o concurso, a banca, o cargo e o que aconteceu.';
    }

    private function normalize(string $value): string
    {
        $value = mb_strtolower($value);
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);

        return $ascii === false ? $value : $ascii;
    }
}
