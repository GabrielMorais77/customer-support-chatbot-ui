<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chat_sessions', function (Blueprint $table): void {
            $table->id();
            $table->uuid('session_uuid')->unique();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->string('selected_option')->nullable()->index();
            $table->string('channel')->default('web')->index();
            $table->timestamps();
        });

        Schema::create('chat_messages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('session_id')->constrained('chat_sessions')->cascadeOnDelete();
            $table->string('sender_type')->index();
            $table->string('sender_name')->nullable();
            $table->text('message');
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chat_messages');
        Schema::dropIfExists('chat_sessions');
    }
};
