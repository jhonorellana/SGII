<?php

namespace App\Http\Controllers\Utilidades;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class OpenAIController extends Controller
{
    public function getBromaDiaria(Request $request)
    {
        $contexto = trim($request->input('contexto', ''));
        $cacheKey = $contexto ? 'openai_broma_diaria_' . md5($contexto) : 'openai_broma_diaria';

        $broma = Cache::remember($cacheKey, 60 * 60 * 24, function () use ($contexto) {
            $apiKey = env('OPENAI_API_KEY');
            
            if (!$apiKey) {
                return "El mercado de valores está lleno de individuos que conocen el precio de todo, pero el valor de nada. ¡A comprar y vender se ha dicho! 🚀";
            }

            try {
                $userMessage = 'Genera una sola frase motivacional o broma corta y divertida en español sobre finanzas, inversiones o el mercado de valores para iniciar el día. Máximo 25 palabras. Usa algún emoji al final.';
                if (!empty($contexto)) {
                    $userMessage .= " Considera esta novedad del mercado de renta variable o contexto ingresado por el usuario: '{$contexto}'.";
                }

                $response = Http::withToken($apiKey)
                    ->timeout(10)
                    ->post('https://api.openai.com/v1/chat/completions', [
                        'model' => 'gpt-3.5-turbo',
                        'messages' => [
                            [
                                'role' => 'system',
                                'content' => 'Eres un asistente ingenioso y divertido para un equipo de corredores de bolsa en Ecuador.'
                            ],
                            [
                                'role' => 'user',
                                'content' => $userMessage
                            ]
                        ],
                        'temperature' => 0.7,
                    ]);

                if ($response->successful()) {
                    return trim($response->json('choices.0.message.content'), '"\' ');
                } else {
                    Log::error('OpenAI API Error: ' . $response->body());
                    return "Si la inversión fuera fácil, no sería tan divertido. ¡A ver qué nos depara el mercado hoy! 💼";
                }
            } catch (\Exception $e) {
                Log::error('OpenAI Request Failed: ' . $e->getMessage());
                return "El dinero nunca duerme. ¡Que tengamos una excelente jornada! 🌅";
            }
        });

        return response()->json([
            'success' => true,
            'data' => $broma
        ]);
    }

    public function getBromaCierre(Request $request)
    {
        $contexto = trim($request->input('contexto', ''));
        $cacheKey = $contexto ? 'openai_broma_cierre_' . md5($contexto) : 'openai_broma_cierre';

        $broma = Cache::remember($cacheKey, 60 * 60 * 24, function () use ($contexto) {
            $apiKey = env('OPENAI_API_KEY');
            
            if (!$apiKey) {
                return "¡Por fin cuadramos caja! A descansar, que mañana el mercado vuelve a abrir. 📈";
            }

            try {
                $userMessage = 'Genera una sola frase motivacional, de alivio o broma corta en español sobre finanzas o contabilidad para celebrar el cierre del día laboral o cuadre de caja. Máximo 25 palabras. Usa algún emoji al final.';
                if (!empty($contexto)) {
                    $userMessage .= " Considera esta novedad del mercado o cierre de renta variable expresada por el usuario: '{$contexto}'.";
                }

                $response = Http::withToken($apiKey)
                    ->timeout(10)
                    ->post('https://api.openai.com/v1/chat/completions', [
                        'model' => 'gpt-3.5-turbo',
                        'messages' => [
                            [
                                'role' => 'system',
                                'content' => 'Eres un asistente ingenioso y divertido para un equipo de corredores de bolsa en Ecuador.'
                            ],
                            [
                                'role' => 'user',
                                'content' => $userMessage
                            ]
                        ],
                        'temperature' => 0.7,
                    ]);

                if ($response->successful()) {
                    return trim($response->json('choices.0.message.content'), '"\' ');
                } else {
                    Log::error('OpenAI API Error: ' . $response->body());
                    return "El balance cuadró (o eso parece). ¡Hora de apagar la computadora! 🖥️";
                }
            } catch (\Exception $e) {
                Log::error('OpenAI Request Failed: ' . $e->getMessage());
                return "Cierre de mercado completado con éxito. ¡Vámonos a casa! 🏃‍♂️";
            }
        });

        return response()->json([
            'success' => true,
            'data' => $broma
        ]);
    }
}
