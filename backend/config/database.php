<?php

use Illuminate\Support\Str;

return [
    'default' => env('DB_CONNECTION', env('HOST') ? 'mysql' : 'sqlite'),
    'connections' => [
        'sqlite' => [
            'driver' => 'sqlite',
            'url' => env('DB_URL'),
            'database' => env('DB_DATABASE', database_path('database.sqlite')),
            'prefix' => '',
            'foreign_key_constraints' => env('DB_FOREIGN_KEYS', true),
            'busy_timeout' => null,
            'journal_mode' => null,
            'synchronous' => null,
        ],
        'mysql' => [
            'driver' => 'mysql',
            'url' => env('DB_URL'),
            'host' => env('DB_HOST', env('HOST', '127.0.0.1')),
            'port' => env('DB_PORT', env('PORT', '3306')),
            'database' => env('DB_DATABASE', env('DATABASE', 'laravel')),
            'username' => env('DB_USERNAME', env('USERNAME', 'root')),
            'password' => env('DB_PASSWORD', env('PASSWORD', '')),
            'unix_socket' => env('DB_SOCKET', ''),
            'charset' => env('DB_CHARSET', 'utf8mb4'),
            'collation' => env('DB_COLLATION', 'utf8mb4_unicode_ci'),
            'prefix' => '',
            'prefix_indexes' => true,
            'strict' => true,
            'engine' => null,
            'options' => extension_loaded('pdo_mysql') ? array_filter([
                PDO::MYSQL_ATTR_SSL_CA => env('MYSQL_ATTR_SSL_CA'),
                PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT => Str::of((string) env('MYSQL_SSL_VERIFY', 'false'))->lower()->value() === 'true',
            ], fn ($value) => $value !== null && $value !== '') : [],
        ],
    ],
    'migrations' => [
        'table' => 'migrations',
        'update_date_on_publish' => true,
    ],
];
