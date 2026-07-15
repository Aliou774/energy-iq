import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { Chart } from 'chart.js/auto';
import {
  PrelevementService, SalleService, CapteurService
} from '../../services/data.service';
import { Salle, Prelevement, DonneesCapteur } from '../../models/models';

interface OptionTarifaire {
  code:   string;
  label:  string;
  tranches: { min: number; max: number | null; prix: number }[];
}

@Component({
  selector: 'app-mesures',
  templateUrl: './mesures.component.html',
  styleUrls: ['./mesures.component.scss']
})
export class MesuresComponent implements OnInit, OnDestroy, AfterViewInit {

  salles: Salle[]             = [];
  selectedSalleId             = '';
  selectedSalle: Salle | null = null;
  derniereMesure: Prelevement | null = null;
  donneesCapteur: DonneesCapteur | null = null;
  historique: Prelevement[]   = [];

  // ── Grille tarifaire SENELEC ───────────────────────
  // Source : CRSE — Décision n°2025-140 — 1er janvier 2026
  readonly optionsTarifaires: OptionTarifaire[] = [
    {
      code: 'UD-PP', label: 'Domestique Petite Puissance (DPP)',
      tranches: [
        { min: 0,   max: 150,  prix: 82.00  },
        { min: 151, max: 250,  prix: 136.49 },
        { min: 251, max: null, prix: 159.36 }
      ]
    },
    {
      code: 'UD-MP', label: 'Domestique Moyenne Puissance (DMP)',
      tranches: [
        { min: 0,   max: 50,   prix: 111.23 },
        { min: 51,  max: 300,  prix: 143.54 },
        { min: 301, max: null, prix: 158.46 }
      ]
    },
    {
      code: 'UP-PP', label: 'Professionnel Petite Puissance (PPP)',
      tranches: [
        { min: 0,   max: 50,   prix: 147.43 },
        { min: 51,  max: 500,  prix: 189.84 },
        { min: 501, max: null, prix: 208.63 }
      ]
    },
    {
      code: 'UP-MP', label: 'Professionnel Moyenne Puissance (PMP)',
      tranches: [
        { min: 0,   max: 100,  prix: 165.01 },
        { min: 101, max: 500,  prix: 191.01 },
        { min: 501, max: null, prix: 210.81 }
      ]
    }
  ];

  // UP-MP sélectionné par défaut (UCAD = professionnel)
  optionSelectionnee: OptionTarifaire = this.optionsTarifaires[3];

  readonly HEURES_JOUR  = 8;
  readonly JOURS_OUVRES = 22;

  private chartTemp:  Chart | null = null;
  private chartPower: Chart | null = null;
  private subs: Subscription[]     = [];
  private intervalHorsLigne: any   = null;

  constructor(
    private prelSvc:    PrelevementService,
    private salleSvc:   SalleService,
    private capteurSvc: CapteurService
  ) {}

  ngOnInit() {
    this.salleSvc.getAll().subscribe(salles => {
      this.salles = salles;
      if (salles.length) this.selectSalle(salles[0].idSalle || salles[0].id || '');
    });
    this.intervalHorsLigne = setInterval(() => {
      this.donneesCapteur = this.donneesCapteur ? { ...this.donneesCapteur } : null;
    }, 5000);
  }

  ngAfterViewInit() { setTimeout(() => this.initCharts(), 600); }

  selectSalle(id: string) {
    this.selectedSalleId = id;
    this.selectedSalle   = this.salles.find(s => (s.idSalle || s.id) === id) || null;
    this.subs.forEach(s => s.unsubscribe());
    this.subs = [];
    this.subs.push(
      this.capteurSvc.getDonneesSalle(id).subscribe(d => this.donneesCapteur = d),
      this.prelSvc.getDernierPrelevement(id).subscribe(m => this.derniereMesure = m),
      this.prelSvc.getHistorique(id).subscribe(h => {
        this.historique = h.slice(-50).reverse();
        this.updateCharts();
      })
    );
  }

  selectOption(code: string) {
    const opt = this.optionsTarifaires.find(o => o.code === code);
    if (opt) this.optionSelectionnee = opt;
  }

  // ── Hors-ligne ─────────────────────────────────────
  get estConnecte(): boolean  { return this.capteurSvc.estConnecte(this.donneesCapteur); }
  get presenceReelle(): boolean { return this.capteurSvc.presenceReelle(this.donneesCapteur); }

  // ── Grandeurs électriques ──────────────────────────
  get puissanceW(): number   { return this.derniereMesure?.puissance || 0; }
  get puissanceKw(): number  { return this.puissanceW / 1000; }

  // Énergie mensuelle estimée
  get energieMensuelleKwh(): number {
    return this.puissanceKw * this.HEURES_JOUR * this.JOURS_OUVRES;
  }

  // Afficher uniquement si puissance > 0
  get afficherTarif(): boolean { return this.puissanceW > 0; }

  // ── Tranche applicable ─────────────────────────────
  get trancheApplicable(): { min: number; max: number | null; prix: number; numero: number } | null {
    const tranches = this.optionSelectionnee.tranches;
    for (let i = 0; i < tranches.length; i++) {
      const t = tranches[i];
      if (t.max === null || this.energieMensuelleKwh <= t.max) {
        return { ...t, numero: i + 1 };
      }
    }
    return null;
  }

  get prixKwhActuel(): number  { return this.trancheApplicable?.prix    || 0; }
  get numeroTranche(): number  { return this.trancheApplicable?.numero  || 1; }

  get labelTranche(): string {
    const t = this.trancheApplicable;
    if (!t) return '';
    const suffix = t.numero === 1 ? 'ère' : 'ème';
    const plage  = t.max ? `${t.min}–${t.max} kWh` : `> ${t.min - 1} kWh`;
    return `${t.numero}${suffix} tranche · ${plage} · ${t.prix.toFixed(2)} FCFA/kWh`;
  }

  get classeTranche(): string {
    if (this.numeroTranche === 1) return 'tranche1';
    if (this.numeroTranche === 2) return 'tranche2';
    return 'tranche3';
  }

  // ── Calculs de coût ────────────────────────────────
  get coutHeure(): number     { return this.puissanceKw * this.prixKwhActuel; }
  get coutJournalier(): number { return this.puissanceKw * this.HEURES_JOUR * this.prixKwhActuel; }
  get coutMensuel(): number   { return this.puissanceKw * this.HEURES_JOUR * this.JOURS_OUVRES * this.prixKwhActuel; }

  // ── Graphiques ─────────────────────────────────────
  initCharts() {
    const ctxT = document.getElementById('chartTemp')  as HTMLCanvasElement;
    const ctxP = document.getElementById('chartPower') as HTMLCanvasElement;
    if (!ctxT || !ctxP) return;

    const opts = (color: string, label: string): any => ({
      type: 'line',
      data: { labels: [], datasets: [{ label, data: [],
        borderColor: color, backgroundColor: color + '15',
        tension: 0.4, fill: true, pointRadius: 3, borderWidth: 2
      }]},
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { labels: { color: '#0B2C35', font: {size:11} } } },
        scales: {
          x: { grid: {color:'rgba(159,183,182,0.15)'}, ticks: {color:'#9FB7B6', font:{size:10}, maxTicksLimit:8} },
          y: { grid: {color:'rgba(159,183,182,0.15)'}, ticks: {color:'#9FB7B6', font:{size:10}} }
        }
      }
    });

    this.chartTemp  = new Chart(ctxT, opts('#bf360c', 'Température (°C)'));
    this.chartPower = new Chart(ctxP, opts('#0F4C5C', 'Puissance (W)'));
    this.updateCharts();
  }

  updateCharts() {
    if (!this.historique.length) return;
    const labels = this.historique.slice(0,20).map((_,i) => `T-${i}`).reverse();
    const temps  = this.historique.slice(0,20).map(h => h.temperature).reverse();
    const powers = this.historique.slice(0,20).map(h => h.puissance).reverse();
    if (this.chartTemp)  { this.chartTemp.data.labels  = labels; this.chartTemp.data.datasets[0].data  = temps;  this.chartTemp.update('none'); }
    if (this.chartPower) { this.chartPower.data.labels = labels; this.chartPower.data.datasets[0].data = powers; this.chartPower.update('none'); }
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    if (this.chartTemp)         { this.chartTemp.destroy();  this.chartTemp  = null; }
    if (this.chartPower)        { this.chartPower.destroy(); this.chartPower = null; }
    if (this.intervalHorsLigne) { clearInterval(this.intervalHorsLigne); }
  }
}