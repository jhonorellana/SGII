<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        \App\Models\AccionOperacion::observe(\App\Observers\AccionOperacionObserver::class);
        \App\Models\AccionDividendo::observe(\App\Observers\AccionDividendoObserver::class);
    }
}
