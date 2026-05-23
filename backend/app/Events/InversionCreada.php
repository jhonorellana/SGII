<?php

namespace App\Events;

use App\Models\Inversion;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class InversionCreada
{
    use Dispatchable, SerializesModels;

    public $inversion;

    /**
     * Create a new event instance.
     */
    public function __construct(Inversion $inversion)
    {
        $this->inversion = $inversion;
    }
}
