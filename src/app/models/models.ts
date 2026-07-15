export interface Utilisateur {
  idUser?: string;
  id?: string;
  nom: string;
  prenom: string;
  dateNaissance: string;
  email: string;
  role: 'admin' | 'gestionnaire' | 'visiteur';
  telephone?: string;
  adresse?: string;
}

export interface Batiment {
  idBatiment?: string;
  id?: string;
  nom: string;
  localisation: string;
  nombreSalles: number;
}

export interface Salle {
  idSalle?: string;
  id?: string;
  idBatiment: string;
  nomSalle: string;
  typeSalle: string;
}

export interface Equipement {
  idEquipement?: string;
  id?: string;
  idSalle: string;
  type: 'lampe' | 'ventilateur';
  nom: string;
  etat: boolean;
  etatReel?: boolean;
  commandeEnAttente?: boolean;
  consommation: number;
  derniereMAJ?: string;
}

export interface DonneesCapteur {
  id?: string;
  idSalle?: string;
  nomSalle?: string;
  temperature: number;
  humidite: number;
  presence: boolean;
  lampe?: boolean;
  ventilateur?: boolean;
  puissance?: number;
  tension?: number;
  courant?: number;
  timestamp: string;
}

export interface Prelevement {
  idPrelevement?: string;
  id?: string;
  idSalle?: string;
  nomSalle?: string;
  temperature: number;
  humidite: number;
  presence: boolean;
  puissance: number;
  tension: number;
  courant: number;
  etat?: boolean;
  timestamp: string;
}

export interface Capteur {
  idCapteur?: string;
  id?: string;
  idSalle?: string;
  typeCapteur: 'DHT22' | 'PIR' | 'SCT-013' | 'ZMPT101B';
  modele: string;
  dateInstallation: string;
}

// ── Alerte — mise à jour avec nouveaux types ────────────────
export interface Alerte {
  idAlerte?: string;
  id?: string;
  idSalle?: string;
  typeAlerte: 'temperature' | 'humidite' | 'absence'
            | 'anomalie'   | 'hors_ligne';
  message: string;
  niveau: 'warning' | 'critical';
  dateAlerte: string;
  lue?: boolean;
}

export interface PredictionML {
  idPrediction?: string;
  id?: string;
  idSalle?: string;
  consoPredite: number;
  modele: string;
  datePrediction: string;
  scoreConfiance?: number;
}

export interface EtatSalle {
  salle: Salle;
  capteur: DonneesCapteur | null;
  equipements: Equipement[];
  presence: boolean;
  temperatureActuelle: number;
  humiditeActuelle: number;
  puissanceActuelle: number;
  nombreEquipementsActifs: number;
}