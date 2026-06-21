<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('edital_documentos', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('concurso_id')->constrained('concursos')->cascadeOnDelete();
            $table->string('tipo', 80)->default('edital');
            $table->text('url_pdf');
            $table->char('hash_documento', 64)->unique();
            $table->mediumText('texto_extraido')->nullable();
            $table->timestamp('data_captura')->useCurrent();
            $table->timestamps();
        });

        Schema::create('edital_chunks', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('documento_id')->constrained('edital_documentos')->cascadeOnDelete();
            $table->foreignId('concurso_id')->constrained('concursos')->cascadeOnDelete();
            $table->unsignedInteger('chunk_index');
            $table->string('titulo')->nullable();
            $table->mediumText('texto');
            $table->json('embedding')->nullable();
            $table->string('embedding_model', 80)->default('gemini-embedding-2');
            $table->timestamps();
            $table->index(['concurso_id', 'documento_id']);
            $table->unique(['documento_id', 'chunk_index']);
        });

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            try {
                Schema::table('edital_chunks', function (Blueprint $table): void {
                    $table->fullText('texto', 'edital_chunks_texto_fulltext');
                });
            } catch (Throwable) {
                // TiDB/MySQL variants without FULLTEXT can still use the embedding fallback.
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('edital_chunks');
        Schema::dropIfExists('edital_documentos');
    }
};
