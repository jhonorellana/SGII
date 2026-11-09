import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PersonaOption {
  id_persona: number;
  nombres: string;
  apellidos: string;
  identificacion: string | null;
}

export interface PreviewItem {
  id_temporal: string;
  filename: string;
  bolsa: 'BVQ' | 'BVG' | 'DESCONOCIDA' | string;
  tipo_titulo: string;
  liquidacion: string;
  fecha_compra: string;
  comitente_nombre: string;
  comitente_identificacion: string;
  id_propietario: number | null;
  propietario_detectado: string | null;
  id_grupo_familiar: number;
  id_instrumento: number;
  valor_nominal: number;
  precio_compra: number;
  valor_efectivo: number;
  comision_bolsa: number;
  comision_casa_valores: number;
  capital_invertido: number;
  precio_neto_compra: number;
  factura_bolsa: string | null;
  operador_valores: string | null;
  estado: 'VALIDO' | 'DUPLICADO' | 'ERROR';
  inversion_existente_id?: number | null;
  mensaje_estado: string;
  seleccionado: boolean;
}

export interface PreviewResponse {
  success: boolean;
  data: {
    resumen: {
      total_archivos: number;
      validos: number;
      duplicados: number;
      con_error: number;
      total_nominal: number;
      total_invertido: number;
    };
    items: PreviewItem[];
    personas_disponibles: PersonaOption[];
  };
  message?: string;
}

export interface ConfirmResponse {
  success: boolean;
  message: string;
  data: {
    total_guardados: number;
    total_errores: number;
    guardados: any[];
    errores: any[];
  };
}

@Injectable({
  providedIn: 'root'
})
export class PdfImportService {
  private apiUrl = `${environment.apiUrl}/inversiones/importar-pdf`;

  constructor(private http: HttpClient) {}

  /**
   * Envía los archivos PDF para generar la previsualización y validación
   */
  previewFiles(files: File[]): Observable<PreviewResponse> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files[]', file, file.name);
    });

    return this.http.post<PreviewResponse>(`${this.apiUrl}/preview`, formData);
  }

  /**
   * Confirma y guarda en la base de datos las inversiones validadas
   */
  confirmImport(inversiones: PreviewItem[]): Observable<ConfirmResponse> {
    return this.http.post<ConfirmResponse>(`${this.apiUrl}/confirm`, {
      inversiones: inversiones
    });
  }
}
