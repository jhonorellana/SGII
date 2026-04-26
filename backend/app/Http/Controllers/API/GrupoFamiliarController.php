<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\GrupoFamiliar;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class GrupoFamiliarController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(): JsonResponse
    {
        $grupos = GrupoFamiliar::with('patriarca:id_persona,apellidos,nombres')
            ->orderBy('nombre')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $grupos
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:255',
            'descripcion' => 'nullable|string',
            'id_patriarca' => 'nullable|exists:persona,id_persona',
            'activo' => 'boolean'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $grupo = GrupoFamiliar::create([
            'nombre' => $request->nombre,
            'descripcion' => $request->descripcion,
            'id_patriarca' => $request->id_patriarca,
            'activo' => $request->activo ?? true,
            'fecha_creacion' => now(),
            'fecha_actualizacion' => now()
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Grupo familiar creado exitosamente',
            'data' => $grupo
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id): JsonResponse
    {
        $grupo = GrupoFamiliar::with('patriarca:id_persona,apellidos,nombres')
            ->with('personas:id_persona,apellidos,nombres,identificacion')
            ->find($id);

        if (!$grupo) {
            return response()->json([
                'success' => false,
                'message' => 'Grupo familiar no encontrado'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $grupo
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $grupo = GrupoFamiliar::find($id);

        if (!$grupo) {
            return response()->json([
                'success' => false,
                'message' => 'Grupo familiar no encontrado'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:255',
            'descripcion' => 'nullable|string',
            'id_patriarca' => 'nullable|exists:persona,id_persona',
            'activo' => 'boolean'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $grupo->update([
            'nombre' => $request->nombre,
            'descripcion' => $request->descripcion,
            'id_patriarca' => $request->id_patriarca,
            'activo' => $request->activo,
            'fecha_actualizacion' => now()
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Grupo familiar actualizado exitosamente',
            'data' => $grupo
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id): JsonResponse
    {
        $grupo = GrupoFamiliar::find($id);

        if (!$grupo) {
            return response()->json([
                'success' => false,
                'message' => 'Grupo familiar no encontrado'
            ], 404);
        }

        $grupo->update([
            'activo' => false,
            'fecha_actualizacion' => now()
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Grupo familiar desactivado exitosamente'
        ]);
    }
}
