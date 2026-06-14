<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\HistoricoPatrimonio;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class HistoricoPatrimonioController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(): JsonResponse
    {
        $historico = HistoricoPatrimonio::orderBy('fecha', 'desc')->get();

        return response()->json([
            'success' => true,
            'data' => $historico
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'fecha' => 'required|date',
            'capital_jaime' => 'required|numeric|min:0',
            'capital_argentina' => 'required|numeric|min:0',
            'capital_cristian' => 'required|numeric|min:0',
            'capital_total' => 'required|numeric|min:0',
            'capital_importacion' => 'required|numeric|min:0'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        // Realizar cálculos automáticos en el servidor para consistencia
        $capitalJaime = (float) $request->capital_jaime;
        $capitalArgentina = (float) $request->capital_argentina;
        $capitalCristian = (float) $request->capital_cristian;
        $capitalTotal = (float) $request->capital_total;
        $capitalImportacion = (float) $request->capital_importacion;

        // Calcular capital propio: Total - Socios
        $capitalPropio = $capitalTotal - ($capitalJaime + $capitalArgentina + $capitalCristian);
        $capitalTotalPropio = $capitalPropio + $capitalImportacion;

        $registro = HistoricoPatrimonio::create([
            'fecha' => $request->fecha,
            'capital_jaime' => $capitalJaime,
            'capital_argentina' => $capitalArgentina,
            'capital_cristian' => $capitalCristian,
            'capital_propio' => $capitalPropio,
            'capital_importacion' => $capitalImportacion,
            'capital_total' => $capitalTotal,
            'capital_total_propio' => $capitalTotalPropio
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Registro histórico creado exitosamente',
            'data' => $registro
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id): JsonResponse
    {
        $registro = HistoricoPatrimonio::find($id);

        if (!$registro) {
            return response()->json([
                'success' => false,
                'message' => 'Registro histórico no encontrado'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $registro
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $registro = HistoricoPatrimonio::find($id);

        if (!$registro) {
            return response()->json([
                'success' => false,
                'message' => 'Registro histórico no encontrado'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'fecha' => 'required|date',
            'capital_jaime' => 'required|numeric|min:0',
            'capital_argentina' => 'required|numeric|min:0',
            'capital_cristian' => 'required|numeric|min:0',
            'capital_total' => 'required|numeric|min:0',
            'capital_importacion' => 'required|numeric|min:0'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        // Realizar cálculos automáticos en el servidor para consistencia
        $capitalJaime = (float) $request->capital_jaime;
        $capitalArgentina = (float) $request->capital_argentina;
        $capitalCristian = (float) $request->capital_cristian;
        $capitalTotal = (float) $request->capital_total;
        $capitalImportacion = (float) $request->capital_importacion;

        // Calcular capital propio: Total - Socios
        $capitalPropio = $capitalTotal - ($capitalJaime + $capitalArgentina + $capitalCristian);
        $capitalTotalPropio = $capitalPropio + $capitalImportacion;

        $registro->update([
            'fecha' => $request->fecha,
            'capital_jaime' => $capitalJaime,
            'capital_argentina' => $capitalArgentina,
            'capital_cristian' => $capitalCristian,
            'capital_propio' => $capitalPropio,
            'capital_importacion' => $capitalImportacion,
            'capital_total' => $capitalTotal,
            'capital_total_propio' => $capitalTotalPropio
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Registro histórico actualizado exitosamente',
            'data' => $registro
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id): JsonResponse
    {
        $registro = HistoricoPatrimonio::find($id);

        if (!$registro) {
            return response()->json([
                'success' => false,
                'message' => 'Registro histórico no encontrado'
            ], 404);
        }

        $registro->delete();

        return response()->json([
            'success' => true,
            'message' => 'Registro histórico eliminado exitosamente'
        ]);
    }
}
