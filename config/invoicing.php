<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Owner account
    |--------------------------------------------------------------------------
    |
    | The single user this app is seeded with. Set these in .env before running
    | `php artisan db:seed` so the owner password is never committed to git.
    |
    */

    'owner' => [
        'name' => env('OWNER_NAME', 'Owner'),
        'email' => env('OWNER_EMAIL', 'owner@example.com'),
        'password' => env('OWNER_PASSWORD', 'password'),
    ],

];
