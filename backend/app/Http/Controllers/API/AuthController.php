<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Usuario;
use App\Models\Persona;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'nombre_usuario' => 'required|string',
            'clave' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos inválidos',
                'errors' => $validator->errors()
            ], 422);
        }

        $usuario = Usuario::with(['persona', 'rol'])
            ->where('nombre_usuario', $request->nombre_usuario)
            ->where('activo', 1)
            ->first();

        if (!$usuario || !$usuario->checkPassword($request->clave)) {
            return response()->json([
                'success' => false,
                'message' => 'Credenciales incorrectas'
            ], 401);
        }

        // Actualizar último acceso
        $usuario->ultimo_acceso = now();
        $usuario->save();

        // Crear token simple (puedes usar JWT después)
        $token = base64_encode($usuario->id_usuario . ':' . $usuario->nombre_usuario . ':' . time());

        return response()->json([
            'success' => true,
            'message' => 'Login exitoso',
            'data' => [
                'usuario' => [
                    'id' => $usuario->id_usuario,
                    'nombre_usuario' => $usuario->nombre_usuario,
                    'rol' => $usuario->rol->nombre,
                    'persona' => $usuario->persona
                ],
                'token' => $token
            ]
        ]);
    }

    public function logout(Request $request)
    {
        // Por ahora simple, puedes implementar blacklist de tokens después
        return response()->json([
            'success' => true,
            'message' => 'Sesión cerrada exitosamente'
        ]);
    }

    public function me(Request $request)
    {
        // Por ahora retornamos usuario fijo, debes implementar middleware de auth
        $usuario = Usuario::with(['persona', 'rol'])
            ->where('nombre_usuario', 'admin')
            ->first();

        return response()->json([
            'success' => true,
            'data' => [
                'usuario' => [
                    'id' => $usuario->id_usuario,
                    'nombre_usuario' => $usuario->nombre_usuario,
                    'rol' => $usuario->rol->nombre,
                    'persona' => $usuario->persona
                ]
            ]
        ]);
    }
}
