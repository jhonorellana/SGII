# Endpoint Requerido para Actualización de Amortizaciones

## Descripción
Se necesita crear un endpoint en Laravel para desactivar registros de amortización cuando se registra una venta de inversión.

## Endpoint Details

**URL:** `PUT /api/amortizaciones/desactivar-por-fecha-inversion`

**Headers:**
- Content-Type: application/json
- Authorization: Bearer {token}

**Request Body:**
```json
{
  "id_inversion": 123,
  "fecha_venta": "2024-12-31"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Amortizaciones actualizadas correctamente",
  "count": 5
}
```

## Lógica del Backend

1. **Buscar registros:**
   ```php
   $amortizaciones = Amortizacion::where('id_inversion', $request->id_inversion)
                               ->where('fecha_pago', '>=', $request->fecha_venta)
                               ->where('activo', true)
                               ->get();
   ```

2. **Actualizar registros:**
   ```php
   $count = $amortizaciones->each(function ($amortizacion) {
       $amortizacion->activo = false;
       $amortizacion->save();
   })->count();
   ```

3. **Retornar respuesta:**
   ```php
   return response()->json([
       'success' => true,
       'message' => 'Amortizaciones actualizadas correctamente',
       'count' => $count
   ]);
   ```

## Criterios de Actualización

- **id_inversion:** Debe coincidir exactamente con el ID de la inversión vendida
- **fecha_pago:** Debe ser mayor o igual a la fecha de venta ingresada
- **activo:** Solo se actualizarán registros que estén activos (activo = true)

## Notas Importantes

- Este endpoint es llamado automáticamente cuando se registra una venta de inversión
- La actualización es un soft delete (se cambia `activo` a `false`, no se elimina físicamente)
- El frontend espera una respuesta JSON con el número de registros afectados
