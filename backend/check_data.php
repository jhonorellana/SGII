<?php

require_once 'vendor/autoload.php';

$app = require_once 'bootstrap/app.php';

echo "Inversiones:\n";
$inversions = \App\Models\Inversion::take(3)->get(['id_inversion', 'valor_nominal', 'capital_invertido']);

foreach($inversions as $inv) {
    echo 'ID: ' . $inv->id_inversion . ', Nominal: ' . $inv->valor_nominal . ', Capital: ' . $inv->capital_invertido . "\n";
}

echo "\nInstrumentos:\n";
$instrumentos = \App\Models\Instrumento::take(3)->get(['id_instrumento', 'valor_interes', 'fecha_emision', 'fecha_vencimiento']);

foreach($instrumentos as $inst) {
    echo 'ID: ' . $inst->id_instrumento . ', Valor Interes: ' . $inst->valor_interes . ', Emision: ' . $inst->fecha_emision . ', Vencimiento: ' . $inst->fecha_vencimiento . "\n";
}

?>
