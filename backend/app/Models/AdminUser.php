<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AdminUser extends Model
{
    protected $fillable = [
        'name',
        'email',
        'password',
        'api_token_hash',
        'last_login_at',
    ];

    protected $hidden = [
        'password',
        'api_token_hash',
    ];

    protected $casts = [
        'last_login_at' => 'datetime',
    ];
}
