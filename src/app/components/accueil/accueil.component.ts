import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router }                        from '@angular/router';
import { Database, ref, onValue, off }   from '@angular/fire/database';

interface DonneesTerrain {
  batiments:      number;
  salles:         number;
  consoAnnuelle:  number;
  factureAnnuelle:number;
  etudiants:      number;
  enseignants:    number;
  tempMoyenne:    number;
  gaspillage:     number;
}

@Component({
  selector:    'app-accueil',
  templateUrl: './accueil.component.html',
  styleUrls:   ['./accueil.component.scss']
})
export class AccueilComponent implements OnInit, OnDestroy {

  ficheVisible = false;
  ficheActive  = '';

  // Données terrain COUD — à remplir après enquête
  donneesTerrain: DonneesTerrain = {
    batiments:       0,   // ← remplir après enquête COUD
    salles:          0,   // ← remplir après enquête COUD
    consoAnnuelle:   0,   // ← remplir après enquête COUD
    factureAnnuelle: 0,   // ← remplir après enquête COUD
    etudiants:       0,   // ← remplir après enquête COUD
    enseignants:     0,   // ← remplir après enquête COUD
    tempMoyenne:     0,   // ← remplir après enquête COUD
    gaspillage:      0    // ← remplir après enquête COUD
  };

  private dbRefs: any[] = [];

  // Données statiques universités
  private universites: Record<string, {
    nom:   string;
    sigle: string;
    ville: string;
  }> = {
    ucad:   { nom: 'Université Cheikh Anta Diop de Dakar',         sigle: 'UCAD',   ville: 'Dakar'       },
    ugb:    { nom: 'Université Gaston Berger',                      sigle: 'UGB',    ville: 'Saint-Louis' },
    uadb:   { nom: 'Université Alioune Diop de Bambey',             sigle: 'UADB',   ville: 'Bambey'      },
    uasz:   { nom: 'Université Assane Seck de Ziguinchor',          sigle: 'UASZ',   ville: 'Ziguinchor'  },
    uidt:   { nom: 'Université Iba Der Thiam de Thiès',             sigle: 'UIDT',   ville: 'Thiès'       },
    ussein: { nom: 'Université du Sine-Saloum El-Hadj Ibrahima Niass', sigle: 'USSEIN', ville: 'Kaolack'  },
    unchk:  { nom: 'Université Numérique Cheikh Hamidou Kane',      sigle: 'UN-CHK', ville: 'Dakar'       },
    uam:    { nom: "Université Amadou Mahtar M'bow",                sigle: 'UAM',    ville: 'Diamniadio'  },
    ucak:   { nom: 'Université Cheikh Ahmadoul Khadim',                  sigle: 'UCAK',   ville: 'Touba'  }
  };

  constructor(
    private db:     Database,
    private router: Router
  ) {}

  ngOnInit() {}

  // Sélection université
  selectUniversite(code: string) {
    this.ficheActive  = code;
    this.ficheVisible = true;
    setTimeout(() => {
      document.querySelector('.fiche-section')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  // Naviguer dashboard
  allerDashboard() {
    this.router.navigate(['/dashboard']);
  }

  // Helpers
  getNomUniversite(code: string): string {
    return this.universites[code]?.nom || code.toUpperCase();
  }

  getSigle(code: string): string {
    return this.universites[code]?.sigle || code.toUpperCase();
  }

  getVille(code: string): string {
    return this.universites[code]?.ville || '—';
  }

  // Méthode publique pour mettre à jour les données terrain
  // (à appeler quand les données COUD seront disponibles)
  mettreAJourDonneesTerrain(data: Partial<DonneesTerrain>) {
    this.donneesTerrain = { ...this.donneesTerrain, ...data };
  }

  ngOnDestroy() {
    this.dbRefs.forEach(r => off(r));
  }
}