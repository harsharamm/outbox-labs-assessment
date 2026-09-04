import nodemailer, { Transporter } from "nodemailer";

export interface SenderCreds {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
}

const transportCache = new Map<string, Transporter>();

export function getTransport(sender: SenderCreds): Transporter {
  const cacheKey = `${sender.smtpHost}:${sender.smtpPort}:${sender.smtpUser}`;
  let transport = transportCache.get(cacheKey);
  if (!transport) {
    transport = nodemailer.createTransport({
      host: sender.smtpHost,
      port: sender.smtpPort,
      secure: false,
      auth: {
        user: sender.smtpUser,
        pass: sender.smtpPass,
      },
    });
    transportCache.set(cacheKey, transport);
  }
  return transport;
}
