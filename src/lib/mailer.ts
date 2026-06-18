import nodemailer from "nodemailer";
import { getOptionalEnv } from "@/lib/env";

export type MailSettingsSnapshot = {
  defaultNotificationEmail: string;
  fromEmail: string;
  hasSmtpConfig: boolean;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUserHint: string | null;
};

export function readMailSettingsSnapshot(): MailSettingsSnapshot {
  const smtpUser = getOptionalEnv("SMTP_USER") ?? "";
  const smtpHost = getOptionalEnv("SMTP_HOST") ?? "";
  const smtpPort = getOptionalEnv("SMTP_PORT") ?? "587";
  const fromEmail = getOptionalEnv("MAIL_FROM") ?? "";
  const defaultNotificationEmail = getOptionalEnv("DEFAULT_NOTIFICATION_EMAIL") ?? "";
  const smtpPassword = getOptionalEnv("SMTP_PASSWORD") ?? "";
  const smtpSecure = (getOptionalEnv("SMTP_SECURE") ?? "false").toLowerCase() === "true";

  return {
    defaultNotificationEmail,
    fromEmail,
    hasSmtpConfig: Boolean(smtpHost && smtpPort && smtpUser && smtpPassword && fromEmail),
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUserHint: smtpUser ? maskSecret(smtpUser) : null
  };
}

export async function verifySmtpSettings() {
  const transporter = createTransporter();
  await transporter.verify();
}

export async function sendProjectRunEmail(input: {
  changedCount: number;
  durationLabel?: string;
  errorMessage?: string | null;
  indexed: number;
  notIndexed: number;
  projectName: string;
  recipient: string;
  runStatus: "COMPLETED" | "FAILED";
  sourceLabel: string;
  total: number;
  unknown: number;
}) {
  const transporter = createTransporter();
  const subject =
    input.runStatus === "COMPLETED"
      ? `Index Checker: ${input.projectName} completed`
      : `Index Checker: ${input.projectName} failed`;

  const lines = [
    `Project: ${input.projectName}`,
    `Status: ${input.runStatus}`,
    `Provider: ${input.sourceLabel}`,
    `Total checked: ${input.total}`,
    `Indexed: ${input.indexed}`,
    `Not indexed: ${input.notIndexed}`,
    `Unknown: ${input.unknown}`,
    `Changed since previous run: ${input.changedCount}`
  ];

  if (input.durationLabel) {
    lines.push(`Duration: ${input.durationLabel}`);
  }
  if (input.errorMessage) {
    lines.push(`Error: ${input.errorMessage}`);
  }

  await transporter.sendMail({
    from: getRequiredMailValue("MAIL_FROM"),
    subject,
    text: lines.join("\n"),
    to: input.recipient
  });
}

function createTransporter() {
  const host = getRequiredMailValue("SMTP_HOST");
  const port = Number.parseInt(getRequiredMailValue("SMTP_PORT"), 10);
  const secure = (getOptionalEnv("SMTP_SECURE") ?? "false").toLowerCase() === "true";
  const user = getRequiredMailValue("SMTP_USER");
  const pass = getRequiredMailValue("SMTP_PASSWORD");

  return nodemailer.createTransport({
    auth: { pass, user },
    host,
    port,
    secure
  });
}

function getRequiredMailValue(name: string) {
  const value = getOptionalEnv(name);
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

function maskSecret(value: string) {
  if (value.length <= 6) {
    return "Configured";
  }
  return `${value.slice(0, 3)}...${value.slice(-4)}`;
}
