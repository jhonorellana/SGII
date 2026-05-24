<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\VentaInversionDetalle;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Validator;

class VentaInversionDetalleController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = VentaInversionDetalle::with(['ventaInversion', 'inversion']);

        // Filtros
        if ($request->has('id_venta_inversion') && $request->id_venta_inversion) {
            $query->where('id_venta_inversion', $request->id_venta_inversion);
        }
        if ($request->has('id_inversion') && $request->id_inversion) {
            $query->where('id_inversion', $request->id_inversion);
        }

        $detalles = $query->orderBy('id_venta_inversion_detalle', 'asc')->get();

        return response()->json([
            'success' => true,
            'data' => $detalles
        ], Response::HTTP_OK);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id_venta_inversion' => 'required|exists:venta_inversion,id_venta_inversion',
            'id_inversion' => 'required|exists:inversion,id_inversion',
            'valor_nominal' => 'required|numeric|min:0',
            'valor_compra' => 'required|numeric|min:0',
            'porcentaje_compra' => 'nullable|numeric|min:0|max:100',
            'valor_venta_asignado' => 'required|numeric|min:0',
            'porcentaje_venta' => 'nullable|numeric|min:0|max:100',
            'utilidad' => 'nullable|numeric',
            'rendimiento' => 'nullable|numeric'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $detalle = VentaInversionDetalle::create($request->all());

        return response()->json([
            'success' => true,
            'data' => $detalle,
            'message' => 'Detalle de venta creado exitosamente'
        ], Response::HTTP_CREATED);
    }

    /**
     * Display the specified resource.
     */
    public function show($id)
    {
        $detalle = VentaInversionDetalle::with(['ventaInversion', 'inversion'])
            ->find($id);

        if (!$detalle) {
            return response()->json([
                'success' => false,
                'message' => 'Detalle de venta no encontrado'
            ], Response::HTTP_NOT_FOUND);
        }

        return response()->json([
            'success' => true,
            'data' => $detalle
        ], Response::HTTP_OK);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, $id)
    {
        $detalle = VentaInversionDetalle::find($id);

        if (!$detalle) {
            return response()->json([
                'success' => false,
                'message' => 'Detalle de venta no encontrado'
            ], Response::HTTP_NOT_FOUND);
        }

        $validator = Validator::make($request->all(), [
            'valor_nominal' => 'nullable|numeric|min:0',
            'valor_compra' => 'nullable|numeric|min:0',
            'porcentaje_compra' => 'nullable|numeric|min:0|max:100',
            'valor_venta_asignado' => 'nullable|numeric|min:0',
            'porcentaje_venta' => 'nullable|numeric|min:0|max:100',
            'utilidad' => 'nullable|numeric',
            'rendimiento' => 'nullable|numeric'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $detalle->update($request->all());

        return response()->json([
            'success' => true,
            'data' => $detalle,
            'message' => 'Detalle de venta actualizado exitosamente'
        ], Response::HTTP_OK);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id)
    {
        $detalle = VentaInversionDetalle::find($id);

        if (!$detalle) {
            return response()->json([
                'success' => false,
                'message' => 'Detalle de venta no encontrado'
            ], Response::HTTP_NOT_FOUND);
        }

        $detalle->delete();

        return response()->json([
            'success' => true,
            'message' => 'Detalle de venta eliminado exitosamente'
        ], Response::HTTP_OK);
    }

    /**
     * Obtener detalles por venta
     */
    public function getByVenta($id_venta_inversion)
    {
        $detalles = VentaInversionDetalle::with(['inversion'])
            ->where('id_venta_inversion', $id_venta_inversion)
            ->orderBy('id_venta_inversion_detalle', 'asc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $detalles
        ], Response::HTTP_OK);
    }
}
