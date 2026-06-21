<?php

namespace App\Services;

class AssistantChatService
{
    public function reply(string $message, ?string $area = null, array $history = []): array
    {
        $triage = $this->classifyCase($message, $area);

        return [
            'reply' => $this->localReply($message, $area, $triage),
            'source' => 'local',
            'triage' => $triage,
        ];
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

        if ($this->containsAnyTerm($text, ['recurso', 'revisao', 'redacao', 'discursiva', 'gabarito', 'questao'])) {
            return 'Para recurso ou revisao de redacao/prova discursiva, envie edital, espelho de correcao, texto produzido, nota, criterios da banca, decisao/justificativa e prazo. Vou organizar o protocolo para analise da perita humana, sem prometer alteracao de nota ou deferimento.';
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
                'reason' => 'recurso, revisao de prova/redacao, nota, gabarito ou eliminacao',
                'terms' => ['recurso', 'revisao', 'redacao', 'gabarito', 'questao anulada', 'nota', 'discursiva', 'espelho', 'eliminacao', 'indeferimento'],
            ],
            'peritaHumana' => [
                'reason' => 'tema sensivel que exige analise humana',
                'terms' => ['perita', 'pericia', 'pericia medica', 'falar com perita', 'analise profissional', 'abrir protocolo', 'quero abrir protocolo', 'pcd', 'heteroidentificacao', 'taf', 'cota', 'ppp', 'avaliacao psicologica', 'prova oral'],
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
