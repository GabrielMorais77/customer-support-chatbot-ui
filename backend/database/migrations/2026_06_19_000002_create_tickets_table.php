<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tickets', function (Blueprint $table): void {
            $table->id();
            $table->string('protocol')->unique();
            $table->string('name');
            $table->string('email')->index();
            $table->string('phone')->nullable();
            $table->string('area');
            $table->string('subject');
            $table->text('description');
            $table->string('status')->default('open')->index();
            $table->string('priority')->default('normal')->index();
            $table->timestamp('estimated_response_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tickets');
    }
};
