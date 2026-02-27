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
   @desc    Register user
   @route   POST /api/auth/register
   @access  Public
============================= */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, invitationToken } = req.body;

  // Check if user exists (including soft-deleted)
  let user = await User.findOne({ email }).where("isDeleted").in([true, false]);

  // Restore soft-deleted account
  if (user?.isDeleted) {
    user.isDeleted = false;
    user.deletedAt = null;
    user.isActive = true;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: "Account restored. You can now login.",
    });
  }

  // Link local provider to existing OAuth account
  if (user) {
    const hasLocalAuth = user.authProviders.some((p) => p.provider === "local");

    if (!hasLocalAuth) {
      user.password = password;
      user.authProviders.push({
        provider: "local",
        providerId: null,
        connectedAt: new Date(),
      });
      await user.save();

      return res.status(200).json({
        success: true,
        message:
          "Account linked successfully. You can now login using email and password.",
      });
    }

    throw new ErrorResponse(
      "Account already exists. Please login instead.",
      400,
    );
  }

  // ✅ Create user instance in memory (NOT saved yet)
  user = new User({
    name,
    email,
    password,
    emailVerified: false,
    authProviders: [
      {
        provider: "local",
        providerId: null,
        connectedAt: new Date(),
      },
    ],
  });

  let workspaceId = null;
  let role = "owner";

  // Handle invitation
  if (invitationToken) {
    const invitation = await Invitation.findByToken(invitationToken);

    if (!invitation) {
      throw new ErrorResponse("Invalid or expired invitation", 400);
    }

    workspaceId = invitation.workspace;
    role = invitation.role || "member";

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new ErrorResponse("Workspace not found", 404);
    }

    await workspace.addMember(user._id, role, invitation.invitedBy);
    await user.addWorkspace(workspaceId, role, false);
    await invitation.accept(user._id);
  }

  // Create personal workspace if no invitation
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

  try {
    // Generate verification token in memory
    const verificationToken = user.getEmailVerificationToken();

    // Construct verification URL
    const verificationUrl = `${process.env.FRONTEND_URL}/auth/verify-email/${verificationToken}`;

    // Send verification email first
    await sendVerificationEmail({
      email: user.email,
      name: user.name,
      verificationUrl,
    });

    // Only save user to DB if email was sent successfully
    await user.save({ validateBeforeSave: false });

    res.status(201).json({
      success: true,
      message: "Registration successful! Please verify your email.",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        workspace: workspaceId,
        role,
        requiresVerification: true,
      },
    });
  } catch (error) {
    console.error("❌ Registration failed:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Registration failed. Please try again later.",
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
export const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;

  if (!token) {
    throw new ErrorResponse("Verification token is required", 400);
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({ emailVerificationToken: hashedToken });

  if (!user) {
    throw new ErrorResponse("Invalid verification token", 400);
  }

  if (user.emailVerificationExpire < Date.now()) {
    throw new ErrorResponse("Verification token has expired", 400);
  }

  if (user.emailVerified) {
    return res.status(200).json({
      success: true,
      message: "Email is already verified",
    });
  }

  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpire = undefined;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: "Email verified successfully!",
  });
});

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
   @desc    Reset password
   @route   PUT /api/auth/reset-password/:token
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
   @desc    Google OAuth callback
   @route   GET /api/auth/google/callback
   @access  Public
============================= */
export const googleCallback = asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.redirect(
      `${process.env.FRONTEND_URL}/login?error=authentication_failed`,
    );
  }

  const { email, name, googleId } = req.user;

  let user = await User.findOne({ email }).notDeleted();

  if (user) {
    const alreadyLinked = user.authProviders.some(
      (p) => p.provider === "google",
    );

    if (!alreadyLinked) {
      user.authProviders.push({
        provider: "google",
        providerId: googleId,
        connectedAt: new Date(),
      });
      user.emailVerified = true;
    }
  } else {
    user = await User.findOneAndUpdate(
      { email },
      {
        $setOnInsert: {
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
        },
      },
      { upsert: true, new: true },
    );
  }

  // Create personal workspace if doesn't exist
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
    "Login Successful via Google",
    `${process.env.FRONTEND_URL}/auth/callback`,
  );
});

/* =============================
   @desc    LinkedIn OAuth callback
   @route   GET /api/auth/linkedin/callback
   @access  Public
============================= */
export const linkedinCallback = asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.redirect(
      `${process.env.FRONTEND_URL}/login?error=linkedin_auth_failed`,
    );
  }

  const { email, name, linkedinId } = req.user;

  let user = await User.findOne({ email }).notDeleted();

  if (user) {
    const alreadyLinked = user.authProviders.some(
      (p) => p.provider === "linkedin",
    );

    if (!alreadyLinked) {
      user.authProviders.push({
        provider: "linkedin",
        providerId: linkedinId,
        connectedAt: new Date(),
      });
      user.emailVerified = true;
    }
  } else {
    user = await User.findOneAndUpdate(
      { email },
      {
        $setOnInsert: {
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
        },
      },
      { upsert: true, new: true },
    );
  }

  // Create personal workspace if doesn't exist
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
    `${process.env.FRONTEND_URL}/auth/callback`,
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
