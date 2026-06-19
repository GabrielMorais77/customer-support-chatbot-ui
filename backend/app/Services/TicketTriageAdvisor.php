<?php

namespace App\Services;

class TicketTriageAdvisor
{
    /**
     * This deterministic rule is the extension point for a future AI triage integration.
     */
    public function suggestPriority(array $payload): string
    {
        $text = mb_strtolower(implode(' ', [
            $payload['area'] ?? '',
            $payload['subject'] ?? '',
            $payload['description'] ?? '',
        ]));

        $urgentSignals = [
            'urgente',
            'prazo hoje',
            'hoje',
            'amanha',
            'amanhã',
            'liminar',
            'sessao',
            'sessão',
            'intimacao',
            'intimação',
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
