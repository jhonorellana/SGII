import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface HistoricoIndicadorData {
  fecha_captura: string;
  patrimonio_base: number;
  patrimonio_consolidado: number;
  proyeccion_1_ano: number;
  patrimonio_proyectado_consolidado: number;
  intereses_esperados: number;
  total_corriente: number;
  dividendos_acciones: number;
  dividendos_efectivo: number;
  plusvalia_acciones: number;
  capital_renta_fija: number;
  capital_renta_variable: number;
  capital_notas_credito: number;
  valor_compra_nc: number;
  valor_venta_nc: number;
  utilidad_nc: number;
}

@Injectable({
  providedIn: 'root'
})
export class HistoricoIndicadorService {
  private apiUrl = `${environment.apiUrl}/historico-indicadores`;

  constructor(private http: HttpClient) {}

  guardarSnapshot(data: HistoricoIndicadorData, force: boolean = false): Observable<any> {
    const payload = { ...data, force };
    return this.http.post<any>(this.apiUrl, payload);
  }
}
