// ============================================
// Load Environment Variables DIRECTLY
// ============================================
import dotenv from 'dotenv';
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';
import axios from 'axios';
import crypto from 'crypto';
import User from '../models/User.js';

/**
 * Passport OAuth Configuration
 */

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

/* -------------------------------------------------------------------------- */
/*                            Google OAuth Strategy                           */
/* -------------------------------------------------------------------------- */
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/api/auth/google/callback',
      scope: ['profile', 'email']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const name = profile.displayName;
        const googleId = profile.id;
        const avatar = profile.photos?.[0]?.value || null;

        let user = await User.findOne({ email });

        if (user) {
          if (user.authProviders?.some(p => p.provider === 'google')) {
            console.log(`✓ Google login: ${email}`);
            return done(null, user);
          } else {
            if (!user.authProviders) user.authProviders = [];
            
            user.authProviders.push({
              provider: 'google',
              providerId: googleId,
              connectedAt: new Date()
            });
            
            if (!user.avatar && avatar) user.avatar = avatar;
            user.emailVerified = true;
            
            await user.save({ validateBeforeSave: false });
            console.log(`✓ Google linked: ${email}`);
            return done(null, user);
          }
        } else {
          user = await User.create({
            name,
            email,
            password: crypto.randomBytes(32).toString('hex'),
            avatar,
            emailVerified: true,
            authProviders: [{
              provider: 'google',
              providerId: googleId,
              connectedAt: new Date()
            }]
          });
          
          console.log(`✓ New user via Google: ${email}`);
          return done(null, user);
        }
      } catch (error) {
        console.error('Google OAuth error:', error);
        return done(error, null);
      }
    }
  )
);

/* -------------------------------------------------------------------------- */
/*                     LinkedIn OAuth Strategy (Custom)                       */
/* -------------------------------------------------------------------------- */

// ✅ Custom LinkedIn Strategy using OAuth2 base
passport.use('linkedin', new OAuth2Strategy({
    authorizationURL: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenURL: 'https://www.linkedin.com/oauth/v2/accessToken',
    clientID: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    callbackURL: '/api/auth/linkedin/callback',
    scope: ['openid', 'profile', 'email'],
    state: true
  },
  async (accessToken, refreshToken, params, profile, done) => {
    try {
      console.log('📍 LinkedIn OAuth callback started');

      // ✅ Fetch user profile using LinkedIn API v2
      const [profileResponse, emailResponse] = await Promise.all([
        axios.get('https://api.linkedin.com/v2/userinfo', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'cache-control': 'no-cache',
            'X-Restli-Protocol-Version': '2.0.0'
          }
        }),
        axios.get('https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'cache-control': 'no-cache',
            'X-Restli-Protocol-Version': '2.0.0'
          }
        }).catch(() => null) // Fallback if this endpoint fails
      ]);

      const linkedinProfile = profileResponse.data;
      
      // ✅ Extract email from multiple possible sources
      let email = linkedinProfile.email;
      
      if (!email && emailResponse?.data) {
        email = emailResponse.data.elements?.[0]?.['handle~']?.emailAddress;
      }

      if (!email) {
        console.error('❌ No email returned from LinkedIn');
        return done(null, false, { 
          message: 'No email returned. Please ensure email permission is granted in LinkedIn app settings.' 
        });
      }

      const name = linkedinProfile.name || linkedinProfile.given_name + ' ' + linkedinProfile.family_name;
      const linkedinId = linkedinProfile.sub;
      const avatar = linkedinProfile.picture || null;

      console.log(`📧 LinkedIn email: ${email}`);

      // Find existing user
      let user = await User.findOne({ email });

      if (user) {
        // Check if LinkedIn already linked
        const hasLinkedIn = user.authProviders?.some(p => p.provider === 'linkedin');
        
        if (hasLinkedIn) {
          console.log(`✓ LinkedIn login: ${email}`);
          return done(null, user);
        } else {
          // Link LinkedIn to existing account
          if (!user.authProviders) user.authProviders = [];
          
          user.authProviders.push({
            provider: 'linkedin',
            providerId: linkedinId,
            connectedAt: new Date()
          });
          
          if (!user.avatar && avatar) user.avatar = avatar;
          user.emailVerified = true;
          
          await user.save({ validateBeforeSave: false });
          console.log(`✓ LinkedIn linked: ${email}`);
          return done(null, user);
        }
      } else {
        // Create new user
        user = await User.create({
          name: name || 'LinkedIn User',
          email,
          password: crypto.randomBytes(32).toString('hex'),
          avatar,
          emailVerified: true,
          authProviders: [{
            provider: 'linkedin',
            providerId: linkedinId,
            connectedAt: new Date()
          }]
        });
        
        console.log(`✓ New user via LinkedIn: ${email}`);
        return done(null, user);
      }
    } catch (error) {
      console.error('❌ LinkedIn OAuth error:', error.response?.data || error.message);
      return done(error, null);
    }
  }
));

export default passport;