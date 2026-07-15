import { Component, OnInit } from '@angular/core';
import { EquipementService, SalleService } from '../../services/data.service';
import { AuthService } from '../../services/auth.service';
import { Equipement, Salle } from '../../models/models';

@Component({
  selector: 'app-equipements',
  templateUrl: './equipements.component.html',
  styleUrls: ['./equipements.component.scss']
})
export class EquipementsComponent implements OnInit {
  equipements: Equipement[] = [];
  salles: Salle[] = [];
  showForm = false;
  form: Partial<Equipement> = {};
  isEdit = false;
  searchTerm = '';
  filtreType = 'tous';

  // ── Rôle utilisateur connecté ──────────────────────
  userRole: 'admin' | 'gestionnaire' | 'visiteur' | null = null;

  constructor(
    private equipSvc: EquipementService,
    private salleSvc: SalleService,
    private authSvc:  AuthService
  ) {}

  ngOnInit() {
    this.equipSvc.getAll().subscribe(e => this.equipements = e);
    this.salleSvc.getAll().subscribe(s => this.salles = s);
    this.loadUserRole();
  }

  // ── Rôle utilisateur ───────────────────────────────
  private async loadUserRole() {
    const user = this.authSvc.getCurrentUser();
    if (!user) {
      this.userRole = null;
      return;
    }
    const profil = await this.authSvc.getUserProfile(user.uid);
    this.userRole = profil?.role || null;
  }

  // Seuls admin et gestionnaire peuvent piloter/gérer les équipements
  get peutGererEquipements(): boolean {
    return this.userRole === 'admin' || this.userRole === 'gestionnaire';
  }

  // ── Getters ──────────────────────────────────────────────────

  get equipementsFiltres(): Equipement[] {
    let list = this.equipements;
    if (this.filtreType !== 'tous') {
      list = list.filter(e => e.type === this.filtreType);
    }
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      list = list.filter(e =>
        e.nom.toLowerCase().includes(term) ||
        e.type.toLowerCase().includes(term) ||
        this.getSalleName(e.idSalle).toLowerCase().includes(term)
      );
    }
    return list;
  }

  get countLampes(): number {
    return this.equipements.filter(e => e.type === 'lampe').length;
  }

  get countVentilateurs(): number {
    return this.equipements.filter(e => e.type === 'ventilateur').length;
  }

  get countActifs(): number {
    return this.equipements.filter(e => e.etat).length;
  }

  get puissanceTotale(): number {
    return this.equipements
      .filter(e => e.etat)
      .reduce((sum, e) => sum + e.consommation, 0);
  }

  // ── Utilitaires ──────────────────────────────────────────────

  getSalleName(idSalle: string): string {
    return this.salles.find(s =>
      (s.idSalle || s.id) === idSalle
    )?.nomSalle || '—';
  }

  getTypeIcon(type: string): string {
    return type === 'lampe' ? '💡' : '🌀';
  }

  getTypeColor(type: string): string {
    return type === 'lampe' ? '#f7971e' : '#4facfe';
  }

  // ── CRUD — réservé admin/gestionnaire ───────────────────────

  openForm(eq?: Equipement) {
    if (!this.peutGererEquipements) return;
    this.isEdit = !!eq;
    this.form = eq ? { ...eq } : {
      type: 'lampe',
      etat: false,
      consommation: 60
    };
    this.showForm = true;
  }

  save() {
    if (!this.peutGererEquipements) return;
    if (!this.form.nom || !this.form.type || !this.form.idSalle) return;
    if (this.isEdit) {
      const id = this.form.idEquipement || this.form.id!;
      this.equipSvc.update(id, this.form);
    } else {
      this.equipSvc.add(this.form as Omit<Equipement, 'idEquipement' | 'id'>);
    }
    this.showForm = false;
    this.form = {};
  }

  toggle(eq: Equipement) {
    if (!this.peutGererEquipements) return;
    const id = eq.idEquipement || (eq as any).id;
    this.equipSvc.envoyerCommande(id, !eq.etat);
  }

  delete(eq: Equipement) {
    if (!this.peutGererEquipements) return;
    const id = eq.idEquipement || (eq as any).id;
    if (confirm(`Supprimer "${eq.nom}" ?`)) {
      this.equipSvc.delete(id);
    }
  }

  toutEteindre() {
    if (!this.peutGererEquipements) return;
    this.equipements.filter(e => e.etat).forEach(e => {
      const id = e.idEquipement || (e as any).id;
      this.equipSvc.envoyerCommande(id, false);
    });
  }
}