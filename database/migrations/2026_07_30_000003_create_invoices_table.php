<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();

            // Invoice history must not disappear with a client.
            $table->foreignId('client_id')->constrained()->restrictOnDelete();
            $table->string('invoice_number', 50)->unique();
            $table->date('issue_date');
            $table->date('due_date')->nullable();

            // draft | sent | paid
            $table->string('status', 20)->default('draft');

            // Slug of the preset Blade layout used to render this invoice.
            $table->string('template_id', 50)->default('classic');
            $table->decimal('subtotal', 10, 2)->default(0);
            $table->boolean('tax_enabled')->default(false);
            $table->decimal('tax_rate_or_amount', 10, 2)->nullable();
            $table->decimal('total', 10, 2)->default(0);
            $table->timestamp('paid_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['client_id', 'status']);
            $table->index('issue_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoices');
    }
};
