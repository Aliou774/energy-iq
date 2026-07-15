import { Injectable } from '@angular/core';
import {
  Database, ref, push, set, update,
  remove, onValue, query, orderByChild, equalTo
} from '@angular/fire/database';
import { Observable } from 'rxjs';
import {
  Batiment, Salle, Equipement, Prelevement,
  Alerte, PredictionML, DonneesCapteur, EtatSalle
} from '../models/models';

// ── Utilitaire snapshot → liste ──────────────────────────────
function snapToList<T>(snap: any): T[] {
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([key, val]: any) => ({
    id: key, ...val
  })) as T[];
}

// ════════════════════════════════════════════════════════════════
// BATIMENT SERVICE
// ════════════════════════════════════════════════════════════════
@Injectable({ providedIn: 'root' })
export class BatimentService {
  constructor(private db: Database) {}

  getAll(): Observable<Batiment[]> {
    return new Observable(obs =>
      onValue(ref(this.db, 'batiments'),
        snap => obs.next(snapToList<Batiment>(snap)))
    );
  }

  add(b: Omit<Batiment, 'idBatiment' | 'id'>): void {
    push(ref(this.db, 'batiments'), b)
      .catch((e: any) => console.error('Erreur batiment :', e));
  }

  update(id: string, b: Partial<Batiment>): Promise<void> {
    return update(ref(this.db, `batiments/${id}`), b);
  }

  delete(id: string): Promise<void> {
    return remove(ref(this.db, `batiments/${id}`));
  }
}

// ════════════════════════════════════════════════════════════════
// SALLE SERVICE
// ════════════════════════════════════════════════════════════════
@Injectable({ providedIn: 'root' })
export class SalleService {
  constructor(private db: Database) {}

  getAll(): Observable<Salle[]> {
    return new Observable(obs =>
      onValue(ref(this.db, 'salles'),
        snap => obs.next(snapToList<Salle>(snap)))
    );
  }

  getByBatiment(idBatiment: string): Observable<Salle[]> {
    return new Observable(obs => {
      const q = query(
        ref(this.db, 'salles'),
        orderByChild('idBatiment'),
        equalTo(idBatiment)
      );
      onValue(q, snap => obs.next(snapToList<Salle>(snap)));
    });
  }

  add(s: Omit<Salle, 'idSalle' | 'id'>): void {
    push(ref(this.db, 'salles'), s)
      .catch((e: any) => console.error('Erreur salle :', e));
  }

  update(id: string, s: Partial<Salle>): Promise<void> {
    return update(ref(this.db, `salles/${id}`), s);
  }

  delete(id: string): Promise<void> {
    return remove(ref(this.db, `salles/${id}`));
  }
}

// ════════════════════════════════════════════════════════════════
// EQUIPEMENT SERVICE
// ════════════════════════════════════════════════════════════════
@Injectable({ providedIn: 'root' })
export class EquipementService {
  constructor(private db: Database) {}

  getAll(): Observable<Equipement[]> {
    return new Observable(obs =>
      onValue(ref(this.db, 'equipements'),
        snap => obs.next(snapToList<Equipement>(snap)))
    );
  }

  getBySalle(idSalle: string): Observable<Equipement[]> {
    return new Observable(obs => {
      const q = query(
        ref(this.db, 'equipements'),
        orderByChild('idSalle'),
        equalTo(idSalle)
      );
      onValue(q, snap => obs.next(snapToList<Equipement>(snap)));
    });
  }

  envoyerCommande(id: string, etat: boolean): Promise<void> {
    return update(ref(this.db, `equipements/${id}`), {
      etat,
      commandeEnAttente: true,
      derniereMAJ: new Date().toISOString()
    });
  }

  confirmerEtat(id: string, etatReel: boolean): Promise<void> {
    return update(ref(this.db, `equipements/${id}`), {
      etat: etatReel,
      etatReel,
      commandeEnAttente: false,
      derniereMAJ: new Date().toISOString()
    });
  }

  eteindreSalle(idSalle: string): void {
    this.getBySalle(idSalle).subscribe(equips => {
      equips.forEach(e => {
        const id = e.idEquipement || (e as any).id;
        this.envoyerCommande(id, false);
      });
    }).unsubscribe();
  }

  add(e: Omit<Equipement, 'idEquipement' | 'id'>): void {
    push(ref(this.db, 'equipements'), {
      ...e,
      etatReel: false,
      commandeEnAttente: false,
      derniereMAJ: new Date().toISOString()
    }).catch((err: any) => console.error('Erreur équipement :', err));
  }

  update(id: string, e: Partial<Equipement>): Promise<void> {
    return update(ref(this.db, `equipements/${id}`), e);
  }

  delete(id: string): Promise<void> {
    return remove(ref(this.db, `equipements/${id}`));
  }
}

// ════════════════════════════════════════════════════════════════
// CAPTEUR SERVICE
// ════════════════════════════════════════════════════════════════
@Injectable({ providedIn: 'root' })
export class CapteurService {

  readonly SEUIL_HORS_LIGNE_MS = 30000;

  constructor(private db: Database) {}

  getDonneesSalle(idSalle: string): Observable<DonneesCapteur | null> {
    return new Observable(obs =>
      onValue(
        ref(this.db, `capteurs/${idSalle}`),
        snap => obs.next(snap.exists()
          ? { idSalle, ...snap.val() }
          : null
        )
      )
    );
  }

  getToutesLesDonnees(): Observable<Record<string, DonneesCapteur>> {
    return new Observable(obs =>
      onValue(ref(this.db, 'capteurs'), snap => {
        const data: Record<string, DonneesCapteur> = {};
        if (snap.exists()) {
          snap.forEach(child => {
            data[child.key!] = { idSalle: child.key!, ...child.val() };
          });
        }
        obs.next(data);
      })
    );
  }

  estConnecte(donnees: DonneesCapteur | null): boolean {
    if (!donnees?.timestamp) return false;
    const dernierEnvoi = new Date(donnees.timestamp).getTime();
    if (isNaN(dernierEnvoi)) return false;
    return (Date.now() - dernierEnvoi) <= this.SEUIL_HORS_LIGNE_MS;
  }

  presenceReelle(donnees: DonneesCapteur | null): boolean {
    if (!this.estConnecte(donnees)) return false;
    return !!donnees?.presence;
  }

  synchroniserEtatEquipements(
    idSalle: string,
    equipSvc: EquipementService
  ): void {
    onValue(ref(this.db, `capteurs/${idSalle}`), snap => {
      if (!snap.exists()) return;
      const data = snap.val();
      const aEtatEquipement =
        data.lampe !== undefined || data.ventilateur !== undefined;
      if (!aEtatEquipement) return;
      equipSvc.getBySalle(idSalle).subscribe(equips => {
        equips.forEach(e => {
          const id = e.idEquipement || (e as any).id;
          let nouvelEtat: boolean | undefined;
          if (e.type === 'lampe' && data.lampe !== undefined)
            nouvelEtat = data.lampe;
          else if (e.type === 'ventilateur' && data.ventilateur !== undefined)
            nouvelEtat = data.ventilateur;
          if (nouvelEtat !== undefined && nouvelEtat !== e.etat)
            equipSvc.confirmerEtat(id, nouvelEtat);
        });
      }).unsubscribe();
    });
  }

  simulerDonnees(idSalle: string): void {
    const presence = Math.random() > 0.4;
    const temp     = parseFloat((18 + Math.random() * 14).toFixed(1));
    set(ref(this.db, `capteurs/${idSalle}`), {
      temperature:  temp,
      humidite:     parseFloat((45 + Math.random() * 35).toFixed(1)),
      presence,
      lampe:        presence,
      ventilateur:  presence && temp > 25,
      puissance:    parseFloat((Math.random() * 400).toFixed(1)),
      tension:      parseFloat((218 + Math.random() * 8).toFixed(1)),
      courant:      parseFloat((Math.random() * 2).toFixed(2)),
      timestamp:    new Date().toISOString()
    }).catch((e: any) => console.error('Erreur simulation :', e));
  }
}

// ════════════════════════════════════════════════════════════════
// SUPERVISION SERVICE
// ════════════════════════════════════════════════════════════════
@Injectable({ providedIn: 'root' })
export class SupervisionService {

  readonly SEUIL_TEMPERATURE_FROID = 22;
  readonly DELAI_ABSENCE_MS = 10 * 60 * 1000;

  private absenceTimers: Record<string, any> = {};
  private sallesSupervised: Set<string> = new Set();

  constructor(
    private capteurSvc: CapteurService,
    private equipSvc:   EquipementService,
    private alerteSvc:  AlerteService
  ) {}

  superviserSalle(idSalle: string, nomSalle: string): void {
    if (this.sallesSupervised.has(idSalle)) return;
    this.sallesSupervised.add(idSalle);

    this.capteurSvc.getDonneesSalle(idSalle).subscribe(donnees => {
      if (!donnees) return;
      const connecte      = this.capteurSvc.estConnecte(donnees);
      const presenceFiable = connecte ? donnees.presence : false;

      if (!presenceFiable) {
        this.demarrerTimerAbsence(idSalle, nomSalle);
      } else {
        this.annulerTimerAbsence(idSalle);
      }

      if (connecte && donnees.temperature < this.SEUIL_TEMPERATURE_FROID) {
        this.eteindreFroid(idSalle, nomSalle, donnees.temperature);
      }
    });
  }

  private eteindreFroid(
    idSalle: string, nomSalle: string, temp: number
  ): void {
    this.equipSvc.getBySalle(idSalle).subscribe(equips => {
      equips.filter(e => e.type === 'ventilateur' && e.etat)
        .forEach(e => {
          const id = e.idEquipement || (e as any).id;
          this.equipSvc.envoyerCommande(id, false);
          this.alerteSvc.genererSiAbsent(
            idSalle, 'temperature',
            `${nomSalle} : ventilation éteinte automatiquement ` +
            `(${temp}°C < ${this.SEUIL_TEMPERATURE_FROID}°C)`,
            'warning'
          );
        });
    }).unsubscribe();
  }

  private demarrerTimerAbsence(idSalle: string, nomSalle: string): void {
    if (this.absenceTimers[idSalle]) return;
    this.absenceTimers[idSalle] = setTimeout(() => {
      this.capteurSvc.getDonneesSalle(idSalle).subscribe(d => {
        const connecte      = this.capteurSvc.estConnecte(d);
        const presenceFiable = connecte ? d?.presence : false;
        if (!presenceFiable) {
          this.equipSvc.eteindreSalle(idSalle);
          this.alerteSvc.genererSiAbsent(
            idSalle, 'absence',
            `${nomSalle} : équipements éteints (absence > 10 min)`,
            'warning'
          );
        }
        delete this.absenceTimers[idSalle];
      }).unsubscribe();
    }, this.DELAI_ABSENCE_MS);
  }

  private annulerTimerAbsence(idSalle: string): void {
    if (this.absenceTimers[idSalle]) {
      clearTimeout(this.absenceTimers[idSalle]);
      delete this.absenceTimers[idSalle];
    }
  }

  resetSupervision(): void {
    this.sallesSupervised.clear();
    Object.values(this.absenceTimers).forEach(t => clearTimeout(t));
    this.absenceTimers = {};
  }
}

// ════════════════════════════════════════════════════════════════
// PRELEVEMENT SERVICE
// ════════════════════════════════════════════════════════════════
@Injectable({ providedIn: 'root' })
export class PrelevementService {
  constructor(private db: Database) {}

  getDernierPrelevement(idSalle: string): Observable<Prelevement | null> {
    return new Observable(obs =>
      onValue(
        ref(this.db, `prelevements/${idSalle}/historique`),
        snap => {
          const liste = snapToList<Prelevement>(snap);
          if (liste.length === 0) { obs.next(null); return; }
          const trie = liste
            .filter(p => p.timestamp)
            .sort((a, b) =>
              new Date(b.timestamp).getTime() -
              new Date(a.timestamp).getTime()
            );
          obs.next(trie.length > 0 ? trie[0] : liste[liste.length - 1]);
        }
      )
    );
  }

  getHistorique(idSalle: string): Observable<Prelevement[]> {
    return new Observable(obs =>
      onValue(
        ref(this.db, `prelevements/${idSalle}/historique`),
        snap => obs.next(snapToList<Prelevement>(snap))
      )
    );
  }

  simulerMesureComplete(idSalle: string): void {
    const m: Prelevement = {
      temperature: parseFloat((20 + Math.random() * 12).toFixed(1)),
      humidite:    parseFloat((45 + Math.random() * 35).toFixed(1)),
      presence:    Math.random() > 0.35,
      puissance:   parseFloat((50 + Math.random() * 450).toFixed(1)),
      tension:     parseFloat((218 + Math.random() * 8).toFixed(1)),
      courant:     parseFloat((0.2 + Math.random() * 2).toFixed(2)),
      etat:        true,
      timestamp:   new Date().toISOString()
    };
    push(ref(this.db, `prelevements/${idSalle}/historique`), m);
  }
}

// ════════════════════════════════════════════════════════════════
// ALERTE SERVICE
// ════════════════════════════════════════════════════════════════
@Injectable({ providedIn: 'root' })
export class AlerteService {
  constructor(private db: Database) {}

  getAll(): Observable<Alerte[]> {
    return new Observable(obs =>
      onValue(ref(this.db, 'alertes'), snap => {
        const list = snapToList<Alerte>(snap);
        list.sort((a, b) =>
          new Date(b.dateAlerte).getTime() -
          new Date(a.dateAlerte).getTime()
        );
        obs.next(list);
      })
    );
  }

  getNonLues(): Observable<Alerte[]> {
    return new Observable(obs =>
      onValue(ref(this.db, 'alertes'), snap => {
        obs.next(snapToList<Alerte>(snap).filter(a => !a.lue));
      })
    );
  }

  getBySalle(idSalle: string): Observable<Alerte[]> {
    return new Observable(obs => {
      const q = query(
        ref(this.db, 'alertes'),
        orderByChild('idSalle'),
        equalTo(idSalle)
      );
      onValue(q, snap => obs.next(snapToList<Alerte>(snap)));
    });
  }

  marquerLue(id: string): Promise<void> {
    return update(ref(this.db, `alertes/${id}`), { lue: true });
  }

  marquerToutesLues(alertes: Alerte[]): void {
    alertes.forEach(a =>
      update(
        ref(this.db, `alertes/${a.idAlerte || a.id!}`),
        { lue: true }
      )
    );
  }

  add(a: Omit<Alerte, 'idAlerte' | 'id'>): void {
    push(ref(this.db, 'alertes'), { ...a, lue: false })
      .catch((e: any) => console.error('Erreur alerte :', e));
  }

  // ── Génération avec anti-doublon ───────────────────────────
  // N'ajoute l'alerte que si aucune alerte non lue
  // du même type pour la même salle n'existe déjà
  genererSiAbsent(
    idSalle: string,
    typeAlerte: Alerte['typeAlerte'],
    message: string,
    niveau: Alerte['niveau']
  ): void {
    onValue(ref(this.db, 'alertes'), snap => {
      const existantes = snapToList<Alerte>(snap);
      const dejaPresente = existantes.some(a =>
        a.idSalle === idSalle &&
        a.typeAlerte === typeAlerte &&
        !a.lue
      );
      if (!dejaPresente) {
        this.add({
          idSalle, typeAlerte, message, niveau,
          dateAlerte: new Date().toISOString(),
          lue: false
        });
      }
    }, { onlyOnce: true });
  }

  // Compatibilité avec SupervisionService existant
  genererAlerte(
    idSalle: string,
    typeAlerte: Alerte['typeAlerte'],
    message: string,
    niveau: Alerte['niveau']
  ): void {
    this.genererSiAbsent(idSalle, typeAlerte, message, niveau);
  }

  delete(id: string): Promise<void> {
    return remove(ref(this.db, `alertes/${id}`));
  }

  deleteAll(alertes: Alerte[]): void {
    alertes.forEach(a =>
      remove(ref(this.db, `alertes/${a.idAlerte || a.id!}`))
    );
  }
}

// ════════════════════════════════════════════════════════════════
// PREDICTION SERVICE
// ════════════════════════════════════════════════════════════════
@Injectable({ providedIn: 'root' })
export class PredictionService {
  constructor(private db: Database) {}

  getAll(): Observable<PredictionML[]> {
    return new Observable(obs =>
      onValue(ref(this.db, 'predictions'), snap => {
        const list = snapToList<PredictionML>(snap);
        list.sort((a, b) =>
          new Date(b.datePrediction).getTime() -
          new Date(a.datePrediction).getTime()
        );
        obs.next(list);
      })
    );
  }

  getBySalle(idSalle: string): Observable<PredictionML[]> {
    return new Observable(obs => {
      const q = query(
        ref(this.db, 'predictions'),
        orderByChild('idSalle'),
        equalTo(idSalle)
      );
      onValue(q, snap => obs.next(snapToList<PredictionML>(snap)));
    });
  }

  add(p: Omit<PredictionML, 'idPrediction' | 'id'>): void {
    push(ref(this.db, 'predictions'), p)
      .catch((e: any) => console.error('Erreur prédiction :', e));
  }

  simulerPredictions(salles: { id: string }[]): void {
    salles.forEach(s => {
      this.add({
        idSalle:        s.id,
        consoPredite:   parseFloat((Math.random() * 5).toFixed(2)),
        modele:         'RandomForest',
        datePrediction: new Date().toISOString(),
        scoreConfiance: parseFloat((0.7 + Math.random() * 0.3).toFixed(2))
      });
    });
  }

  delete(id: string): Promise<void> {
    return remove(ref(this.db, `predictions/${id}`));
  }
}