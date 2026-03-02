// import { Resend } from "resend";
// import emailTemplates from "./emailTemplates.js";
// import nodemailer from "nodemailer";

// const resend = new Resend(process.env.RESEND_API_KEY);

// export default async function sendEmail({ to, subject, template, data }) {
//   let html;

//   switch (template) {
//     case "verification":
//       html = emailTemplates.getVerificationEmailTemplate(data);
//       break;
//     case "passwordReset":
//       html = emailTemplates.getPasswordResetTemplate(data);
//       break;
//     case "passwordResetSuccess":
//       html = emailTemplates.getPasswordResetSuccessTemplate(data);
//       break;
//     case "welcome":
//       html = emailTemplates.getWelcomeEmailTemplate(data);
//       break;
//     case "invitation":
//       html = emailTemplates.getInvitationEmailTemplate(data);
//       break;
//     case "securityAlert":
//       html = emailTemplates.getSecurityAlertTemplate(data);
//       break;
//     default:
//       html = emailTemplates.getGenericNotificationTemplate(data);
//   }

  
//   try {
//     if (process.env.NODE_ENV === "production") {
//       await resend.emails.send({
//         from: `${process.env.APP_NAME} <no-reply@${process.env.RESEND_SENDER_EMAIL}>`,
//         to,
//         subject,
//         html,
//       });
//     } else {

//       // Development: use Ethereal
//       // If EMAIL_USER/PASS are empty, generate a test account dynamically
//       let transporter;
//       if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
//         const testAccount = await nodemailer.createTestAccount();
//         transporter = nodemailer.createTransport({
//           host: "smtp.ethereal.email",
//           port: 587,
//           secure: false,
//           auth: {
//             user: testAccount.user,
//             pass: testAccount.pass,
//           },
//         });
//         console.log("Created Ethereal test account:", testAccount);
//       } else {
//         transporter = nodemailer.createTransport({
//           host: "smtp.ethereal.email",
//           port: 587,
//           secure: false,
//           auth: {
//             user: process.env.EMAIL_USER,
//             pass: process.env.EMAIL_PASS,
//           },
//         });
//       }

//       const info = await transporter.sendMail({
//         from: `"${process.env.APP_NAME}" <${process.env.EMAIL_USER}>`,
//         to,
//         subject,
//         html,
//       });

//       console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
//     }
//   } catch (error) {
//     console.error(`Error sending email to ${to}:`, error);
//     throw error;
//   }
// }

