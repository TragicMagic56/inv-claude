<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the single owner account.
     *
     * Credentials come from OWNER_NAME / OWNER_EMAIL / OWNER_PASSWORD in .env
     * so the seeded password is never committed. Keyed on email, so re-running
     * the seeder updates the owner rather than creating a second user.
     */
    public function run(): void
    {
        $email = config('invoicing.owner.email');

        User::updateOrCreate(
            ['email' => $email],
            [
                'name' => config('invoicing.owner.name'),
                'password' => Hash::make(config('invoicing.owner.password')),
                'email_verified_at' => now(),
            ]
        );

        $this->command->info("Owner account ready: {$email}");
    }
}
