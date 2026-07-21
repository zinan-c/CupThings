import nodemailer from "nodemailer";

let lastConsoleLoginLink: string | null = null;

export function getWebOrigin() {
  return ((process.env.WEB_ORIGIN ?? process.env.WEB_ORIGINS ?? "http://localhost:5173")
    .split(",")[0] ?? "http://localhost:5173")
    .trim()
    .replace(/\/$/, "");
}

export function getLastConsoleLoginLink() {
  return lastConsoleLoginLink;
}

export async function sendLoginLink(email: string, token: string) {
  const loginLink = `${getWebOrigin()}/auth/verify?token=${encodeURIComponent(token)}`;
  const provider = process.env.EMAIL_PROVIDER ?? "console";

  if (provider === "console") {
    lastConsoleLoginLink = loginLink;
    console.info(`[CupThings] Magic Link for ${email}: ${loginLink}`);
    return;
  }

  if (provider !== "smtp") {
    throw new Error("EMAIL_PROVIDER must be console or smtp");
  }

  const smtpUrl = process.env.SMTP_URL;
  const from = process.env.EMAIL_FROM;
  if (!smtpUrl || !from) {
    throw new Error("SMTP_URL and EMAIL_FROM are required for SMTP email delivery");
  }

  const transporter = nodemailer.createTransport(smtpUrl);
  await transporter.sendMail({
    from,
    to: email,
    subject: "Your CupThings sign-in link",
    text: `Sign in to CupThings: ${loginLink}`
  });
}
