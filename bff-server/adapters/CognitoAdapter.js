/**
 * Cognito Adapter
 * Abstracts AWS Cognito operations
 */

const {
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
  AdminDeleteUserCommand,
  AdminUpdateUserAttributesCommand,
  AdminListGroupsForUserCommand,
  AdminRemoveUserFromGroupCommand,
  ListUsersCommand,
  ListGroupsCommand,
  ListUsersInGroupCommand
} = require('@aws-sdk/client-cognito-identity-provider');
const { getCognitoClient } = require('../config/clients');
const { config } = require('../config/environment');
const { isFlagTrue } = require('../utils/flagValidation');
const { sanitizeError } = require('../utils/errorHandler');

class CognitoAdapter {
  constructor() {
    this.client = getCognitoClient();
    this.userPoolId = config.cognitoUserPoolId;
  }

  /**
   * Create user
   */
  async createUser(username, email, desiredDeliveryMediums = ['EMAIL']) {
    const command = new AdminCreateUserCommand({
      UserPoolId: this.userPoolId,
      Username: username,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
      ],
      DesiredDeliveryMediums: desiredDeliveryMediums,
    });

    const result = await this.client.send(command);
    return result.User;
  }

  /**
   * Add user to group
   */
  async addUserToGroup(username, groupName) {
    const command = new AdminAddUserToGroupCommand({
      UserPoolId: this.userPoolId,
      Username: username,
      GroupName: groupName,
    });

    await this.client.send(command);
  }

  /**
   * Delete user
   */
  async deleteUser(username) {
    const command = new AdminDeleteUserCommand({
      UserPoolId: this.userPoolId,
      Username: username,
    });

    await this.client.send(command);
  }

  /**
   * List users
   */
  async listUsers(limit = 60, filter = null) {
    const params = {
      UserPoolId: this.userPoolId,
      Limit: limit,
    };

    if (filter) {
      params.Filter = filter;
    }

    const command = new ListUsersCommand(params);
    const result = await this.client.send(command);

    return result.Users || [];
  }

  /**
   * Find user by email
   */
  async findUserByEmail(email) {
    // Validate and escape email to prevent filter injection
    if (!email || typeof email !== 'string') {
      throw new Error('Invalid email parameter');
    }

    // Escape double quotes in email to prevent filter injection
    const escapedEmail = email.replace(/"/g, '\\"');

    // Additional validation: ensure email format is reasonable
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    const users = await this.listUsers(60, `email = "${escapedEmail}"`);
    return users.length > 0 ? users[0] : null;
  }

  /**
   * List all users with pagination support
   */
  async listAllUsers(limit = 60) {
    const allUsers = [];
    let paginationToken = null;

    do {
      const params = {
        UserPoolId: this.userPoolId,
        Limit: limit,
      };

      if (paginationToken) {
        params.PaginationToken = paginationToken;
      }

      const command = new ListUsersCommand(params);
      const result = await this.client.send(command);

      if (result.Users) {
        allUsers.push(...result.Users);
      }

      paginationToken = result.PaginationToken;
    } while (paginationToken);

    return allUsers;
  }

  /**
   * Create users in bulk (with update and delete support)
   */
  async createUsersBulk(records) {
    const results = [];
    let successCount = 0;
    let failCount = 0;
    let deletedCount = 0;
    let updatedCount = 0;

    // Separate records by operation type
    // Strict validation: only true, 1, or "1" are considered delete requests
    const toDelete = records.filter(r => isFlagTrue(r.deleteFlag));
    const toUpdate = records.filter(r => !isFlagTrue(r.deleteFlag) && isFlagTrue(r.updateFlag));
    const toCreate = records.filter(r => !isFlagTrue(r.deleteFlag) && !isFlagTrue(r.updateFlag));

    // Process deletions first
    for (let i = 0; i < toDelete.length; i++) {
      const record = toDelete[i];
      const { email, username } = record;
      const rowIndex = records.indexOf(record) + 2;

      if (!email && !username) {
        results.push({
          row: rowIndex,
          success: false,
          message: '削除するには email または username が必要です'
        });
        failCount++;
        continue;
      }

      try {
        // Find user by email or username
        let userToDelete = null;
        if (email) {
          userToDelete = await this.findUserByEmail(email);
        } else if (username) {
          const users = await this.listUsers(60, `username = "${username}"`);
          userToDelete = users.length > 0 ? users[0] : null;
        }

        if (!userToDelete) {
          throw new Error(`ユーザーが見つかりません: ${email || username}`);
        }

        // Delete user
        await this.deleteUser(userToDelete.Username);

        results.push({
          row: rowIndex,
          success: true,
          username: userToDelete.Username,
          operation: 'deleted'
        });
        deletedCount++;
        successCount++;
      } catch (error) {
        console.error(`[Cognito] Failed to delete user ${email || username}:`, error.message);
        const userFriendlyMessage = sanitizeError(error, 'cognito');
        results.push({
          row: rowIndex,
          success: false,
          message: userFriendlyMessage,
          username: username || email,
          operation: 'delete'
        });
        failCount++;
      }
    }

    // Process updates
    for (let i = 0; i < toUpdate.length; i++) {
      const record = toUpdate[i];
      const { email, username, group } = record;
      const rowIndex = records.indexOf(record) + 2;

      if (!email && !username) {
        results.push({
          row: rowIndex,
          success: false,
          message: '更新するには email または username が必要です'
        });
        failCount++;
        continue;
      }

      try {
        // Find user by email or username
        let existingUser = null;
        if (email) {
          existingUser = await this.findUserByEmail(email);
        } else if (username) {
          const users = await this.listUsers(60, `username = "${username}"`);
          existingUser = users.length > 0 ? users[0] : null;
        }

        if (!existingUser) {
          throw new Error(`ユーザーが見つかりません: ${email || username}`);
        }

        const actualUsername = existingUser.Username;

        // Update email if provided and different
        if (email) {
          const currentEmail = existingUser.Attributes.find(attr => attr.Name === 'email')?.Value;
          if (currentEmail !== email) {
            await this.updateUserAttributes(actualUsername, [
              { Name: 'email', Value: email },
              { Name: 'email_verified', Value: 'true' }
            ]);
            console.log(`[Cognito] Updated email for ${actualUsername}: ${currentEmail} -> ${email}`);
          }
        }

        // Update group membership if specified
        if (group) {
          // Get current groups for user
          const currentGroups = await this.listUserGroups(actualUsername);
          const currentGroupNames = currentGroups.map(g => g.GroupName);

          // Remove from all current groups
          for (const currentGroup of currentGroupNames) {
            await this.removeUserFromGroup(actualUsername, currentGroup);
            console.log(`[Cognito] Removed ${actualUsername} from group: ${currentGroup}`);
          }

          // Add to new group
          await this.addUserToGroup(actualUsername, group);
          console.log(`[Cognito] Added ${actualUsername} to group: ${group}`);
        }

        results.push({
          row: rowIndex,
          success: true,
          username: actualUsername,
          operation: 'updated'
        });
        updatedCount++;
        successCount++;
      } catch (error) {
        console.error(`[Cognito] Failed to update user ${email || username}:`, error.message);
        const userFriendlyMessage = sanitizeError(error, 'cognito');
        results.push({
          row: rowIndex,
          success: false,
          message: userFriendlyMessage,
          username: username || email,
          operation: 'update'
        });
        failCount++;
      }
    }

    // Process creations
    for (let i = 0; i < toCreate.length; i++) {
      const record = toCreate[i];
      const { email, username, group } = record;
      const rowIndex = records.indexOf(record) + 2;

      if (!email || !username) {
        results.push({
          row: rowIndex,
          success: false,
          message: 'email と username は必須です'
        });
        failCount++;
        continue;
      }

      try {
        // Check for duplicate email
        const existingUser = await this.findUserByEmail(email);

        if (existingUser) {
          throw new Error(`メールアドレス ${email} は既に登録されています`);
        }

        // Create user
        await this.createUser(username, email);

        // Add to group if specified
        if (group) {
          await this.addUserToGroup(username, group);
        }

        results.push({
          row: rowIndex,
          success: true,
          username,
          operation: 'created'
        });
        successCount++;
      } catch (error) {
        console.error(`[Cognito] Failed to create user ${username}:`, error.message);
        const userFriendlyMessage = sanitizeError(error, 'cognito');
        results.push({
          row: rowIndex,
          success: false,
          message: userFriendlyMessage,
          username,
          operation: 'create'
        });
        failCount++;
      }
    }

    return {
      success: failCount === 0,
      recordsProcessed: successCount,
      recordsDeleted: deletedCount,
      recordsUpdated: updatedCount,
      recordsFailed: failCount,
      results
    };
  }

  /**
   * List all groups with pagination support
   */
  async listGroups(limit = 60) {
    const allGroups = [];
    let nextToken = null;

    do {
      const params = {
        UserPoolId: this.userPoolId,
        Limit: limit,
      };

      if (nextToken) {
        params.NextToken = nextToken;
      }

      const command = new ListGroupsCommand(params);
      const result = await this.client.send(command);

      if (result.Groups) {
        allGroups.push(...result.Groups);
      }

      nextToken = result.NextToken;
    } while (nextToken);

    return allGroups;
  }

  /**
   * List all users in a specific group with pagination support
   */
  async listUsersInGroup(groupName, limit = 60) {
    const allUsers = [];
    let nextToken = null;

    do {
      const params = {
        UserPoolId: this.userPoolId,
        GroupName: groupName,
        Limit: limit,
      };

      if (nextToken) {
        params.NextToken = nextToken;
      }

      const command = new ListUsersInGroupCommand(params);
      const result = await this.client.send(command);

      if (result.Users) {
        allUsers.push(...result.Users);
      }

      nextToken = result.NextToken;
    } while (nextToken);

    return allUsers;
  }

  /**
   * Get all users with their group memberships
   * More efficient than calling AdminListGroupsForUser for each user
   */
  async getUsersWithGroups() {
    // Get all users
    const users = await this.listAllUsers();

    // Get all groups
    const groups = await this.listGroups();

    // Create a map: username -> list of groups
    const userGroupMap = new Map();

    // Initialize map with empty arrays
    for (const user of users) {
      userGroupMap.set(user.Username, []);
    }

    // For each group, get members and populate the map
    for (const group of groups) {
      const groupMembers = await this.listUsersInGroup(group.GroupName);

      for (const member of groupMembers) {
        const groupList = userGroupMap.get(member.Username);
        if (groupList) {
          groupList.push(group.GroupName);
        }
      }
    }

    // Build result array with user info and groups
    return users.map(user => ({
      username: user.Username,
      email: user.Attributes?.find(a => a.Name === 'email')?.Value || '',
      status: user.UserStatus,
      enabled: user.Enabled,
      createdAt: user.UserCreateDate,
      groups: userGroupMap.get(user.Username) || []
    }));
  }

  /**
   * Update user attributes
   */
  async updateUserAttributes(username, attributes) {
    const command = new AdminUpdateUserAttributesCommand({
      UserPoolId: this.userPoolId,
      Username: username,
      UserAttributes: attributes
    });

    await this.client.send(command);
  }

  /**
   * List groups for a user
   */
  async listUserGroups(username) {
    const command = new AdminListGroupsForUserCommand({
      UserPoolId: this.userPoolId,
      Username: username
    });

    const result = await this.client.send(command);
    return result.Groups || [];
  }

  /**
   * Remove user from group
   */
  async removeUserFromGroup(username, groupName) {
    const command = new AdminRemoveUserFromGroupCommand({
      UserPoolId: this.userPoolId,
      Username: username,
      GroupName: groupName
    });

    await this.client.send(command);
  }
}

// Create singleton instance
const cognitoAdapter = new CognitoAdapter();

module.exports = cognitoAdapter;
