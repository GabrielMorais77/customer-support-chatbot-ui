<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Throwable;

class GeminiService
{
    private const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

    public function answerQuestion(string $question, ?string $option = null): array
    {
        $catalogContexts = $this->retrieveCatalogContexts($question, $option);

        if ($catalogContexts !== []) {
            $normalizedQuestion = $this->normalizeText($question.' '.$option);

            if ($this->isOpenListQuestion($normalizedQuestion)) {
                return [
                    'resposta' => 'Encontrei estes editais abertos no catalogo local. Confira a tabela abaixo e use o link oficial para validar detalhes, retificacoes e inscricao.',
                    'fontes_usadas' => $this->sourcesFromCatalog($catalogContexts),
                    'catalog_results' => $this->catalogRowsForFrontend($catalogContexts),
                ];
            }

            $studySelection = $this->studySelectionPayload($question, $catalogContexts, $option);

            if ($studySelection !== null) {
                return [
                    'resposta' => $studySelection['message'],
                    'fontes_usadas' => $this->sourcesFromCatalog([$studySelection['contest']]),
                    'catalog_results' => $this->catalogRowsForFrontend([$studySelection['contest']]),
                    'study_options' => $studySelection['options'],
                ];
            }

            $answerContexts = $this->isStudyPlanIntent($question, $option)
                || $this->shouldUseSingleCatalogContext($catalogContexts)
                ? array_slice($catalogContexts, 0, 1)
                : $catalogContexts;

            try {
                $answer = $this->generateCatalogAnswer($question, $answerContexts, $option);
            } catch (Throwable) {
                $answer = $this->catalogFallbackAnswer($answerContexts, $option, $question);
            }

            return [
                'resposta' => $answer,
                'fontes_usadas' => $this->sourcesFromCatalog($answerContexts),
                'catalog_results' => $this->shouldAttachCatalogSummary($normalizedQuestion, $option)
                    ? $this->catalogRowsForFrontend($answerContexts)
                    : [],
            ];
        }

        if ($this->hasIndexedChunks()) {
            $questionEmbedding = $this->generateEmbedding($question);
            $contexts = $this->retrieveContexts($question, $questionEmbedding);

            if ($contexts !== []) {
                try {
                    $answer = $this->generateAnswer($question, $contexts, $option);
                } catch (Throwable) {
                    $answer = 'Encontrei trechos de editais indexados, mas nao consegui gerar a resposta pela IA agora. Tente novamente em alguns instantes.';
                }

                return [
                    'resposta' => $answer,
                    'fontes_usadas' => $this->sourcesFromContexts($contexts),
                ];
            }
        }

        return [
            'resposta' => $this->generateNoLocalContextAnswer($question, $option),
            'fontes_usadas' => [],
        ];
    }
    private function retrieveCatalogContexts(string $question, ?string $option): array
    {
        if (! Schema::hasTable('concursos_editais')) {
            return [];
        }

        $rows = DB::table('concursos_editais')
            ->orderByRaw("FIELD(status, 'aberto', 'previsto', 'encerrado')")
            ->orderBy('dt_fim_inscricao')
            ->limit(250)
            ->get()
            ->map(fn ($row): array => (array) $row)
            ->all();

        if ($rows === []) {
            return [];
        }

        $normalizedQuestion = $this->normalizeText($question.' '.$option);

        if ($this->isOpenListQuestion($normalizedQuestion)) {
            return array_values(array_filter(
                $rows,
                fn (array $row): bool => ($row['status'] ?? '') === 'aberto',
            ));
        }

        if (str_contains($normalizedQuestion, 'previsto')) {
            return array_values(array_filter(
                $rows,
                fn (array $row): bool => ($row['status'] ?? '') === 'previsto',
            ));
        }

        if (str_contains($normalizedQuestion, 'encerrado')) {
            return array_values(array_filter(
                $rows,
                fn (array $row): bool => ($row['status'] ?? '') === 'encerrado',
            ));
        }

        $tokens = $this->questionTokens($normalizedQuestion);

        if ($tokens === [] && $option === 'montar_plano_estudos') {
            return [];
        }

        $scored = [];

        foreach ($rows as $row) {
            $haystack = $this->normalizeText(implode(' ', array_filter([
                $row['titulo'] ?? '',
                $row['orgao'] ?? '',
                $row['banca'] ?? '',
                $row['uf'] ?? '',
                $row['cidade'] ?? '',
                $row['escolaridade'] ?? '',
                $row['cargos'] ?? '',
                $row['status'] ?? '',
            ])));

            $score = 0;

            foreach ($tokens as $token) {
                if (strlen($token) <= 2) {
                    if (preg_match('/(?<![a-z0-9])'.preg_quote($token, '/').'(?![a-z0-9])/', $haystack) === 1) {
                        $score += 2;
                    }

                    continue;
                }

                if (str_contains($haystack, $token)) {
                    $score += strlen($token) >= 5 ? 2 : 1;
                }
            }

            if ($score > 0) {
                $scored[] = [
                    ...$row,
                    '_score' => $score,
                ];
            }
        }

        usort($scored, fn (array $a, array $b): int => ($b['_score'] <=> $a['_score'])
            ?: strcmp((string) $a['dt_fim_inscricao'], (string) $b['dt_fim_inscricao']));

        return array_slice($scored, 0, 10);
    }
    private function generateCatalogAnswer(string $question, array $catalogContexts, ?string $option): string
    {
        $model = $this->textModel();
        $modeInstruction = match ($option) {
            'montar_plano_estudos' => 'Nao responda apenas com resumo do edital. Se o concurso tiver mais de um cargo e o cargo ainda nao estiver na pergunta, pergunte o cargo antes de montar o plano. Se o cargo ja estiver selecionado, responda como um mentor de estudos. Use obrigatoriamente esta ordem: saudacao curta, contexto do concurso e data de prova, "Cronograma de Estudos", quatro fases ate a prova, "Disciplinas Prioritarias", "Estrategias Extras" e uma pergunta final sobre horas liquidas por dia. Use a banca, o prazo de inscricao, a data de prova, os dias ate a prova e o cargo escolhido quando esses dados aparecerem no contexto. Para banca Cebraspe, inclua estrategia de questoes Certo/Errado, controle de anulacao, caderno de erros e simulados. Nao invente disciplinas oficiais, pesos ou etapas ausentes no cadastro; quando faltarem dados, escreva que sao blocos iniciais a confirmar no edital e use blocos gerais de teoria, questoes, revisao, simulados, lei seca e preparo fisico/TAF quando fizer sentido.',
            'analisar_edital_regras' => 'Analise o edital/catalogo informado e destaque prazos, cargos, escolaridade, banca, salario, prova e cuidados para o candidato.',
            default => 'Responda diretamente a duvida usando o catalogo. Se a pergunta pedir editais abertos, liste de forma escaneavel e priorize prazo final de inscricao.',
        };

        $catalogText = collect($catalogContexts)
            ->values()
            ->map(function (array $row, int $index): string {
                $sourceNumber = $index + 1;
                $salary = $this->formatSalaryRange($row['salario_min'] ?? null, $row['salario_max'] ?? null);
                $examDate = $this->extractExamDate((string) ($row['cargos'] ?? ''));
                $examDateText = $examDate ?: 'nao informado no cadastro';
                $daysUntilExam = $this->daysUntilExam($examDate);
                $daysUntilExamText = $daysUntilExam === null
                    ? 'nao informado no cadastro'
                    : $daysUntilExam.' dias a partir de '.now()->format('d/m/Y');

                return <<<TEXT
[Fonte {$sourceNumber}]
Titulo: {$row['titulo']}
Orgao: {$row['orgao']}
Banca: {$row['banca']}
UF/Cidade: {$row['uf']} {$row['cidade']}
Escolaridade: {$row['escolaridade']}
Cargos: {$row['cargos']}
Salario: {$salary}
Inscricoes: {$row['dt_inicio_inscricao']} ate {$row['dt_fim_inscricao']}
Data de prova: {$examDateText}
Dias ate a prova: {$daysUntilExamText}
Status: {$row['status']}
Link: {$row['link_edital']}
Fonte: {$row['fonte']}
TEXT;
            })
            ->implode("\n\n");

        $systemPrompt = <<<PROMPT
Voce e um assistente tecnico especializado em concursos publicos.
Responda em portugues do Brasil, com clareza e objetividade.
Use os dados estruturados do catalogo como fonte principal.
Respeite a ordem das fontes recebidas no catalogo; elas ja chegam priorizadas.
Nao invente edital, prazo, cargo, salario, banca, requisito, cidade ou data que nao esteja no contexto.
Quando a informacao estiver ausente, escreva "nao informado no cadastro".
Ao citar concursos, inclua prazo final, banca, cargo/resumo e link oficial quando disponivel.
{$modeInstruction}
PROMPT;

        $studyPlanContext = $option === 'montar_plano_estudos' && isset($catalogContexts[0])
            ? "\n\nDiretrizes especificas para o plano:\n".$this->studyPlanPromptContext($catalogContexts[0], $question)
            : '';

        $userPrompt = <<<PROMPT
Pergunta do candidato:
{$question}

Catalogo local encontrado:
{$catalogText}
{$studyPlanContext}
PROMPT;

        $payload = Http::withHeaders(['x-goog-api-key' => $this->apiKey()])
            ->acceptJson()
            ->asJson()
            ->timeout(45)
            ->post($this->endpoint($model, 'generateContent'), [
                'systemInstruction' => [
                    'parts' => [
                        ['text' => $systemPrompt],
                    ],
                ],
                'contents' => [
                    [
                        'role' => 'user',
                        'parts' => [
                            ['text' => $userPrompt],
                        ],
                    ],
                ],
                'generationConfig' => [
                    'temperature' => 0.25,
                    'maxOutputTokens' => $option === 'montar_plano_estudos' ? 1200 : 1100,
                ],
            ])
            ->throw()
            ->json();

        $text = $this->extractText($payload);

        return $text !== ''
            ? $this->enrichStudyPlanAnswer($text, $catalogContexts, $option, $question)
            : 'Encontrei concursos no catalogo, mas nao consegui montar uma resposta agora.';
    }

    private function generateNoLocalContextAnswer(string $question, ?string $option): string
    {
        $model = $this->textModel();
        $modeInstruction = $option === 'montar_plano_estudos'
            ? 'Se o candidato quer plano de estudos, monte um roteiro geral e peça o concurso/link do edital, data da prova, horas por dia e nivel atual para personalizar.'
            : 'Ajude o usuario a formular a busca e peça o link ou PDF do edital quando a duvida depender de edital especifico.';

        $systemPrompt = <<<PROMPT
Voce e um assistente tecnico para concursos publicos.
Nao ha registro correspondente no catalogo local e nao ha trecho de edital recuperado.
Nao invente concurso aberto, prazo, salario, cargo, banca ou regra.
Explique que a informacao nao foi localizada na base local.
{$modeInstruction}
Responda de forma util, curta e em portugues do Brasil.
PROMPT;

        $payload = Http::withHeaders(['x-goog-api-key' => $this->apiKey()])
            ->acceptJson()
            ->asJson()
            ->timeout(30)
            ->post($this->endpoint($model, 'generateContent'), [
                'systemInstruction' => [
                    'parts' => [
                        ['text' => $systemPrompt],
                    ],
                ],
                'contents' => [
                    [
                        'role' => 'user',
                        'parts' => [
                            ['text' => $question],
                        ],
                    ],
                ],
                'generationConfig' => [
                    'temperature' => 0.35,
                    'maxOutputTokens' => 650,
                ],
            ])
            ->throw()
            ->json();

        $text = $this->extractText($payload);

        return $text !== ''
            ? $text
            : 'Nao localizei esse concurso na base local. Envie o link ou PDF do edital para eu analisar sem inventar informacoes.';
    }

    private function sourcesFromCatalog(array $catalogContexts): array
    {
        return collect($catalogContexts)
            ->map(fn (array $row): array => [
                'score' => isset($row['_score']) ? round((float) $row['_score'], 4) : 1.0,
                'concurso' => $row['titulo'],
                'orgao' => $row['orgao'],
                'banca' => $row['banca'],
                'url_oficial' => $row['link_edital'],
                'status' => $row['status'],
            ])
            ->values()
            ->all();
    }

    private function catalogRowsForFrontend(array $catalogContexts): array
    {
        return collect($catalogContexts)
            ->map(fn (array $row): array => [
                'id' => $row['cd_edital'] ?? null,
                'titulo' => $row['titulo'] ?? '',
                'orgao' => $row['orgao'] ?? '',
                'banca' => $row['banca'] ?? null,
                'uf' => $row['uf'] ?? null,
                'cidade' => $row['cidade'] ?? null,
                'escolaridade' => $row['escolaridade'] ?? null,
                'cargos' => $row['cargos'] ?? null,
                'salario' => $this->formatSalaryRange($row['salario_min'] ?? null, $row['salario_max'] ?? null),
                'dt_inicio_inscricao' => $row['dt_inicio_inscricao'] ?? null,
                'dt_fim_inscricao' => $row['dt_fim_inscricao'] ?? null,
                'link_edital' => $row['link_edital'] ?? null,
                'fonte' => $row['fonte'] ?? null,
                'status' => $row['status'] ?? null,
            ])
            ->values()
            ->all();
    }

    private function studyPlanPromptContext(array $contest, string $question): string
    {
        $examDate = $this->extractExamDate((string) ($contest['cargos'] ?? ''));
        $daysUntilExam = $this->daysUntilExam($examDate);
        $cargo = $this->selectedStudyCargo($contest, $question) ?: 'cargo escolhido pelo candidato nao identificado no texto';
        $monthRange = $this->studyMonthRange($examDate);
        $workload = $this->suggestedStudyWorkload($daysUntilExam);
        $blocks = collect($this->studyBlocksForContest($contest, $question))
            ->map(fn (string $block): string => '- '.$block)
            ->implode("\n");
        $examLine = $examDate
            ? "Data de prova: {$examDate}. Dias ate a prova: ".($daysUntilExam ?? 'nao informado').'.'
            : 'Data de prova: nao informada no cadastro.';

        return <<<TEXT
Cargo selecionado: {$cargo}
Janela do cronograma: {$monthRange}
Carga horaria sugerida: {$workload}
{$examLine}
Blocos/disciplinas iniciais a considerar, confirmando sempre no edital:
{$blocks}
Formato desejado:
Perfeito! Vamos montar um plano de estudos estrategico para [concurso/cargo], considerando a prova e o tempo restante.
Cronograma de Estudos ({$monthRange})
1. Fase de fundamentos e base
2. Fase de conteudos especificos e intensificacao
3. Fase de revisao e treino pesado
4. Reta final
Disciplinas Prioritarias
Estrategias Extras
Pergunta final: quantas horas liquidas por dia o candidato consegue manter?
TEXT;
    }

    private function enrichStudyPlanAnswer(string $answer, array $catalogContexts, ?string $option, string $question): string
    {
        if ($option !== 'montar_plano_estudos') {
            return $answer;
        }

        $contest = $catalogContexts[0] ?? null;

        if (! $contest) {
            return $answer;
        }

        $normalizedAnswer = $this->normalizeText($answer);
        $mustAddStructure = ! str_contains($normalizedAnswer, 'cronograma')
            || ! str_contains($normalizedAnswer, 'disciplinas priorit')
            || ! str_contains($normalizedAnswer, 'estrategias');

        if ($mustAddStructure) {
            return $this->structuredStudyPlanFallback($contest, $question);
        }

        if (! str_contains($this->normalizeText((string) ($contest['banca'] ?? '')), 'cebraspe')) {
            return $answer;
        }

        if (str_contains($normalizedAnswer, 'certo') && str_contains($normalizedAnswer, 'errado')) {
            return $answer;
        }

        $examDate = $this->extractExamDate((string) ($contest['cargos'] ?? ''));
        $daysUntilExam = $this->daysUntilExam($examDate);
        $timeText = $daysUntilExam !== null && $daysUntilExam > 0 && $examDate
            ? " Considerando {$daysUntilExam} dias ate a prova ({$examDate}), o plano precisa equilibrar teoria, muitas questoes e revisao semanal."
            : '';

        $prefix = "Para otimizar sua preparacao para {$contest['titulo']} com banca Cebraspe, o foco deve ser estrategico: o Cebraspe costuma exigir muita atencao no formato Certo ou Errado, em que uma marcacao errada pode comprometer uma certa. Isso pede conhecimento, controle emocional e tatica de prova.{$timeText}";

        return $prefix."\n\n".$answer;
    }

    private function structuredStudyPlanFallback(array $contest, string $question): string
    {
        $title = (string) ($contest['titulo'] ?? 'concurso informado');
        $orgao = (string) ($contest['orgao'] ?? 'orgao nao informado');
        $banca = (string) ($contest['banca'] ?: 'banca nao informada');
        $cargo = $this->selectedStudyCargo($contest, $question);
        $examDate = $this->extractExamDate((string) ($contest['cargos'] ?? ''));
        $daysUntilExam = $this->daysUntilExam($examDate);
        $monthRange = $this->studyMonthRange($examDate);
        $workload = $this->suggestedStudyWorkload($daysUntilExam);
        $blocks = collect($this->studyBlocksForContest($contest, $question))
            ->map(fn (string $block): string => '- '.$block)
            ->implode("\n");
        $cargoText = $cargo ? " para o cargo {$cargo}" : '';
        $examText = $examDate
            ? "considerando que a prova aparece no cadastro como {$examDate}"
            : 'considerando que a data de prova nao esta informada no cadastro';
        $timeText = $daysUntilExam !== null && $daysUntilExam > 0
            ? " e que voce tem cerca de {$daysUntilExam} dias ate la"
            : '';
        $cebraspeLine = str_contains($this->normalizeText($banca), 'cebraspe')
            ? "\nEstrategia Cebraspe: treine Certo ou Errado com controle de risco. Marque apenas quando tiver seguranca, porque uma errada pode anular uma certa. Mantenha caderno de erros separado por disciplina."
            : '';

        return <<<TEXT
Perfeito! Vamos montar um plano de estudos estrategico para {$title}{$cargoText}, {$examText}{$timeText}.

Contexto: {$orgao}; banca: {$banca}; carga horaria inicial sugerida: {$workload}.

Cronograma de Estudos ({$monthRange})
1. Fundamentos e base
Foco em teoria essencial, leitura do edital, organizacao de resumos e primeiras questoes da banca.

2. Conteudos especificos e intensificacao
Aumente o volume de questoes, aprofunde os blocos ligados ao cargo e revise os erros da semana.

3. Revisao e treino pesado
Faca simulados cronometrados, revise pontos fracos e acompanhe retificacoes no site oficial.

4. Reta final
Priorize revisao leve, lei seca quando aplicavel, mapas mentais, descanso e preparo fisico se houver TAF.

Disciplinas Prioritarias
Como o conteudo programatico detalhado pode nao estar todo indexado, trate estes como blocos iniciais a confirmar no edital:
{$blocks}

Estrategias Extras
- Use ciclos de estudo em vez de grade fixa.
- Separe teoria, questoes e revisao em blocos curtos.
- Resolva provas anteriores da banca sempre que possivel.
- Faca revisao ativa com flashcards, resumos e caderno de erros.{$cebraspeLine}

Para personalizar melhor: quantas horas liquidas por dia voce consegue estudar de forma sustentavel?
TEXT;
    }

    private function shouldAttachCatalogSummary(string $normalizedQuestion, ?string $option): bool
    {
        return $option === 'analisar_edital_regras'
            || $option === 'montar_plano_estudos'
            || str_contains($normalizedQuestion, 'edital')
            || str_contains($normalizedQuestion, 'prazo')
            || str_contains($normalizedQuestion, 'salario')
            || str_contains($normalizedQuestion, 'cargo')
            || str_contains($normalizedQuestion, 'banca');
    }

    private function studySelectionPayload(string $question, array $catalogContexts, ?string $option): ?array
    {
        if (! $this->isStudyPlanIntent($question, $option)) {
            return null;
        }

        $contest = $catalogContexts[0] ?? null;

        if (! $contest) {
            return null;
        }

        $cargos = $this->extractStudyCargos((string) ($contest['cargos'] ?? ''));

        if (count($cargos) <= 1) {
            return null;
        }

        $normalizedQuestion = $this->normalizeText($question);

        foreach ($cargos as $cargo) {
            if (str_contains($normalizedQuestion, $this->normalizeText($cargo))) {
                return null;
            }
        }

        $options = collect($cargos)
            ->map(fn (string $cargo): array => [
                'label' => $cargo,
                'message' => "Monte um plano de estudos para {$contest['titulo']} no cargo: {$cargo}",
            ])
            ->values()
            ->all();

        $banca = $contest['banca'] ?: 'banca nao informada';
        $examDate = $this->extractExamDate((string) ($contest['cargos'] ?? ''));
        $examLine = $examDate ? " A prova aparece no cadastro como prevista para {$examDate}." : '';

        return [
            'contest' => $contest,
            'message' => "Identifiquei o {$contest['titulo']} no catalogo local, com banca {$banca}.{$examLine}\n\nPara montar um plano de estudos melhor, preciso saber para qual cargo voce quer se preparar. Escolha uma opcao:",
            'options' => $options,
        ];
    }

    private function isStudyPlanIntent(string $question, ?string $option): bool
    {
        $normalized = $this->normalizeText($question.' '.$option);

        return $option === 'montar_plano_estudos'
            || str_contains($normalized, 'plano')
            || str_contains($normalized, 'estudo')
            || str_contains($normalized, 'cronograma');
    }

    private function extractStudyCargos(string $cargosText): array
    {
        $ignoredTerms = [
            'vaga',
            'vagas',
            'cadastro',
            'prova',
            'provas',
            'prevista',
            'previsto',
            'cargo apos',
            'cargo após',
            'concurso autorizado',
            'edital previsto',
        ];

        return collect(explode(';', $cargosText))
            ->map(fn (string $cargo): string => trim($cargo))
            ->filter(function (string $cargo) use ($ignoredTerms): bool {
                if ($cargo === '' || mb_strlen($cargo) > 120) {
                    return false;
                }

                $normalized = $this->normalizeText($cargo);

                foreach ($ignoredTerms as $term) {
                    if (str_contains($normalized, $this->normalizeText($term))) {
                        return false;
                    }
                }

                return true;
            })
            ->unique()
            ->take(8)
            ->values()
            ->all();
    }

    private function selectedStudyCargo(array $contest, string $question): ?string
    {
        if (preg_match('/cargo:\s*(.+)$/iu', $question, $matches) === 1) {
            return trim($matches[1]);
        }

        $normalizedQuestion = $this->normalizeText($question);

        foreach ($this->extractStudyCargos((string) ($contest['cargos'] ?? '')) as $cargo) {
            if (str_contains($normalizedQuestion, $this->normalizeText($cargo))) {
                return $cargo;
            }
        }

        return null;
    }

    private function studyMonthRange(?string $examDate): string
    {
        $start = now();

        if (! $examDate) {
            return $this->monthNamePt((int) $start->format('n')).' -> proximos 90 dias';
        }

        try {
            $end = CarbonImmutable::createFromFormat('d/m/Y', $examDate);

            return $this->monthNamePt((int) $start->format('n')).' -> '.$this->monthNamePt((int) $end->format('n'));
        } catch (Throwable) {
            return $this->monthNamePt((int) $start->format('n')).' -> proximos 90 dias';
        }
    }

    private function suggestedStudyWorkload(?int $daysUntilExam): string
    {
        if ($daysUntilExam === null) {
            return '2h a 4h por dia, 5 a 6 dias por semana, ajustando pelo edital';
        }

        if ($daysUntilExam <= 45) {
            return '4h a 6h por dia, com revisao e simulados toda semana';
        }

        if ($daysUntilExam <= 120) {
            return '3h a 5h por dia, 5 a 6 dias por semana';
        }

        return '2h a 4h por dia, 5 dias por semana, aumentando perto da prova';
    }

    private function studyBlocksForContest(array $contest, string $question): array
    {
        $haystack = $this->normalizeText(implode(' ', [
            $contest['titulo'] ?? '',
            $contest['orgao'] ?? '',
            $contest['banca'] ?? '',
            $contest['cargos'] ?? '',
            $contest['escolaridade'] ?? '',
            $question,
        ]));

        if (str_contains($haystack, 'bombeiro')
            || str_contains($haystack, 'policia')
            || str_contains($haystack, 'militar')
            || str_contains($haystack, 'guarda')) {
            return [
                'Portugues: interpretacao de texto, gramatica e reescrita.',
                'Matematica e raciocinio logico: porcentagem, proporcao, operacoes basicas e logica.',
                'Informatica: sistemas operacionais, internet e seguranca da informacao, se constar no edital.',
                'Legislacao e seguranca publica: Constituicao, normas institucionais e legislacao local, conforme edital.',
                'Atualidades: seguranca publica, cidadania, meio ambiente e temas sociais.',
                'Conhecimentos especificos do cargo e preparo fisico/TAF quando houver etapa fisica.',
            ];
        }

        if (str_contains($haystack, 'sefaz')
            || str_contains($haystack, 'auditor')
            || str_contains($haystack, 'fiscal')
            || str_contains($haystack, 'controle externo')
            || str_contains($haystack, 'tribunal de contas')) {
            return [
                'Portugues e interpretacao de textos normativos.',
                'Raciocinio logico, matematica financeira e estatistica, se constarem no edital.',
                'Direito Constitucional e Direito Administrativo.',
                'Contabilidade, auditoria, controle e administracao publica, conforme cargo.',
                'Legislacao tributaria, financeira ou institucional do orgao.',
                'Questoes da banca e simulados cronometrados.',
            ];
        }

        if (str_contains($haystack, 'procurador')
            || str_contains($haystack, 'defensor')
            || str_contains($haystack, 'delegado')
            || str_contains($haystack, 'direito')
            || str_contains($haystack, 'oab')) {
            return [
                'Direito Constitucional e Direito Administrativo.',
                'Direito Civil, Processo Civil e legislacao correlata, se constarem no edital.',
                'Direito Penal e Processo Penal quando o cargo exigir.',
                'Legislacao institucional e jurisprudencia atualizada.',
                'Treino de questoes discursivas, pecas ou pareceres quando houver etapa escrita.',
                'Revisao por lei seca, informativos e caderno de erros.',
            ];
        }

        if (str_contains($haystack, 'saude')
            || str_contains($haystack, 'social')
            || str_contains($haystack, 'desenvolvimento social')) {
            return [
                'Portugues e interpretacao de textos.',
                'Legislacao do servico publico e politicas publicas do setor.',
                'SUS, SUAS ou normas setoriais quando constarem no edital.',
                'Conhecimentos especificos da especialidade/cargo.',
                'Atualidades e direitos sociais.',
                'Questoes da banca e revisao por temas.',
            ];
        }

        return [
            'Portugues e interpretacao de texto.',
            'Raciocinio logico ou matematica, se constarem no edital.',
            'Informatica e atualidades, quando exigidas.',
            'Legislacao do orgao e conhecimentos especificos do cargo.',
            'Questoes da banca, simulados e revisao dos erros.',
            'Leitura de retificacoes e acompanhamento do link oficial.',
        ];
    }

    private function monthNamePt(int $month): string
    {
        $months = [
            1 => 'Janeiro',
            2 => 'Fevereiro',
            3 => 'Marco',
            4 => 'Abril',
            5 => 'Maio',
            6 => 'Junho',
            7 => 'Julho',
            8 => 'Agosto',
            9 => 'Setembro',
            10 => 'Outubro',
            11 => 'Novembro',
            12 => 'Dezembro',
        ];

        return $months[$month] ?? 'Periodo atual';
    }

    private function extractExamDate(string $value): ?string
    {
        if (preg_match('/\b(\d{2}\/\d{2}\/\d{4})\b/', $value, $matches) === 1) {
            return $matches[1];
        }

        return null;
    }

    private function daysUntilExam(?string $examDate): ?int
    {
        if (! $examDate) {
            return null;
        }

        try {
            $date = CarbonImmutable::createFromFormat('d/m/Y', $examDate)->startOfDay();

            return (int) now()->startOfDay()->diffInDays($date, false);
        } catch (Throwable) {
            return null;
        }
    }

    private function shouldUseSingleCatalogContext(array $catalogContexts): bool
    {
        if (count($catalogContexts) <= 1) {
            return false;
        }

        $topScore = (float) ($catalogContexts[0]['_score'] ?? 0);
        $secondScore = (float) ($catalogContexts[1]['_score'] ?? 0);

        return $topScore >= 2.0 && $topScore > $secondScore;
    }

    private function catalogFallbackAnswer(array $catalogContexts, ?string $option, string $question = ''): string
    {
        if ($option === 'montar_plano_estudos') {
            return $this->structuredStudyPlanFallback($catalogContexts[0], $question);
        }

        $lines = collect($catalogContexts)
            ->take(12)
            ->map(function (array $row): string {
                $salary = $this->formatSalaryRange($row['salario_min'] ?? null, $row['salario_max'] ?? null);

                return "- {$row['titulo']} | banca: ".($row['banca'] ?: 'nao informado no cadastro')." | prazo: {$row['dt_fim_inscricao']} | salario: {$salary} | link: {$row['link_edital']}";
            })
            ->implode("\n");

        return "Encontrei estes registros no catalogo local:\n\n{$lines}";
    }

    private function isOpenListQuestion(string $normalizedQuestion): bool
    {
        return str_contains($normalizedQuestion, 'aberto')
            || str_contains($normalizedQuestion, 'inscricao aberta')
            || str_contains($normalizedQuestion, 'inscricoes abertas')
            || str_contains($normalizedQuestion, 'editais aberto')
            || str_contains($normalizedQuestion, 'editais abertos');
    }

    private function questionTokens(string $normalizedQuestion): array
    {
        $stopWords = [
            'qual', 'quais', 'sao', 'são', 'para', 'com', 'dos', 'das', 'uma', 'sobre',
            'edital', 'editais', 'concurso', 'concursos', 'publico', 'publicos', 'publica',
            'duvida', 'plano', 'estudo', 'estudos', 'montar', 'analise', 'analisar',
        ];

        $ufTokens = [
            'ac', 'al', 'ap', 'am', 'ba', 'ce', 'df', 'es', 'go', 'ma', 'mt', 'ms', 'mg',
            'pa', 'pb', 'pr', 'pe', 'pi', 'rj', 'rn', 'rs', 'ro', 'rr', 'sc', 'sp', 'se', 'to',
        ];

        return collect(preg_split('/[^a-z0-9]+/', $normalizedQuestion) ?: [])
            ->filter(fn (string $token): bool => (strlen($token) >= 3 || in_array($token, $ufTokens, true))
                && ! in_array($token, $stopWords, true))
            ->unique()
            ->values()
            ->all();
    }

    private function normalizeText(string $value): string
    {
        $value = mb_strtolower($value);
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);

        return $ascii === false ? $value : $ascii;
    }

    private function formatSalaryRange(mixed $min, mixed $max): string
    {
        if ($min === null && $max === null) {
            return 'nao informado';
        }

        if ($min !== null && $max !== null && (float) $min !== (float) $max) {
            return 'R$ '.number_format((float) $min, 2, ',', '.').' a R$ '.number_format((float) $max, 2, ',', '.');
        }

        $value = $min ?? $max;

        return 'R$ '.number_format((float) $value, 2, ',', '.');
    }

    private function extractText(array $payload): string
    {
        $parts = data_get($payload, 'candidates.0.content.parts', []);
        return trim(collect($parts)
            ->pluck('text')
            ->filter(fn ($part): bool => is_string($part) && trim($part) !== '')
            ->implode("\n"));
    }

    private function hasIndexedChunks(): bool
    {
        if (! Schema::hasTable('edital_chunks')) {
            return false;
        }

        return DB::table('edital_chunks')
            ->whereNotNull('embedding')
            ->exists();
    }

    public function generateEmbedding(string $text): array
    {
        $model = $this->embeddingModel();
        $payload = Http::withHeaders(['x-goog-api-key' => $this->apiKey()])
            ->acceptJson()
            ->asJson()
            ->timeout(30)
            ->post($this->endpoint($model, 'embedContent'), [
                'model' => 'models/'.$model,
                'content' => [
                    'parts' => [
                        ['text' => mb_substr($text, 0, 8000)],
                    ],
                ],
            ])
            ->throw()
            ->json();

        $values = data_get($payload, 'embedding.values') ?? data_get($payload, 'embeddings.0.values');

        if (! is_array($values) || $values === []) {
            throw new RuntimeException('Gemini nao retornou embedding valido.');
        }

        return array_values(array_map('floatval', $values));
    }

    private function generateAnswer(string $question, array $contexts, ?string $option = null): string
    {
        $model = $this->textModel();
        $contextText = collect($contexts)
            ->values()
            ->map(function (array $context, int $index): string {
                $sourceNumber = $index + 1;
                $title = $context['concurso'] ?: 'Concurso sem titulo';
                $orgao = $context['orgao'] ?: 'orgao nao informado';
                $banca = $context['banca'] ?: 'banca nao informada';
                $chunk = mb_substr($context['texto'], 0, 1800);

                return <<<TEXT
[Fonte {$sourceNumber}]
Concurso: {$title}
Orgao: {$orgao}
Banca: {$banca}
Trecho:
{$chunk}
TEXT;
            })
            ->implode("\n\n");

        $systemPrompt = <<<PROMPT
Voce e um assistente especializado em concursos publicos e editais.
Responda sempre em portugues do Brasil.
Use somente os trechos recuperados do banco de editais.
Nao invente datas, cargos, salarios, taxas, bancas, prazos, etapas, requisitos ou regras.
Se os trechos nao contiverem a informacao pedida, diga claramente que a informacao nao foi localizada nos editais indexados.
Quando houver contexto suficiente, responda de forma objetiva e cite as fontes pelo numero.
PROMPT;

        $userPrompt = <<<PROMPT
Pergunta do candidato:
{$question}

Contextos recuperados:
{$contextText}
PROMPT;

        $payload = Http::withHeaders(['x-goog-api-key' => $this->apiKey()])
            ->acceptJson()
            ->asJson()
            ->timeout(45)
            ->post($this->endpoint($model, 'generateContent'), [
                'systemInstruction' => [
                    'parts' => [
                        ['text' => $systemPrompt],
                    ],
                ],
                'contents' => [
                    [
                        'role' => 'user',
                        'parts' => [
                            ['text' => $userPrompt],
                        ],
                    ],
                ],
                'generationConfig' => [
                    'temperature' => 0.2,
                    'maxOutputTokens' => 900,
                ],
            ])
            ->throw()
            ->json();

        $parts = data_get($payload, 'candidates.0.content.parts', []);
        $text = collect($parts)
            ->pluck('text')
            ->filter(fn ($part): bool => is_string($part) && trim($part) !== '')
            ->implode("\n");

        return trim($text) !== ''
            ? trim($text)
            : 'Nao localizei informacao suficiente nos editais indexados para responder com seguranca.';
    }

    private function retrieveContexts(string $question, array $questionEmbedding): array
    {
        $candidates = $this->fullTextCandidates($question, 50);

        if (count($candidates) < 10) {
            $candidates = array_merge($candidates, $this->latestEmbeddingCandidates(80));
        }

        $seen = [];
        $ranked = [];

        foreach ($candidates as $candidate) {
            $key = (string) $candidate['chunk_id'];

            if (isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;
            $embedding = $this->decodeEmbedding($candidate['embedding'] ?? null);

            if ($embedding === []) {
                continue;
            }

            $ranked[] = [
                ...$candidate,
                'score' => $this->cosineSimilarity($questionEmbedding, $embedding),
            ];
        }

        usort($ranked, fn (array $a, array $b): int => $b['score'] <=> $a['score']);

        return array_slice($ranked, 0, 6);
    }

    private function fullTextCandidates(string $question, int $limit): array
    {
        if (SchemaDriver::name() !== 'mysql') {
            return [];
        }

        try {
            return $this->baseChunkQuery()
                ->selectRaw('MATCH(edital_chunks.texto) AGAINST (? IN NATURAL LANGUAGE MODE) as text_score', [$question])
                ->whereRaw('MATCH(edital_chunks.texto) AGAINST (? IN NATURAL LANGUAGE MODE)', [$question])
                ->whereNotNull('edital_chunks.embedding')
                ->orderByDesc('text_score')
                ->limit($limit)
                ->get()
                ->map(fn ($row): array => (array) $row)
                ->all();
        } catch (Throwable) {
            return [];
        }
    }

    private function latestEmbeddingCandidates(int $limit): array
    {
        return $this->baseChunkQuery()
            ->whereNotNull('edital_chunks.embedding')
            ->orderByDesc('edital_chunks.id')
            ->limit($limit)
            ->get()
            ->map(fn ($row): array => (array) $row)
            ->all();
    }

    private function baseChunkQuery()
    {
        return DB::table('edital_chunks')
            ->join('concursos', 'concursos.id', '=', 'edital_chunks.concurso_id')
            ->join('edital_documentos', 'edital_documentos.id', '=', 'edital_chunks.documento_id')
            ->select([
                'edital_chunks.id as chunk_id',
                'edital_chunks.chunk_index',
                'edital_chunks.titulo as chunk_title',
                'edital_chunks.texto',
                'edital_chunks.embedding',
                'edital_chunks.embedding_model',
                'concursos.id as concurso_id',
                'concursos.titulo as concurso',
                'concursos.orgao',
                'concursos.banca',
                'concursos.url_oficial',
                'edital_documentos.url_pdf',
            ]);
    }

    private function sourcesFromContexts(array $contexts): array
    {
        return collect($contexts)
            ->map(fn (array $context): array => [
                'score' => round((float) $context['score'], 4),
                'concurso' => $context['concurso'],
                'orgao' => $context['orgao'],
                'banca' => $context['banca'],
                'url_oficial' => $context['url_oficial'],
                'url_pdf' => $context['url_pdf'],
                'chunk_index' => $context['chunk_index'],
            ])
            ->unique(fn (array $source): string => implode('|', [
                $source['concurso'],
                $source['orgao'],
                $source['banca'],
                $source['url_oficial'],
            ]))
            ->values()
            ->all();
    }

    private function decodeEmbedding(mixed $value): array
    {
        if (is_string($value)) {
            $value = json_decode($value, true);
        }

        if (is_array($value) && isset($value['values']) && is_array($value['values'])) {
            $value = $value['values'];
        }

        if (! is_array($value)) {
            return [];
        }

        return array_values(array_map(
            fn ($item): float => is_numeric($item) ? (float) $item : 0.0,
            $value,
        ));
    }

    private function cosineSimilarity(array $a, array $b): float
    {
        $limit = min(count($a), count($b));

        if ($limit === 0) {
            return 0.0;
        }

        $dot = 0.0;
        $normA = 0.0;
        $normB = 0.0;

        for ($index = 0; $index < $limit; $index++) {
            $left = (float) $a[$index];
            $right = (float) $b[$index];
            $dot += $left * $right;
            $normA += $left * $left;
            $normB += $right * $right;
        }

        if ($normA <= 0.0 || $normB <= 0.0) {
            return 0.0;
        }

        return $dot / (sqrt($normA) * sqrt($normB));
    }

    private function endpoint(string $model, string $method): string
    {
        return self::API_BASE.'/'.$model.':'.$method;
    }

    private function apiKey(): string
    {
        $key = trim((string) env('GEMINI_API_KEY', ''));

        if ($key === '') {
            throw new RuntimeException('GEMINI_API_KEY nao configurada no backend.');
        }

        return $key;
    }

    private function textModel(): string
    {
        return $this->normalizeModelName((string) env('GEMINI_MODEL', 'gemini-2.5-flash'));
    }

    private function embeddingModel(): string
    {
        return $this->normalizeModelName((string) env('GEMINI_EMBEDDING_MODEL', 'gemini-embedding-2'));
    }

    private function normalizeModelName(string $model): string
    {
        $model = trim($model);

        return str_starts_with($model, 'models/') ? substr($model, 7) : $model;
    }
}

final class SchemaDriver
{
    public static function name(): string
    {
        return DB::connection()->getDriverName();
    }
}
