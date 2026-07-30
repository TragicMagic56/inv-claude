<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('time_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->text('description')->nullable();
            $table->timestamp('started_at')->nullable();

            // Null while a live timer is still running.
            $table->timestamp('ended_at')->nullable();
            $table->unsignedInteger('duration_minutes')->nullable();

            // The project's hourly_rate at the time the entry was closed, so
            // later rate changes do not retroactively alter tracked value.
            $table->decimal('rate_snapshot', 8, 2)->nullable();

            // Set once the entry has been pulled onto an invoice; locks it from
            // being billed twice or edited.
            $table->foreignId('invoice_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('invoiced_at')->nullable();
            $table->timestamps();

            // Drives the "unbilled time for this client in this date range" query.
            $table->index(['project_id', 'invoice_id', 'started_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('time_entries');
    }
};
