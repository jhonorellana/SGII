<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Catalogo;
use App\Models\CatalogoValor;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class CatalogoValorController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(): JsonResponse
    {
        $valores = CatalogoValor::with('catalogo')
            ->where('activo', true)
            ->orderBy('id_catalogo')
            ->orderBy('orden_visual')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $valores
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'id_catalogo' => 'required|exists:catalogo,id_catalogo',
            'codigo' => 'required|string|max:50',
            'nombre' => 'required|string|max:100',
            'descripcion' => 'nullable|string|max:255',
            'orden_visual' => 'required|integer|min:1'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        // Verificar que el código sea único dentro del catálogo
        $existe = CatalogoValor::where('id_catalogo', $request->id_catalogo)
            ->where('codigo', $request->codigo)
            ->where('activo', true)
            ->exists();

        if ($existe) {
            return response()->json([
                'success' => false,
                'message' => 'El código ya existe en este catálogo'
            ], 422);
        }

        $valor = CatalogoValor::create([
            'id_catalogo' => $request->id_catalogo,
            'codigo' => $request->codigo,
            'nombre' => $request->nombre,
            'descripcion' => $request->descripcion,
            'orden_visual' => $request->orden_visual,
            'activo' => true,
            'fecha_creacion' => now(),
            'fecha_actualizacion' => now()
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Valor de catálogo creado exitosamente',
            'data' => $valor->load('catalogo')
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id): JsonResponse
    {
        $valor = CatalogoValor::with('catalogo')->find($id);

        if (!$valor) {
            return response()->json([
                'success' => false,
                'message' => 'Valor de catálogo no encontrado'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $valor
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $valor = CatalogoValor::find($id);

        if (!$valor) {
            return response()->json([
                'success' => false,
                'message' => 'Valor de catálogo no encontrado'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'id_catalogo' => 'required|exists:catalogo,id_catalogo',
            'codigo' => 'required|string|max:50',
            'nombre' => 'required|string|max:100',
            'descripcion' => 'nullable|string|max:255',
            'orden_visual' => 'required|integer|min:1',
            'activo' => 'boolean'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        // Verificar que el código sea único dentro del catálogo (excluyendo el actual)
        $existe = CatalogoValor::where('id_catalogo', $request->id_catalogo)
            ->where('codigo', $request->codigo)
            ->where('id_catalogo_valor', '!=', $id)
            ->where('activo', true)
            ->exists();

        if ($existe) {
            return response()->json([
                'success' => false,
                'message' => 'El código ya existe en este catálogo'
            ], 422);
        }

        $valor->update([
            'id_catalogo' => $request->id_catalogo,
            'codigo' => $request->codigo,
            'nombre' => $request->nombre,
            'descripcion' => $request->descripcion,
            'orden_visual' => $request->orden_visual,
            'activo' => $request->has('activo') ? $request->activo : $valor->activo,
            'fecha_actualizacion' => now()
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Valor de catálogo actualizado exitosamente',
            'data' => $valor->load('catalogo')
        ]);
    }

    /**
     * Remove the specified resource from storage (soft delete - deactivate).
     */
    public function destroy(string $id): JsonResponse
    {
        $valor = CatalogoValor::find($id);

        if (!$valor) {
            return response()->json([
                'success' => false,
                'message' => 'Valor de catálogo no encontrado'
            ], 404);
        }

        // Soft delete: inactivar en lugar de borrar físicamente
        $valor->update([
            'activo' => false,
            'fecha_actualizacion' => now()
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Valor de catálogo desactivado exitosamente'
        ]);
    }

    /**
     * Get values by catalog ID
     */
    public function getByCatalogo(string $idCatalogo): JsonResponse
    {
        try {
            // Convertir a entero y validar
            $catalogoId = (int) $idCatalogo;

            $catalogo = Catalogo::find($catalogoId);

            if (!$catalogo) {
                return response()->json([
                    'success' => false,
                    'message' => 'Catálogo no encontrado'
                ], 404);
            }

            $valores = CatalogoValor::where('id_catalogo', $catalogoId)
                ->orderBy('orden_visual')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $valores
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener los valores del catálogo: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Activate/deactivate catalog value
     */
    public function toggleActive(string $id): JsonResponse
    {
        $valor = CatalogoValor::find($id);

        if (!$valor) {
            return response()->json([
                'success' => false,
                'message' => 'Valor de catálogo no encontrado'
            ], 404);
        }

        $valor->update([
            'activo' => !$valor->activo,
            'fecha_actualizacion' => now()
        ]);

        return response()->json([
            'success' => true,
            'message' => $valor->activo ? 'Valor activado exitosamente' : 'Valor desactivado exitosamente',
            'data' => $valor
        ]);
    }
}
