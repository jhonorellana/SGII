<?php

namespace App\Events;

use App\Models\VentaInversion;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class VentaInversionRegistrada
{
    use Dispatchable, SerializesModels;

    public $ventaInversion;

    /**
     * Create a new event instance.
     */
    public function __construct(VentaInversion $ventaInversion)
    {
        $this->ventaInversion = $ventaInversion;
    }
}
