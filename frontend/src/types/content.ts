export interface CourseCategory {
  id: number;
  name: string;
  description?: string;
  descriptionformat?: number;
  parent: number;
  sortorder: number;
  coursecount: number;
  visible: number;
  visibleold?: number;
  timemodified: number;
  depth: number;
  path: string;
}

export interface CourseCustomField {
  shortname: string;
  value: string;
}

export interface CourseCreateRequest {
  fullname: string;
  shortname: string;
  categoryid: number;
  summary?: string;
  summaryformat?: number;
  format?: string;
  showgrades?: number;
  newsitems?: number;
  startdate?: number;
  enddate?: number;
  maxbytes?: number;
  showreports?: number;
  visible?: number;
  hiddensections?: number;
  groupmode?: number;
  groupmodeforce?: number;
  defaultgroupingid?: number;
  enablecompletion?: number;
  completionnotify?: number;
  lang?: string;
  forcetheme?: string;
  courseformatoptions?: Array<{
    name: string;
    value: string;
  }>;
  customfields?: CourseCustomField[];
}

export interface Activity {
  id: number;
  name: string;
  description?: string;
  descriptionformat: number;
  modulename: string;
  instance: number;
  contextid: number;
  visible: number;
  uservisible: boolean;
  availabilityinfo?: string;
  indent: number;
  onclick: string;
  afterlink?: string;
  customdata: string;
  noviewlink: boolean;
  completion: number;
  completiondata?: {
    state: number;
    timecompleted: number;
    overrideby: number;
    valueused: boolean;
  };
  dates?: Array<{
    label: string;
    timestamp: number;
    relativeto?: number;
  }>;
}

export interface Section {
  id: number;
  name: string;
  visible: number;
  summary: string;
  summaryformat: number;
  section: number;
  hiddenbynumsections: number;
  uservisible: boolean;
  availabilityinfo?: string;
  modules: Activity[];
}

export interface ContentFormData {
  type: 'course' | 'activity' | 'resource';
  course?: CourseCreateRequest;
  activity?: {
    courseid: number;
    modulename: string;
    name: string;
    intro?: string;
    introformat?: number;
    section?: number;
    visible?: number;
    groupmode?: number;
    groupingid?: number;
    completion?: number;
    [key: string]: any;
  };
  resource?: {
    courseid: number;
    name: string;
    intro?: string;
    introformat?: number;
    section?: number;
    visible?: number;
    files?: File[];
    [key: string]: any;
  };
}

export interface ModuleType {
  name: string;
  plural: string;
  link: string;
  iconclass: string;
  title: string;
  help: string;
  helplink: string;
  purpose: string;
}

export interface ContentCreationResponse {
  id: number;
  shortname?: string;
  fullname?: string;
  name?: string;
  success?: boolean;
  courseid?: number;
  manual?: boolean;
  message?: string;
  result?: any;
  fallback?: boolean;
  warnings?: Array<{
    item: string;
    itemid: number;
    warningcode: string;
    message: string;
  }>;
}