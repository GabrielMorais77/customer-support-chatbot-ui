<?php

namespace App\Http\Middleware;

use App\Models\AdminUser;
use Closure;
use Illuminate\Http\Request;

class AuthenticateAdminToken
{
    public function handle(Request $request, Closure $next): mixed
    {
        $token = $request->bearerToken();

        if (! $token) {
            return response()->json([
                'success' => false,
                'message' => 'Admin token is required.',
            ], 401);
        }

        $admin = AdminUser::query()
            ->where('api_token_hash', hash('sha256', $token))
            ->first();

        if (! $admin) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid admin token.',
            ], 401);
        }

        $request->attributes->set('admin_user', $admin);

        return $next($request);
    }
}
