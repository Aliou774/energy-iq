import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { Chart } from 'chart.js/auto';
import { PredictionService, SalleService } from '../../services/data.service';
import { PredictionML, Salle } from '../../models/models';

@Component({
  selector: 'app-predictions',
  templateUrl: './predictions.component.html',
  styleUrls: ['./predictions.component.scss']
})
export class PredictionsComponent implements OnInit, OnDestroy, AfterViewInit {

  predictions: PredictionML[] = [];
  salles: Salle[]              = [];
  maxConso                     = 1;
  selectedModele               = 'tous';
  modeles                      = ['tous', 'RandomForest', 'LSTM'];

  private chart: Chart | null  = null;
  private subs: Subscription[] = [];

  constructor(
    private predSvc:  PredictionService,
    private salleSvc: SalleService
  ) {}

  ngOnInit() {
    const s1 = this.salleSvc.getAll().subscribe(s => {
      this.salles = s || [];
    });
    const s2 = this.predSvc.getAll().subscribe(p => {
      this.predictions = p || [];
      this.maxConso    = Math.max(
        ...this.predictions.map(x => x.consoPredite || 0), 1
      );
      this.updateChart();
    });
    this.subs.push(s1, s2);
  }

  ngAfterViewInit() {
    setTimeout(() => this.initChart(), 600);
  }

  // ── Getters ──────────────────────────────────────────────────

  get predictionsFiltrees(): PredictionML[] {
    if (this.selectedModele === 'tous') return this.predictions;
    return this.predictions.filter(
      p => p.modele === this.selectedModele
    );
  }

  get moyConfiance(): number {
    if (!this.predictions.length) return 0;
    return parseFloat((
      this.predictions.reduce(
        (s, p) => s + (p.scoreConfiance || 0), 0
      ) / this.predictions.length * 100
    ).toFixed(1));
  }

  get consoMoyenne(): number {
    if (!this.predictions.length) return 0;
    return parseFloat((
      this.predictions.reduce(
        (s, p) => s + (p.consoPredite || 0), 0
      ) / this.predictions.length
    ).toFixed(2));
  }

  // ── Utilitaires ──────────────────────────────────────────────

  getSalleName(idSalle?: string): string {
    if (!idSalle) return '—';
    return this.salles.find(s =>
      (s.idSalle || s.id) === idSalle
    )?.nomSalle || idSalle;
  }

  getConfianceColor(score?: number): string {
    const s = (score || 0) * 100;
    if (s >= 85) return '#00ff88';
    if (s >= 70) return '#f7971e';
    return '#ff6464';
  }

  formatDate(d: string): string {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return d; }
  }

  // ── Actions ──────────────────────────────────────────────────

  genererPredictions() {
    if (!this.salles.length) {
      alert('Ajoutez d\'abord des salles.');
      return;
    }
    this.predSvc.simulerPredictions(
      this.salles.map(s => ({ id: s.idSalle || s.id || '' }))
    );
  }

  supprimerPrediction(p: PredictionML) {
    const id = p.idPrediction || (p as any).id;
    if (id) this.predSvc.delete(id);
  }

  // ── Chart ────────────────────────────────────────────────────

  initChart() {
    const ctx = document.getElementById('predChart') as HTMLCanvasElement;
    if (!ctx) return;
    if (this.chart) { this.chart.destroy(); this.chart = null; }

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: { labels: [], datasets: [{
        label: 'Consommation prédite (kWh)',
        data: [],
        backgroundColor: 'rgba(0,255,136,0.2)',
        borderColor: '#00ff88',
        borderWidth: 1.5,
        borderRadius: 6
      }, {
        label: 'Confiance (%)',
        data: [],
        backgroundColor: 'rgba(79,172,254,0.15)',
        borderColor: '#4facfe',
        borderWidth: 1.5,
        borderRadius: 6
      }]},
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            labels: { color: 'rgba(255,255,255,0.5)', font: {size:11} }
          }
        },
        scales: {
          x: { grid: {color:'rgba(255,255,255,0.04)'},
               ticks: {color:'rgba(255,255,255,0.3)', font:{size:10}} },
          y: { grid: {color:'rgba(255,255,255,0.04)'},
               ticks: {color:'rgba(255,255,255,0.3)', font:{size:10}} }
        }
      }
    });
    this.updateChart();
  }

  updateChart() {
    if (!this.chart) return;
    const data = this.predictionsFiltrees.slice(0, 8);
    this.chart.data.labels =
      data.map(p => this.getSalleName(p.idSalle));
    this.chart.data.datasets[0].data =
      data.map(p => p.consoPredite || 0);
    this.chart.data.datasets[1].data =
      data.map(p => (p.scoreConfiance || 0) * 100);
    this.chart.update('none');
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    if (this.chart) { this.chart.destroy(); this.chart = null; }
  }
}