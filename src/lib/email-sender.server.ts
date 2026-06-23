import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.resend.com",
  port: 465,
  secure: true,
  auth: {
    user: "resend",
    pass: process.env.RESEND_SMTP_PASSWORD,
  },
});

export async function sendEmail({
  to,
  from,
  subject,
  html,
  text,
}: {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const fromAddress = from ?? process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  await transporter.sendMail({ from: fromAddress, to, subject, html, text });
}
