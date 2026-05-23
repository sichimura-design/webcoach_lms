/**
 * Test script to check mod_page API responses
 */

const moodleAdapter = require('./adapters/MoodleAdapter');

async function testPageContents() {
  try {
    console.log('Authenticating service account...');
    await moodleAdapter.authenticateServiceAccount();

    const courseid = 9; // WD-DESIGN-INTRO - has page modules

    console.log(`\n=== Testing with course ${courseid} ===`);

    console.log('\n=== Testing mod_page_get_pages_by_courses ===');
    let pagesResponse;
    try {
      pagesResponse = await moodleAdapter.getPagesByCourses([courseid]);
      console.log('Pages response (focusing on content field):');
      pagesResponse.pages.forEach(page => {
        console.log(`\nPage ID ${page.id} (cmid=${page.coursemodule}):`);
        console.log('  name:', page.name);
        console.log('  content:', page.content);
      });
    } catch (error) {
      console.error('mod_page_get_pages_by_courses failed:', error.message);
    }

    console.log('\n=== Testing core_course_get_contents ===');
    const contentsResponse = await moodleAdapter.getCourseContents(courseid);

    // Filter only page modules and show contents array
    const pageModules = [];
    contentsResponse.forEach(section => {
      section.modules.forEach(module => {
        if (module.modname === 'page') {
          pageModules.push({
            id: module.id,
            name: module.name,
            contents: module.contents
          });
        }
      });
    });

    console.log('\nPage modules from core_course_get_contents:');
    console.log(JSON.stringify(pageModules, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  process.exit(0);
}

testPageContents();
