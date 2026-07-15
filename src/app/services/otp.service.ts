import { Injectable } from '@angular/core';
import { Database, ref, set, get, remove } from '@angular/fire/database';
import emailjs from '@emailjs/browser';
import { environment } from '../../environment/environment';

export interface OtpRecord {
  code: string;
  email: string;
  expiresAt: number;
  attempts: number;
}

@Injectable({ providedIn: 'root' })
export class OtpService {

  private readonly MAX_ATTEMPTS = 3;
  private readonly EXPIRY_MS = 10 * 60 * 1000;

  constructor(private db: Database) {
    emailjs.init(environment.emailjs.publicKey);
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async sendOtp(uid: string, email: string, nom: string): Promise<void> {
    const code = this.generateCode();

    const record: OtpRecord = {
      code,
      email,
      expiresAt: Date.now() + this.EXPIRY_MS,
      attempts: 0
    };

    // Stocker dans Firebase
    await set(ref(this.db, `otp/${uid}`), record);

    // Envoyer email - variables exactes du template
    const response = await emailjs.send(
      environment.emailjs.serviceId,
      environment.emailjs.templateId,
      {
        to_email: email,   // Destinataire
        nom: nom,          // 👈 IMPORTANT : "nom" pas "to_name"
        code: code         // Code OTP
      }
      // 👉 Ne pas mettre publicKey ici (déjà initialisé)
    );

    console.log('Email envoyé:', response.status, response.text);
  }

  async verifyOtp(uid: string, codeSaisi: string): Promise<{ valid: boolean; error?: string }> {
    const snap = await get(ref(this.db, `otp/${uid}`));

    if (!snap.exists()) {
      return { valid: false, error: 'Code introuvable.' };
    }

    const record = snap.val() as OtpRecord;

    if (Date.now() > record.expiresAt) {
      await remove(ref(this.db, `otp/${uid}`));
      return { valid: false, error: 'Code expiré. Reconnectez-vous.' };
    }

    if (record.attempts >= this.MAX_ATTEMPTS) {
      await remove(ref(this.db, `otp/${uid}`));
      return { valid: false, error: 'Trop de tentatives. Reconnectez-vous.' };
    }

    if (record.code !== codeSaisi) {
      await set(ref(this.db, `otp/${uid}/attempts`), record.attempts + 1);
      const restantes = this.MAX_ATTEMPTS - record.attempts - 1;
      return { valid: false, error: `Code incorrect. ${restantes} tentative(s) restante(s).` };
    }

    await remove(ref(this.db, `otp/${uid}`));
    return { valid: true };
  }

  async deleteOtp(uid: string): Promise<void> {
    await remove(ref(this.db, `otp/${uid}`));
  }
}