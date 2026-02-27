/**
 * ----------------------------------------
 * FlowEase Email Service
 * ----------------------------------------
 * Handles all outbound email operations.
 * Uses professional templates from emailTemplates.js
 * ----------------------------------------
 */

import nodemailer from "nodemailer";
import * as emailTemplates from "./emailTemplates.js";


/* ----------------------------------------
| Create Transporter (Singleton Style)
---------------------------------------- */
let transporter;

const getTransporter = () => {
  if (transporter) return transporter;

  if (process.env.NODE_ENV === "production") {
    if (
      !process.env.EMAIL_HOST ||
      !process.env.EMAIL_USER ||
      !process.env.EMAIL_PASS
    ) {
      throw new Error("❌ Email credentials missing in production");
    }

    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: { rejectUnauthorized: false },
    });
  } else {
    
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: "norval.armstrong36@ethereal.email",
        pass: "jCJBvGmTuSgYGTDArn",
      },
    });
  }

  return transporter;
};

/* ----------------------------------------
| Base Email Sender
---------------------------------------- */
const sendEmail = async ({ to, subject, html }) => {
  try {
    const mailTransporter = getTransporter();

    const mailOptions = {
      from: `${
        process.env.FROM_NAME || "FlowEase"
      } <${process.env.FROM_EMAIL || "noreply@flowease.com"}>`,
      to,
      subject,
      html,
    };

    const info = await mailTransporter.sendMail(mailOptions);

    if (process.env.NODE_ENV !== "production") {
      console.log("📧 Email Sent Successfully");
      console.log("Message ID:", info.messageId);
      console.log("Preview URL:", nodemailer.getTestMessageUrl(info));
    }

    return {
      success: true,
      messageId: info.messageId,
      previewUrl:
        process.env.NODE_ENV !== "production"
          ? nodemailer.getTestMessageUrl(info)
          : null,
    };
  } catch (error) {
    console.error("❌ Email Sending Failed:", error);
    throw new Error("Email could not be sent. Please try again later.");
  }
};

/* ----------------------------------------
| Email Functions
---------------------------------------- */

export const sendVerificationEmail = async ({
  email,
  name,
  verificationUrl,
}) => {
  const html = emailTemplates.getVerificationEmailTemplate({
    name,
    verificationUrl,
  });

  return sendEmail({
    to: email,
    subject: `Verify Your Email Address - ${
      process.env.APP_NAME || "FlowEase"
    }`,
    html,
  });
};

export const sendPasswordResetEmail = async ({ email, name, resetUrl }) => {
  const html = emailTemplates.getPasswordResetTemplate({
    name,
    resetUrl,
  });

  return sendEmail({
    to: email,
    subject: `Password Reset Request - ${process.env.APP_NAME || "FlowEase"}`,
    html,
  });
};

export const sendPasswordResetSuccessEmail = async ({ email, name }) => {
  const html = emailTemplates.getPasswordResetSuccessTemplate({ name });

  return sendEmail({
    to: email,
    subject: `Password Successfully Reset - ${
      process.env.APP_NAME || "FlowEase"
    }`,
    html,
  });
};

export const sendWelcomeEmail = async ({ email, name }) => {
  const html = emailTemplates.getWelcomeEmailTemplate({ name });

  return sendEmail({
    to: email,
    subject: `Welcome to ${process.env.APP_NAME || "FlowEase"} 🎉`,
    html,
  });
};

export const sendInvitationEmail = async ({
  email,
  name,
  workspace,
  inviteUrl,
}) => {
  const html = emailTemplates.getInvitationEmailTemplate({
    name,
    workspace,
    inviteUrl,
  });

  return sendEmail({
    to: email,
    subject: `You're Invited to Join "${workspace}" - ${
      process.env.APP_NAME || "FlowEase"
    }`,
    html,
  });
};

export const sendSecurityAlertEmail = async ({
  email,
  name,
  action,
  ipAddress,
  location,
  timestamp,
}) => {
  const html = emailTemplates.getSecurityAlertTemplate({
    name,
    action,
    ipAddress,
    location,
    timestamp,
  });

  return sendEmail({
    to: email,
    subject: `Security Alert - ${process.env.APP_NAME || "FlowEase"}`,
    html,
  });
};

export const sendNotificationEmail = async ({
  email,
  name,
  title,
  message,
  buttonText,
  buttonUrl,
}) => {
  const html = emailTemplates.getGenericNotificationTemplate({
    name,
    title,
    message,
    buttonText,
    buttonUrl,
  });

  return sendEmail({
    to: email,
    subject: title,
    html,
  });
};
