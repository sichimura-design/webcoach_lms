# Moodle Frontend

React TypeScript frontend for Moodle Web Services API

## Features

- **Login Page**: Secure authentication using Moodle credentials
- **Courses Page**: Display enrolled courses with search and filtering
- **API Integration**: RESTful API service layer for Moodle Web Services
- **Responsive Design**: Modern UI with CSS Grid and Flexbox

## Setup

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Start development server:
```bash
npm start
```

3. Build for production:
```bash
npm run build
```

## API Configuration

Update the `BASE_URL` in `src/services/api.ts` to match your Moodle installation:

```typescript
const BASE_URL = 'http://your-moodle-site.com/webservice/rest/server.php';
```

## Moodle Web Services Setup

1. Enable Web Services in Moodle Admin
2. Create a Web Service with required functions:
   - `core_webservice_get_site_info`
   - `core_course_get_enrolled_courses_by_timeline_classification`
   - `core_course_search_courses`
3. Create tokens for authentication

## Components

- `LoginPage`: Authentication form
- `CoursesPage`: Course listing with search
- `api.ts`: Moodle API service layer
- TypeScript interfaces for type safety