import { NgModule }             from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard }            from './services/auth.guard';

import { LoginComponent }       from './components/login/login.component';
import { RegisterComponent }    from './components/register/register.component';
import { AccueilComponent }     from './components/accueil/accueil.component';
import { DashboardComponent }   from './components/dashboard/dashboard.component';
import { SallesComponent }      from './components/salles/salles.component';
import { EquipementsComponent } from './components/equipements/equipements.component';
import { MesuresComponent }     from './components/mesures/mesures.component';
import { PredictionsComponent } from './components/predictions/predictions.component';
import { AlertesComponent }     from './components/alertes/alertes.component';
import { ProfilComponent }      from './components/profil/profil.component';

const routes: Routes = [

  // ── Pages publiques (sans guard) ──
  { path: 'login',    component: LoginComponent    },
  { path: 'register', component: RegisterComponent },

  // ── Pages protégées (avec guard) ──
  {
    path:        'accueil',
    component:   AccueilComponent,
    canActivate: [AuthGuard]
  },
  {
    path:        'dashboard',
    component:   DashboardComponent,
    canActivate: [AuthGuard]
  },
  {
    path:        'salles',
    component:   SallesComponent,
    canActivate: [AuthGuard]
  },
  {
    path:        'equipements',
    component:   EquipementsComponent,
    canActivate: [AuthGuard]
  },
  {
    path:        'mesures',
    component:   MesuresComponent,
    canActivate: [AuthGuard]
  },
  {
    path:        'predictions',
    component:   PredictionsComponent,
    canActivate: [AuthGuard]
  },
  {
    path:        'alertes',
    component:   AlertesComponent,
    canActivate: [AuthGuard]
  },
  {
    path:        'profil',
    component:   ProfilComponent,
    canActivate: [AuthGuard]
  },

  // ── Redirections ──
  // Racine → login si non connecté
  { path: '',   redirectTo: '/login', pathMatch: 'full' },
  // Route inconnue → login
  { path: '**', redirectTo: '/login' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}