<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('concurso_resumos', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('concurso_id')->constrained('concursos')->cascadeOnDelete();
            $table->json('resumo_json');
            $table->mediumText('resumo_texto')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('concurso_resumos');
    }
};
