import nodemailer from 'nodemailer';
import { env } from '$lib/server/config';
import { serverT } from '$lib/i18n/server';

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
    subject: serverT('email.reset.subject'),
    text: serverT('email.reset.text', { url: url.toString() }),
    html: `<p>${serverT('email.reset.intro')}</p><p><a href="${url.toString()}">${serverT('email.reset.button')}</a></p><p>${serverT('email.reset.expiry')}</p>`
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
    subject: serverT('email.invite.subject', { campaign: campaignTitle }),
    text: serverT('email.invite.text', { campaign: campaignTitle, url: url.toString() }),
    html: `<p>${serverT('email.invite.intro', { campaign: escapeHtml(campaignTitle) })}</p><p><a href="${url.toString()}">${serverT('email.invite.button')}</a></p>`
  });
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!
  );
}
