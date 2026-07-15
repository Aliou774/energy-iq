import { Component }    from '@angular/core';
import { Router }       from '@angular/router';
import { AuthService }  from '../../services/auth.service';

@Component({
  selector:    'app-register',
  templateUrl: './register.component.html',
  styleUrls:   ['./register.component.scss']
})
export class RegisterComponent {

  nom           = '';
  prenom        = '';
  dateNaissance = '';
  email         = '';
  password      = '';
  role          = 'gestionnaire';
  telephone     = '';
  adresse       = '';
  showPw        = false;
  loading       = false;
  errorMessage  = '';

  constructor(
    private authService: AuthService,
    private router:      Router
  ) {}

  async register() {
    if (!this.nom || !this.prenom || !this.email ||
        !this.password || !this.dateNaissance) {
      this.errorMessage = 'Veuillez remplir tous les champs obligatoires.';
      return;
    }

    if (this.password.length < 6) {
      this.errorMessage = 'Le mot de passe doit contenir au moins 6 caractères.';
      return;
    }

    this.loading      = true;
    this.errorMessage = '';

    try {
      await this.authService.signup({
        nom:           this.nom,
        prenom:        this.prenom,
        dateNaissance: this.dateNaissance,
        email:         this.email,
        password:      this.password,
        role:          this.role,
        telephone:     this.telephone,
        adresse:       this.adresse
      });

      this.router.navigate(['/login']);

    } catch (err: any) {
      console.error('Erreur inscription:', err);
      if (err.code === 'auth/email-already-in-use') {
        this.errorMessage = 'Cette adresse email est déjà utilisée.';
      } else if (err.code === 'auth/invalid-email') {
        this.errorMessage = 'Adresse email invalide.';
      } else if (err.code === 'auth/weak-password') {
        this.errorMessage = 'Mot de passe trop faible (6 caractères minimum).';
      } else {
        this.errorMessage = 'Erreur lors de l\'inscription. Réessayez.';
      }
    } finally {
      this.loading = false;
    }
  }
}