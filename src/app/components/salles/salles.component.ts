import { Component, OnInit } from '@angular/core';
import { SalleService, BatimentService } from '../../services/data.service';
import { AuthService } from '../../services/auth.service';
import { Salle, Batiment } from '../../models/models';

@Component({
  selector: 'app-salles',
  templateUrl: './salles.component.html',
  styleUrls: ['./salles.component.scss']
})
export class SallesComponent implements OnInit {
  salles: Salle[] = [];
  batiments: Batiment[] = [];
  showForm = false;
  form: Partial<Salle> = {};
  isEdit = false;
  searchTerm = '';

  // ── Rôle utilisateur connecté ──────────────────────
  userRole: 'admin' | 'gestionnaire' | 'visiteur' | null = null;

  typesSalles = [
    { value: 'amphi',         label: 'Amphithéâtre',            categorie: 'Pédagogique' },
    { value: 'salle_cours',   label: 'Salle de cours',          categorie: 'Pédagogique' },
    { value: 'salle_tp',      label: 'Salle TP / Laboratoire',  categorie: 'Pédagogique' },
    { value: 'salle_info',    label: 'Salle informatique',      categorie: 'Pédagogique' },
    { value: 'bibliotheque',  label: 'Bibliothèque',            categorie: 'Pédagogique' },
    { value: 'salle_exam',    label: "Salle d'examen",          categorie: 'Pédagogique' },
    { value: 'bureau',        label: 'Bureau',                  categorie: 'Administratif' },
    { value: 'secretariat',   label: 'Secrétariat',             categorie: 'Administratif' },
    { value: 'salle_reunion', label: 'Salle de réunion',        categorie: 'Administratif' },
    { value: 'direction',     label: 'Direction',               categorie: 'Administratif' },
    { value: 'chambre',       label: 'Chambre',                 categorie: 'Social' },
    { value: 'cafeteria',     label: 'Cafétéria',               categorie: 'Social' },
    { value: 'restaurant',    label: 'Restaurant universitaire', categorie: 'Social' },
    { value: 'salle_sport',   label: 'Salle de sport',          categorie: 'Social' },
    { value: 'infirmerie',    label: 'Infirmerie',              categorie: 'Social' },
    { value: 'foyer',         label: 'Foyer étudiant',          categorie: 'Social' },
    { value: 'couloir',       label: 'Couloir / Hall',          categorie: 'Autre' },
    { value: 'autre',         label: 'Autre',                   categorie: 'Autre' },
  ];

  constructor(
    private salleSvc:    SalleService,
    private batimentSvc: BatimentService,
    private authSvc:     AuthService
  ) {}

  ngOnInit() {
    this.salleSvc.getAll().subscribe(s => this.salles = s);
    this.batimentSvc.getAll().subscribe(b => this.batiments = b);
    this.loadUserRole();
  }

  // ── Rôle utilisateur ───────────────────────────────
  private async loadUserRole() {
    const user = this.authSvc.getCurrentUser();
    if (!user) { this.userRole = null; return; }
    const profil = await this.authSvc.getUserProfile(user.uid);
    this.userRole = profil?.role || null;
  }

  // Seuls admin et gestionnaire peuvent gérer les salles
  get peutGererSalles(): boolean {
    return this.userRole === 'admin' || this.userRole === 'gestionnaire';
  }

  // ── Getters ──────────────────────────────────────────────────

  get sallesFiltrees(): Salle[] {
    if (!this.searchTerm.trim()) return this.salles;
    const term = this.searchTerm.toLowerCase();
    return this.salles.filter(s =>
      s.nomSalle.toLowerCase().includes(term) ||
      s.typeSalle.toLowerCase().includes(term) ||
      this.getBatimentName(s.idBatiment).toLowerCase().includes(term)
    );
  }

  get categoriesTypes(): string[] {
    return [...new Set(this.typesSalles.map(t => t.categorie))];
  }

  // ── Méthodes utilitaires ─────────────────────────────────────

  getTypesByCategorie(cat: string) {
    return this.typesSalles.filter(t => t.categorie === cat);
  }

  getTypeLabel(value: string): string {
    return this.typesSalles.find(t => t.value === value)?.label || value;
  }

  getCategorie(value: string): string {
    return this.typesSalles.find(t => t.value === value)?.categorie || 'Autre';
  }

  getCategorieIcon(cat: string): string {
    const icons: Record<string, string> = {
      'Pédagogique':   '🎓',
      'Administratif': '🏢',
      'Social':        '🏠',
      'Autre':         '📦'
    };
    return icons[cat] || '📦';
  }

  getCategorieColor(value: string): string {
    const cat = this.getCategorie(value);
    const colors: Record<string, string> = {
      'Pédagogique':   '#00ff88',
      'Administratif': '#4facfe',
      'Social':        '#f7971e',
      'Autre':         'rgba(255,255,255,0.4)'
    };
    return colors[cat] || 'rgba(255,255,255,0.4)';
  }

  getBatimentName(idBatiment: string): string {
    return this.batiments.find(b =>
      (b.idBatiment || b.id) === idBatiment
    )?.nom || '—';
  }

  countByCategorie(categorie: string): number {
    return this.salles.filter(s =>
      this.getCategorie(s.typeSalle) === categorie
    ).length;
  }

  // ── CRUD — réservé admin/gestionnaire ────────────────────────

  openForm(salle?: Salle) {
    if (!this.peutGererSalles) return;
    this.isEdit = !!salle;
    this.form = salle ? { ...salle } : { typeSalle: 'salle_cours' };
    this.showForm = true;
  }

  save() {
    if (!this.peutGererSalles) return;
    if (!this.form.nomSalle || !this.form.typeSalle) return;
    if (this.isEdit) {
      const id = this.form.idSalle || this.form.id!;
      this.salleSvc.update(id, this.form);
    } else {
      this.salleSvc.add(this.form as Omit<Salle, 'idSalle' | 'id'>);
    }
    this.showForm = false;
    this.form = {};
  }

  delete(salle: Salle) {
    if (!this.peutGererSalles) return;
    const id = salle.idSalle || salle.id!;
    if (confirm(`Supprimer la salle "${salle.nomSalle}" ?`)) {
      this.salleSvc.delete(id);
    }
  }
}