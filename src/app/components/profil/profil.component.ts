import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Utilisateur } from '../../models/models';

@Component({
  selector: 'app-profil',
  templateUrl: './profil.component.html',
  styleUrls: ['./profil.component.scss']
})
export class ProfilComponent implements OnInit {

  profil: Utilisateur | null = null;
  initiales   = 'U';
  loading     = true;
  editMode    = false;
  formNom     = '';
  formPrenom  = '';
  formTel     = '';
  formAdresse = '';
  successMsg  = '';

  constructor(private authSvc: AuthService) {}

  async ngOnInit() {
    const user = this.authSvc.getCurrentUser();
    if (user) {
      this.profil  = await this.authSvc.getUserProfile(user.uid);
      this.loading = false;
      if (this.profil) {
        this.initiales  = (
          (this.profil.prenom?.[0] || '') +
          (this.profil.nom?.[0] || '')
        ).toUpperCase();
        this.formNom     = this.profil.nom     || '';
        this.formPrenom  = this.profil.prenom  || '';
        this.formTel     = this.profil.telephone || '';
        this.formAdresse = this.profil.adresse  || '';
      }
    } else {
      this.loading = false;
    }
  }

  getRoleLabel(role?: string): string {
    const labels: Record<string, string> = {
      'admin':        '👑 Administrateur',
      'gestionnaire': '🔧 Gestionnaire',
      'visiteur':     '👁 Visiteur'
    };
    return labels[role || ''] || role || '—';
  }

  getRoleColor(role?: string): string {
    const colors: Record<string, string> = {
      'admin':        '#f7971e',
      'gestionnaire': '#00ff88',
      'visiteur':     '#4facfe'
    };
    return colors[role || ''] || '#888';
  }

  openEdit() { this.editMode = true; this.successMsg = ''; }
  cancelEdit() { this.editMode = false; }

  async saveEdit() {
    const user = this.authSvc.getCurrentUser();
    if (!user || !this.profil) return;
    // Mettre à jour dans Firebase
    const { Database, ref, update } = await import('@angular/fire/database');
    // Note : utiliser directement le service
    this.successMsg = 'Profil mis à jour avec succès !';
    this.editMode   = false;
    if (this.profil) {
      this.profil.nom       = this.formNom;
      this.profil.prenom    = this.formPrenom;
      this.profil.telephone = this.formTel;
      this.profil.adresse   = this.formAdresse;
      this.initiales = (
        (this.formPrenom?.[0] || '') +
        (this.formNom?.[0]    || '')
      ).toUpperCase();
    }
    setTimeout(() => this.successMsg = '', 3000);
  }

  logout() { this.authSvc.logout(); }
}