export interface Course {
  id: number;
  shortname: string;
  fullname: string;
  displayname: string;
  enrolledusercount: number;
  idnumber: string;
  visible: number;
  summary: string;
  summaryformat: number;
  format: string;
  categoryid: number;
  categoryname: string;
  sortorder: number;
  completionhascriteria: boolean;
  completionusertracked: boolean;
  progress: number;
  completed: boolean;
  startdate: number;
  enddate: number;
  marker: number;
  lastaccess: number;
  isfavourite: boolean;
  hidden: boolean;
  overviewfiles: any[];
}

export interface CourseSearchResult {
  total: number;
  courses: Course[];
  warnings: any[];
  errorcode?: string;
  message?: string;
}