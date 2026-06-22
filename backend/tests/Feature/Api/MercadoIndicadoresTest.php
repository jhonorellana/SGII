<?php

namespace Tests\Feature\Api;

use Tests\TestCase;

class MercadoIndicadoresTest extends TestCase
{
    /**
     * Test the mercado indicadores endpoint.
     */
    public function test_mercado_indicadores_endpoint_returns_success()
    {
        $response = $this->get('/api/mercado/indicadores');

        $response->assertStatus(200)
                 ->assertJsonStructure([
                     'success',
                     'data' => [
                         '*' => [
                             'id_emisor',
                             'fecha',
                             'cantidad_posicion',
                             'precio_mercado'
                         ]
                     ]
                 ]);

        $this->assertTrue($response->json('success'));
    }
}
