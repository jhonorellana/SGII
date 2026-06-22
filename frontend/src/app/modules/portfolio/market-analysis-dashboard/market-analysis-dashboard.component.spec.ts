import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MarketAnalysisDashboardComponent } from './market-analysis-dashboard.component';

import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('MarketAnalysisDashboardComponent', () => {
  let component: MarketAnalysisDashboardComponent;
  let fixture: ComponentFixture<MarketAnalysisDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketAnalysisDashboardComponent, HttpClientTestingModule]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MarketAnalysisDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
