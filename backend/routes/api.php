<?php

use App\Http\Controllers\Admin\AuthController as AdminAuthController;
use App\Http\Controllers\Admin\TicketController as AdminTicketController;
use App\Http\Controllers\Admin\TicketAttachmentController as AdminTicketAttachmentController;
use App\Http\Controllers\AssistantController;
use App\Http\Controllers\TicketController;
use Illuminate\Support\Facades\Route;

Route::post('/assistant/chat', [AssistantController::class, 'chat']);
Route::post('/tickets', [TicketController::class, 'store']);
Route::get('/tickets/lookup', [TicketController::class, 'lookup']);
Route::post('/tickets/{protocol}/messages', [TicketController::class, 'storeMessage']);
Route::post('/tickets/{protocol}/attachments', [TicketController::class, 'storeAttachments']);
Route::post('/tickets/{protocol}/feedback', [TicketController::class, 'storeFeedback']);

Route::prefix('admin')->group(function (): void {
    Route::post('/login', [AdminAuthController::class, 'login']);

    Route::middleware('admin.token')->group(function (): void {
        Route::post('/logout', [AdminAuthController::class, 'logout']);
        Route::get('/tickets', [AdminTicketController::class, 'index']);
        Route::get('/tickets/{ticket}', [AdminTicketController::class, 'show']);
        Route::patch('/tickets/{ticket}/status', [AdminTicketController::class, 'updateStatus']);
        Route::post('/tickets/{ticket}/messages', [AdminTicketController::class, 'storeMessage']);
        Route::get('/attachments/{attachment}/download', [AdminTicketAttachmentController::class, 'download']);
    });
});
