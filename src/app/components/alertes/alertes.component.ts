import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import {
  AlerteService, SalleService,
  CapteurService, EquipementService
} from '../../services/data.service';
import { AuthService } from '../../services/auth.service';
import { Alerte, Salle, DonneesCapteur, Equipement } from '../../models/models';

@Component({
  selector: 'app-alertes',
  templateUrl: './alertes.component.html',
  styleUrls: ['./alertes.component.scss']
})
export class AlertesComponent implements OnInit, OnDestroy {

  alertes: Alerte[]  = [];
  salles: Salle[]    = [];
  filtreNiveau       = 'tous';
  filtreLue          = 'toutes';
  searchTerm         = '';

  // ── Rôle utilisateur ───────────────────────────────
  userRole: 'admin' | 'gestionnaire' | 'visiteur' | null = null;

  // ── Données temps réel pour supervision ────────────
  private donneesCapteurs: Record<string, DonneesCapteur> = {};
  private equipementsParSalle: Record<string, Equipement[]> = {};

  // ── Verrou anti-régénération après suppression ─────
  private suppressionEnCours       = false;
  private delaiApresSuppressionMs  = 20000; // 20s

  private subs: Subscription[]     = [];
  private supervisionInterval: any = null;

  niveaux = ['tous', 'warning', 'critical'];

  constructor(
    private alerteSvc:  AlerteService,
    private salleSvc:   SalleService,
    private capteurSvc: CapteurService,
    private equipSvc:   EquipementService,
    private authSvc:    AuthService
  ) {}

  ngOnInit() {
    this.loadUserRole();

    const s1 = this.alerteSvc.getAll().subscribe(a => {
      this.alertes = a || [];
    });
    const s2 = this.salleSvc.getAll().subscribe(s => {
      this.salles = s || [];
    });
    const s3 = this.capteurSvc.getToutesLesDonnees().subscribe(d => {
      this.donneesCapteurs = d || {};
    });
    const s4 = this.equipSvc.getAll().subscribe(equips => {
      this.equipementsParSalle = {};
      (equips || []).forEach(e => {
        if (!this.equipementsParSalle[e.idSalle])
          this.equipementsParSalle[e.idSalle] = [];
        this.equipementsParSalle[e.idSalle].push(e);
      });
    });

    this.subs.push(s1, s2, s3, s4);

    // Supervision automatique toutes les 15 secondes
    this.supervisionInterval = setInterval(() => {
      this.evaluerAlertes();
    }, 15000);
  }

  // ── Rôle ────────────────────────────────────────────
  private async loadUserRole() {
    const user = this.authSvc.getCurrentUser();
    if (!user) { this.userRole = null; return; }
    const profil = await this.authSvc.getUserProfile(user.uid);
    this.userRole = profil?.role || null;
  }

  get peutGererAlertes(): boolean {
    return this.userRole === 'admin' || this.userRole === 'gestionnaire';
  }

  // ── Verrou anti-régénération ────────────────────────
  private pauserSupervision() {
    this.suppressionEnCours = true;
    setTimeout(() => {
      this.suppressionEnCours = false;
    }, this.delaiApresSuppressionMs);
  }

  // ══════════════════════════════════════════════════
  //  ÉVALUATION AUTOMATIQUE DES ALERTES
  // ══════════════════════════════════════════════════

  private evaluerAlertes() {
    // Ne pas régénérer pendant les 20s après une suppression
    if (this.suppressionEnCours) return;

    this.salles.forEach(salle => {
      const id  = salle.idSalle || salle.id || '';
      const nom = salle.nomSalle;
      const d   = this.donneesCapteurs[id];

      if (!d) return;

      const connecte = this.capteurSvc.estConnecte(d);

      // ── A) Capteur hors ligne ─────────────────────
      if (!connecte) {
        this.alerteSvc.genererSiAbsent(
          id, 'hors_ligne',
          `Capteur hors ligne — ${nom} : aucune donnée reçue depuis plus de 30s`,
          'critical'
        );
        return;
      }

      // ── B) Température trop élevée ────────────────
      if (d.temperature > 35) {
        this.alerteSvc.genererSiAbsent(
          id, 'temperature',
          `Température élevée dans ${nom} : ${d.temperature.toFixed(1)}°C`,
          'critical'
        );
      }

      // ── C) Humidité anormale ──────────────────────
      if (d.humidite > 80) {
        this.alerteSvc.genererSiAbsent(
          id, 'humidite',
          `Humidité anormale dans ${nom} : ${d.humidite.toFixed(0)}%`,
          'warning'
        );
      }

      // ── D) Équipement ON sans présence ────────────
      const equips        = this.equipementsParSalle[id] || [];
      const equipsAllumes = equips.filter(e => e.etat);
      const presence      = this.capteurSvc.presenceReelle(d);

      if (equipsAllumes.length > 0 && !presence) {
        const noms = equipsAllumes.map(e => e.nom).join(', ');
        this.alerteSvc.genererSiAbsent(
          id, 'absence',
          `Équipement(s) allumé(s) sans présence dans ${nom} : ${noms}`,
          'warning'
        );
      }

      // ── E) Consommation anormale ──────────────────
      if (d.puissance && d.puissance > 200) {
        this.alerteSvc.genererSiAbsent(
          id, 'anomalie',
          `Consommation anormale dans ${nom} : ${d.puissance.toFixed(0)}W`,
          'warning'
        );
      }
    });
  }

  // ── Getters ──────────────────────────────────────────────────

  get alertesFiltrees(): Alerte[] {
    return this.alertes.filter(a => {
      const matchNiveau = this.filtreNiveau === 'tous' ||
                          a.niveau === this.filtreNiveau;
      const matchLue    = this.filtreLue === 'toutes' ||
                          (this.filtreLue === 'non_lues' && !a.lue) ||
                          (this.filtreLue === 'lues' && a.lue);
      const matchSearch = !this.searchTerm ||
                          a.message.toLowerCase()
                            .includes(this.searchTerm.toLowerCase()) ||
                          this.getSalleName(a.idSalle)
                            .toLowerCase()
                            .includes(this.searchTerm.toLowerCase());
      return matchNiveau && matchLue && matchSearch;
    });
  }

  get countNonLues(): number {
    return this.alertes.filter(a => !a.lue).length;
  }
  get countCritical(): number {
    return this.alertes.filter(a => a.niveau === 'critical').length;
  }
  get countWarning(): number {
    return this.alertes.filter(a => a.niveau === 'warning').length;
  }

  // ── Utilitaires ──────────────────────────────────────────────

  getSalleName(idSalle?: string): string {
    if (!idSalle) return '—';
    return this.salles.find(s =>
      (s.idSalle || s.id) === idSalle
    )?.nomSalle || idSalle;
  }

  getNiveauIcon(niveau: string): string {
    return niveau === 'critical' ? '🔴' : '🟡';
  }

  getNiveauLabel(niveau: string): string {
    return niveau === 'critical' ? 'Critique' : 'Avertissement';
  }

  getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      'temperature': '🌡️',
      'humidite':    '💧',
      'absence':     '👤',
      'anomalie':    '⚡',
      'hors_ligne':  '📡',
    };
    return icons[type] || '🔔';
  }

  getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'temperature': 'Température élevée',
      'humidite':    'Humidité anormale',
      'absence':     'Équipement sans présence',
      'anomalie':    'Consommation anormale',
      'hors_ligne':  'Capteur hors ligne',
    };
    return labels[type] || type;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return dateStr; }
  }

  // ── Actions — réservées admin/gestionnaire ────────────────────

  marquerLue(a: Alerte) {
    if (!this.peutGererAlertes) return;
    const id = a.idAlerte || (a as any).id;
    if (id) this.alerteSvc.marquerLue(id);
  }

  marquerToutesLues() {
    if (!this.peutGererAlertes) return;
    const nonLues = this.alertes.filter(a => !a.lue);
    if (nonLues.length === 0) return;
    this.alerteSvc.marquerToutesLues(nonLues);
  }

  supprimerAlerte(a: Alerte) {
    if (!this.peutGererAlertes) return;
    const id = a.idAlerte || (a as any).id;
    if (id && confirm('Supprimer cette alerte ?')) {
      this.alerteSvc.delete(id);
      this.pauserSupervision();
    }
  }

  supprimerToutes() {
    if (!this.peutGererAlertes) return;
    if (!this.alertes.length) return;
    if (confirm(`Supprimer toutes les ${this.alertes.length} alertes ?`)) {
      this.alerteSvc.deleteAll(this.alertes);
      this.pauserSupervision();
    }
  }

  resetFiltres() {
    this.filtreNiveau = 'tous';
    this.filtreLue    = 'toutes';
    this.searchTerm   = '';
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    if (this.supervisionInterval) clearInterval(this.supervisionInterval);
  }
}