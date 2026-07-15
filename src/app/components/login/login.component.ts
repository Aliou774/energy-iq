import { Component, OnDestroy } from '@angular/core';
import { Router }               from '@angular/router';
import { AuthService }          from '../../services/auth.service';
import { OtpService }           from '../../services/otp.service';
import { Auth, signOut }        from '@angular/fire/auth';

@Component({
  selector:    'app-login',
  templateUrl: './login.component.html',
  styleUrls:   ['./login.component.scss']
})
export class LoginComponent implements OnDestroy {

  // Étape 1
  email        = '';
  password     = '';
  showPassword = false;
  loading      = false;
  errorMessage = '';

  // Étape 2 OTP
  step       = 1;
  otpCode    = '';
  otpLoading = false;
  otpError   = '';
  otpTimer   = 600;
  timerInterval: any;

  // Infos temporaires
  currentUid   = '';
  currentNom   = '';
  currentEmail = '';

  constructor(
    private authService: AuthService,
    private otpService:  OtpService,
    private auth:        Auth,
    private router:      Router
  ) {
    // Nettoyer le flag OTP au chargement du login
    sessionStorage.removeItem('otp_verified');
  }

  // ── Étape 1 : Login ──
  async login() {
    this.loading      = true;
    this.errorMessage = '';

    try {
      // 1. Connexion Firebase
      const result = await this.authService
        .login(this.email, this.password);

      // 2. Récupérer le profil
      const profil = await this.authService
        .getUserProfile(result.user.uid);

      if (!profil) {
        await signOut(this.auth);
        this.errorMessage =
          'Compte non reconnu. Contactez l\'administrateur.';
        this.loading = false;
        return;
      }

      // 3. Stocker infos temporaires
      this.currentUid   = result.user.uid;
      this.currentEmail = this.email;
      this.currentNom   =
        `${profil['prenom'] || ''} ${profil['nom'] || ''}`.trim();

      // 4. Envoyer OTP
      await this.otpService.sendOtp(
        this.currentUid,
        this.currentEmail,
        this.currentNom
      );

      // 5. Déconnecter Firebase temporairement
      await signOut(this.auth);

      // 6. Passer à l'étape OTP
      this.step = 2;
      this.startTimer();

    } catch (err: any) {
      console.error('Code erreur Firebase:', err.code);
      console.error('Message erreur Firebase:', err.message);

      switch (err.code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
          this.errorMessage = 'Mot de passe incorrect.';
          break;
        case 'auth/user-not-found':
          this.errorMessage = 'Aucun compte avec cet email.';
          break;
        case 'auth/invalid-email':
          this.errorMessage = 'Format email invalide.';
          break;
        case 'auth/too-many-requests':
          this.errorMessage =
            'Trop de tentatives. Réessayez dans quelques minutes.';
          break;
        case 'auth/network-request-failed':
          this.errorMessage =
            'Erreur réseau. Vérifiez votre connexion.';
          break;
        default:
          this.errorMessage =
            `Erreur de connexion. Vérifiez vos identifiants.`;
      }
    } finally {
      this.loading = false;
    }
  }

  // ── Étape 2 : Vérification OTP ──
  async verifierOtp() {
    if (this.otpCode.length !== 6) {
      this.otpError = 'Entrez un code à 6 chiffres.';
      return;
    }

    this.otpLoading = true;
    this.otpError   = '';

    try {
      // 1. Reconnexion temporaire pour accéder à Firebase
      await this.authService.login(this.email, this.password);

      // 2. Vérifier le code OTP
      const check = await this.otpService
        .verifyOtp(this.currentUid, this.otpCode);

      if (check.valid) {
        // 3. OTP correct → poser le flag
        sessionStorage.setItem('otp_verified', 'true');
        this.stopTimer();

        // 4. ← Rediriger vers /accueil
        this.router.navigate(['/accueil']);

      } else {
        // OTP incorrect → déconnecter et afficher erreur
        await signOut(this.auth);
        this.otpError = check.error || 'Code invalide.';
        this.otpCode  = '';

        if (check.error?.includes('expiré') ||
            check.error?.includes('tentatives')) {
          setTimeout(() => this.retourLogin(), 2500);
        }
      }

    } catch (err) {
      console.error('Erreur OTP:', err);
      await signOut(this.auth).catch(() => {});
      this.otpError = 'Erreur de vérification. Réessayez.';
    } finally {
      this.otpLoading = false;
    }
  }

  // ── Renvoyer le code ──
  async renvoyerCode() {
    this.otpError   = '';
    this.otpCode    = '';
    this.otpLoading = true;

    try {
      await this.authService.login(this.email, this.password);
      await this.otpService.sendOtp(
        this.currentUid,
        this.currentEmail,
        this.currentNom
      );
      await signOut(this.auth);
      this.resetTimer();
    } catch {
      this.otpError = 'Impossible de renvoyer le code.';
    } finally {
      this.otpLoading = false;
    }
  }

  // ── Retour étape 1 ──
  async retourLogin() {
    this.stopTimer();
    await signOut(this.auth).catch(() => {});
    sessionStorage.removeItem('otp_verified');
    this.step         = 1;
    this.otpCode      = '';
    this.otpError     = '';
    this.errorMessage = '';
    this.password     = '';
    this.currentUid   = '';
    this.currentEmail = '';
    this.currentNom   = '';
  }

  // ── Timer ──
  startTimer() {
    this.otpTimer = 600;
    this.timerInterval = setInterval(() => {
      this.otpTimer--;
      if (this.otpTimer <= 0) {
        this.stopTimer();
        this.otpError =
          'Code expiré. Veuillez vous reconnecter.';
        setTimeout(() => this.retourLogin(), 2500);
      }
    }, 1000);
  }

  resetTimer() {
    this.stopTimer();
    this.startTimer();
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  get timerFormate(): string {
    const m = Math.floor(this.otpTimer / 60)
      .toString().padStart(2, '0');
    const s = (this.otpTimer % 60)
      .toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  onOtpInput(event: Event) {
    const input = event.target as HTMLInputElement;
    input.value = input.value
      .replace(/[^0-9]/g, '')
      .slice(0, 6);
    this.otpCode = input.value;
  }

  ngOnDestroy() {
    this.stopTimer();
  }
}