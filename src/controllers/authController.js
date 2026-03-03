/* ======================================================
   src/controllers/authController.js
   Authentication & Security Only
====================================================== */
import User from "../models/User.js";
import Workspace from "../models/Workspace.js";
import Invitation from "../models/Invitation.js";
import { ErrorResponse } from "../middleware/error.js";
import asyncHandler from "express-async-handler";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendPasswordResetSuccessEmail,
  sendWelcomeEmail,
} from "../services/emailService.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

/* =============================
   HELPER: Send Token Response
============================= */
const sendTokenResponse = async (
  user,
  statusCode,
  res,
  message,
  redirectUrl = null,
) => {
  try {
    const accessToken = user.getSignedJwtToken();
    const refreshToken = user.getRefreshToken({
      type: "web",
      ipAddress: res.req?.ip,
      userAgent: res.req?.headers["user-agent"],
    });

    if (!user.refreshTokens) user.refreshTokens = [];
    user.refreshTokens.push(refreshToken);

    // Keep only last 5 refresh tokens
    if (user.refreshTokens.length > 5) {
      user.refreshTokens = user.refreshTokens.slice(-5);
    }

    await user.save({ validateBeforeSave: false });

    // OAuth redirect
    if (redirectUrl) {
      return res.redirect(
        `${redirectUrl}?accessToken=${accessToken}&refreshToken=${refreshToken.token}`,
      );
    }

    // JSON response
    res.status(statusCode).json({
      success: true,
      message,
      accessToken,
      refreshToken: refreshToken.token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Error saving refresh token:", error);
    throw new ErrorResponse("Could not issue tokens. Try again later.", 500);
  }
};

/* =============================
   @desc    Register user (email verification first)
   @route   POST /api/auth/register
   @access  Public
============================= */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, invitationToken, providerId } = req.body;

  // 1️⃣ Check if user exists (including soft-deleted)
  let existingUser = await User.findOne({ email })
    .where("isDeleted")
    .in([true, false]);

  if (existingUser) {
    // Restore soft-deleted account
    if (existingUser.isDeleted) {
      existingUser.isDeleted = false;
      existingUser.deletedAt = null;
      existingUser.isActive = true;
      await existingUser.save({ validateBeforeSave: false });

      return res.status(200).json({
        success: true,
        message: "Account restored. You can now login.",
      });
    }

    // Link local auth if missing
    const hasLocalAuth = existingUser.authProviders?.some(
      (p) => p.provider === "local",
    );
    if (!hasLocalAuth && password) {
      existingUser.password = password; // ✅ Model will hash automatically
      existingUser.authProviders.push({
        provider: "local",
        providerId: providerId || null,
        connectedAt: new Date(),
      });
      await existingUser.save();
      return res.status(200).json({
        success: true,
        message: "Account linked successfully. You can now login.",
      });
    }

    // Account exists with local auth
    return res.status(400).json({
      success: false,
      message: "Account already exists. Please login.",
    });
  }

  // 2️⃣ Create new user in memory (NOT saved yet)
  const user = new User({
    name,
    email,
    password, // ✅ Will be hashed on save
    emailVerified: false,
    authProviders: [
      {
        provider: "local",
        providerId: providerId || null,
        connectedAt: new Date(),
      },
    ],
    pendingInvitation: invitationToken || null,
  });

  // 3️⃣ Generate email verification token
  const verificationToken = user.getEmailVerificationToken();
  const verificationUrl = `${process.env.FRONTEND_URL}/auth/verify-email/${verificationToken}`;

  try {
    // 4️⃣ Send verification email FIRST
    await sendVerificationEmail({
      email: user.email,
      name: user.name,
      verificationUrl,
    });

    // 5️⃣ Save user only after email sent
    await user.save({ validateBeforeSave: false });

    return res.status(201).json({
      success: true,
      message: "Registration successful! Please verify your email.",
      requiresVerification: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        pendingInvitation: user.pendingInvitation,
        authProviders: user.authProviders,
      },
    });
  } catch (error) {
    console.error("Email failed, user not saved:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not send verification email. Try again.",
    });
  }
});

/* =============================
   @desc    Login user
   @route   POST /api/auth/login
   @access  Public
============================= */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email, isDeleted: false }).select(
    "+password",
  );

  if (!user) {
    throw new ErrorResponse("Invalid credentials", 401);
  }

  // Check for local auth
  const hasLocalAuth = user.authProviders.some((p) => p.provider === "local");

  if (!hasLocalAuth) {
    const providers = user.authProviders.map((p) => p.provider).join(", ");
    throw new ErrorResponse(
      `This account uses ${providers}. Please login using that provider.`,
      400,
    );
  }

  // Verify password
  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    throw new ErrorResponse("Invalid credentials", 401);
  }

  // Check email verification
  if (!user.emailVerified) {
    throw new ErrorResponse(
      "Email not verified. Please verify your email.",
      403,
    );
  }

  // Track login
  await user.trackLogin(req.ip, req.headers["user-agent"]);

  return sendTokenResponse(user, 200, res, "Login Successful");
});

/* =============================
   @desc    Logout user
   @route   POST /api/auth/logout
   @access  Private
============================= */
export const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new ErrorResponse("Refresh token required", 400);
  }

  const user = await User.findById(req.user._id);

  user.refreshTokens = user.refreshTokens.filter(
    (t) => t.token !== refreshToken,
  );

  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

/* =============================
   @desc    Logout all devices
   @route   POST /api/auth/logout-all
   @access  Private
============================= */
export const logoutAll = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  user.refreshTokens = [];
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: "Logged out from all devices",
  });
});

/* =============================
   @desc    Refresh access token
   @route   POST /api/auth/refresh
   @access  Public
============================= */
export const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new ErrorResponse("Refresh token required", 400);
  }

  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  const user = await User.findById(decoded.id);

  if (!user) {
    throw new ErrorResponse("Invalid refresh token", 401);
  }

  const tokenExists = user.refreshTokens.some((t) => t.token === refreshToken);

  if (!tokenExists) {
    throw new ErrorResponse("Refresh token revoked", 401);
  }

  // Remove old token (rotation)
  user.refreshTokens = user.refreshTokens.filter(
    (t) => t.token !== refreshToken,
  );

  const newRefreshToken = user.getRefreshToken({
    type: "web",
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  user.refreshTokens.push(newRefreshToken);

  const newAccessToken = user.getSignedJwtToken();

  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken.token,
  });
});

/* =============================
   @desc    Verify email
   @route   GET /api/auth/verify-email/:token
   @access  Public
============================= */
// export const verifyEmail = asyncHandler(async (req, res) => {
//   const { token } = req.params;

//   if (!token) {
//     throw new ErrorResponse("Verification token is required", 400);
//   }

//   const hashedToken = crypto
//     .createHash("sha256")
//     .update(token)
//     .digest("hex");

//   const user = await User.findOne({
//     emailVerificationToken: hashedToken,
//   });

//   if (!user) {
//     throw new ErrorResponse("Invalid or already used verification token", 400);
//   }

//   if (user.emailVerificationExpire < Date.now()) {
//     throw new ErrorResponse("Verification token has expired", 400);
//   }

//   if (!user.emailVerified) {
//     user.emailVerified = true;
//     user.emailVerificationExpire = undefined;
//     await user.save({ validateBeforeSave: false });
//   }

//   // 🔐 Generate tokens
//   const accessToken = user.getSignedAccessToken();
//   const refreshToken = user.getSignedRefreshToken();

//   // Optional: save refresh token
//   user.refreshToken = refreshToken;
//   await user.save({ validateBeforeSave: false });

//   // 🍪 Send tokens (choose your strategy)

//   // If using httpOnly cookies (BEST practice)
//   res.cookie("accessToken", accessToken, {
//     httpOnly: true,
//     secure: process.env.NODE_ENV === "production",
//     sameSite: "strict",
//   });

//   res.cookie("refreshToken", refreshToken, {
//     httpOnly: true,
//     secure: process.env.NODE_ENV === "production",
//     sameSite: "strict",
//   });

//   return res.status(200).json({
//     success: true,
//     message: "Email verified successfully!",
//     accessToken, // if you're storing in frontend instead of cookies
//   });
// });

/* =============================
   @desc    Resend verification email
   @route   POST /api/auth/resend-verification
   @access  Public
============================= */
export const resendVerificationEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ErrorResponse("Email is required", 400);
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw new ErrorResponse("User not found", 404);
  }

  if (user.emailVerified) {
    return res.status(400).json({
      success: false,
      message: "Email is already verified",
    });
  }

  const hasLocalAuth = user.authProviders?.some((p) => p.provider === "local");

  if (!hasLocalAuth) {
    throw new ErrorResponse(
      "This account uses OAuth and does not require email verification",
      400,
    );
  }

  const verificationToken = user.getEmailVerificationToken();
  await user.save({ validateBeforeSave: false });

  const verifyUrl = `${process.env.FRONTEND_URL}/auth/verify-email/${verificationToken}`;

  await sendVerificationEmail({
    email: user.email,
    name: user.name,
    verificationUrl: verifyUrl,
  });

  res.status(200).json({
    success: true,
    message: "Verification email resent successfully! Please check your inbox.",
  });
});

/* =============================
   @desc    Update password
   @route   PUT /api/auth/update-password
   @access  Private
============================= */
export const updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ErrorResponse("Please provide current and new password", 400);
  }

  const user = await User.findById(req.user._id).select("+password");

  const isMatch = await user.matchPassword(currentPassword);

  if (!isMatch) {
    throw new ErrorResponse("Current password is incorrect", 401);
  }

  user.password = newPassword;
  await user.save();

  await sendTokenResponse(user, 200, res, "Password updated successfully");
});

/* =============================
   @desc    Forgot password
   @route   POST /api/auth/forgot-password
   @access  Public
============================= */
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ErrorResponse("Please provide your email", 400);
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw new ErrorResponse("No user found with this email", 404);
  }

  const hasLocalAuth = user.authProviders?.some((p) => p.provider === "local");

  if (!hasLocalAuth) {
    throw new ErrorResponse(
      "This account uses OAuth. Cannot reset password.",
      400,
    );
  }

  const resetToken = user.getResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.FRONTEND_URL}/auth/reset-password/${resetToken}`;

  await sendPasswordResetEmail({
    email: user.email,
    name: user.name,
    resetUrl,
  });

  res.status(200).json({
    success: true,
    message: "Password reset email sent. Check your inbox.",
  });
});


/* =============================
   @desc    Verify email and complete registration
   @route   GET /api/auth/verify-email/:token
   @access  Public
============================= */

export const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;

  if (!token) {
    throw new ErrorResponse("Verification token is required", 400);
  }

  const hashedToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpire: { $gt: Date.now() }, // ✅ check expiration
  });

  if (!user) {
    throw new ErrorResponse(
      "Invalid or expired verification token",
      400
    );
  }

  let workspaceId = null;
  let isFirstTimeVerification = false;

  // 🔐 First-time verification
  if (!user.emailVerified) {
    isFirstTimeVerification = true;

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;

    // 🔹 Handle invitation
    if (user.pendingInvitation) {
      const invitation = await Invitation.findById(user.pendingInvitation);

      if (invitation) {
        const workspace = await Workspace.findById(invitation.workspace);

        if (workspace) {
          await workspace.addMember(
            user._id,
            invitation.role || "member",
            invitation.invitedBy
          );

          await user.addWorkspace(
            workspace._id,
            invitation.role || "member",
            false
          );

          workspaceId = workspace._id;
          await invitation.accept(user._id);
        }
      }

      user.pendingInvitation = null;
    }

    // 🔹 Create personal workspace if none
    if (!workspaceId) {
      const workspace = await Workspace.create({
        name: `${user.name}'s Workspace`,
        owner: user._id,
        members: [
          {
            user: user._id,
            role: "owner",
            joinedAt: new Date(),
          },
        ],
      });

      workspaceId = workspace._id;

      await user.addWorkspace(workspaceId, "owner", true);
    }

    await user.save({ validateBeforeSave: false });

    // ✅ Send welcome email SAFELY (non-blocking)
    sendWelcomeEmail({
      email: user.email,
      name: user.name,
    })
      .then(() =>
        console.log(`✅ Welcome email sent to ${user.email}`)
      )
      .catch((err) =>
        console.error(
          `❌ Welcome email failed for ${user.email}:`,
          err.message
        )
      );
  }

  // 🔐 Always issue tokens
  const accessToken = user.getSignedJwtToken();

  const refreshTokenObj = user.getRefreshToken({
    type: "web",
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  if (!user.refreshTokens) user.refreshTokens = [];
  user.refreshTokens.push(refreshTokenObj);

  await user.save({ validateBeforeSave: false });

  return res.status(200).json({
    success: true,
    message: isFirstTimeVerification
      ? "Email verified successfully!"
      : "Email already verified!",
    accessToken,
    refreshToken: refreshTokenObj.token,
    workspaceId,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      authProviders: user.authProviders,
    },
  });
});


/* =============================
   @desc    Reset password
   @route   POST /api/auth/reset-password/:token
   @access  Public
============================= */
export const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  if (!newPassword) {
    throw new ErrorResponse("Please provide a new password", 400);
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() },
  }).select("+password");

  if (!user) {
    throw new ErrorResponse("Invalid or expired reset token", 400);
  }

  user.password = newPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  // Send success email
  try {
    await sendPasswordResetSuccessEmail({
      email: user.email,
      name: user.name,
    });
  } catch (emailError) {
    console.error("Failed to send password reset success email:", emailError);
  }

  const accessToken = user.getSignedJwtToken();
  const refreshToken = user.getRefreshToken({
    type: "web",
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  user.refreshTokens.push(refreshToken);
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: "Password has been reset successfully!",
    accessToken,
    refreshToken: refreshToken.token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
    },
  });
});

/* =============================
   UPDATED: Google OAuth callback with Welcome Email
   For NEW users only
============================= */
export const googleCallback = asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.redirect(
      `${process.env.FRONTEND_URL}/login?error=authentication_failed`
    );
  }

  const { email, name, googleId } = req.user;

  let user = await User.findOne({ email }).notDeleted();
  let isNewUser = false;

  if (!user) {
    // 🔥 Truly NEW user
    isNewUser = true;

    user = await User.create({
      name,
      email,
      emailVerified: true,
      authProviders: [
        {
          provider: "google",
          providerId: googleId,
          connectedAt: new Date(),
        },
      ],
    });
  } else {
    // Existing user → link Google if not linked
    const alreadyLinked = user.authProviders.some(
      (p) => p.provider === "google"
    );

    if (!alreadyLinked) {
      user.authProviders.push({
        provider: "google",
        providerId: googleId,
        connectedAt: new Date(),
      });
    }

    user.emailVerified = true;
    await user.save();
  }

  // Create workspace if none exists
  const existingWorkspace = await Workspace.findOne({ owner: user._id });

  if (!existingWorkspace) {
    const workspace = await Workspace.create({
      name: `${user.name}'s Workspace`,
      owner: user._id,
      members: [{ user: user._id, role: "owner" }],
    });

    await user.addWorkspace(workspace._id, "owner", true);
  }

  // ✅ Send welcome email ONLY for truly new users
  if (isNewUser) {
    sendWelcomeEmail({
      email: user.email,
      name: user.name,
    })
      .then(() =>
        console.log(`✅ Welcome email sent to new OAuth user: ${user.email}`)
      )
      .catch((err) =>
        console.error(
          `❌ Welcome email failed for OAuth user:`,
          err.message
        )
      );
  }

  await user.trackLogin(req.ip, req.headers["user-agent"]);

  return sendTokenResponse(
    user,
    200,
    res,
    "Login Successful via Google",
    `${process.env.FRONTEND_URL}/auth/callback`
  );
});

/* =============================
   UPDATED: LinkedIn OAuth callback with Welcome Email
   For NEW users only
============================= */
export const linkedinCallback = asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.redirect(
      `${process.env.FRONTEND_URL}/login?error=linkedin_auth_failed`
    );
  }

  const { email, name, linkedinId } = req.user;

  let user = await User.findOne({ email }).notDeleted();
  let isNewUser = false;

  // 🔥 Truly new user
  if (!user) {
    isNewUser = true;

    user = await User.create({
      name,
      email,
      emailVerified: true,
      authProviders: [
        {
          provider: "linkedin",
          providerId: linkedinId,
          connectedAt: new Date(),
        },
      ],
    });
  } else {
    // Existing user → link LinkedIn if not already linked
    const alreadyLinked = user.authProviders.some(
      (p) => p.provider === "linkedin"
    );

    if (!alreadyLinked) {
      user.authProviders.push({
        provider: "linkedin",
        providerId: linkedinId,
        connectedAt: new Date(),
      });
    }

    user.emailVerified = true;

    await user.save(); // ✅ IMPORTANT
  }

  // ✅ Ensure workspace exists
  const existingWorkspace = await Workspace.findOne({ owner: user._id });

  if (!existingWorkspace) {
    const workspace = await Workspace.create({
      name: `${user.name}'s Workspace`,
      owner: user._id,
      members: [{ user: user._id, role: "owner" }],
    });

    await user.addWorkspace(workspace._id, "owner", true);
  }

  await user.trackLogin(req.ip, req.headers["user-agent"]);

  return sendTokenResponse(
    user,
    200,
    res,
    "Login Successful via LinkedIn",
    `${process.env.FRONTEND_URL}/auth/callback`
  );
});


/* =============================
   @desc    Get auth providers
   @route   GET /api/auth/providers
   @access  Private
============================= */
export const getAuthProviders = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    throw new ErrorResponse("User not found", 404);
  }

  const providers = user.authProviders.map((p) => ({
    provider: p.provider,
    connectedAt: p.connectedAt,
  }));

  res.status(200).json({
    success: true,
    data: {
      email: user.email,
      providers,
    },
  });
});

/* =============================
   @desc    Disconnect provider
   @route   DELETE /api/auth/providers/:provider
   @access  Private
============================= */
export const disconnectProvider = asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const user = await User.findById(req.user._id).select("+password");

  if (!["google", "linkedin", "local"].includes(provider)) {
    throw new ErrorResponse("Invalid provider", 400);
  }

  if (user.authProviders.length === 1) {
    throw new ErrorResponse(
      "Cannot disconnect the only authentication method",
      400,
    );
  }

  user.authProviders = user.authProviders.filter(
    (p) => p.provider !== provider,
  );

  if (provider === "local") {
    user.password = undefined;
  }

  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: `${provider} disconnected successfully`,
    data: {
      providers: user.authProviders.map((p) => ({
        provider: p.provider,
        connectedAt: p.connectedAt,
      })),
    },
  });
});

/* =============================
   @desc    Delete account (soft delete)
   @route   DELETE /api/auth/delete-account
   @access  Private
============================= */
export const deleteAccount = asyncHandler(async (req, res) => {
  const { password } = req.body;

  if (!password) {
    throw new ErrorResponse("Password required", 400);
  }

  const user = await User.findById(req.user._id).select("+password");

  if (!user) {
    throw new ErrorResponse("User not found", 404);
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new ErrorResponse("Incorrect password", 401);
  }

  await user.softDelete();

  res.status(200).json({
    success: true,
    message: "Account deleted successfully",
  });
});

/* =============================
   @desc    Delete account (Hard delete) - PERMANENT
   @route   DELETE /api/auth/hard-delete-account
   @access  Private
============================= */
export const hardDeleteAccount = asyncHandler(async (req, res) => {
  const { password, confirmText } = req.body;

  // Require password confirmation
  if (!password) {
    throw new ErrorResponse("Password required", 400);
  }

  // Require typing "DELETE MY ACCOUNT" for safety
  if (confirmText !== "DELETE MY ACCOUNT") {
    throw new ErrorResponse('Please type "DELETE MY ACCOUNT" to confirm', 400);
  }

  const user = await User.findById(req.user._id).select("+password");

  if (!user) {
    throw new ErrorResponse("User not found", 404);
  }

  // Verify password
  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new ErrorResponse("Incorrect password", 401);
  }

  // Delete user's profile image from Cloudinary if exists
  if (user.profile?.image?.publicId) {
    try {
      await cloudinary.uploader.destroy(user.profile.image.publicId);
    } catch (error) {
      console.error("Failed to delete profile image:", error);
    }
  }

  // Remove user from all workspaces
  await Workspace.updateMany(
    { "members.user": user._id },
    { $pull: { members: { user: user._id } } },
  );

  // Delete owned workspaces (cascade will handle projects/tasks)
  await Workspace.deleteMany({ owner: user._id });

  // Hard delete the user
  await user.deleteOne();

  res.status(200).json({
    success: true,
    message: "Account permanently deleted",
  });
});

// Export at the end of file
export { sendTokenResponse };
