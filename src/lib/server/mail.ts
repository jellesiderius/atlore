import nodemailer from 'nodemailer';
import { env } from '$lib/server/config';

const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined
    })
  : null;

export async function sendPasswordReset(email: string, token: string): Promise<void> {
  const url = new URL('/auth/reset', env.ORIGIN);
  url.searchParams.set('token', token);
  if (!transporter) {
    console.info(`[Atlore] Password reset for ${email}: ${url.toString()}`);
    return;
  }
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: email,
    subject: 'Stel je Atlore-wachtwoord opnieuw in',
    text: `Gebruik deze link om je wachtwoord opnieuw in te stellen: ${url.toString()}\n\nDe link verloopt over één uur.`,
    html: `<p>Gebruik de onderstaande link om je Atlore-wachtwoord opnieuw in te stellen.</p><p><a href="${url.toString()}">Wachtwoord opnieuw instellen</a></p><p>De link verloopt over één uur.</p>`
  });
}

export async function sendInvitation(
  email: string,
  campaignTitle: string,
  token: string
): Promise<void> {
  const url = new URL('/invite', env.ORIGIN);
  url.searchParams.set('token', token);
  if (!transporter) {
    console.info(`[Atlore] Invitation for ${email}: ${url.toString()}`);
    return;
  }
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: email,
    subject: `Uitnodiging voor ${campaignTitle} in Atlore`,
    text: `Je bent uitgenodigd voor ${campaignTitle}. Accepteer via: ${url.toString()}`,
    html: `<p>Je bent uitgenodigd voor <strong>${escapeHtml(campaignTitle)}</strong>.</p><p><a href="${url.toString()}">Uitnodiging accepteren</a></p>`
  });
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!
  );
}
