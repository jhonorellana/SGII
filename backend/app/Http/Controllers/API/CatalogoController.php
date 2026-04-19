<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Catalogo;
use App\Models\CatalogoValor;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class CatalogoController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(): JsonResponse
    {
        $catalogos = Catalogo::with(['valores' => function($query) {
            $query->where('activo', true)->orderBy('orden_visual');
        }])->where('activo', true)->get();

        return response()->json([
            'success' => true,
            'data' => $catalogos
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:100',
            'descripcion' => 'nullable|string|max:255',
            'codigo' => 'required|string|max:50|unique:catalogo,codigo'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $catalogo = Catalogo::create([
            'nombre' => $request->nombre,
            'descripcion' => $request->descripcion,
            'codigo' => $request->codigo,
            'activo' => true,
            'fecha_creacion' => now(),
            'fecha_actualizacion' => now()
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Catálogo creado exitosamente',
            'data' => $catalogo
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id): JsonResponse
    {
        $catalogo = Catalogo::with(['valores' => function($query) {
            $query->orderBy('orden_visual');
        }])->find($id);

        if (!$catalogo) {
            return response()->json([
                'success' => false,
                'message' => 'Catálogo no encontrado'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $catalogo
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $catalogo = Catalogo::find($id);

        if (!$catalogo) {
            return response()->json([
                'success' => false,
                'message' => 'Catálogo no encontrado'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:100',
            'descripcion' => 'nullable|string|max:255',
            'codigo' => 'required|string|max:50|unique:catalogo,codigo,'.$id.',id_catalogo',
            'activo' => 'boolean'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $catalogo->update([
            'nombre' => $request->nombre,
            'descripcion' => $request->descripcion,
            'codigo' => $request->codigo,
            'activo' => $request->has('activo') ? $request->activo : $catalogo->activo,
            'fecha_actualizacion' => now()
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Catálogo actualizado exitosamente',
            'data' => $catalogo
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id): JsonResponse
    {
        $catalogo = Catalogo::find($id);

        if (!$catalogo) {
            return response()->json([
                'success' => false,
                'message' => 'Catálogo no encontrado'
            ], 404);
        }

        // Verificar si tiene valores activos
        $valoresActivos = $catalogo->valores()->where('activo', true)->count();
        if ($valoresActivos > 0) {
            return response()->json([
                'success' => false,
                'message' => 'No se puede eliminar el catálogo porque tiene valores activos'
            ], 422);
        }

        $catalogo->delete();

        return response()->json([
            'success' => true,
            'message' => 'Catálogo eliminado exitosamente'
        ]);
    }

    /**
     * Get catalog values by catalog code
     */
    public function getValoresByCodigo(string $codigo): JsonResponse
    {
        $catalogo = Catalogo::where('codigo', $codigo)
            ->where('activo', true)
            ->with(['valores' => function($query) {
                $query->where('activo', true)->orderBy('orden_visual');
            }])
            ->first();

        if (!$catalogo) {
            return response()->json([
                'success' => false,
                'message' => 'Catálogo no encontrado'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $catalogo->valores
        ]);
    }
}
