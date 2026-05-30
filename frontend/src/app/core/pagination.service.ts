import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PaginationService {
  private readonly STORAGE_PREFIX = 'pagination_';

  /**
   * Obtiene la cantidad de filas por página guardada para un componente específico
   * @param componentKey Identificador único del componente (ej: 'inversiones', 'otrosValores')
   * @param defaultRows Valor por defecto si no hay configuración guardada
   */
  getRowsPerPage(componentKey: string, defaultRows: number = 10): number {
    const savedValue = localStorage.getItem(`${this.STORAGE_PREFIX}${componentKey}`);
    return savedValue ? parseInt(savedValue, 10) : defaultRows;
  }

  /**
   * Guarda la cantidad de filas por página para un componente específico
   * @param componentKey Identificador único del componente
   * @param rows Cantidad de filas por página
   */
  setRowsPerPage(componentKey: string, rows: number): void {
    localStorage.setItem(`${this.STORAGE_PREFIX}${componentKey}`, rows.toString());
  }

  /**
   * Limpia la configuración de paginación para un componente específico
   * @param componentKey Identificador único del componente
   */
  clearRowsPerPage(componentKey: string): void {
    localStorage.removeItem(`${this.STORAGE_PREFIX}${componentKey}`);
  }

  /**
   * Limpia todas las configuraciones de paginación
   */
  clearAll(): void {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(this.STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  }
}
