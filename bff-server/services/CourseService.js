/**
 * Course Service
 * Handles course-related business logic
 */

const axios = require('axios');
const moodleAdapter = require('../adapters/MoodleAdapter');
const { normalizeMoodleContent, decodeHtml } = require('../utils/html-normalizer');
const { config } = require('../config/environment');

class CourseService {
  /**
   * Enrich courses with custom image URLs from WebCoach database
   * @param {Array} courses - Array of course objects
   * @param {number} categoryId - Category ID (1 for courses, 2 for categories)
   * @returns {Promise<Array>} - Courses enriched with custom image URLs
   */
  async enrichCoursesWithImageUrls(courses, categoryId = 1) {
    if (!Array.isArray(courses) || courses.length === 0) {
      return courses;
    }

    try {
      console.log(`[Enrich Image URLs] Fetching image URLs from api-server for category ${categoryId}...`);
      const imageUrlsResponse = await axios.get(
        `${config.apiServerUrl}/api/image-urls/category/${categoryId}`,
        { timeout: 5000 }
      );

      console.log(`[Enrich Image URLs] Received ${imageUrlsResponse.data?.length || 0} image URLs from api-server`);

      if (imageUrlsResponse.data && Array.isArray(imageUrlsResponse.data)) {
        // Create a map of image URLs by target_id (courseid)
        const imageUrlMap = {};
        imageUrlsResponse.data.forEach(item => {
          imageUrlMap[item.target_id] = item.image_url;
        });

        // Replace overviewfiles and courseimage with custom URLs
        courses.forEach(course => {
          const customImageUrl = imageUrlMap[course.id];
          if (customImageUrl) {
            // Replace overviewfiles
            course.overviewfiles = [{
              filename: 'custom_image',
              filepath: '/',
              filesize: 0,
              fileurl: customImageUrl,
              timemodified: Math.floor(Date.now() / 1000),
              mimetype: 'image/jpeg'
            }];

            // Replace courseimage
            course.courseimage = customImageUrl;

            console.log(`[Enrich Image URLs] Replaced image for course ${course.id}: ${customImageUrl}`);
          }
        });
      }
    } catch (error) {
      // Fail gracefully - return courses with Moodle default images
      console.warn('[Enrich Image URLs] Failed to fetch custom image URLs:', error.message);
    }

    return courses;
  }

  /**
   * Calculate course progress from activity completion status
   */
  async calculateCourseProgress(courseid, userid) {
    try {
      const completionStatus = await moodleAdapter.getActivityCompletionStatus(courseid, userid);

      let progress = 0;
      if (completionStatus && completionStatus.statuses && Array.isArray(completionStatus.statuses)) {
        const statuses = completionStatus.statuses;
        const totalActivities = statuses.length;

        if (totalActivities > 0) {
          const completedActivities = statuses.filter(
            activity => activity.state === 1 || activity.state === 2 // 1=completed, 2=completed with pass
          ).length;
          progress = Math.round((completedActivities / totalActivities) * 100);
        }
      }

      return progress;
    } catch (error) {
      console.error(`Error calculating progress for course ${courseid}:`, error.message);
      return 0;
    }
  }

  /**
   * Get all courses
   */
  async getAllCourses() {
    const courses = await moodleAdapter.getCourses();
    if (!Array.isArray(courses)) {
      return [];
    }

    // Filter out site course (id=1) and courses with invalid categoryid (0)
    const filteredCourses = courses.filter(course => {
      // Exclude site course
      if (course.id === 1) {
        return false;
      }
      // Exclude courses with categoryid = 0 (invalid category)
      if (course.categoryid === 0 || course.category === 0) {
        return false;
      }
      return true;
    });

    // Enrich with custom image URLs from WebCoach database
    const enrichedCourses = await this.enrichCoursesWithImageUrls(filteredCourses, 1);

    // Add tag information to each course
    try {
      console.log('[Get All Courses] Fetching tags for each course...');

      // Fetch tags for each course in parallel
      await Promise.all(
        enrichedCourses.map(async (course) => {
          try {
            const tagsResult = await moodleAdapter.getCourseTags(course.id);

            // Add tag information (as array)
            course.tags = tagsResult.tags || [];

            console.log(`[Get All Courses] Added ${course.tags.length} tags to course ${course.id}`);
          } catch (tagError) {
            // Set empty array if tag fetch fails
            console.warn(`[Get All Courses] Failed to fetch tags for course ${course.id}:`, tagError.message);
            course.tags = [];
          }
        })
      );
    } catch (error) {
      console.warn('[Get All Courses] Failed to fetch tags:', error.message);
    }

    return enrichedCourses;
  }

  /**
   * Get enrolled courses with progress
   */
  async getEnrolledCoursesWithProgress(userid) {
    const userIdInt = parseInt(userid, 10);
    const courses = await moodleAdapter.getEnrolledCourses(userIdInt);

    if (!Array.isArray(courses) || courses.length === 0) {
      return [];
    }

    // Add progress to each course
    const coursesWithProgress = await Promise.all(
      courses.map(async (course) => {
        const progress = await this.calculateCourseProgress(course.id, userIdInt);
        return {
          ...course,
          progress
        };
      })
    );

    // Enrich with custom image URLs from WebCoach database
    return await this.enrichCoursesWithImageUrls(coursesWithProgress, 1);
  }

  /**
   * Search courses
   */
  async searchCourses(query) {
    const result = await moodleAdapter.searchCourses(query);
    return result.courses || [];
  }

  /**
   * Get course contents with enriched page details
   */
  async getCourseContentsEnriched(courseid, userid = null) {
    // Get course structure
    const contents = await moodleAdapter.getCourseContents(courseid);

    // Enrich with page module details
    try {
      const pagesResponse = await moodleAdapter.getPagesByCourses([courseid]);

      // Create a map of page details by coursemodule ID
      const pagesMap = new Map(
        pagesResponse.pages.map(page => [page.coursemodule, page])
      );

      // Enrich page modules with detailed content
      contents.forEach(section => {
        section.modules.forEach(module => {
          if (module.modname === 'page' && pagesMap.has(module.id)) {
            const pageDetails = pagesMap.get(module.id);
            module.description = decodeHtml(pageDetails.intro);
            module.descriptionformat = pageDetails.introformat;
            module.content = normalizeMoodleContent(decodeHtml(pageDetails.content));
            module.contentformat = pageDetails.contentformat;
            module.timemodified = pageDetails.timemodified;

            // Extract URLs from page content and replace contents array
            // Page content HTML often contains URLs that should be exposed in the contents array
            const htmlContent = decodeHtml(pageDetails.content);
            const urlRegex = /https?:\/\/[^\s<>"']+/gi;
            const urls = htmlContent.match(urlRegex) || [];

            if (urls.length > 0) {
              // Replace the incorrect contents array (index.html) with actual URLs
              module.contents = urls.map((url, index) => ({
                type: 'url',
                filename: url.split('/').pop() || 'content',
                filepath: '/',
                filesize: 0,
                fileurl: url,
                timecreated: pageDetails.timemodified,
                timemodified: pageDetails.timemodified,
                sortorder: index + 1,
                userid: null,
                author: null,
                license: null
              }));

              console.log(`[CourseService] Extracted ${urls.length} URLs from page module ${module.id}`);
            }
          }
        });
      });
    } catch (pageError) {
      console.error('Failed to fetch page details:', pageError.message);
      // Continue without page details rather than failing entirely
    }

    // Fix completion tracking settings using core_completion_get_activities_completion_status
    // This API returns more reliable completion data than the potentially cached core_course_get_contents
    if (userid) {
      try {
        const completionStatus = await moodleAdapter.getActivityCompletionStatus(courseid, userid);

        if (completionStatus && completionStatus.statuses && Array.isArray(completionStatus.statuses)) {
          // Create a map of completion settings by coursemodule ID
          const completionMap = new Map(
            completionStatus.statuses.map(status => [status.cmid, status])
          );

          // Update completion tracking settings from the completion API
          contents.forEach(section => {
            section.modules.forEach(module => {
              const completionData = completionMap.get(module.id);
              if (completionData) {
                // Use 'tracking' field from completion API as the reliable source
                // tracking: 0=none, 1=manual, 2=automatic
                module.completion = completionData.tracking;

                // Also merge completion state data if not already present
                if (!module.completiondata) {
                  module.completiondata = {
                    state: completionData.state,
                    timecompleted: completionData.timecompleted || 0,
                    overrideby: completionData.overrideby || null,
                    valueused: completionData.valueused || false
                  };
                }
              }
            });
          });

          console.log(`[CourseService] Fixed completion tracking for ${completionStatus.statuses.length} activities in course ${courseid}`);
        }
      } catch (completionError) {
        console.error('Failed to fetch completion status:', completionError.message);
        // Continue without completion fix rather than failing entirely
      }
    }

    return contents;
  }

  /**
   * Enrich categories with custom image URLs from WebCoach database
   * @param {Array} categories - Array of category objects
   * @returns {Promise<Array>} - Categories enriched with custom image URLs
   */
  async enrichCategoriesWithImageUrls(categories) {
    if (!Array.isArray(categories) || categories.length === 0) {
      return categories;
    }

    try {
      console.log(`[Enrich Category Image URLs] Fetching image URLs from api-server for category_id=2...`);
      const imageUrlsResponse = await axios.get(
        `${config.apiServerUrl}/api/image-urls/category/2`,
        { timeout: 5000 }
      );

      console.log(`[Enrich Category Image URLs] Received ${imageUrlsResponse.data?.length || 0} image URLs from api-server`);

      if (imageUrlsResponse.data && Array.isArray(imageUrlsResponse.data)) {
        // Create a map of image URLs by target_id (category id)
        const imageUrlMap = {};
        imageUrlsResponse.data.forEach(item => {
          imageUrlMap[item.target_id] = item.image_url;
        });

        // Add categoryimage field with custom URLs
        categories.forEach(category => {
          const customImageUrl = imageUrlMap[category.id];
          if (customImageUrl) {
            category.categoryimage = customImageUrl;
            console.log(`[Enrich Category Image URLs] Added image for category ${category.id}: ${customImageUrl}`);
          }
        });
      }
    } catch (error) {
      // Fail gracefully - return categories without custom images
      console.warn('[Enrich Category Image URLs] Failed to fetch custom image URLs:', error.message);
    }

    return categories;
  }

  /**
   * Get categories
   */
  async getCategories() {
    const categories = await moodleAdapter.getCategories();
    const categoriesArray = Array.isArray(categories) ? categories : categories.categories || [];

    // Enrich with custom image URLs from WebCoach database
    return await this.enrichCategoriesWithImageUrls(categoriesArray);
  }

  /**
   * Get courses by field
   */
  async getCoursesByField(field, value) {
    const courses = await moodleAdapter.getCoursesByField(field, value);

    // Enrich with custom image URLs from WebCoach database
    if (courses && courses.courses && Array.isArray(courses.courses)) {
      courses.courses = await this.enrichCoursesWithImageUrls(courses.courses, 1);
    }

    // 各コースにタグ情報を追加
    try {
      console.log('[Get Courses By Field] Fetching tags for each course...');

      if (courses && courses.courses && Array.isArray(courses.courses)) {
        // 各コースのタグを並列取得
        await Promise.all(
          courses.courses.map(async (course) => {
            try {
              const tagsResult = await moodleAdapter.getCourseTags(course.id);

              // タグ情報を追加（配列形式）
              course.tags = tagsResult.tags || [];

              console.log(`[Get Courses By Field] Added ${course.tags.length} tags to course ${course.id}`);
            } catch (tagError) {
              // タグ取得に失敗した場合は空配列をセット
              console.warn(`[Get Courses By Field] Failed to fetch tags for course ${course.id}:`, tagError.message);
              course.tags = [];
            }
          })
        );
      }
    } catch (error) {
      console.warn('[Get Courses By Field] Failed to fetch tags:', error.message);
    }

    return courses;
  }

  /**
   * Create categories (bulk)
   */
  async createCategories(categories) {
    // Validate each category
    categories.forEach((category, index) => {
      if (!category.name) {
        throw new Error(`Category at index ${index} is missing required field: name`);
      }
    });

    const result = await moodleAdapter.createCategories(categories);

    // Process category images if imageUrl is provided
    const categoriesWithImages = categories.filter(category => category.imageUrl);

    if (categoriesWithImages.length > 0) {
      console.log(`[Create Categories] Processing ${categoriesWithImages.length} category images`);

      for (let i = 0; i < categoriesWithImages.length; i++) {
        const category = categoriesWithImages[i];
        const createdCategory = result[categories.indexOf(category)];

        if (!createdCategory || !createdCategory.id) {
          console.error(`[Create Categories] Could not find created category for: ${category.name}`);
          continue;
        }

        try {
          console.log(`[Create Categories] Updating WebCoach image_url table for category ${createdCategory.id}: ${category.imageUrl}`);

          // Update WebCoach image_url table (category_id=2 for categories)
          await axios.post(
            `${config.apiServerUrl}/api/image-url/2/${createdCategory.id}`,
            { image_url: category.imageUrl }
          );

          console.log(`[Create Categories] Successfully updated WebCoach image_url table for category ${createdCategory.id}`);
        } catch (error) {
          console.error(`[Create Categories] Failed to update WebCoach image_url table for category ${createdCategory.id}:`, error.message);
          // Continue with other categories even if one fails
        }
      }
    }

    return result;
  }

  /**
   * Create courses (bulk)
   */
  async createCourses(courses) {
    // Validate each course
    courses.forEach((course, index) => {
      if (!course.fullname || !course.shortname || !course.categoryid) {
        throw new Error(`Course at index ${index} is missing required fields (fullname, shortname, categoryid)`);
      }
    });

    // Create courses
    const result = await moodleAdapter.createCourses(courses);

    // Process course images if imageUrl is provided
    const coursesWithImages = courses.filter(course => course.imageUrl);

    if (coursesWithImages.length > 0) {
      console.log(`[Create Courses] Processing ${coursesWithImages.length} course image URLs`);

      for (let i = 0; i < coursesWithImages.length; i++) {
        const course = coursesWithImages[i];
        const createdCourse = result[courses.indexOf(course)];

        if (!createdCourse || !createdCourse.id) {
          console.error(`[Create Courses] Could not find created course for: ${course.shortname}`);
          continue;
        }

        try {
          console.log(`[Create Courses] Updating WebCoach image_url for course ${createdCourse.id}: ${course.imageUrl}`);

          // Update WebCoach image_url table
          await axios.post(
            `${config.apiServerUrl}/api/image-url/1/${createdCourse.id}`,
            { image_url: course.imageUrl }
          );
          console.log(`[Create Courses] Successfully updated WebCoach image_url table for course ${createdCourse.id}`);
        } catch (error) {
          console.error(`[Create Courses] Failed to update WebCoach image_url table for course ${createdCourse.id}:`, error.message);
          // Continue with other courses even if one fails
        }
      }
    }

    // Process course tag if tag is provided
    const coursesWithTag = courses.filter(course => course.tag && typeof course.tag === 'string');

    if (coursesWithTag.length > 0) {
      console.log(`[Create Courses] Processing ${coursesWithTag.length} courses with tag`);

      for (let i = 0; i < coursesWithTag.length; i++) {
        const course = coursesWithTag[i];
        const createdCourse = result[courses.indexOf(course)];

        if (!createdCourse || !createdCourse.id) {
          console.error(`[Create Courses] Could not find created course for: ${course.shortname}`);
          continue;
        }

        try {
          console.log(`[Create Courses] Setting tag for course ${createdCourse.id}: ${course.tag}`);

          // Convert single tag to array for Moodle API
          await moodleAdapter.setCourseTag(createdCourse.id, [course.tag]);

          console.log(`[Create Courses] Successfully set tag for course ${createdCourse.id}`);

        } catch (error) {
          console.error(`[Create Courses] Failed to set tag for course ${createdCourse.id}:`, error.message);
          // Continue with other courses even if tag setting fails
        }
      }
    }

    return result;
  }

  /**
   * Update categories (bulk)
   */
  async updateCategories(categories) {
    const result = await moodleAdapter.updateCategories(categories);

    // Process category images if imageUrl is provided
    const categoriesWithImages = categories.filter(category => category.imageUrl && category.id);

    if (categoriesWithImages.length > 0) {
      console.log(`[Update Categories] Processing ${categoriesWithImages.length} category images`);

      for (let i = 0; i < categoriesWithImages.length; i++) {
        const category = categoriesWithImages[i];

        try {
          console.log(`[Update Categories] Updating WebCoach image_url table for category ${category.id}: ${category.imageUrl}`);

          // Update WebCoach image_url table (category_id=2 for categories)
          await axios.post(
            `${config.apiServerUrl}/api/image-url/2/${category.id}`,
            { image_url: category.imageUrl }
          );

          console.log(`[Update Categories] Successfully updated WebCoach image_url table for category ${category.id}`);
        } catch (error) {
          console.error(`[Update Categories] Failed to update WebCoach image_url table for category ${category.id}:`, error.message);
          // Continue with other categories even if one fails
        }
      }
    }

    return result;
  }

  /**
   * Update courses (bulk)
   */
  async updateCourses(courses) {
    const result = await moodleAdapter.updateCourses(courses);

    // Process course images if imageUrl is provided
    const coursesWithImages = courses.filter(course => course.imageUrl && course.id);

    if (coursesWithImages.length > 0) {
      console.log(`[Update Courses] Processing ${coursesWithImages.length} course image URLs`);

      for (let i = 0; i < coursesWithImages.length; i++) {
        const course = coursesWithImages[i];

        try {
          console.log(`[Update Courses] Updating WebCoach image_url for course ${course.id}: ${course.imageUrl}`);

          // Update WebCoach image_url table
          await axios.post(
            `${config.apiServerUrl}/api/image-url/1/${course.id}`,
            { image_url: course.imageUrl }
          );
          console.log(`[Update Courses] Successfully updated WebCoach image_url table for course ${course.id}`);
        } catch (error) {
          console.error(`[Update Courses] Failed to update WebCoach image_url table for course ${course.id}:`, error.message);
          // Continue with other courses even if one fails
        }
      }
    }

    // Process course tag if tag is provided
    const coursesWithTag = courses.filter(course => course.tag && typeof course.tag === 'string' && course.id);

    if (coursesWithTag.length > 0) {
      console.log(`[Update Courses] Processing ${coursesWithTag.length} courses with tag`);

      for (let i = 0; i < coursesWithTag.length; i++) {
        const course = coursesWithTag[i];

        try {
          console.log(`[Update Courses] Setting tag for course ${course.id}: ${course.tag}`);

          // Convert single tag to array for Moodle API
          await moodleAdapter.setCourseTag(course.id, [course.tag]);

          console.log(`[Update Courses] Successfully set tag for course ${course.id}`);

        } catch (error) {
          console.error(`[Update Courses] Failed to set tag for course ${course.id}:`, error.message);
          // Continue with other courses even if tag setting fails
        }
      }
    }

    return result;
  }

  /**
   * Enroll user in course
   */
  async enrollUser(userid, courseid, roleid = 5) {
    console.log(`[Enroll Course] Checking if user ${userid} is already enrolled in course ${courseid}`);

    // Check if user is already enrolled
    const isEnrolled = await moodleAdapter.isUserEnrolledInCourse(userid, courseid);

    if (isEnrolled) {
      console.log(`[Enroll Course] User ${userid} is already enrolled in course ${courseid}`);
      const error = new Error('User is already enrolled in this course');
      error.statusCode = 409;
      throw error;
    }

    console.log(`[Enroll Course] Enrolling user ${userid} in course ${courseid}`);
    const result = await moodleAdapter.enrollUser(userid, courseid, roleid);
    console.log('[Enroll Course] Enrollment successful:', result);
    return result;
  }

  /**
   * Get new content notifications since timestamp
   * Detects both course setting changes AND content additions/updates
   */
  async getNewContentNotifications(sinceTimestamp) {
    const since = parseInt(sinceTimestamp, 10) || 0;
    const sinceSeconds = since / 1000; // Convert to Unix timestamp in seconds
    const courses = await moodleAdapter.getCourses();

    if (!Array.isArray(courses)) {
      return { count: 0, items: [] };
    }

    const items = [];

    for (const course of courses) {
      if (course.id === 1) continue; // Skip site course

      // Check 1: Course setting changes (original logic)
      if ((course.timemodified || 0) > sinceSeconds) {
        items.push({
          type: 'course',
          id: course.id,
          name: course.fullname,
          timemodified: course.timemodified * 1000,
          changeType: 'course_settings'
        });
        continue; // Skip content check if course itself was modified
      }

      // Check 2: Content additions/updates (NEW)
      try {
        const contents = await moodleAdapter.getCourseContents(course.id);

        if (!Array.isArray(contents)) {
          continue;
        }

        // Check each section and module for updates
        let hasNewContent = false;
        let latestContentTime = 0;
        let contentDetails = [];

        for (const section of contents) {
          // Check section modifications
          if (section.timemodified && section.timemodified > sinceSeconds) {
            hasNewContent = true;
            latestContentTime = Math.max(latestContentTime, section.timemodified);
          }

          // Check module (activity/resource) additions or updates
          if (Array.isArray(section.modules)) {
            for (const module of section.modules) {
              const moduleTime = module.added || module.timemodified || 0;

              if (moduleTime > sinceSeconds) {
                hasNewContent = true;
                latestContentTime = Math.max(latestContentTime, moduleTime);

                contentDetails.push({
                  moduleName: module.name,
                  moduleType: module.modname,
                  sectionName: section.name
                });
              }
            }
          }
        }

        if (hasNewContent) {
          items.push({
            type: 'course_content',
            id: course.id,
            name: course.fullname,
            timemodified: latestContentTime * 1000,
            changeType: 'content_added',
            details: contentDetails.slice(0, 5) // Limit to first 5 items to avoid large responses
          });
        }

      } catch (contentError) {
        // Log error but continue with other courses
        console.error(`[Notifications] Failed to check content for course ${course.id}:`, contentError.message);
        continue;
      }
    }

    // Sort by most recent first
    items.sort((a, b) => b.timemodified - a.timemodified);

    return { count: items.length, items };
  }

  /**
   * Get badges
   */
  async getBadges() {
    return await moodleAdapter.getBadges();
  }

  /**
   * Get user badges
   */
  async getUserBadges(userid) {
    return await moodleAdapter.getUserBadges(userid);
  }
}

// Create singleton instance
const courseService = new CourseService();

module.exports = courseService;
