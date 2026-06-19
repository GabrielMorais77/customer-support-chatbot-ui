<?php

use Illuminate\Support\Facades\Artisan;

Artisan::command('support:about', function (): void {
    $this->info('Customer Support API MVP');
})->purpose('Show the support API name');
