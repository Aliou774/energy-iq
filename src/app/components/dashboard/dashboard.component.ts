import {
  Component, OnInit, OnDestroy, AfterViewInit,
  ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { Subscription } from 'rxjs';
import { Chart } from 'chart.js/auto';
import {
  SalleService, EquipementService, AlerteService,
  PredictionService, CapteurService, PrelevementService
} from '../../services/data.service';
import {
  Salle, Equipement, DonneesCapteur, PredictionML
} from '../../models/models';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent
  implements OnInit, OnDestroy, AfterViewInit {

  // KPIs
  moyTemperature  = 0;
  moyHumidite     = 0;
  tempTrend       = 0;
  economie        = 0;
  puissanceTotale = 0;
  sallesOccupees  = 0;
  totalSalles     = 0;
  alertesCount    = 0;
  alertesCritical = 0;
  alertesWarning  = 0;
  maxConso        = 1;

  // Données
  salles:       Salle[]       = [];
  predictions:  PredictionML[]= [];
  derniersMesures: any[]      = [];
  chartPeriod   = '1h';

  sallesStatus: any[] = [];

  private donneesCapteurs:      Record<string, DonneesCapteur> = {};
  private equipementsParSalle:  Record<string, Equipement[]>   = {};
  private mainChart:            Chart | null = null;
  private subs:                 Subscription[] = [];
  private chartTimer:           any = null;
  private refreshTimer:         any = null;
  private horsLigneTimer:       any = null;

  constructor(
    private salleSvc:   SalleService,
    private equipSvc:   EquipementService,
    private alerteSvc:  AlerteService,
    private predSvc:    PredictionService,
    private capteurSvc: CapteurService,
    private prelSvc:    PrelevementService,
    private cdr:        ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadEquipements();
    this.loadDonneesCapteurs();
    this.loadAlertes();
    this.loadPredictions();
    this.loadSalles();

    // Réévalue le statut hors-ligne et risque d'extinction
    // toutes les 5s, même sans nouvelle donnée Firebase
    this.horsLigneTimer = setInterval(() => {
      this.buildSallesStatus();
      this.buildDerniersMesures();
      this.recalcSallesOccupeesFiable();
      this.cdr.markForCheck();
    }, 5000);
  }

  ngAfterViewInit() {
    setTimeout(() => this.initChart(), 1000);
  }

  // ── Salles ─────────────────────────────────────────────────
  loadSalles() {
    const sub = this.salleSvc.getAll().subscribe({
      next: salles => {
        this.salles      = salles || [];
        this.totalSalles = this.salles.length;
        this.refreshAll();
      },
      error: err => console.error('Erreur salles :', err)
    });
    this.subs.push(sub);
  }

  // ── Capteurs ───────────────────────────────────────────────
  loadDonneesCapteurs() {
    const sub = this.capteurSvc.getToutesLesDonnees().subscribe({
      next: donnees => {
        this.donneesCapteurs = donnees || {};
        this.recalcKPIs();
        this.refreshAll();
        this.throttleChart();
      },
      error: err => console.error('Erreur capteurs :', err)
    });
    this.subs.push(sub);
  }

  // ── Équipements ────────────────────────────────────────────
  loadEquipements() {
    const sub = this.equipSvc.getAll().subscribe({
      next: equips => {
        this.equipementsParSalle = {};
        (equips || []).forEach(e => {
          if (!this.equipementsParSalle[e.idSalle]) {
            this.equipementsParSalle[e.idSalle] = [];
          }
          this.equipementsParSalle[e.idSalle].push(e);
        });
        this.recalcPuissance();
        this.refreshAll();
      },
      error: err => console.error('Erreur équipements :', err)
    });
    this.subs.push(sub);
  }

  // ── Prédictions ────────────────────────────────────────────
  loadPredictions() {
    const sub = this.predSvc.getAll().subscribe({
      next: preds => {
        this.predictions = (preds || []).slice(0, 5);
        this.maxConso    = Math.max(
          ...this.predictions.map(p => p.consoPredite || 0), 1
        );
        this.cdr.markForCheck();
      },
      error: err => console.error('Erreur prédictions :', err)
    });
    this.subs.push(sub);
  }

  // ── Alertes ────────────────────────────────────────────────
  loadAlertes() {
    const sub = this.alerteSvc.getAll().subscribe({
      next: a => {
        this.alertesCount    = (a || []).length;
        this.alertesCritical = (a || []).filter(x => x.niveau === 'critical').length;
        this.alertesWarning  = (a || []).filter(x => x.niveau === 'warning').length;
        this.cdr.markForCheck();
      },
      error: err => console.error('Erreur alertes :', err)
    });
    this.subs.push(sub);
  }

  // ── Calculs ────────────────────────────────────────────────
  recalcKPIs() {
    const vals = Object.values(this.donneesCapteurs || {})
      .filter(d => this.capteurSvc.estConnecte(d));

    if (!vals.length) {
      this.moyTemperature = 0;
      this.moyHumidite    = 0;
      this.sallesOccupees = 0;
      return;
    }

    const prev          = this.moyTemperature;
    this.moyTemperature = parseFloat(
      (vals.reduce((s, d) => s + (d.temperature || 0), 0) / vals.length).toFixed(1)
    );
    this.tempTrend    = parseFloat((this.moyTemperature - prev).toFixed(1));
    this.moyHumidite  = parseFloat(
      (vals.reduce((s, d) => s + (d.humidite || 0), 0) / vals.length).toFixed(1)
    );

    this.sallesOccupees = vals.filter(d => d.presence).length;
  }

  recalcSallesOccupeesFiable() {
    const vals = Object.values(this.donneesCapteurs || {});
    this.sallesOccupees = vals.filter(d =>
      this.capteurSvc.presenceReelle(d)
    ).length;
  }

  recalcPuissance() {
    let total = 0, eco = 0;
    Object.entries(this.equipementsParSalle || {}).forEach(([id, equips]) => {
      const c = this.donneesCapteurs?.[id];
      const connecte = this.capteurSvc.estConnecte(c || null);

      equips.filter(e => e.etat).forEach(e => total += e.consommation);

      if (connecte && c && !c.presence) {
        equips.filter(e => e.etat).forEach(e => eco += e.consommation);
      }
    });
    this.puissanceTotale = total;
    this.economie        = eco;
  }

  // ── Refresh centralisé avec throttle ───────────────────────
  private refreshAll() {
    if (this.refreshTimer) return;
    this.refreshTimer = setTimeout(() => {
      this.buildSallesStatus();
      this.buildDerniersMesures();
      this.recalcPuissance();
      this.cdr.markForCheck();
      this.refreshTimer = null;
    }, 500);
  }

  // ── Construire sallesStatus ─────────────────────────────────
  private buildSallesStatus() {
    this.sallesStatus = this.salles.map(s => {
      const id     = s.idSalle || s.id || '';
      const c      = this.donneesCapteurs?.[id] || null;
      const equips = this.equipementsParSalle?.[id] || [];

      const connecte       = this.capteurSvc.estConnecte(c);
      const presenceFiable = this.capteurSvc.presenceReelle(c);

      const lampeOn   = equips.find(e => e.type === 'lampe')?.etat       || false;
      const ventiloOn = equips.find(e => e.type === 'ventilateur')?.etat || false;

      // Risque d'extinction automatique par l'ESP32 :
      // capteur connecté, pas de présence détectée,
      // et au moins un équipement encore allumé
      const risqueExtinctionAuto =
        connecte && !presenceFiable && (lampeOn || ventiloOn);

      return {
        idSalle:   id,
        nomSalle:  s.nomSalle,
        typeSalle: s.typeSalle,
        presence:  presenceFiable,
        temp:      connecte ? (c?.temperature || 0) : 0,
        humidite:  connecte ? (c?.humidite    || 0) : 0,
        lampeOn,
        ventiloOn,
        actifs:    equips.filter(e => e.etat).length,
        puissance: equips.filter(e => e.etat)
                         .reduce((s, e) => s + e.consommation, 0),
        connecte,
        risqueExtinctionAuto
      };
    });
  }

  private buildDerniersMesures() {
    this.derniersMesures = this.salles
      .map(s => {
        const id = s.idSalle || s.id || '';
        const c  = this.donneesCapteurs?.[id] || null;
        if (!c) return null;

        const connecte = this.capteurSvc.estConnecte(c);

        return {
          nomSalle:    s.nomSalle,
          temperature: c.temperature || 0,
          humidite:    c.humidite    || 0,
          presence:    connecte ? (c.presence || false) : false,
          puissance:   (this.equipementsParSalle?.[id] || [])
                         .filter(e => e.etat)
                         .reduce((s, e) => s + e.consommation, 0),
          timestamp:   c.timestamp || '',
          connecte
        };
      })
      .filter(Boolean);
  }

  // ── Getters template ───────────────────────────────────────
  getPredNomSalle(idSalle?: string): string {
    if (!idSalle) return '—';
    return this.salles.find(s =>
      (s.idSalle || s.id) === idSalle
    )?.nomSalle || idSalle;
  }

  // ── Commandes manuelles (allumage uniquement
  //    recommandé — l'extinction peut être reprise
  //    automatiquement par l'ESP32 selon les règles
  //    d'absence/température embarquées) ───────────
  toggleEquipementSalle(
    salle: any,
    type: 'lampe' | 'ventilateur'
  ) {
    const equips = this.equipementsParSalle?.[salle.idSalle] || [];
    const eq     = equips.find(e => e.type === type);
    if (eq) {
      const id = eq.idEquipement || (eq as any).id;
      this.equipSvc.envoyerCommande(id, !eq.etat);
    }
  }

  setChartPeriod(p: string) {
    this.chartPeriod = p;
    this.cdr.markForCheck();
  }

  // ── Chart ──────────────────────────────────────────────────
  private throttleChart() {
    if (this.chartTimer) return;
    this.chartTimer = setTimeout(() => {
      this.updateChart();
      this.chartTimer = null;
    }, 5000);
  }

  initChart() {
    const canvas = document.getElementById('mainChart') as HTMLCanvasElement;
    if (!canvas) return;
    if (this.mainChart) { this.mainChart.destroy(); this.mainChart = null; }

    this.mainChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: Array.from({length: 12}, (_, i) => `${i * 5}min`),
        datasets: [
          {
            label: 'Puissance (W)',
            data:  Array.from({length: 12}, () => 0),
            borderColor: '#0F4C5C', backgroundColor: 'rgba(15,76,92,0.08)',
            tension: 0.4, fill: true, pointBackgroundColor: '#0F4C5C',
            pointRadius: 3, borderWidth: 2
          },
          {
            label: 'Prédiction (W)',
            data:  Array.from({length: 12}, () => 0),
            borderColor: '#9FB7B6', backgroundColor: 'rgba(159,183,182,0.08)',
            tension: 0.4, fill: false, borderDash: [5,4],
            pointRadius: 2, borderWidth: 1.5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            labels: { color: '#0B2C35', font: {size: 12}, boxWidth: 12 }
          },
          tooltip: {
            backgroundColor: '#061A1F', borderColor: 'rgba(15,76,92,0.3)',
            borderWidth: 1, titleColor: '#F2EFEA',
            bodyColor: 'rgba(242,239,234,0.8)', padding: 10
          }
        },
        scales: {
          x: { grid: {color: 'rgba(159,183,182,0.15)'},
               ticks: {color: '#9FB7B6', font: {size: 11}} },
          y: { grid: {color: 'rgba(159,183,182,0.15)'},
               ticks: {color: '#9FB7B6', font: {size: 11}} }
        }
      }
    });
  }

  updateChart() {
    if (!this.mainChart) return;
    const data = this.mainChart.data.datasets[0].data as number[];
    data.push(this.puissanceTotale);
    if (data.length > 20) data.shift();
    this.mainChart.update('none');
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    if (this.chartTimer)     clearTimeout(this.chartTimer);
    if (this.refreshTimer)   clearTimeout(this.refreshTimer);
    if (this.horsLigneTimer) clearInterval(this.horsLigneTimer);
    if (this.mainChart)      { this.mainChart.destroy(); this.mainChart = null; }
  }
}