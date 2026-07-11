/**
 * Moodle Adapter
 * Abstracts Moodle API calls and handles authentication
 */

const axios = require('axios');
const FormData = require('form-data');
const { config } = require('../config/environment');

class MoodleAdapter {
  constructor() {
    this.moodleUrl = config.moodleUrl;
    this.serviceAccountToken = null;
  }

  /**
   * Set service account token
   */
  setServiceToken(token) {
    this.serviceAccountToken = token;
  }

  /**
   * Get service account token
   */
  getServiceToken() {
    return this.serviceAccountToken;
  }

  /**
   * Authenticate service account and get token
   */
  async authenticateServiceAccount() {
    const { moodleServiceUsername, moodleServicePassword, moodleServiceName } = config;

    if (!moodleServiceUsername || !moodleServicePassword) {
      throw new Error('Service account credentials not configured');
    }

    try {
      console.log(`Authenticating service account: ${moodleServiceUsername}`);

      const params = new URLSearchParams();
      params.append('username', moodleServiceUsername);
      params.append('password', moodleServicePassword);
      params.append('service', moodleServiceName);

      const response = await axios.post(`${this.moodleUrl}/login/token.php`, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      this.serviceAccountToken = response.data.token;
      console.log('Service account token obtained successfully');

      return this.serviceAccountToken;
    } catch (error) {
      console.error('Failed to get service account token:', error.message);
      throw error;
    }
  }

  /**
   * Call Moodle Web Service API
   * @param {string} wsfunction - Web service function name
   * @param {Object} params - Parameters
   * @returns {Promise<any>} API response
   */
  async callAPI(wsfunction, params = {}) {
    if (!this.serviceAccountToken) {
      throw new Error('Service account token not available. Server may still be initializing.');
    }

    console.log(`[DEBUG] callMoodleAPI: ${wsfunction}`, params);

    const formData = new FormData();
    formData.append('wstoken', this.serviceAccountToken);
    formData.append('wsfunction', wsfunction);
    formData.append('moodlewsrestformat', 'json');

    Object.keys(params).forEach(key => {
      const value = params[key];

      // Handle arrays - Moodle expects array[0], array[1], etc.
      if (Array.isArray(value)) {
        console.log(`[DEBUG] Appending array param: ${key} with ${value.length} items`);
        value.forEach((item, index) => {
          formData.append(`${key}[${index}]`, item);
        });
      } else {
        console.log(`[DEBUG] Appending param: ${key} = ${value} (type: ${typeof value})`);
        formData.append(key, value);
      }
    });

    try {
      const response = await axios.post(`${this.moodleUrl}/webservice/rest/server.php`, formData, {
        headers: formData.getHeaders(),
        timeout: 30000
      });

      if (response.data?.exception) {
        console.error(`API Call Failed: ${wsfunction}`, JSON.stringify(response.data, null, 2));
        throw new Error(response.data.message || response.data.errorcode);
      }

      return response.data;
    } catch (error) {
      console.error(`Moodle API error (${wsfunction}):`, error.message);
      throw error;
    }
  }

  /**
   * Get all courses
   */
  async getCourses() {
    return this.callAPI('core_course_get_courses');
  }

  /**
   * Get enrolled courses by user ID
   */
  async getEnrolledCourses(userid) {
    return this.callAPI('core_enrol_get_users_courses', { userid });
  }

  /**
   * Get course contents
   */
  async getCourseContents(courseid) {
    return this.callAPI('core_course_get_contents', { courseid });
  }

  /**
   * Get courses by field
   */
  async getCoursesByField(field, value) {
    return this.callAPI('core_course_get_courses_by_field', { field, value });
  }

  /**
   * Search courses
   */
  async searchCourses(query) {
    return this.callAPI('core_course_search_courses', {
      criterianame: 'search',
      criteriavalue: query
    });
  }

  /**
   * Get categories
   */
  async getCategories() {
    return this.callAPI('core_course_get_categories');
  }

  /**
   * Create categories (bulk)
   */
  async createCategories(categories) {
    const params = {};
    categories.forEach((category, index) => {
      params[`categories[${index}][name]`] = category.name;
      if (category.parent !== undefined) {
        params[`categories[${index}][parent]`] = parseInt(category.parent, 10);
      } else {
        params[`categories[${index}][parent]`] = 0;
      }
      if (category.idnumber) params[`categories[${index}][idnumber]`] = category.idnumber;
      if (category.description) params[`categories[${index}][description]`] = category.description;
      if (category.descriptionformat !== undefined) params[`categories[${index}][descriptionformat]`] = category.descriptionformat;
      // Note: visible parameter is not supported by core_course_create_categories API
      // if (category.visible !== undefined) params[`categories[${index}][visible]`] = category.visible ? 1 : 0;
      if (category.theme) params[`categories[${index}][theme]`] = category.theme;
    });

    return this.callAPI('core_course_create_categories', params);
  }

  /**
   * Update categories (bulk)
   */
  async updateCategories(categories) {
    const params = {};
    categories.forEach((category, index) => {
      params[`categories[${index}][id]`] = parseInt(category.id, 10);

      if (category.name) params[`categories[${index}][name]`] = category.name;
      if (category.parent !== undefined) params[`categories[${index}][parent]`] = parseInt(category.parent, 10);
      if (category.idnumber !== undefined) params[`categories[${index}][idnumber]`] = category.idnumber;
      if (category.description !== undefined) params[`categories[${index}][description]`] = category.description;
      if (category.descriptionformat !== undefined) params[`categories[${index}][descriptionformat]`] = category.descriptionformat;
      // Note: visible parameter is not supported by core_course_update_categories API
      // if (category.visible !== undefined) params[`categories[${index}][visible]`] = category.visible ? 1 : 0;
      if (category.theme !== undefined) params[`categories[${index}][theme]`] = category.theme;
    });

    return this.callAPI('core_course_update_categories', params);
  }

  /**
   * Delete categories (bulk)
   */
  async deleteCategories(categoryIds) {
    const params = {};
    categoryIds.forEach((id, index) => {
      params[`categories[${index}][id]`] = parseInt(id, 10);
      params[`categories[${index}][newparent]`] = 0; // Move contents to top level
      params[`categories[${index}][recursive]`] = 1; // Delete recursively
    });

    return this.callAPI('core_course_delete_categories', params);
  }

  /**
   * Create courses (bulk)
   */
  async createCourses(courses) {
    const params = {};
    courses.forEach((course, index) => {
      params[`courses[${index}][fullname]`] = course.fullname;
      params[`courses[${index}][shortname]`] = course.shortname;
      params[`courses[${index}][categoryid]`] = parseInt(course.categoryid, 10);

      // Always enable completion tracking
      params[`courses[${index}][enablecompletion]`] = 1;

      if (course.summary) params[`courses[${index}][summary]`] = course.summary;
      if (course.summaryformat !== undefined) params[`courses[${index}][summaryformat]`] = course.summaryformat;
      if (course.format) params[`courses[${index}][format]`] = course.format;
      if (course.visible !== undefined) params[`courses[${index}][visible]`] = course.visible ? 1 : 0;
      if (course.startdate) params[`courses[${index}][startdate]`] = course.startdate;
      if (course.enddate) params[`courses[${index}][enddate]`] = course.enddate;
    });

    return this.callAPI('core_course_create_courses', params);
  }

  /**
   * Update courses (bulk)
   */
  async updateCourses(courses) {
    const params = {};
    courses.forEach((course, index) => {
      params[`courses[${index}][id]`] = parseInt(course.id, 10);

      // Always enable completion tracking
      params[`courses[${index}][enablecompletion]`] = 1;

      if (course.fullname) params[`courses[${index}][fullname]`] = course.fullname;
      if (course.shortname) params[`courses[${index}][shortname]`] = course.shortname;
      if (course.categoryid !== undefined) params[`courses[${index}][categoryid]`] = parseInt(course.categoryid, 10);
      if (course.summary) params[`courses[${index}][summary]`] = course.summary;
      if (course.summaryformat !== undefined) params[`courses[${index}][summaryformat]`] = course.summaryformat;
      if (course.format) params[`courses[${index}][format]`] = course.format;
      if (course.visible !== undefined) params[`courses[${index}][visible]`] = course.visible ? 1 : 0;
      if (course.startdate) params[`courses[${index}][startdate]`] = course.startdate;
      if (course.enddate) params[`courses[${index}][enddate]`] = course.enddate;

      // Overview files (course images)
      if (course.overviewfiles && Array.isArray(course.overviewfiles)) {
        course.overviewfiles.forEach((file, fileIndex) => {
          params[`courses[${index}][courseformatoptions][${fileIndex}][name]`] = 'overviewfiles_filemanager';
          params[`courses[${index}][courseformatoptions][${fileIndex}][value]`] = file.itemid;
        });
      }
    });

    return this.callAPI('core_course_update_courses', params);
  }

  /**
   * Delete courses (bulk)
   */
  async deleteCourses(courseIds) {
    const params = {};
    courseIds.forEach((id, index) => {
      params[`courseids[${index}]`] = parseInt(id, 10);
    });

    return this.callAPI('core_course_delete_courses', params);
  }

  /**
   * Check if user is already enrolled in course
   */
  async isUserEnrolledInCourse(userid, courseid) {
    const enrolledCourses = await this.getEnrolledCourses(userid);

    if (!Array.isArray(enrolledCourses)) {
      return false;
    }

    return enrolledCourses.some(course => course.id === parseInt(courseid, 10));
  }

  /**
   * Enroll user in course
   */
  async enrollUser(userid, courseid, roleid = 5) {
    return this.callAPI('enrol_manual_enrol_users', {
      'enrolments[0][roleid]': roleid,
      'enrolments[0][userid]': userid,
      'enrolments[0][courseid]': parseInt(courseid, 10)
    });
  }

  /**
   * Get user by field
   */
  async getUsersByField(field, values) {
    const params = { field };
    values.forEach((value, index) => {
      params[`values[${index}]`] = value;
    });
    return this.callAPI('core_user_get_users_by_field', params);
  }

  /**
   * Create users (bulk)
   */
  async createUsers(users) {
    const params = {};
    users.forEach((user, index) => {
      params[`users[${index}][username]`] = user.username;
      params[`users[${index}][password]`] = user.password;
      params[`users[${index}][firstname]`] = user.firstname;
      params[`users[${index}][lastname]`] = user.lastname;
      params[`users[${index}][email]`] = user.email;
      params[`users[${index}][auth]`] = user.auth || 'manual';
      if (user.idnumber) params[`users[${index}][idnumber]`] = user.idnumber;
      if (user.lang) params[`users[${index}][lang]`] = user.lang;
      if (user.timezone) params[`users[${index}][timezone]`] = user.timezone;
    });

    return this.callAPI('core_user_create_users', params);
  }

  /**
   * Update users
   */
  async updateUsers(users) {
    const params = {};
    users.forEach((user, index) => {
      params[`users[${index}][id]`] = user.id;
      if (user.email) params[`users[${index}][email]`] = user.email;
      if (user.firstname) params[`users[${index}][firstname]`] = user.firstname;
      if (user.lastname) params[`users[${index}][lastname]`] = user.lastname;
    });

    return this.callAPI('core_user_update_users', params);
  }

  /**
   * Update user's lastaccess timestamp using custom WebCoach Utils plugin
   * @param {number} userid - Moodle user ID
   * @returns {Promise<any>} API response
   */
  async updateUserLastAccess(userid) {
    return this.callAPI('local_webcoach_utils_update_user_lastaccess', {
      userid: parseInt(userid, 10)
    });
  }

  /**
   * Delete users (bulk)
   */
  async deleteUsers(userIds) {
    const params = {};
    userIds.forEach((id, index) => {
      params[`userids[${index}]`] = parseInt(id, 10);
    });

    return this.callAPI('core_user_delete_users', params);
  }

  /**
   * Get all users
   * @param {Array} criteria - Search criteria (optional)
   * @returns {Promise<Array>} List of users with lastaccess information
   */
  async getAllUsers(criteria = []) {
    const params = {
      'criteria[0][key]': '',
      'criteria[0][value]': ''
    };

    // Default criteria: get all users (empty criteria returns all)
    if (criteria && criteria.length > 0) {
      // Clear default empty criteria
      delete params['criteria[0][key]'];
      delete params['criteria[0][value]'];

      criteria.forEach((criterion, index) => {
        params[`criteria[${index}][key]`] = criterion.key;
        params[`criteria[${index}][value]`] = criterion.value;
      });
    }

    return this.callAPI('core_user_get_users', params);
  }

  /**
   * Get activity completion status
   */
  async getActivityCompletionStatus(courseid, userid) {
    return this.callAPI('core_completion_get_activities_completion_status', {
      courseid,
      userid
    });
  }

  /**
   * Update activity completion status manually
   * @param {number} cmid - Course module ID
   * @param {boolean} completed - true for complete, false for incomplete
   */
  async updateActivityCompletionStatusManually(cmid, completed) {
    return this.callAPI('core_completion_update_activity_completion_status_manually', {
      cmid,
      completed: completed ? 1 : 0
    });
  }

  /**
   * Override activity completion status (admin-level operation)
   * Allows updating completion status for any user
   * @param {number} userid - User ID whose completion to update
   * @param {number} cmid - Course module ID
   * @param {number} newstate - New completion state (0=incomplete, 1=complete)
   */
  async overrideActivityCompletionStatus(userid, cmid, newstate) {
    return this.callAPI('core_completion_override_activity_completion_status', {
      userid,
      cmid,
      newstate
    });
  }

  /**
   * Mark course as self-completed
   * @param {number} courseid - Course ID
   */
  async markCourseSelfCompleted(courseid) {
    return this.callAPI('core_completion_mark_course_self_completed', {
      courseid
    });
  }

  /**
   * Get page modules by courses
   */
  async getPagesByCourses(courseids) {
    const params = {};
    courseids.forEach((courseid, index) => {
      params[`courseids[${index}]`] = courseid;
    });
    return this.callAPI('mod_page_get_pages_by_courses', params);
  }

  /**
   * Get all roles
   */
  async getAllRoles() {
    return this.callAPI('core_role_get_all_roles');
  }

  /**
   * Assign roles
   */
  async assignRoles(assignments) {
    const params = {};
    assignments.forEach((assignment, index) => {
      params[`assignments[${index}][roleid]`] = assignment.roleid;
      params[`assignments[${index}][userid]`] = assignment.userid;
      params[`assignments[${index}][contextid]`] = assignment.contextid;
    });
    return this.callAPI('core_role_assign_roles', params);
  }

  /**
   * Get site info
   */
  async getSiteInfo() {
    return this.callAPI('core_webservice_get_site_info');
  }

  /**
   * Get badges
   */
  async getBadges() {
    return this.callAPI('core_badges_get_badges', {});
  }

  /**
   * Get user badges
   */
  async getUserBadges(userid) {
    return this.callAPI('core_badges_get_user_badges', { userid });
  }

  /**
   * Upload file
   */
  async uploadFile(file, contextid = '1', component = 'user', filearea = 'draft') {
    const formData = new FormData();
    formData.append('wstoken', this.serviceAccountToken);
    formData.append('wsfunction', 'core_files_upload');
    formData.append('moodlewsrestformat', 'json');
    formData.append('contextid', contextid);
    formData.append('component', component);
    formData.append('filearea', filearea);
    formData.append('itemid', Date.now().toString());
    formData.append('filepath', '/');
    formData.append('filename', file.originalname);
    formData.append('file', file.buffer, { filename: file.originalname });

    const response = await axios.post(`${this.moodleUrl}/webservice/rest/server.php`, formData, {
      headers: formData.getHeaders()
    });

    return response.data;
  }

  /**
   * Set course tags using custom web service
   */
  async setCourseTag(courseid, tags) {
    return this.callAPI('local_webcoach_tags_set_course_tags', {
      courseid: parseInt(courseid, 10),
      tags: Array.isArray(tags) ? tags : [tags]
    });
  }

  /**
   * Get course tags using custom web service
   */
  async getCourseTags(courseid) {
    return this.callAPI('local_webcoach_tags_get_course_tags', {
      courseid: parseInt(courseid, 10)
    });
  }
}

// Create singleton instance
const moodleAdapter = new MoodleAdapter();

module.exports = moodleAdapter;
