<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\API\AuthController;
use App\Http\Controllers\API\CatalogoController;
use App\Http\Controllers\API\CatalogoValorController;
use App\Http\Controllers\API\PersonaController;
use App\Http\Controllers\API\GrupoFamiliarController;
use App\Http\Controllers\API\EmisorController;
use App\Http\Controllers\API\InstrumentoController;
use App\Http\Controllers\API\InversionController;
use App\Http\Controllers\API\AmortizacionController;
use App\Http\Controllers\API\AmortizacionGeneracionController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Rutas de autenticación
Route::post('/login', [AuthController::class, 'login']);
Route::post('/logout', [AuthController::class, 'logout']);
Route::get('/me', [AuthController::class, 'me']);

// Rutas de Catálogos (temporalmente sin autenticación para pruebas)
Route::apiResource('catalogos', CatalogoController::class);
Route::get('catalogos/{codigo}/valores', [CatalogoController::class, 'getValoresByCodigo']);

// Rutas de Valores de Catálogo (temporalmente sin autenticación para pruebas)
Route::apiResource('catalogo-valores', CatalogoValorController::class);
Route::get('catalogo-valores/catalogo/{idCatalogo}', [CatalogoValorController::class, 'getByCatalogo']);
Route::patch('catalogo-valores/{id}/toggle-active', [CatalogoValorController::class, 'toggleActive']);

// Rutas de Personas (temporalmente sin autenticación para pruebas)
Route::apiResource('personas', PersonaController::class);

// Rutas de Grupos Familiares (temporalmente sin autenticación para pruebas)
Route::apiResource('grupos-familiares', GrupoFamiliarController::class);

// Rutas de Emisores (temporalmente sin autenticación para pruebas)
Route::apiResource('emisores', EmisorController::class);

// Rutas de Instrumentos (temporalmente sin autenticación para pruebas)
Route::apiResource('instrumentos', InstrumentoController::class);

// Rutas de Inversiones (temporalmente sin autenticación para pruebas)
Route::apiResource('inversiones', InversionController::class);

// Rutas de Amortizaciones (temporalmente sin autenticación para pruebas)
Route::apiResource('amortizaciones', AmortizacionController::class);
Route::get('amortizaciones/inversion/{idInversion}', [AmortizacionController::class, 'getByInversion']);

// Rutas de Generación de Amortizaciones (temporalmente sin autenticación para pruebas)
Route::post('amortizaciones/generar', [AmortizacionGeneracionController::class, 'generar']);
Route::get('amortizaciones/parametros/{id_inversion}', [AmortizacionGeneracionController::class, 'getParametros']);
Route::post('amortizaciones/previsualizar', [AmortizacionGeneracionController::class, 'previsualizar']);
Route::delete('amortizaciones/eliminar/{id_inversion}', [AmortizacionGeneracionController::class, 'eliminar']);

// Rutas protegidas (aquí irán las demás rutas)
Route::middleware('auth:sanctum')->group(function () {
    // Ejemplo: Route::get('/inversiones', 'InversionController@index');
});
