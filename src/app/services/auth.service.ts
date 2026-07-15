import { Injectable }                    from '@angular/core';
import { Auth,
         signInWithEmailAndPassword,
         createUserWithEmailAndPassword,
         signOut,
         authState }                     from '@angular/fire/auth';
import { Database, ref, set, get }       from '@angular/fire/database';
import { Observable }                    from 'rxjs';
import { map }                           from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthService {

  user$: Observable<any>;

  constructor(
    private auth: Auth,
    private db:   Database
  ) {
    this.user$ = authState(this.auth);
  }

  // ── Connexion ──
  login(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  // ── Inscription ──
  register(email: string, password: string) {
    return createUserWithEmailAndPassword(this.auth, email, password);
  }

  // ── signup alias pour register (compatibilité) ──
  async signup(data: {
    nom:           string;
    prenom:        string;
    dateNaissance: string;
    email:         string;
    password:      string;
    role:          string;
    telephone?:    string;
    adresse?:      string;
  }): Promise<void> {
    const cred = await createUserWithEmailAndPassword(
      this.auth, data.email, data.password
    );
    await set(ref(this.db, `utilisateurs/${cred.user.uid}`), {
      nom:           data.nom,
      prenom:        data.prenom,
      dateNaissance: data.dateNaissance,
      email:         data.email,
      role:          data.role,
      telephone:     data.telephone  || '',
      adresse:       data.adresse    || ''
    });
    await signOut(this.auth);
  }

  // ── Déconnexion ──
  logout() {
    sessionStorage.removeItem('otp_verified');
    return signOut(this.auth);
  }

  // ── isLoggedIn observable (compatibilité app.component) ──
  isLoggedIn(): Observable<boolean> {
    return this.user$.pipe(
      map(user => !!user)
    );
  }

  // ── Profil utilisateur ──
  async getUserProfile(uid: string): Promise<any> {
    const snap = await get(ref(this.db, `utilisateurs/${uid}`));
    return snap.exists() ? snap.val() : null;
  }

  // ── Sauvegarder profil ──
  async saveUserProfile(uid: string, data: any): Promise<void> {
    await set(ref(this.db, `utilisateurs/${uid}`), data);
  }

  // ── Utilisateur courant ──
  getCurrentUser() {
    return this.auth.currentUser;
  }

  // ── UID courant ──
  getCurrentUid(): string | null {
    return this.auth.currentUser?.uid || null;
  }
}