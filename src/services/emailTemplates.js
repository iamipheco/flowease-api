/**
 * ========================================
 * FlowEase Email Templates - Modern Design
 * ========================================
 */

/* ========================================
| Brand & Company Info
======================================== */
export const getBrandColors = () => ({
  primary: process.env.BRAND_COLOR_PRIMARY || "#E8632A", // orange
  primaryLight: "#F5C5AC",
  primaryDark: "#7e2600",
  dark: "#20120c",        // dark brown (header color)
  darkMuted: "#6b7280",
  light: "#ffffff",
  background: "#ffffff",  // orange background
  border: "#e5e7eb",
  success: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444",
  info: "#3b82f6",
});

export const getCompanyInfo = () => ({
  name: process.env.APP_NAME,
  fullName: process.env.APP_FULL_NAME,
  website: process.env.FRONTEND_URL,
  supportEmail: process.env.SUPPORT_EMAIL,
  logo: process.env.APP_LOGO_URL,
});


/* ========================================
| Helper Functions
======================================== */
export const getButton = (text, url, type = "primary", colors) => {
  const background =
    type === "primary"
      ? colors.primary
      : type === "success"
      ? colors.success
      : colors.info;
  const color = colors.light;
  return `
    <a href="${url}" class="button button-${type}" 
       style="display:inline-block; padding:14px 32px; border-radius:8px; font-weight:600; font-size:16px; text-decoration:none; color:${color}; background:${background}; border:2px solid ${background};">
      ${text}
    </a>
  `;
};

export const getAlertBox = (type, message, colors) => {
  const types = {
    success: { bg: "#d1fae5", border: colors.success, color: "#065f46" },
    error: { bg: "#fee2e2", border: colors.error, color: "#991b1b" },
    warning: { bg: "#fef3c7", border: colors.warning, color: "#92400e" },
    info: { bg: "#dbeafe", border: colors.info, color: "#1e40af" },
  };
  const t = types[type] || types.info;
  return `
    <div class="alert alert-${type}" style="padding:16px 20px; border-radius:8px; margin:24px 0; background:${t.bg}; border-left:4px solid ${t.border}; color:${t.color};">
      ${message}
    </div>
  `;
};

export const getInfoCard = (items, colors) => {
  const rows = items
    .map(
      (item) => `
    <tr>
      <td style="padding: 8px 16px; font-weight:600; color:${colors.dark};">${item.label}</td>
      <td style="padding: 8px 16px; color:${colors.darkMuted};">${item.value}</td>
    </tr>
  `
    )
    .join("");
  return `
    <table style="width:100%; border-collapse:collapse; margin:24px 0; border:1px solid ${colors.border}; border-radius:8px; overflow:hidden;">
      ${rows}
    </table>
  `;
};

/* ========================================
| Modern Base Template
======================================== */
export const getBaseTemplate = (content, colors = getBrandColors()) => {
  const company = getCompanyInfo();
  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${company.fullName}</title>
<style>
  body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    color: ${colors.light};
  }
  table { border-collapse: collapse; width: 100%; }
  img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
  .container {
    width: 600px;
    max-width: 100%;
    background: ${colors.background};
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  }
  .header {
    padding: 24px;
    text-align: center;
    background: ${colors.dark};
  }
  .header img {
    height: 120px;
    margin: 0 auto;
    display: block;
  }
  .header h1 {
    margin: 0;
    font-size: 32px;
    font-weight: 700;
    color: ${colors.light};
  }
  .content {
    padding: 48px 40px;
    font-size: 16px;
    line-height: 1.6;
    color: ${colors.dark};
  }
  .footer {
    padding: 32px 40px;
    text-align: center;
    font-size: 14px;
    color: ${colors.darkMuted};
    background: ${colors.background};
  }
  .footer a { color: ${colors.primary}; text-decoration: none; margin: 0 8px; }
  .divider { height: 1px; background: ${colors.border}; margin: 24px 0; }
  .button {
    display: inline-block;
    padding: 14px 32px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 16px;
    text-decoration: none;
    transition: all 0.2s;
  }
  .button-primary { background: ${colors.primary}; color: ${colors.light}; border: 2px solid ${colors.primary}; }
  .button-secondary { background: transparent; color: ${colors.primary}; border: 2px solid ${colors.primary}; }
  .alert {
    padding: 16px 20px;
    border-radius: 8px;
    margin: 24px 0;
  }
  .alert-success { background: #d1fae5; border-left: 4px solid ${colors.success}; color: #065f46; }
  .alert-error { background: #fee2e2; border-left: 4px solid ${colors.error}; color: #991b1b; }
  .alert-warning { background: #fef3c7; border-left: 4px solid ${colors.warning}; color: #92400e; }
  .alert-info { background: #dbeafe; border-left: 4px solid ${colors.info}; color: #1e40af; }
  @media only screen and (max-width: 600px) {
    .container { width: 100% !important; }
    .content { padding: 24px 20px !important; }
    .footer { padding: 24px 20px !important; }
  }
</style>
</head>
<body>

  <table role="presentation">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table class="container" role="presentation">

          <!-- Header -->
          <tr>
            <td class="header">
              ${
                company.logo
                  ? `<a href="${company.website}" target="_blank">
                      <img src="${company.logo}" alt="${company.name}" />
                    </a>`
                  : `<h1>${company.name}</h1>`
              }
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td class="content">
              ${content}
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td class="divider"></td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="footer">
              <div>
                <a href="${company.website}">Website</a> •
                <a href="mailto:${company.supportEmail}">Support</a>
              </div>
              <p style="margin: 8px 0 0;">
                <strong>${company.fullName}</strong><br/>
                © ${new Date().getFullYear()} All rights reserved.
              </p>
              <p style="margin: 8px 0 0;">
                <a href="${company.website}/unsubscribe">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
`;
};

/* ========================================
| Verification Email 
======================================== */
export const getVerificationEmailTemplate = ({ name, verificationUrl }) => {
  const colors = getBrandColors();
  const content = `
<h1 style="margin: 0 0 16px; font-size: 28px; font-weight: 700; color: ${colors.dark}; line-height: 1.2;">
  Verify Your Email Address
</h1>

<p style="margin: 0 0 24px; font-size: 16px; color: ${colors.darkMuted}; line-height: 1.6;">
  Hello <strong style="color: ${colors.dark};">${name}</strong>,
</p>

<p style="margin: 0 0 24px; font-size: 16px; color: ${colors.darkMuted}; line-height: 1.6;">
  Thank you for registering with <strong style="color: ${colors.primary};">${company.name}</strong>, your all-in-one task management and team collaboration platform.
</p>

<p style="margin: 0 0 8px; font-size: 16px; color: ${colors.darkMuted}; line-height: 1.6;">
  To activate your account and start managing your projects, please verify your email address by clicking the button below:
</p>

${getButton("Verify Email Address", verificationUrl, "primary", colors)}

${getAlertBox("warning", "This verification link will expire in <strong>15 minutes</strong> for security reasons.", colors)}

<p style="margin: 24px 0 0; font-size: 14px; color: ${colors.darkMuted}; line-height: 1.6;">
  If you didn't create an account with ${company.name}, you can safely ignore this email.
</p>
`;
  return getBaseTemplate(content, colors);
};

/* ========================================
| Password Reset Request
======================================== */
export const getPasswordResetTemplate = ({ name, resetUrl }) => {
  const colors = getBrandColors();
  const content = `
<h1 style="margin: 0 0 16px; font-size: 28px; font-weight: 700; color: ${colors.dark}; line-height: 1.2;">
  Reset Your Password
</h1>

<p style="margin: 0 0 24px; font-size: 16px; color: ${colors.darkMuted}; line-height: 1.6;">
  Hello <strong style="color: ${colors.dark};">${name}</strong>,
</p>

<p style="margin: 0 0 24px; font-size: 16px; color: ${colors.darkMuted}; line-height: 1.6;">
  We received a request to reset the password for your ${company.name} account. If you didn't make this request, you can safely ignore this email.
</p>

<p style="margin: 0 0 8px; font-size: 16px; color: ${colors.darkMuted}; line-height: 1.6;">
  To reset your password, click the button below:
</p>

${getButton("Reset My Password", resetUrl, "primary", colors)}

${getAlertBox("warning", "This password reset link will expire in <strong>15 minutes</strong> for security reasons.", colors)}

${getAlertBox("info", "If you didn't request a password reset, please contact our support team immediately to secure your account.", colors)}
`;
  return getBaseTemplate(content, colors);
};

/* ========================================
| Password Reset Success
======================================== */
export const getPasswordResetSuccessTemplate = ({ name }) => {
  const colors = getBrandColors();
  const company = getCompanyInfo();
  const content = `
<div style="text-align: center; margin-bottom: 32px;">
  <div style="display: inline-block; width: 64px; height: 64px; background: linear-gradient(135deg, ${colors.success}, #059669); border-radius: 50%; line-height: 64px; font-size: 32px;">
    ✓
  </div>
</div>

<h1 style="margin: 0 0 16px; font-size: 28px; font-weight: 700; color: ${colors.dark}; line-height: 1.2; text-align: center;">
  Password Reset Successful
</h1>

<p style="margin: 0 0 24px; font-size: 16px; color: ${colors.darkMuted}; line-height: 1.6;">
  Hello <strong style="color: ${colors.dark};">${name}</strong>,
</p>

<p style="margin: 0 0 24px; font-size: 16px; color: ${colors.darkMuted}; line-height: 1.6;">
Your ${company.name} account password has been successfully updated. Your account is now secured with your new password.
</p>
${getAlertBox("success", "You can now log in to your account using your new password.", colors)}
<p style="margin: 24px 0 8px; font-size: 16px; color: ${colors.darkMuted}; line-height: 1.6;">
  Click below to access your dashboard:
</p>
${getButton("Go to Dashboard", company.website + "/login", "success", colors)}
<p style="margin: 24px 0 0; font-size: 14px; color: ${colors.darkMuted}; line-height: 1.6;">
  If you didn't make this change or believe your account has been compromised, please contact our support team immediately.
</p>
`;
  return getBaseTemplate(content, colors);
};
/* ========================================
| Welcome Email 
======================================== */
export const getWelcomeEmailTemplate = ({ name }) => {
const colors = getBrandColors();
const company = getCompanyInfo();
const content = `
<div style="text-align: center; margin-bottom: 32px;">
  <div style="display: inline-block; width: 64px; height: 64px; background: linear-gradient(135deg, ${colors.primary}, ${colors.primaryDark}); border-radius: 50%; line-height: 64px; font-size: 32px;">
    🎉
  </div>
</div>
<h1 style="margin: 0 0 16px; font-size: 28px; font-weight: 700; color: ${colors.dark}; line-height: 1.2; text-align: center;">
  Welcome to ${company.name}!
</h1>
<p style="margin: 0 0 24px; font-size: 16px; color: ${colors.darkMuted}; line-height: 1.6;">
  Hello <strong style="color: ${colors.dark};">${name}</strong>,
</p>
<p style="margin: 0 0 24px; font-size: 16px; color: ${colors.darkMuted}; line-height: 1.6;">
  Your account is now fully active! We're excited to have you on board. ${company.name} helps you manage tasks, collaborate with your team, and boost productivity.
</p>
<p style="margin: 0 0 8px; font-size: 16px; color: ${colors.darkMuted}; line-height: 1.6;">
  Ready to get started? Access your dashboard now:
</p>
${getButton("Open Dashboard", company.website + "/dashboard", "primary", colors)}
<div style="margin: 32px 0; padding: 20px; background-color: ${colors.background}; border-radius: 8px; border: 1px solid ${colors.border};">
  <h3 style="margin: 0 0 12px; font-size: 18px; font-weight: 600; color: ${colors.dark};">
    Quick Start Tips:
  </h3>
  <ul style="margin: 0; padding-left: 20px; color: ${colors.darkMuted}; font-size: 14px; line-height: 1.8;">
    <li>Create your first workspace</li>
    <li>Invite team members to collaborate</li>
    <li>Set up your first project</li>
    <li>Start tracking tasks and progress</li>
  </ul>
</div>
<p style="margin: 24px 0 0; font-size: 14px; color: ${colors.darkMuted}; line-height: 1.6;">
  Need help? Our support team is here for you at 
  <a href="mailto:${company.supportEmail}" style="color: ${colors.primary}; text-decoration: none; font-weight: 500;">
    ${company.supportEmail}
  </a>
</p>
`;
  return getBaseTemplate(content, colors);
};
/* ========================================
| Workspace Invitation - Modern
======================================== */
export const getInvitationEmailTemplate = ({ name, workspace, inviteUrl, inviterName }) => {
const colors = getBrandColors();
const content = `
<div style="text-align: center; margin-bottom: 32px;">
  <div style="display: inline-block; width: 64px; height: 64px; background: linear-gradient(135deg, ${colors.info}, #2563eb); border-radius: 50%; line-height: 64px; font-size: 32px;">
    📨
  </div>
</div>
<h1 style="margin: 0 0 16px; font-size: 28px; font-weight: 700; color: ${colors.dark}; line-height: 1.2; text-align: center;">
  You've Been Invited!
</h1>
<p style="margin: 0 0 24px; font-size: 16px; color: ${colors.darkMuted}; line-height: 1.6;">
  Hello <strong style="color: ${colors.dark};">${name}</strong>,
</p>
<p style="margin: 0 0 24px; font-size: 16px; color: ${colors.darkMuted}; line-height: 1.6;">
  ${inviterName ? `<strong>${inviterName}</strong> has` : 'You have been'} invited you to join the workspace 
  <strong style="color: ${colors.primary};">"${workspace}"</strong> on ${company.name}.
</p>
${getInfoCard([
{ label: "Workspace", value: workspace },
{ label: "Access Level", value: "Team Member" },
{ label: "Expires", value: "24 hours" },
], colors)}
<p style="margin: 24px 0 8px; font-size: 16px; color: ${colors.darkMuted}; line-height: 1.6;">
  Click below to accept the invitation and start collaborating:
</p>
${getButton("Accept Invitation", inviteUrl, "primary", colors)}
${getAlertBox("info", "This invitation link will expire in <strong>24 hours</strong>.", colors)}
<p style="margin: 24px 0 0; font-size: 14px; color: ${colors.darkMuted}; line-height: 1.6;">
  If you didn't expect this invitation, you can safely ignore this email.
</p>
`;
  return getBaseTemplate(content, colors);
};
/* ========================================
| Security Alert - Modern
======================================== */
export const getSecurityAlertTemplate = ({
name,
action,
ipAddress,
location,
timestamp,
}) => {
const colors = getBrandColors();
const content = `
<div style="text-align: center; margin-bottom: 32px;">
  <div style="display: inline-block; width: 64px; height: 64px; background: linear-gradient(135deg, ${colors.error}, #dc2626); border-radius: 50%; line-height: 64px; font-size: 32px;">
    🔒
  </div>
</div>
<h1 style="margin: 0 0 16px; font-size: 28px; font-weight: 700; color: ${colors.error}; line-height: 1.2; text-align: center;">
  Security Alert
</h1>
<p style="margin: 0 0 24px; font-size: 16px; color: ${colors.darkMuted}; line-height: 1.6;">
  Hello <strong style="color: ${colors.dark};">${name}</strong>,
</p>
<p style="margin: 0 0 24px; font-size: 16px; color: ${colors.darkMuted}; line-height: 1.6;">
  We detected unusual activity in your ${company.name} account. Please review the details below:
</p>
${getInfoCard([
{ label: "Action", value: action },
{ label: "IP Address", value: ipAddress },
{ label: "Location", value: location || "Unknown" },
{ label: "Timestamp", value: timestamp },
], colors)}
${getAlertBox("error", "If this was <strong>NOT you</strong>, reset your password immediately and contact our support team.", colors)}
<p style="margin: 24px 0 0; font-size: 14px; color: ${colors.darkMuted}; line-height: 1.6;">
  If this activity was authorized by you, no action is needed. We're committed to keeping your account secure.
</p>
`;
  return getBaseTemplate(content, colors);
};
/* ========================================
| Generic Notification - Modern
======================================== */
export const getGenericNotificationTemplate = ({
name,
title,
message,
buttonText,
buttonUrl,
}) => {
const colors = getBrandColors();
const content = `
<h1 style="margin: 0 0 24px; font-size: 28px; font-weight: 700; color: ${colors.dark}; line-height: 1.2;">
  ${title}
</h1>
<p style="margin: 0 0 24px; font-size: 16px; color: ${colors.darkMuted}; line-height: 1.6;">
  Hello <strong style="color: ${colors.dark};">${name}</strong>,
</p>
<p style="margin: 0 0 24px; font-size: 16px; color: ${colors.darkMuted}; line-height: 1.6;">
  ${message}
</p>
${buttonText && buttonUrl ? getButton(buttonText, buttonUrl, "primary", colors) : ""}
`;
return getBaseTemplate(content, colors);
};
/* ========================================
| Export All Templates
======================================== */
export default {
getBrandColors,
getCompanyInfo,
getBaseTemplate,
getButton,
getAlertBox,
getInfoCard,
getVerificationEmailTemplate,
getPasswordResetTemplate,
getPasswordResetSuccessTemplate,
getWelcomeEmailTemplate,
getInvitationEmailTemplate,
getSecurityAlertTemplate,
getGenericNotificationTemplate,
};