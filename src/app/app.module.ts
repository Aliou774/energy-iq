import { NgModule }             from '@angular/core';
import { BrowserModule }        from '@angular/platform-browser';
import { FormsModule }          from '@angular/forms';
import { CommonModule }         from '@angular/common';

import { AppRoutingModule }     from './app-routing.module';
import { AppComponent }         from './app.component';
import { environment }          from './../environment/environment';

// AngularFire
import { initializeApp }        from 'firebase/app';
import { getAuth }              from 'firebase/auth';
import { getDatabase }          from 'firebase/database';
import { provideFirebaseApp }   from '@angular/fire/app';
import { provideAuth }          from '@angular/fire/auth';
import { provideDatabase }      from '@angular/fire/database';

// Composants
import { LoginComponent }       from './components/login/login.component';
import { RegisterComponent }    from './components/register/register.component';
import { SidebarComponent }     from './components/sidebar/sidebar.component';
import { AccueilComponent }     from './components/accueil/accueil.component';
import { DashboardComponent }   from './components/dashboard/dashboard.component';
import { SallesComponent }      from './components/salles/salles.component';
import { EquipementsComponent } from './components/equipements/equipements.component';
import { MesuresComponent }     from './components/mesures/mesures.component';
import { PredictionsComponent } from './components/predictions/predictions.component';
import { AlertesComponent }     from './components/alertes/alertes.component';
import { ProfilComponent }      from './components/profil/profil.component';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    RegisterComponent,
    SidebarComponent,
    AccueilComponent,
    DashboardComponent,
    SallesComponent,
    EquipementsComponent,
    MesuresComponent,
    PredictionsComponent,
    AlertesComponent,
    ProfilComponent
  ],
  imports: [
    BrowserModule,
    CommonModule,       // ← *ngIf, *ngFor, pipes (number, date...)
    FormsModule,        // ← [(ngModel)], #f="ngForm"
    AppRoutingModule,   // ← <router-outlet>, routerLink
  ],
  providers: [
    // Firebase → dans providers, pas dans imports
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    provideDatabase(() => getDatabase()),
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}