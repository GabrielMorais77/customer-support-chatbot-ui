<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('concursos', function (Blueprint $table): void {
            $table->id();
            $table->string('titulo');
            $table->string('orgao')->nullable();
            $table->string('banca')->nullable();
            $table->char('uf', 2)->nullable();
            $table->string('municipio', 120)->nullable();
            $table->string('status', 50)->default('novo')->index();
            $table->date('data_publicacao')->nullable();
            $table->date('data_inicio_inscricao')->nullable();
            $table->date('data_fim_inscricao')->nullable();
            $table->date('data_prova')->nullable();
            $table->text('url_oficial')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('concursos');
    }
};
