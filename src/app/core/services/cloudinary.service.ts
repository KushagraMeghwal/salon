import { Injectable } from '@angular/core';

/**
 * Image hosting for salon logos and staff photos. Replaces Firebase Storage (never enabled on the
 * Firebase project) with an unsigned Cloudinary upload — no backend round trip, no secret in the
 * browser: an unsigned preset can only upload, it cannot read, list or delete.
 */
@Injectable({ providedIn: 'root' })
export class CloudinaryService {
  private cloudName = 'dtfodjr5k';
  private uploadPreset = 'dsmanagement';
  private uploadUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`;

  /** Uploads an image and resolves with its hosted (https) URL. */
  async uploadImage(file: File): Promise<string> {
    const body = new FormData();
    body.append('file', file);
    body.append('upload_preset', this.uploadPreset);

    let res: Response;
    try {
      res = await fetch(this.uploadUrl, { method: 'POST', body });
    } catch {
      throw new Error('Could not reach the image server. Check your connection and try again.');
    }
    if (!res.ok) throw new Error('Image upload failed. Please try again.');

    const data = (await res.json()) as { secure_url?: string };
    if (!data.secure_url) throw new Error('Image upload failed. Please try again.');
    return data.secure_url;
  }
}
