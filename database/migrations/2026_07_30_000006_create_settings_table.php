<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Single row table holding the owner's business and invoicing defaults.
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('business_name')->nullable();
            $table->string('logo_path')->nullable();
            $table->string('primary_color', 20)->nullable();
            $table->text('business_address')->nullable();
            $table->decimal('default_tax_rate', 5, 2)->nullable();
            $table->string('invoice_number_prefix', 20)->default('INV-');
            $table->unsignedInteger('next_invoice_number')->default(1);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
