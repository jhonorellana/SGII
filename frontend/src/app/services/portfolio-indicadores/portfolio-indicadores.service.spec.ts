import { TestBed } from '@angular/core/testing';

import { PortfolioIndicadoresService } from './portfolio-indicadores.service';

describe('PortfolioIndicadoresService', () => {
  let service: PortfolioIndicadoresService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PortfolioIndicadoresService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
