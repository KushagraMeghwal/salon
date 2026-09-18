import { logger } from 'firebase-functions';

export interface ReminderMessage {
  /** Digits only, 10-digit Indian mobile. */
  to: string;
  template: 'booking-reminder';
  params: { salonName: string; customerName: string; date: string; time: string; services: string };
}

/**
 * 'sent'    -> delivered to the provider; the booking is marked so it is never reminded twice.
 * 'skipped' -> nothing was sent (no provider wired yet); the booking stays eligible for the next run.
 */
export type SendResult = 'sent' | 'skipped';

/** One seam for the messaging channel. WhatsApp, SMS or both can be plugged in without touching the job. */
export interface ReminderProvider {
  readonly name: string;
  send(message: ReminderMessage): Promise<SendResult>;
}

/**
 * Default provider: sends nothing. Keeps the scheduled job safe to deploy before a channel exists.
 * TODO(whatsapp): implement a WhatsApp Cloud API provider (Meta) once the message templates are approved, then return it
 * from getReminderProvider() in index.ts. SMS can be added the same way; the channel decision is deliberately open.
 */
export class NoopReminderProvider implements ReminderProvider {
  readonly name = 'noop';
  async send(message: ReminderMessage): Promise<SendResult> {
    // Log that a reminder was due, never the phone number or message text.
    logger.debug('reminder due but no provider configured', { template: message.template });
    return 'skipped';
  }
}
