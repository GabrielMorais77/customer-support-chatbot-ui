<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Throwable;

class AssistantChatService
{
    public function reply(string $message, ?string $area = null, array $history = []): array
    {
        $triage = $this->classifyCase($message, $area);

        if ($this->canUseOpenRouter()) {
            try {
                return [
                    'reply' => $this->openRouterReply($message, $area, $history),
                    'source' => 'openrouter',
                    'triage' => $triage,
                ];
            } catch (Throwable) {
                // The MVP must stay usable even when the free provider is unavailable or rate-limited.
            }
        }

        return [
            'reply' => $this->localReply($message, $area, $triage),
            'source' => 'local',
            'triage' => $triage,
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
Nao abra protocolo para toda mensagem. Primeiro faca triagem: resolva duvidas simples no chat e so recomende protocolo quando houver risco tecnico, documento sensivel, prazo, recurso, eliminacao ou necessidade de perita humana.
Responda em portugues do Brasil, de forma curta, pratica e segura.
PROMPT;
    }

    private function localReply(string $message, ?string $area, array $triage): string
    {
        $text = $this->normalize($message.' '.$area);

        if ($triage['requires_ticket']) {
            return <<<TEXT
Entendi. Pela situacao descrita, esse caso precisa de uma triagem formal antes de qualquer conclusao, porque pode envolver impacto no resultado, permanencia no concurso, documento tecnico ou prazo.

Vou organizar as informacoes principais e abrir um protocolo para que uma perita humana possa avaliar o caso. Antes disso, preciso confirmar nome, e-mail, telefone, concurso, banca, cargo, etapa, prazo, resumo do ocorrido, documentos disponiveis e consentimento para tratamento dos dados.
TEXT;
        }

        if ($this->containsAnyTerm($text, ['laudo', 'parecer'])) {
            return 'Para laudo ou parecer, eu organizo a triagem, mas a emissao precisa da perita humana. Separe finalidade, prazo, edital, prova, decisao da banca, fato controvertido e perguntas tecnicas.';
        }

        if ($this->containsAnyTerm($text, ['classificacao', 'classificado', 'convocacao', 'convocado'])) {
            return 'Classificacao significa que o candidato ficou ordenado no resultado do concurso, conforme nota e regras do edital. Convocacao e o chamado oficial para uma proxima etapa, entrega de documentos, curso, posse ou nomeacao. Em geral, estar classificado nao garante convocacao: isso depende de vagas, cadastro reserva, validade do concurso e atos oficiais do orgao.';
        }

        if ($this->containsAnyTerm($text, ['recurso', 'gabarito', 'questao'])) {
            return 'Para recurso, envie edital, caderno de prova, questao, gabarito, alternativa marcada, fundamento tecnico, bibliografia e prazo. Posso ajudar na estrutura, sem prometer anulacao ou deferimento.';
        }

        if ($this->containsAnyTerm($text, ['estudo', 'cronograma', 'simulado'])) {
            return 'Para montar um plano, preciso do concurso, banca, cargo, data da prova, horas por dia, nivel atual e materias fracas. A base sera ciclo semanal, revisoes e simulados.';
        }

        if ($this->containsAnyTerm($text, ['edital', 'cargo', 'requisito'])) {
            return 'Para analisar edital, informe concurso, banca, cargo, sua formacao e duvida principal. Eu organizo requisitos, datas, etapas, materias, criterios de aprovacao e riscos.';
        }

        if ($this->containsAnyTerm($text, ['acao', 'judicial', 'liminar'])) {
            return 'Isso pode exigir avaliacao juridica. Posso organizar o caso com fatos, fase, decisao da banca, prazo, recurso administrativo, documentos e prejuizo concreto para analise humana.';
        }

        return 'Posso ajudar com edital, plano de estudos, duvidas simples, recursos, revisao de prova e triagem para perita humana. Conte o concurso, a banca, o cargo e o que aconteceu.';
    }

    private function classifyCase(string $message, ?string $area): array
    {
        $text = $this->normalize($message.' '.$area);
        $reasons = [];
        $suggestedArea = 'duvidasMateria';

        $checks = [
            'laudoParecer' => [
                'reason' => 'laudo, parecer, nota tecnica ou documento assinado',
                'terms' => ['laudo', 'parecer', 'nota tecnica', 'relatorio preliminar', 'documento assinado', 'quesito', 'pericial'],
            ],
            'acaoBanca' => [
                'reason' => 'possivel medida administrativa ou judicial contra banca',
                'terms' => ['acao', 'judicial', 'liminar', 'mandado', 'advogado', 'processo', 'direito liquido', 'banca errou'],
            ],
            'recursoRevisao' => [
                'reason' => 'recurso, revisao de prova, nota, gabarito ou eliminacao',
                'terms' => ['recurso', 'revisao', 'gabarito', 'questao anulada', 'nota', 'discursiva', 'espelho', 'eliminacao', 'indeferimento'],
            ],
            'peritaHumana' => [
                'reason' => 'tema sensivel que exige analise humana',
                'terms' => ['pcd', 'heteroidentificacao', 'pericia medica', 'taf', 'cota', 'ppp', 'avaliacao psicologica', 'prova oral'],
            ],
        ];

        foreach ($checks as $areaKey => $config) {
            foreach ($config['terms'] as $term) {
                if ($this->containsTerm($text, $term)) {
                    $reasons[] = $config['reason'];
                    $suggestedArea = $areaKey;
                    break 2;
                }
            }
        }

        if ($this->containsAnyTerm($text, ['prazo', 'urgente', 'vence hoje', 'vence amanha'])) {
            $reasons[] = 'prazo ou urgencia informado';
            $suggestedArea = $suggestedArea === 'duvidasMateria' ? 'peritaHumana' : $suggestedArea;
        }

        if (! $reasons) {
            if ($this->containsAnyTerm($text, ['edital', 'cargo', 'requisito'])) {
                $suggestedArea = 'edital';
            } elseif ($this->containsAnyTerm($text, ['estudo', 'cronograma', 'simulado'])) {
                $suggestedArea = 'planoEstudos';
            }
        }

        $requiresTicket = count($reasons) > 0;

        return [
            'case_type' => $requiresTicket ? 'sensitive' : 'simple',
            'requires_ticket' => $requiresTicket,
            'suggested_area_key' => $suggestedArea,
            'reason' => $requiresTicket ? implode('; ', array_values(array_unique($reasons))) : 'duvida simples ou orientacao operacional',
            'next_questions' => $requiresTicket ? [
                'nome completo',
                'e-mail',
                'telefone',
                'concurso',
                'banca',
                'cargo',
                'etapa',
                'prazo',
                'resumo do ocorrido',
                'documentos disponiveis',
                'consentimento de dados',
            ] : [],
        ];
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

    private function normalize(string $value): string
    {
        $value = mb_strtolower($value);
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);

        return $ascii === false ? $value : $ascii;
    }
}
