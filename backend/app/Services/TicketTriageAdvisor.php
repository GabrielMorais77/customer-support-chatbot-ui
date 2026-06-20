<?php

namespace App\Services;

class TicketTriageAdvisor
{
    /**
     * Deterministic MVP rule. This is the extension point for a future AI triage integration.
     */
    public function suggestPriority(array $payload): string
    {
        $text = mb_strtolower(implode(' ', [
            $payload['area'] ?? '',
            $payload['subject'] ?? '',
            $payload['description'] ?? '',
        ]));

        $asciiText = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text);
        if ($asciiText !== false) {
            $text = $asciiText;
        }

        $urgentSignals = [
            'urgente',
            'prazo',
            'prazo hoje',
            'hoje',
            'amanha',
            'amanha cedo',
            'liminar',
            'judicial',
            'acao',
            'recurso',
            'eliminacao',
            'indeferimento',
            'laudo',
            'parecer',
            'taf',
            'heteroidentificacao',
            'pcd',
            'pericia medica',
            'avaliacao psicologica',
            'sessao',
            'intimacao',
        ];

        foreach ($urgentSignals as $signal) {
            if (str_contains($text, $signal)) {
                return 'urgent';
            }
        }

        return 'normal';
    }

    public function estimatedResponseHours(string $priority): int
    {
        return $priority === 'urgent' ? 2 : 12;
    }
}
