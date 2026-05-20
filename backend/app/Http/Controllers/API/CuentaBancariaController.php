<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\CuentaBancaria;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Validator;

class CuentaBancariaController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $cuentasBancarias = CuentaBancaria::with(['persona', 'banco', 'tipoCuenta'])
            ->where('eliminado', false)
            ->orderBy('id_cuenta_bancaria', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $cuentasBancarias
        ], Response::HTTP_OK);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id_persona' => 'required|exists:persona,id_persona',
            'id_banco' => 'required|exists:catalogo_valor,id_catalogo_valor',
            'id_tipo_cuenta' => 'nullable|exists:catalogo_valor,id_catalogo_valor',
            'numero_cuenta' => 'nullable|string|max:20',
            'activo' => 'boolean'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], Response::HTTP_BAD_REQUEST);
        }

        $cuentaBancaria = CuentaBancaria::create([
            'id_persona' => $request->id_persona,
            'id_banco' => $request->id_banco,
            'id_tipo_cuenta' => $request->id_tipo_cuenta,
            'numero_cuenta' => $request->numero_cuenta,
            'activo' => $request->has('activo') ? $request->activo : true,
            'eliminado' => false,
            'fecha_creacion' => now(),
            'fecha_actualizacion' => now()
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Cuenta bancaria creada exitosamente',
            'data' => $cuentaBancaria->load(['persona', 'banco', 'tipoCuenta'])
        ], Response::HTTP_CREATED);
    }

    /**
     * Display the specified resource.
     */
    public function show($id)
    {
        $cuentaBancaria = CuentaBancaria::with(['persona', 'banco', 'tipoCuenta'])->find($id);

        if (!$cuentaBancaria) {
            return response()->json([
                'success' => false,
                'message' => 'Cuenta bancaria no encontrada'
            ], Response::HTTP_NOT_FOUND);
        }

        return response()->json([
            'success' => true,
            'data' => $cuentaBancaria
        ], Response::HTTP_OK);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, $id)
    {
        $cuentaBancaria = CuentaBancaria::find($id);

        if (!$cuentaBancaria) {
            return response()->json([
                'success' => false,
                'message' => 'Cuenta bancaria no encontrada'
            ], Response::HTTP_NOT_FOUND);
        }

        $validator = Validator::make($request->all(), [
            'id_persona' => 'required|exists:persona,id_persona',
            'id_banco' => 'required|exists:catalogo_valor,id_catalogo_valor',
            'id_tipo_cuenta' => 'nullable|exists:catalogo_valor,id_catalogo_valor',
            'numero_cuenta' => 'nullable|string|max:20',
            'activo' => 'boolean'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], Response::HTTP_BAD_REQUEST);
        }

        $cuentaBancaria->update([
            'id_persona' => $request->id_persona,
            'id_banco' => $request->id_banco,
            'id_tipo_cuenta' => $request->id_tipo_cuenta,
            'numero_cuenta' => $request->numero_cuenta,
            'activo' => $request->has('activo') ? $request->activo : $cuentaBancaria->activo,
            'fecha_actualizacion' => now()
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Cuenta bancaria actualizada exitosamente',
            'data' => $cuentaBancaria->load(['persona', 'banco', 'tipoCuenta'])
        ], Response::HTTP_OK);
    }

    /**
     * Remove the specified resource from storage (soft delete).
     */
    public function destroy($id)
    {
        $cuentaBancaria = CuentaBancaria::find($id);

        if (!$cuentaBancaria) {
            return response()->json([
                'success' => false,
                'message' => 'Cuenta bancaria no encontrada'
            ], Response::HTTP_NOT_FOUND);
        }

        $cuentaBancaria->update([
            'activo' => false,
            'eliminado' => true,
            'fecha_actualizacion' => now()
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Cuenta bancaria desactivada correctamente'
        ], Response::HTTP_OK);
    }
}
