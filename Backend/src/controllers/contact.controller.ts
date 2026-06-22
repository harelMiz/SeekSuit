import nodemailer from "nodemailer";
import { Request, Response } from "express";

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Strip CR/LF to prevent email header injection
function safeHeader(s: string): string {
  return String(s).replace(/[\r\n]/g, " ").trim();
}

export async function sendContactEmail(req: Request, res: Response) {
  const { name, email, phone, message } = req.body;

  if (!name || !message || !phone) {
    res.status(400).json({ error: "name, phone and message are required" });
    return;
  }

  // Basic email format validation
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "invalid email format" });
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.CONTACT_EMAIL,
      pass: process.env.CONTACT_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"SeekSuit" <${process.env.CONTACT_EMAIL}>`,
    to: process.env.CONTACT_EMAIL,
    subject: `פנייה חדשה מהאתר — ${safeHeader(name)}`,
    html: `
      <div dir="rtl" style="font-family:sans-serif;max-width:480px">
        <h2 style="color:#1a1a1a">פנייה חדשה מאתר SeekSuit</h2>
        <table style="border-collapse:collapse;width:100%">
          <tr><td style="padding:6px 0;color:#555;width:100px">שם:</td><td style="padding:6px 0;font-weight:600">${esc(name)}</td></tr>
          <tr><td style="padding:6px 0;color:#555">טלפון:</td><td style="padding:6px 0;font-weight:600">${esc(phone)}</td></tr>
          ${email ? `<tr><td style="padding:6px 0;color:#555">אימייל:</td><td style="padding:6px 0">${esc(email)}</td></tr>` : ""}
        </table>
        <hr style="margin:16px 0;border:none;border-top:1px solid #eee"/>
        <p style="white-space:pre-wrap;color:#333">${esc(message)}</p>
      </div>
    `,
  });

  res.json({ success: true });
}
