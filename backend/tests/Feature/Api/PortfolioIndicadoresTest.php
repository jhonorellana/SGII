<?php

namespace Tests\Feature\Api;

use Tests\TestCase;

class PortfolioIndicadoresTest extends TestCase
{
    /**
     * Test the portfolio indicadores endpoint.
     */
    public function test_portfolio_indicadores_endpoint_returns_success()
    {
        $response = $this->get('/api/portfolio/indicadores');

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
