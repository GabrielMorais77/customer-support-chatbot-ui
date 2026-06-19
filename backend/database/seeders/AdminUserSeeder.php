<?php

namespace Database\Seeders;

use App\Models\AdminUser;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        AdminUser::query()->updateOrCreate(
            ['email' => 'admin@local.test'],
            [
                'name' => 'Admin Local',
                'password' => Hash::make('admin123'),
                'api_token_hash' => null,
            ],
        );
    }
}
