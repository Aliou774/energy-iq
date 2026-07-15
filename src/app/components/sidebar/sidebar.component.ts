import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd }        from '@angular/router';
import { Subscription }                 from 'rxjs';
import { filter }                       from 'rxjs/operators';
import { AuthService }                  from '../../services/auth.service';
import { Database, ref, onValue,
         off }                          from '@angular/fire/database';

@Component({
  selector:    'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls:   ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit, OnDestroy {

  collapsed    = false;
  activeRoute  = '';
  alertesCount = 0;

  utilisateur: any = null;

  private subs:    Subscription[] = [];
  private alertRef: any           = null;

  navItems = [
    {
      label: 'Dashboard',
      route: '/dashboard',
      badge: false,
      icon:  `<svg width="18" height="18" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>`
    },
    {
      label: 'Salles',
      route: '/salles',
      badge: false,
      icon:  `<svg width="18" height="18" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5
                         a2 2 0 01-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>`
    },
    {
      label: 'Équipements',
      route: '/equipements',
      badge: false,
      icon:  `<svg width="18" height="18" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.07 4.93a10 10 0 010 14.14
                         M4.93 4.93a10 10 0 000 14.14"/>
              </svg>`
    },
    {
      label: 'Mesures',
      route: '/mesures',
      badge: false,
      icon:  `<svg width="18" height="18" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round">
                <polyline points="22 12 18 12 15 21
                                   9 3 6 12 2 12"/>
              </svg>`
    },
    {
      label: 'Prédictions ML',
      route: '/predictions',
      badge: false,
      icon:  `<svg width="18" height="18" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27
                                  17 14.14 18.18 21.02 12 17.77
                                  5.82 21.02 7 14.14 2 9.27
                                  8.91 8.26 12 2"/>
              </svg>`
    },
    {
      label: 'Alertes',
      route: '/alertes',
      badge: true,
      icon:  `<svg width="18" height="18" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18
                         s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 01-3.46 0"/>
              </svg>`
    }
  ];

  constructor(
    private authService: AuthService,
    private db:          Database,
    private router:      Router
  ) {}

  ngOnInit() {
    // Route active
    this.activeRoute = this.router.url;
    const routeSub = this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe(e => {
      this.activeRoute = e.urlAfterRedirects;
    });
    this.subs.push(routeSub);

    // Profil utilisateur
    const userSub = this.authService.user$.subscribe(
      async (user: any) => {
        if (user) {
          const profil = await this.authService
            .getUserProfile(user.uid);
          if (profil) {
            this.utilisateur = { ...profil, id: user.uid };
          }
          // Écouter les alertes non lues
          this.ecouterAlertes();
        } else {
          this.utilisateur  = null;
          this.alertesCount = 0;
        }
      }
    );
    this.subs.push(userSub);
  }

  // Écouter les alertes en temps réel
  private ecouterAlertes() {
    const alertesRef = ref(this.db, 'alertes');
    this.alertRef    = alertesRef;

    onValue(alertesRef, (snap: any) => {
      if (snap.exists()) {
        const data  = snap.val();
        const liste = Object.values(data) as any[];
        this.alertesCount = liste.filter(
          (a: any) => !a.lue
        ).length;
      } else {
        this.alertesCount = 0;
      }
    });
  }

  // Navigation
  navigateTo(route: string) {
    this.router.navigate([route]);
  }

  isActive(route: string): boolean {
    return this.activeRoute === route ||
           this.activeRoute.startsWith(route + '/');
  }

  // Collapse
  toggleCollapse() {
    this.collapsed = !this.collapsed;
  }

  // Initiales avatar
  get initiales(): string {
    if (!this.utilisateur) return '?';
    const p = (this.utilisateur.prenom || '')
      .charAt(0).toUpperCase();
    const n = (this.utilisateur.nom    || '')
      .charAt(0).toUpperCase();
    return `${p}${n}`;
  }

  // Nom complet
  get nomComplet(): string {
    if (!this.utilisateur) return 'Chargement...';
    return `${this.utilisateur.prenom || ''}
            ${this.utilisateur.nom    || ''}`.trim();
  }

  // Rôle formaté
  get roleFormate(): string {
    if (!this.utilisateur?.role) return '';
    const roles: Record<string, string> = {
      admin:        'Administrateur',
      gestionnaire: 'Gestionnaire',
      visiteur:     'Visiteur'
    };
    return roles[this.utilisateur.role] || this.utilisateur.role;
  }

  // Déconnexion
  async logout() {
    try {
      sessionStorage.removeItem('otp_verified');
      await this.authService.logout();
      this.router.navigate(['/login']);
    } catch (err) {
      console.error('Erreur déconnexion:', err);
    }
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    // Arrêter l'écoute Firebase
    if (this.alertRef) {
      off(this.alertRef);
    }
  }
}