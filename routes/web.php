<?php

use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return redirect()->route('dashboard');
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/dashboard', function () {
        return view('dashboard');
    })->name('dashboard');

    // Section placeholders. Each is replaced by its real controller in the
    // phase noted on the page: clients/projects (2), time tracking (3),
    // invoices (4), settings (5).
    Route::get('/clients', function () {
        return view('clients.index');
    })->name('clients.index');

    Route::get('/projects', function () {
        return view('projects.index');
    })->name('projects.index');

    Route::get('/time', function () {
        return view('time-entries.index');
    })->name('time-entries.index');

    Route::get('/invoices', function () {
        return view('invoices.index');
    })->name('invoices.index');

    Route::get('/settings', function () {
        return view('settings.edit');
    })->name('settings.edit');
});

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';
