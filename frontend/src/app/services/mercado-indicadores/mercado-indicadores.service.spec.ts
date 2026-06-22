import { TestBed } from '@angular/core/testing';

import { MercadoIndicadoresService } from './mercado-indicadores.service';

describe('MercadoIndicadoresService', () => {
  let service: MercadoIndicadoresService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MercadoIndicadoresService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
