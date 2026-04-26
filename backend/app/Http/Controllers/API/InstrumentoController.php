<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Instrumento;
use App\Http\Resources\InstrumentoResource;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Validator;

class InstrumentoController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $instrumentos = Instrumento::with(['emisor', 'tipoInversion'])
            ->orderBy('id_instrumento', 'desc')
            ->get();

        return response()->json(InstrumentoResource::collection($instrumentos), Response::HTTP_OK);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id_emisor' => 'required|exists:emisor,id_emisor',
            'id_tipo_inversion' => 'required|exists:catalogo_valor,id_catalogo_valor',
            'codigo_titulo' => 'required|string|max:50',
            'nombre' => 'required|string|max:200',
            'fecha_emision' => 'required|date',
            'fecha_vencimiento' => 'required|date|after_or_equal:fecha_emision',
            'tasa_referencial' => 'nullable|numeric',
            'fechas_recuperacion' => 'nullable|string',
            'codigo_titulo_vector' => 'nullable|string|max:50',
            'codigo_seb' => 'nullable|string|max:50',
            'codigo_bce' => 'nullable|string|max:50',
            'activo' => 'boolean'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], Response::HTTP_BAD_REQUEST);
        }

        $instrumento = Instrumento::create([
            'id_emisor' => $request->id_emisor,
            'id_tipo_inversion' => $request->id_tipo_inversion,
            'codigo_titulo' => $request->codigo_titulo,
            'nombre' => $request->nombre,
            'fecha_emision' => $request->fecha_emision,
            'fecha_vencimiento' => $request->fecha_vencimiento,
            'tasa_referencial' => $request->tasa_referencial,
            'fechas_recuperacion' => $request->fechas_recuperacion,
            'codigo_titulo_vector' => $request->codigo_titulo_vector,
            'codigo_seb' => $request->codigo_seb,
            'codigo_bce' => $request->codigo_bce,
            'activo' => $request->has('activo') ? $request->activo : true,
            'fecha_creacion' => now(),
            'fecha_actualizacion' => now()
        ]);

        return response()->json($instrumento->load(['emisor', 'tipoInversion']), Response::HTTP_CREATED);
    }

    /**
     * Display the specified resource.
     */
    public function show($id)
    {
        $instrumento = Instrumento::with(['emisor', 'tipoInversion'])->find($id);

        if (!$instrumento) {
            return response()->json(['message' => 'Instrumento no encontrado'], Response::HTTP_NOT_FOUND);
        }

        return response()->json($instrumento, Response::HTTP_OK);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, $id)
    {
        $instrumento = Instrumento::find($id);

        if (!$instrumento) {
            return response()->json(['message' => 'Instrumento no encontrado'], Response::HTTP_NOT_FOUND);
        }

        $validator = Validator::make($request->all(), [
            'id_emisor' => 'required|exists:emisor,id_emisor',
            'id_tipo_inversion' => 'required|exists:catalogo_valor,id_catalogo_valor',
            'codigo_titulo' => 'required|string|max:50',
            'nombre' => 'required|string|max:200',
            'fecha_emision' => 'required|date',
            'fecha_vencimiento' => 'required|date|after_or_equal:fecha_emision',
            'tasa_referencial' => 'nullable|numeric',
            'fechas_recuperacion' => 'nullable|string',
            'codigo_titulo_vector' => 'nullable|string|max:50',
            'codigo_seb' => 'nullable|string|max:50',
            'codigo_bce' => 'nullable|string|max:50',
            'activo' => 'boolean'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], Response::HTTP_BAD_REQUEST);
        }

        $instrumento->update([
            'id_emisor' => $request->id_emisor,
            'id_tipo_inversion' => $request->id_tipo_inversion,
            'codigo_titulo' => $request->codigo_titulo,
            'nombre' => $request->nombre,
            'fecha_emision' => $request->fecha_emision,
            'fecha_vencimiento' => $request->fecha_vencimiento,
            'tasa_referencial' => $request->tasa_referencial,
            'fechas_recuperacion' => $request->fechas_recuperacion,
            'codigo_titulo_vector' => $request->codigo_titulo_vector,
            'codigo_seb' => $request->codigo_seb,
            'codigo_bce' => $request->codigo_bce,
            'activo' => $request->has('activo') ? $request->activo : $instrumento->activo,
            'fecha_actualizacion' => now()
        ]);

        return response()->json($instrumento->load(['emisor', 'tipoInversion']), Response::HTTP_OK);
    }

    /**
     * Remove the specified resource from storage (soft delete).
     */
    public function destroy($id)
    {
        $instrumento = Instrumento::find($id);

        if (!$instrumento) {
            return response()->json(['message' => 'Instrumento no encontrado'], Response::HTTP_NOT_FOUND);
        }

        $instrumento->update([
            'activo' => false,
            'fecha_actualizacion' => now()
        ]);

        return response()->json(['message' => 'Instrumento desactivado correctamente'], Response::HTTP_OK);
    }
}
