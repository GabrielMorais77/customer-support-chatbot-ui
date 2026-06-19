<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $admin = AdminUser::query()->where('email', $data['email'])->first();

        if (! $admin || ! Hash::check($data['password'], $admin->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Credenciais invalidas.',
            ], 401);
        }

        $token = Str::random(64);

        $admin->forceFill([
            'api_token_hash' => hash('sha256', $token),
            'last_login_at' => now(),
        ])->save();

        return response()->json([
            'success' => true,
            'token' => $token,
            'admin' => [
                'id' => $admin->id,
                'name' => $admin->name,
                'email' => $admin->email,
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $admin = $request->attributes->get('admin_user');
        $admin?->forceFill(['api_token_hash' => null])->save();

        return response()->json([
            'success' => true,
        ]);
    }
}
