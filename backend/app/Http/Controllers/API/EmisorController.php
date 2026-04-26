<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Emisor;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class EmisorController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(): JsonResponse
    {
        $emisores = Emisor::with('tipoEmisor:id_catalogo_valor,codigo,nombre')
            ->orderBy('nombre')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $emisores
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:255',
            'sigla' => 'required|string|max:50',
            'identificacion' => 'nullable|string|max:50',
            'id_tipo_emisor' => 'required|exists:catalogo_valor,id_catalogo_valor',
            'activo' => 'boolean'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $emisor = Emisor::create([
            'nombre' => $request->nombre,
            'sigla' => $request->sigla,
            'identificacion' => $request->identificacion,
            'id_tipo_emisor' => $request->id_tipo_emisor,
            'activo' => $request->activo ?? true,
            'fecha_creacion' => now(),
            'fecha_actualizacion' => now()
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Emisor creado exitosamente',
            'data' => $emisor
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id): JsonResponse
    {
        $emisor = Emisor::with('tipoEmisor:id_catalogo_valor,codigo,nombre')
            ->find($id);

        if (!$emisor) {
            return response()->json([
                'success' => false,
                'message' => 'Emisor no encontrado'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $emisor
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $emisor = Emisor::find($id);

        if (!$emisor) {
            return response()->json([
                'success' => false,
                'message' => 'Emisor no encontrado'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:255',
            'sigla' => 'required|string|max:50',
            'identificacion' => 'nullable|string|max:50',
            'id_tipo_emisor' => 'required|exists:catalogo_valor,id_catalogo_valor',
            'activo' => 'boolean'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $emisor->update([
            'nombre' => $request->nombre,
            'sigla' => $request->sigla,
            'identificacion' => $request->identificacion,
            'id_tipo_emisor' => $request->id_tipo_emisor,
            'activo' => $request->activo,
            'fecha_actualizacion' => now()
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Emisor actualizado exitosamente',
            'data' => $emisor
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id): JsonResponse
    {
        $emisor = Emisor::find($id);

        if (!$emisor) {
            return response()->json([
                'success' => false,
                'message' => 'Emisor no encontrado'
            ], 404);
        }

        $emisor->update([
            'activo' => false,
            'fecha_actualizacion' => now()
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Emisor desactivado exitosamente'
        ]);
    }
}
