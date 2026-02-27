/**
 * ----------------------------------------
 * FlowEase Email Templates (ES Module)
 * ----------------------------------------
 * All templates use a professional, branded style
 * for clear, actionable, and secure communication.
 * ----------------------------------------
 */

/* ----------------------------------------
| Brand & Company Info
---------------------------------------- */
export const getBrandColors = () => ({
  primary: process.env.BRAND_COLOR_PRIMARY || "#E8632A",
  secondary: process.env.BRAND_COLOR_SECONDARY || "#F5C5AC",
  dark: process.env.BRAND_COLOR_DARK || "#2d1a10",
  light: process.env.BRAND_COLOR_LIGHT || "#ffffff",
});

export const getCompanyInfo = () => ({
  name: process.env.APP_NAME || "FlowEase App",
  fullName: process.env.APP_FULL_NAME || "FlowEase Manager",
  website: process.env.FRONTEND_URL || "http://localhost:5173",
  supportEmail: process.env.SUPPORT_EMAIL || "support@floweasemanager.com",
  logo: process.env.APP_LOGO_URL || "https://i.ibb.co/GQSgLv6Y/logo.png",
});

/* ----------------------------------------
| Base HTML Template
---------------------------------------- */
export const getBaseTemplate = (content, colors = getBrandColors()) => {
  const company = getCompanyInfo();
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${company.fullName}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
          
          <!-- Header -->
          <tr>
            <td style="background:#ffffff;padding:30px 40px;text-align:center;border-bottom:1px solid #f1f1f1;">
                ${
                company.logo
                    ? `
                    <a href="${company.website}" target="_blank">
                        <img 
                        src="${company.logo}" 
                        alt="${company.name}" 
                        style="max-height:30px; display:block; margin:0 auto;"
                        />
                    </a>
                    `
                    : `
                    <h1 style="margin:0;font-size:22px;color:${colors.dark};">
                        ${company.name}
                    </h1>
                    `
                }
            </td>
        </tr>

          <!-- Content -->
          <tr>
            <td style="padding:40px;">${content}</td>
          </tr>

          <!-- Footer -->
                <tr>
                <td style="background:linear-gradient(135deg, ${colors.primary}, ${colors.secondary});
                            padding:30px;
                            text-align:center;
                            font-size:12px;
                            color:#ffffff;">
                            
                    <strong>${company.fullName}</strong><br/>
                    © ${new Date().getFullYear()} All rights reserved.
                    <br/><br/>
                    
                    <a href="${company.website}" 
                    style="color:#ffffff;text-decoration:none;font-weight:bold;">
                    ${company.website.replace(/^https?:\/\//, "")}
                    </a>
                    <br/>
                    
                    <a href="mailto:${company.supportEmail}" 
                    style="color:#ffffff;text-decoration:none;">
                    ${company.supportEmail}
                    </a>
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

/* ----------------------------------------
| Reusable Components
---------------------------------------- */
export const getButton = (text, url, colors = getBrandColors()) => `
<div style="margin:30px 0;text-align:center;">
  <a href="${url}" target="_blank"
    style="background:${colors.primary};
           color:#fff;
           padding:14px 32px;
           border-radius:50px;
           font-weight:bold;
           text-decoration:none;
           display:inline-block;">
    ${text}
  </a>
</div>
`;

export const getAlertBox = (type, message) => {
  const styles = {
    warning: "#ff9800",
    success: "#4caf50",
    error: "#f44336",
    info: "#2196f3",
  };
  const color = styles[type] || styles.info;
  return `
    <div style="margin:20px 0;padding:15px;border-left:4px solid ${color};background:#f9f9f9;">
      ${message}
    </div>
  `;
};

/* ----------------------------------------
| Verification Email
---------------------------------------- */
export const getVerificationEmailTemplate = ({ name, verificationUrl }) => {
  const content = `
<h2>Hello ${name},</h2>
<p>Thank you for registering with <strong>FlowEase</strong>, your task management and team collaboration platform.</p>
<p>Please verify your email to activate your account:</p>
${getButton("Verify Email", verificationUrl)}
${getAlertBox("warning", "⏰ This link expires in 15 minutes for security reasons.")}
<p style="font-size:13px;color:#888;">
If you did not create an account, please ignore this email.
</p>
`;
  return getBaseTemplate(content);
};

/* ----------------------------------------
| Password Reset Request
---------------------------------------- */
export const getPasswordResetTemplate = ({ name, resetUrl }) => {
  const content = `
<h2>Hello ${name},</h2>
<p>We received a request to reset your FlowEase account password.</p>
<p>Click below to reset your password:</p>
${getButton("Reset Password", resetUrl)}
${getAlertBox("warning", "⏰ This link expires in 10 minutes for security reasons.")}
<p style="font-size:13px;color:#888;">
If you did not request a password reset, ignore this email or contact support immediately.
</p>
`;
  return getBaseTemplate(content);
};

/* ----------------------------------------
| Password Reset Success
---------------------------------------- */
export const getPasswordResetSuccessTemplate = ({ name }) => {
  const company = getCompanyInfo();
  const content = `
<h2>Password Reset Successful ✅</h2>
<p>Hello ${name},</p>
<p>Your FlowEase account password has been successfully updated. If you did not perform this action, contact support immediately.</p>
${getAlertBox("success", "Your account is now secured.")}
<p>Login to your account here:</p>
${getButton("Login Now", company.website + "/login")}
`;
  return getBaseTemplate(content);
};

/* ----------------------------------------
| Welcome Email
---------------------------------------- */
export const getWelcomeEmailTemplate = ({ name }) => {
  const company = getCompanyInfo();
  const content = `
<h2>Welcome to ${company.name}! 🎉</h2>
<p>Hello ${name},</p>
<p>Your account is fully active. Start managing your tasks and collaborating with your team now.</p>
${getButton("Go to Dashboard", company.website + "/dashboard")}
`;
  return getBaseTemplate(content);
};

/* ----------------------------------------
| Invitation Email
---------------------------------------- */
export const getInvitationEmailTemplate = ({ name, workspace, inviteUrl }) => {
  const content = `
<h2>Hello ${name},</h2>
<p>You have been invited to join the workspace <strong>"${workspace}"</strong> on FlowEase.</p>
<p>This workspace allows you to collaborate with your team, manage projects, and track tasks efficiently.</p>
${getButton("Accept Invitation", inviteUrl)}
${getAlertBox("info", "Invitations expire in 24 hours.")}
<p>If you did not expect this invitation, you can safely ignore this email.</p>
`;
  return getBaseTemplate(content);
};

/* ----------------------------------------
| Security Alert
---------------------------------------- */
export const getSecurityAlertTemplate = ({
  name,
  action,
  ipAddress,
  location,
  timestamp,
}) => {
  const content = `
<h2>Security Alert 🔒</h2>
<p>Hello ${name},</p>
<p>We detected the following action in your FlowEase account:</p>
<ul>
  <li><strong>Action:</strong> ${action}</li>
  <li><strong>IP Address:</strong> ${ipAddress}</li>
  <li><strong>Location:</strong> ${location || "Unknown"}</li>
  <li><strong>Time:</strong> ${timestamp}</li>
</ul>
<p>If this was you, no action is needed. If not, reset your password immediately and contact support.</p>
${getAlertBox("error", "Account security is important. Act quickly if this action was not authorized.")}
`;
  return getBaseTemplate(content);
};

/* ----------------------------------------
| Generic Notification Email
---------------------------------------- */
export const getGenericNotificationTemplate = ({
  name,
  title,
  message,
  buttonText,
  buttonUrl,
}) => {
  const content = `
<h2>${title}</h2>
<p>Hello ${name},</p>
<p>${message}</p>
${buttonText && buttonUrl ? getButton(buttonText, buttonUrl) : ""}
`;
  return getBaseTemplate(content);
};
