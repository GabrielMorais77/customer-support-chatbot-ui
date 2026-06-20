<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Ticket extends Model
{
    use HasFactory;

    public const STATUSES = [
        'open',
        'waiting',
        'in_progress',
        'answered',
        'closed',
    ];

    public const PRIORITIES = [
        'normal',
        'urgent',
    ];

    protected $fillable = [
        'protocol',
        'name',
        'email',
        'phone',
        'area',
        'subject',
        'description',
        'status',
        'priority',
        'estimated_response_at',
        'closed_at',
    ];

    protected $casts = [
        'estimated_response_at' => 'datetime',
        'closed_at' => 'datetime',
    ];

    public function messages(): HasMany
    {
        return $this->hasMany(TicketMessage::class)->oldest();
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(TicketAttachment::class)->oldest();
    }

    public function feedback(): HasOne
    {
        return $this->hasOne(TicketFeedback::class);
    }
}
