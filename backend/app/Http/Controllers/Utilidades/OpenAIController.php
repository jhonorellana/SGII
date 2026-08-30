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
        $promptCustom = trim($request->input('prompt', ''));
        $apiKey = env('OPENAI_API_KEY');
        
        if (!$apiKey) {
            return response()->json([
                'success' => true,
                'data' => "El mercado de valores está lleno de individuos que conocen el precio de todo, pero el valor de nada. ¡A comprar y vender se ha dicho! 🚀"
            ]);
        }

        try {
            if (!empty($promptCustom)) {
                $userMessage = $promptCustom;
            } else {
                $userMessage = 'Genera una frase amigable, ingeniosa y breve (máximo 30 palabras) escrita en primera persona desde la perspectiva de un inversionista que le escribe a su corredor de bolsa en Ecuador. Debe hacer un comentario con toque de humor entusiasta sobre el estado reciente de sus acciones y pedir su recomendación u opinión experta. Usa emojis al final. La casa de Valores se llama Santa Fé. La persona a quien va dirigido el mensaje es José Luis. Usa la información del portafolio para generar la frase.';
                if (!empty($contexto)) {
                    $userMessage .= " El estado y movimientos recientes de su portafolio son: '{$contexto}'.";
                }
            }

            $response = Http::withToken($apiKey)
                ->timeout(10)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => 'gpt-3.5-turbo',
                    'messages' => [
                        [
                            'role' => 'system',
                            'content' => 'Eres un inversionista en Ecuador entusiasta, inteligente y amigable, que le escribe a su corredor de bolsa para consultar su recomendación u opinión experta sobre los movimientos de su portafolio de acciones.'
                        ],
                        [
                            'role' => 'user',
                            'content' => $userMessage
                        ]
                    ],
                    'temperature' => 0.7,
                ]);

            if ($response->successful()) {
                $broma = trim($response->json('choices.0.message.content'), '"\' ');
            } else {
                Log::error('OpenAI API Error: ' . $response->body());
                $broma = "Si la inversión fuera fácil, no sería tan divertido. ¡A ver qué nos depara el mercado hoy! 💼";
            }
        } catch (\Exception $e) {
            Log::error('OpenAI Request Failed: ' . $e->getMessage());
            $broma = "El dinero nunca duerme. ¡Que tengamos una excelente jornada! 🌅";
        }

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
