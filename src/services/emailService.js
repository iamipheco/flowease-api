/**
 * ========================================
 * FlowEase Email Service
 * ========================================
 * Handles all outbound email operations.
 * Uses modern templates from emailTemplates.js
 * Supports Resend (Production) & Ethereal (Development)
 * ========================================
 */

import nodemailer from "nodemailer";
import * as emailTemplates from "./emailTemplates.js";
import { Resend } from "resend";

const isProduction = process.env.NODE_ENV === "production";
let resend = null;
let transporter = null;

/* ========================================
| Development Transporter Setup
======================================== */
const getTransporter = async () => {
  if (isProduction) return null;
  if (transporter) return transporter;

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    // Create temporary Ethereal account
    const testAccount = await nodemailer.createTestAccount();
    console.log("📧 Created Ethereal test account:", testAccount);

    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  } else {
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  return transporter;
};

/* ========================================
| Initialize Resend (Production)
======================================== */
if (isProduction) {
  resend = new Resend(process.env.RESEND_API_KEY);
  console.log("📨 Using Resend (Production)");
} else {
  console.log("📨 Using Ethereal (Development)");
}

/* ========================================
| Core Send Function
======================================== */
export const sendEmail = async ({ to, subject, html, attachments = [] }) => {
  try {
    if (isProduction) {
      const response = await resend.emails.send({
        from: `${process.env.APP_NAME || "FlowEase"} <no-reply@${process.env.RESEND_SENDER_EMAIL}>`,
        to,
        subject,
        html,
      });
      console.log(`✅ Email sent to ${to}: ${subject}`);
      return { success: true, id: response.id };
    } else {
      const mailTransporter = await getTransporter();
      const info = await mailTransporter.sendMail({
        from: `"${process.env.APP_NAME || "FlowEase"}" <${
          process.env.EMAIL_USER || "dev@floweaseapp.online"
        }>`,
        to,
        subject,
        html,
        ...(attachments.length > 0 && { attachments }),
      });

      console.log(`📧 Email sent to ${to} (Development)`);
      console.log("Preview URL:", nodemailer.getTestMessageUrl(info));

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: nodemailer.getTestMessageUrl(info),
      };
    }
  } catch (error) {
    console.error(`❌ Email sending failed to ${to}:`, error);
    throw error;
  }
};

/* ========================================
| Verify Email Connection (Optional)
======================================== */
export const verifyEmailConnection = async () => {
  if (isProduction) {
    console.log("📨 Production uses Resend, no SMTP verification needed");
    return true;
  }

  try {
    const mailTransporter = await getTransporter();
    await mailTransporter.verify();
    console.log("✅ Email service is ready (Development)");
    return true;
  } catch (error) {
    console.error("❌ Email service verification failed:", error.message);
    return false;
  }
};

/* ========================================
| Template-based Email Actions
======================================== */

export const sendVerificationEmail = async ({ email, name, verificationUrl }) => {
  const html = emailTemplates.getVerificationEmailTemplate({ name, verificationUrl });
  return sendEmail({ to: email, subject: `Verify Your Email - ${process.env.APP_NAME || "FlowEase"}`, html });
};

export const sendPasswordResetEmail = async ({ email, name, resetUrl }) => {
  const html = emailTemplates.getPasswordResetTemplate({ name, resetUrl });
  return sendEmail({ to: email, subject: `Password Reset Request - ${process.env.APP_NAME || "FlowEase"}`, html });
};

export const sendPasswordResetSuccessEmail = async ({ email, name }) => {
  const html = emailTemplates.getPasswordResetSuccessTemplate({ name });
  return sendEmail({ to: email, subject: `Password Successfully Reset - ${process.env.APP_NAME || "FlowEase"}`, html });
};

export const sendWelcomeEmail = async ({ email, name }) => {
  const html = emailTemplates.getWelcomeEmailTemplate({ name });
  return sendEmail({ to: email, subject: `Welcome to ${process.env.APP_NAME || "FlowEase"} 🎉`, html });
};

export const sendInvitationEmail = async ({ email, name, workspace, inviteUrl, inviterName }) => {
  const html = emailTemplates.getInvitationEmailTemplate({ name, workspace, inviteUrl, inviterName });
  return sendEmail({ to: email, subject: `You're Invited to Join "${workspace}" - ${process.env.APP_NAME || "FlowEase"}`, html });
};

export const sendSecurityAlertEmail = async ({ email, name, action, ipAddress, location, timestamp }) => {
  const html = emailTemplates.getSecurityAlertTemplate({ name, action, ipAddress, location, timestamp });
  return sendEmail({ to: email, subject: `🔒 Security Alert - ${process.env.APP_NAME || "FlowEase"}`, html });
};

export const sendNotificationEmail = async ({ email, name, title, message, buttonText, buttonUrl }) => {
  const html = emailTemplates.getGenericNotificationTemplate({ name, title, message, buttonText, buttonUrl });
  return sendEmail({ to: email, subject: title, html });
};

/* ========================================
| Bulk Email Sender
======================================== */
export const sendBulkEmail = async ({ recipients, subject, html }) => {
  const results = await Promise.allSettled(
    recipients.map((email) => sendEmail({ to: email, subject, html }))
  );

  const successful = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  console.log(`📧 Bulk email: ${successful} sent, ${failed} failed out of ${recipients.length}`);
  return { total: recipients.length, successful, failed, results };
};