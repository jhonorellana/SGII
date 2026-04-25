<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Persona;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class PersonaController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(): JsonResponse
    {
        $personas = Persona::orderBy('apellidos')
            ->orderBy('nombres')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $personas
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'nombres' => 'required|string|max:150',
            'apellidos' => 'required|string|max:150',
            'identificacion' => 'nullable|string|max:50',
            'correo' => 'nullable|email|max:150',
            'telefono' => 'nullable|string|max:50'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $persona = Persona::create([
            'nombres' => $request->nombres,
            'apellidos' => $request->apellidos,
            'identificacion' => $request->identificacion,
            'correo' => $request->correo,
            'telefono' => $request->telefono,
            'activo' => true,
            'fecha_creacion' => now(),
            'fecha_actualizacion' => now()
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Persona creada exitosamente',
            'data' => $persona
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id): JsonResponse
    {
        $persona = Persona::find($id);

        if (!$persona) {
            return response()->json([
                'success' => false,
                'message' => 'Persona no encontrada'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $persona
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $persona = Persona::find($id);

        if (!$persona) {
            return response()->json([
                'success' => false,
                'message' => 'Persona no encontrada'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'nombres' => 'required|string|max:150',
            'apellidos' => 'required|string|max:150',
            'identificacion' => 'nullable|string|max:50',
            'correo' => 'nullable|email|max:150',
            'telefono' => 'nullable|string|max:50',
            'activo' => 'boolean'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        $persona->update([
            'nombres' => $request->nombres,
            'apellidos' => $request->apellidos,
            'identificacion' => $request->identificacion,
            'correo' => $request->correo,
            'telefono' => $request->telefono,
            'activo' => $request->has('activo') ? $request->activo : $persona->activo,
            'fecha_actualizacion' => now()
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Persona actualizada exitosamente',
            'data' => $persona
        ]);
    }

    /**
     * Remove the specified resource from storage (soft delete - deactivate).
     */
    public function destroy(string $id): JsonResponse
    {
        $persona = Persona::find($id);

        if (!$persona) {
            return response()->json([
                'success' => false,
                'message' => 'Persona no encontrada'
            ], 404);
        }

        // Soft delete: inactivar en lugar de borrar físicamente
        $persona->update([
            'activo' => false,
            'fecha_actualizacion' => now()
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Persona desactivada exitosamente'
        ]);
    }
}
