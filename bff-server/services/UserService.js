/**
 * User Service
 * Handles user creation, management, and Cognito-Moodle mapping
 */

const moodleAdapter = require('../adapters/MoodleAdapter');

// Cognito group to Moodle role mapping
const COGNITO_TO_MOODLE_ROLE_MAPPING = {
  'Administrators': 'manager',
  'CourseCreators': 'coursecreator',
  'Teachers': 'editingteacher',
};

class UserService {
  /**
   * Get or create Moodle user from Cognito payload
   */
  async getOrCreateMoodleUser(cognitoPayload) {
    const { email, sub } = cognitoPayload;

    if (!sub) {
      throw new Error('Cognito sub is required');
    }

    // Try to find existing user by idnumber (Cognito sub)
    try {
      const moodleUsers = await moodleAdapter.getUsersByField('idnumber', [sub]);

      if (moodleUsers && moodleUsers.length > 0) {
        const user = moodleUsers[0];
        console.log('Moodle user found by idnumber:', { id: user.id, username: user.username });

        // Sync email if changed
        if (user.email !== email) {
          console.log('Email mismatch, syncing to Moodle:', {
            moodleEmail: user.email,
            cognitoEmail: email
          });
          try {
            await moodleAdapter.updateUsers([{ id: user.id, email }]);
            console.log('Moodle email updated successfully');
          } catch (updateError) {
            console.error('Failed to sync email to Moodle:', updateError.message);
          }
        }

        return {
          id: user.id,
          username: user.username
        };
      }

      // User not found by idnumber, try finding by email
      console.log('Moodle user not found by idnumber, searching by email:', email);
      const usersByEmail = await moodleAdapter.getUsersByField('email', [email]);

      if (usersByEmail && usersByEmail.length > 0) {
        const user = usersByEmail[0];
        console.log('Moodle user found by email:', { id: user.id, username: user.username });
        console.log('Updating idnumber to link with Cognito sub:', sub);

        // Update idnumber to link with Cognito
        try {
          await moodleAdapter.callAPI('core_user_update_users', {
            'users[0][id]': user.id,
            'users[0][idnumber]': sub
          });
          console.log('Moodle user idnumber updated successfully');

          return {
            id: user.id,
            username: user.username
          };
        } catch (updateError) {
          console.error('Failed to update idnumber:', updateError.message);
          throw updateError;
        }
      }

      // User not found by idnumber or email, create new one
      console.log('Moodle user not found. Creating new user for sub:', sub);
      return await this.createMoodleUser(cognitoPayload);
    } catch (error) {
      console.error('Failed to lookup Moodle user:', error.message);
      throw error;
    }
  }

  /**
   * Create Moodle user from Cognito payload
   */
  async createMoodleUser(cognitoPayload) {
    const { email, sub, 'cognito:username': cognitoUsername } = cognitoPayload;
    const groups = cognitoPayload['cognito:groups'] || [];

    // Parse name from Cognito
    const givenName = cognitoPayload.given_name || cognitoUsername || 'User';
    const familyName = cognitoPayload.family_name || 'User';

    // Generate username
    let username = email.split('@')[0];
    username = username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    // Generate temporary password (not used with Cognito auth)
    const tempPassword = `Temp${Math.random().toString(36).slice(-8)}!${Date.now()}`;

    console.log('[Create Moodle User] Attempting to create user:', {
      username,
      email,
      firstname: givenName,
      lastname: familyName,
      cognitoGroups: groups
    });

    try {
      const result = await moodleAdapter.createUsers([{
        username,
        password: tempPassword,
        firstname: givenName,
        lastname: familyName,
        email,
        auth: 'manual',
        idnumber: sub,
        lang: 'ja',
        timezone: 'Asia/Tokyo'
      }]);

      if (!result || result.length === 0 || !result[0].id) {
        throw new Error('User creation returned empty result');
      }

      const userId = result[0].id;
      const createdUsername = result[0].username;

      console.log('[Create Moodle User] User created successfully:', {
        id: userId,
        username: createdUsername
      });

      // Assign Moodle role based on Cognito groups
      await this.assignRoleFromCognitoGroups(userId, groups);

      return {
        id: userId,
        username: createdUsername
      };
    } catch (error) {
      console.error('[Create Moodle User] Error:', error.message);

      // Retry with unique username if duplicate
      if (error.message.includes('username') || error.message.includes('duplicate')) {
        const uniqueUsername = `${username}${Date.now().toString().slice(-6)}`;
        console.log('[Create Moodle User] Retrying with unique username:', uniqueUsername);

        const retryResult = await moodleAdapter.createUsers([{
          username: uniqueUsername,
          password: tempPassword,
          firstname: givenName,
          lastname: familyName,
          email,
          auth: 'manual',
          idnumber: sub,
          lang: 'ja',
          timezone: 'Asia/Tokyo'
        }]);

        if (retryResult && retryResult[0] && retryResult[0].id) {
          const userId = retryResult[0].id;
          const createdUsername = retryResult[0].username;

          console.log('[Create Moodle User] User created with unique username:', {
            id: userId,
            username: createdUsername
          });

          await this.assignRoleFromCognitoGroups(userId, groups);

          return {
            id: userId,
            username: createdUsername
          };
        }
      }

      throw error;
    }
  }

  /**
   * Assign Moodle system role based on Cognito groups
   */
  async assignRoleFromCognitoGroups(userId, groups) {
    let roleAssigned = false;

    for (const group of groups) {
      const moodleRole = COGNITO_TO_MOODLE_ROLE_MAPPING[group];
      if (moodleRole) {
        console.log(`[Assign Role] Cognito group '${group}' maps to Moodle role '${moodleRole}'`);
        const success = await this.assignMoodleSystemRole(userId, moodleRole);
        if (success) {
          roleAssigned = true;
          break; // Assign only the first matching role
        }
      }
    }

    if (!roleAssigned) {
      console.log('[Assign Role] No Cognito group matched. User will have default "Authenticated User" role only.');
    }
  }

  /**
   * Assign Moodle system role to user
   */
  async assignMoodleSystemRole(userid, roleshortname) {
    try {
      console.log(`[Assign Role] Attempting to assign '${roleshortname}' to user ${userid}`);

      // Get all roles and find role ID
      const roles = await moodleAdapter.getAllRoles();
      const role = roles.find(r => r.shortname === roleshortname);

      if (!role) {
        console.error(`[Assign Role] Role '${roleshortname}' not found in Moodle`);
        return false;
      }

      console.log(`[Assign Role] Found role: ${role.name} (ID: ${role.id})`);

      // Assign role in system context (contextid=1)
      await moodleAdapter.assignRoles([{
        roleid: role.id,
        userid: userid,
        contextid: 1 // System context
      }]);

      console.log(`[Assign Role] Successfully assigned '${roleshortname}' to user ${userid}`);
      return true;
    } catch (error) {
      console.error(`[Assign Role] Failed to assign role '${roleshortname}' to user ${userid}:`, error.message);
      return false;
    }
  }

  /**
   * Get user info by Moodle user ID
   */
  async getUserInfo(moodleUserId) {
    const users = await moodleAdapter.getUsersByField('id', [moodleUserId]);
    if (!users || users.length === 0) {
      return null;
    }
    return users[0];
  }
}

// Create singleton instance
const userService = new UserService();

module.exports = userService;
