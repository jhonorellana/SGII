<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\OtroValor;
use App\Models\GrupoFamiliar;
use App\Models\Persona;
use App\Models\CatalogoValor;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class OtroValorController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $query = OtroValor::with(['grupoFamiliar', 'propietario', 'tipoValor'])
                ->activos();

            // Filtros
            if ($request->has('id_grupo_familiar')) {
                $query->delGrupo($request->id_grupo_familiar);
            }

            if ($request->has('id_propietario')) {
                $query->delPropietario($request->id_propietario);
            }

            if ($request->has('id_tipo_otro_valor')) {
                $query->delTipo($request->id_tipo_otro_valor);
            }

            if ($request->has('vigentes') && $request->vigentes) {
                $query->vigentes();
            }

            $otrosValores = $query->orderBy('fecha_creacion', 'desc')->get();

            return response()->json([
                'success' => true,
                'data' => $otrosValores
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener los valores: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $validator = Validator::make($request->all(), [
                'id_grupo_familiar' => 'required|integer|exists:grupo_familiar,id_grupo_familiar',
                'id_propietario' => 'nullable|integer|exists:persona,id_persona',
                'id_tipo_otro_valor' => 'required|integer|exists:catalogo_valor,id_catalogo_valor',
                'descripcion' => 'required|string|max:255',
                'valor' => 'required|numeric|min:-999999999.99|max:999999999.99',
                'fecha_desde' => 'nullable|date',
                'fecha_hasta' => 'nullable|date|after_or_equal:fecha_desde',
                'activo' => 'boolean'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error de validación',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Validar que el grupo familiar exista
            $grupoFamiliar = GrupoFamiliar::find($request->id_grupo_familiar);
            if (!$grupoFamiliar) {
                return response()->json([
                    'success' => false,
                    'message' => 'El grupo familiar especificado no existe'
                ], 404);
            }

            // Validar que el tipo de valor exista
            $tipoValor = CatalogoValor::find($request->id_tipo_otro_valor);
            if (!$tipoValor) {
                return response()->json([
                    'success' => false,
                    'message' => 'El tipo de valor especificado no existe'
                ], 404);
            }

            // Validar propietario si se especifica
            if ($request->id_propietario) {
                $propietario = Persona::find($request->id_propietario);
                if (!$propietario) {
                    return response()->json([
                        'success' => false,
                        'message' => 'El propietario especificado no existe'
                    ], 404);
                }
            }

            $otroValor = OtroValor::create([
                'id_grupo_familiar' => $request->id_grupo_familiar,
                'id_propietario' => $request->id_propietario,
                'id_tipo_otro_valor' => $request->id_tipo_otro_valor,
                'descripcion' => $request->descripcion,
                'valor' => $request->valor,
                'fecha_desde' => $request->fecha_desde,
                'fecha_hasta' => $request->fecha_hasta,
                'activo' => $request->activo ?? true,
                'eliminado' => false
            ]);

            // Cargar relaciones para la respuesta
            $otroValor->load(['grupoFamiliar', 'propietario', 'tipoValor']);

            return response()->json([
                'success' => true,
                'message' => 'Valor creado exitosamente',
                'data' => $otroValor
            ], 201);

        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al crear el valor: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id): JsonResponse
    {
        try {
            $otroValor = OtroValor::with(['grupoFamiliar', 'propietario', 'tipoValor'])
                ->activos()
                ->find($id);

            if (!$otroValor) {
                return response()->json([
                    'success' => false,
                    'message' => 'Valor no encontrado'
                ], 404);
            }

            return response()->json([
                'success' => true,
                'data' => $otroValor
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener el valor: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        try {
            $otroValor = OtroValor::find($id);

            if (!$otroValor) {
                return response()->json([
                    'success' => false,
                    'message' => 'Valor no encontrado'
                ], 404);
            }

            $validator = Validator::make($request->all(), [
                'id_grupo_familiar' => 'sometimes|required|integer|exists:grupo_familiar,id_grupo_familiar',
                'id_propietario' => 'sometimes|nullable|integer|exists:persona,id_persona',
                'id_tipo_otro_valor' => 'sometimes|required|integer|exists:catalogo_valor,id_catalogo_valor',
                'descripcion' => 'sometimes|required|string|max:255',
                'valor' => 'sometimes|required|numeric|min:-999999999.99|max:999999999.99',
                'fecha_desde' => 'sometimes|nullable|date',
                'fecha_hasta' => 'sometimes|nullable|date|after_or_equal:fecha_desde',
                'activo' => 'sometimes|boolean'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error de validación',
                    'errors' => $validator->errors()
                ], 422);
            }

            $otroValor->update($request->all());

            // Cargar relaciones para la respuesta
            $otroValor->load(['grupoFamiliar', 'propietario', 'tipoValor']);

            return response()->json([
                'success' => true,
                'message' => 'Valor actualizado exitosamente',
                'data' => $otroValor
            ]);

        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar el valor: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id): JsonResponse
    {
        try {
            $otroValor = OtroValor::find($id);

            if (!$otroValor) {
                return response()->json([
                    'success' => false,
                    'message' => 'Valor no encontrado'
                ], 404);
            }

            // Soft delete
            $otroValor->update(['eliminado' => true]);

            return response()->json([
                'success' => true,
                'message' => 'Valor eliminado exitosamente'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al eliminar el valor: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Toggle active status
     */
    public function toggleActive(string $id): JsonResponse
    {
        try {
            $otroValor = OtroValor::find($id);

            if (!$otroValor) {
                return response()->json([
                    'success' => false,
                    'message' => 'Valor no encontrado'
                ], 404);
            }

            $otroValor->activo = !$otroValor->activo;
            $otroValor->save();

            return response()->json([
                'success' => true,
                'message' => $otroValor->activo ? 'Valor activado exitosamente' : 'Valor desactivado exitosamente',
                'data' => $otroValor
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al cambiar estado del valor: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get resumen by grupo familiar
     */
    public function getResumenByGrupo(string $idGrupo): JsonResponse
    {
        try {
            $grupoFamiliar = GrupoFamiliar::find($idGrupo);

            if (!$grupoFamiliar) {
                return response()->json([
                    'success' => false,
                    'message' => 'Grupo familiar no encontrado'
                ], 404);
            }

            $valores = OtroValor::with(['tipoValor'])
                ->activos()
                ->vigentes()
                ->delGrupo($idGrupo)
                ->get();

            $resumen = [
                'grupo_familiar' => $grupoFamiliar,
                'total_activos' => $valores->where('valor', '>', 0)->sum('valor'),
                'total_pasivos' => abs($valores->where('valor', '<', 0)->sum('valor')),
                'patrimonio_neto' => $valores->sum('valor'),
                'cantidad_valores' => $valores->count(),
                'valores' => $valores
            ];

            return response()->json([
                'success' => true,
                'data' => $resumen
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener resumen: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get tipos de otro valor (catálogo 7)
     */
    public function getTipos(): JsonResponse
    {
        try {
            $tipos = CatalogoValor::where('id_catalogo', 7)
                ->where('activo', 1)
                ->orderBy('orden_visual')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $tipos
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener tipos: ' . $e->getMessage()
            ], 500);
        }
    }
}
