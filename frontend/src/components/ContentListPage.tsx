import React, { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import {
  Container,
  Typography,
  Button,
  Box,
  Paper,
  Chip,
  Divider,
  IconButton,
  Fab,
  Alert,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import {
  Add,
  Close,
  CheckCircle,
  AttachFile,
  Delete,
  Visibility,
  VisibilityOff,
  SmartToy
} from '@mui/icons-material';
import { bffClient } from '../services/bffClient';
import { Course } from '../types/course';
import { Activity, Section } from '../types/content';
import WebCoachHeader from './WebCoachHeader';
import AIContentChat from './AIContentChat';
import { LoadingState, ErrorState, CourseCard, PageHeader } from './shared';
import { COLORS } from '../theme';
import { getModuleIcon, getModuleTypeName } from '../utils';

interface ContentListPageProps {
  onBack: () => void;
}

function ContentListPage({ onBack }: ContentListPageProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'courses' | 'content' | 'add-content'>('courses');

  // AI Chat state
  const [showAIChat, setShowAIChat] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  // Add content state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState<'notion' | 'notion-list' | 'file' | 'text'>('text');
  const [newContent, setNewContent] = useState({
    title: '',
    content: '',
    type: 'page' as 'page' | 'resource' | 'assign' | 'quiz'
  });
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCourses();
  }, []);

  // Auto-clear success message after 3 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      const coursesData = await bffClient.getCourses();
      setCourses(coursesData);
    } catch (err) {
      console.error('Error fetching courses:', err);
      setError('Failed to fetch courses');
    } finally {
      setLoading(false);
    }
  };

  const fetchCourseContent = async (course: Course) => {
    try {
      setLoading(true);
      setError(null);
      setSelectedCourse(course);

      // Fetch real course content from Moodle API
      const courseContentData = await bffClient.getCourseContent(course.id);

      // Transform the API response to match our Section type
      const sectionsData: Section[] = Array.isArray(courseContentData)
        ? courseContentData.map((section: any) => ({
            id: section.id,
            name: section.name || `Section ${section.section}`,
            visible: section.visible || 1,
            summary: section.summary || '',
            summaryformat: section.summaryformat || 1,
            section: section.section || 0,
            hiddenbynumsections: section.hiddenbynumsections || 0,
            uservisible: section.uservisible !== false,
            modules: Array.isArray(section.modules)
              ? section.modules.map((module: any) => ({
                  id: module.id,
                  name: module.name || 'Untitled Activity',
                  description: module.description || '',
                  descriptionformat: module.descriptionformat || 1,
                  modulename: module.modname || module.modulename || 'unknown',
                  instance: module.instance || 0,
                  contextid: module.contextid || 0,
                  visible: module.visible || 1,
                  uservisible: module.uservisible !== false,
                  indent: module.indent || 0,
                  onclick: module.onclick || '',
                  customdata: module.customdata || '',
                  noviewlink: module.noviewlink || false,
                  completion: module.completion || 0
                }))
              : []
          }))
        : [];

      setSections(sectionsData);
      setViewMode('content');
    } catch (err) {
      console.error('Error fetching course content:', err);
      setError('Failed to fetch course content');
    } finally {
      setLoading(false);
    }
  };

  // Removed: Using shared utilities instead

  const handleAddContent = () => {
    setShowAddModal(true);
    setError(null);
    setSuccess(null);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setNewContent({
      title: '',
      content: '',
      type: 'page'
    });
    setAttachedFiles([]);
    setAddType('text');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
  };

  const handleNotionFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.name.endsWith('.md')) {
      setError('Please upload a Markdown (.md) file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        // Simple markdown content extraction
        const lines = content.split('\n');
        const title = lines[0]?.replace(/^#\s*/, '') || 'Untitled';

        setNewContent({
          title: title,
          content: content,
          type: 'page'
        });
        setError(null);
      } catch (err) {
        setError('Failed to parse Markdown file');
        console.error('Markdown parsing error:', err);
      }
    };
    reader.readAsText(file);
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setAttachedFiles(files);
    setNewContent({
      title: files[0].name.replace(/\.[^/.]+$/, ''),
      content: `<p>Uploaded ${files.length} file(s):</p><ul>${files.map(f => `<li>${f.name}</li>`).join('')}</ul>`,
      type: 'resource'
    });
    setError(null);
  };

  const handleAttachmentUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setAttachedFiles(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Notion import handlers removed - feature deprecated

  const handleOpenAIChat = (activity: Activity) => {
    setSelectedActivity(activity);
    setShowAIChat(true);
  };

  const handleCloseAIChat = () => {
    setShowAIChat(false);
    setSelectedActivity(null);
  };

  const handleCreateContent = async () => {
    if (!selectedCourse || !newContent.title) {
      setError('Please fill in the required fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Upload files first if any
      const uploadedFiles = [];
      if (attachedFiles.length > 0) {
        for (const file of attachedFiles) {
          try {
            const uploadResult = await bffClient.uploadFile(file, selectedCourse.id);
            uploadedFiles.push(uploadResult);
          } catch (uploadError) {
            console.warn('Failed to upload file:', file.name, uploadError);
          }
        }
      }

      // Create the activity/resource (CreateActivityRequest型に準拠)
      const activityData = {
        modulename: newContent.type === 'resource' ? 'resource' : newContent.type,
        name: newContent.title,
        intro: newContent.content,
        section: 0,
      };

      await bffClient.createActivity(selectedCourse.id, activityData);

      setSuccess(`Content "${newContent.title}" added successfully!`);
      handleCloseModal();

      // Refresh content if viewing content
      if (viewMode === 'content') {
        fetchCourseContent(selectedCourse);
      }

    } catch (err: any) {
      console.error('Content creation error:', err);
      console.error('Error response:', err.response);
      console.error('Error data:', err.response?.data);

      let errorMessage = 'Failed to create content';
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingState />;
  }

  if (error && !courses.length) {
    return <ErrorState error={error} onRetry={fetchCourses} />;
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      {/* WebCoach Header */}
      <WebCoachHeader showButtons={false} />

      {/* Navigation Bar */}
      <PageHeader
        title={viewMode === 'courses'
          ? 'コンテンツ管理'
          : `${selectedCourse?.fullname} - コンテンツ`
        }
        onHome={onBack}
        onBack={viewMode === 'content' && selectedCourse ? () => setViewMode('courses') : undefined}
        variant="dark"
      />

      <Container maxWidth="lg" sx={{ py: 3 }}>
        {success && (
          <Alert
            severity="success"
            sx={{ mb: 2 }}
            action={
              <IconButton
                aria-label="close"
                color="inherit"
                size="small"
                onClick={() => setSuccess(null)}
              >
                <Close fontSize="inherit" />
              </IconButton>
            }
          >
            {success}
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

      {viewMode === 'courses' ? (
        <Grid container spacing={3}>
          {courses.map((course) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={course.id}>
              <CourseCard
                course={course}
                variant="default"
                onViewContent={() => fetchCourseContent(course)}
              />
            </Grid>
          ))}
        </Grid>
      ) : showAIChat && selectedActivity ? (
        <Grid container spacing={3}>
          {/* Content Display */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 3, height: '75vh', overflow: 'auto' }}>
              <Typography variant="h5" component="h2" gutterBottom>
                {selectedActivity.name}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {getModuleTypeName(selectedActivity.modulename)}
              </Typography>
              {selectedActivity.description && (
                <Box
                  sx={{ mt: 2 }}
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedActivity.description) }}
                />
              )}
            </Paper>
          </Grid>

          {/* AI Chat */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ height: '75vh' }}>
              <AIContentChat
                contentId={selectedActivity.id}
                contentTitle={selectedActivity.name}
                contentHtml={selectedActivity.description || ''}
                courseId={selectedCourse?.id || 0}
                onClose={handleCloseAIChat}
              />
            </Box>
          </Grid>
        </Grid>
      ) : (
        <Box>
          {selectedCourse && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="h4" component="h2" gutterBottom>
                    {selectedCourse.fullname}
                  </Typography>
                  <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                    {selectedCourse.shortname} - {selectedCourse.categoryname}
                  </Typography>
                  {selectedCourse.summary && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {selectedCourse.summary}
                    </Typography>
                  )}
                </Box>
                <Fab
                  color="primary"
                  aria-label="add content"
                  onClick={handleAddContent}
                  sx={{ ml: 2 }}
                >
                  <Add />
                </Fab>
              </Box>
            </Paper>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {sections.map((section) => (
              <Paper key={section.id} sx={{ p: 3 }}>
                <Typography variant="h5" component="h3" gutterBottom>
                  {section.name}
                </Typography>
                {section.summary && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {section.summary}
                  </Typography>
                )}

                <Divider sx={{ my: 2 }} />

                {section.modules.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    No activities in this section
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {section.modules.map((activity) => (
                      <Card key={activity.id} variant="outlined">
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ fontSize: '1.5rem' }}>
                              {getModuleIcon(activity.modulename)}
                            </Box>
                            <Box sx={{ flexGrow: 1 }}>
                              <Typography variant="h6" component="h4">
                                {activity.name}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {getModuleTypeName(activity.modulename)}
                              </Typography>
                              {activity.description && (
                                <Typography variant="body2" sx={{ mt: 1 }}>
                                  {activity.description}
                                </Typography>
                              )}
                            </Box>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
                              <Button
                                variant="contained"
                                size="small"
                                startIcon={<SmartToy />}
                                onClick={() => handleOpenAIChat(activity)}
                                sx={{
                                  bgcolor: COLORS.primary,
                                  '&:hover': { bgcolor: COLORS.primaryHover },
                                }}
                              >
                                AIアシスタント
                              </Button>
                              <Chip
                                icon={activity.visible ? <Visibility /> : <VisibilityOff />}
                                label={activity.visible ? 'Visible' : 'Hidden'}
                                color={activity.visible ? 'success' : 'default'}
                                size="small"
                              />
                              {activity.completion === 1 && (
                                <Chip
                                  icon={<CheckCircle />}
                                  label="Completion Tracking"
                                  color="info"
                                  size="small"
                                />
                              )}
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                )}
              </Paper>
            ))}
          </Box>
        </Box>
      )}

      {/* Add Content Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Content to {selectedCourse?.fullname}</h3>
              <button onClick={handleCloseModal} className="close-button">×</button>
            </div>

            <div className="modal-body">
              {error && (
                <div className="alert alert-error">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                  {error}
                </div>
              )}

              <div className="add-type-selector">
                <button
                  className={`type-btn ${addType === 'text' ? 'active' : ''}`}
                  onClick={() => setAddType('text')}
                >
                  📝 Text Input
                </button>
                <button
                  className={`type-btn ${addType === 'notion' ? 'active' : ''}`}
                  onClick={() => setAddType('notion')}
                >
                  📄 Notion Import
                </button>
                <button
                  className={`type-btn ${addType === 'notion-list' ? 'active' : ''}`}
                  onClick={() => setAddType('notion-list')}
                >
                  🗂️ Notion Articles
                </button>
                <button
                  className={`type-btn ${addType === 'file' ? 'active' : ''}`}
                  onClick={() => setAddType('file')}
                >
                  📁 File Upload
                </button>
              </div>

              {addType === 'text' && (
                <div className="text-input-section">
                  <div className="form-group">
                    <label htmlFor="title">Title</label>
                    <input
                      type="text"
                      id="title"
                      value={newContent.title}
                      onChange={(e) => setNewContent(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Enter content title"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="type">Content Type</label>
                    <select
                      id="type"
                      value={newContent.type}
                      onChange={(e) => setNewContent(prev => ({ ...prev, type: e.target.value as any }))}
                    >
                      <option value="page">Page</option>
                      <option value="resource">File/Resource</option>
                      <option value="assign">Assignment</option>
                      <option value="quiz">Quiz</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="content">Content</label>
                    <textarea
                      id="content"
                      value={newContent.content}
                      onChange={(e) => setNewContent(prev => ({ ...prev, content: e.target.value }))}
                      rows={8}
                      placeholder="Enter your content here. You can use HTML formatting."
                    />
                  </div>

                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Attachments</Typography>
                    <input
                      ref={attachmentInputRef}
                      type="file"
                      multiple
                      onChange={handleAttachmentUpload}
                      style={{ display: 'none' }}
                    />
                    <Button
                      onClick={() => attachmentInputRef.current?.click()}
                      startIcon={<AttachFile />}
                      variant="outlined"
                      sx={{ mb: 2 }}
                    >
                      Add Files
                    </Button>

                    {attachedFiles.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {attachedFiles.map((file, index) => (
                          <Chip
                            key={index}
                            label={file.name}
                            onDelete={() => removeAttachment(index)}
                            deleteIcon={<Delete />}
                          />
                        ))}
                      </Box>
                    )}
                  </Box>
                </div>
              )}

              {addType === 'notion' && (
                <div className="notion-import-section">
                  <div className="upload-area">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".md"
                      onChange={handleNotionFileUpload}
                      style={{ display: 'none' }}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="upload-btn"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17,8 12,3 7,8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      Upload Markdown File
                    </button>
                    <p>Export your Notion page as Markdown and upload it here.</p>
                  </div>

                  {newContent.title && (
                    <div className="preview">
                      <h4>Preview:</h4>
                      <p><strong>Title:</strong> {newContent.title}</p>
                      <div className="content-preview" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(newContent.content.substring(0, 200) + '...') }} />
                    </div>
                  )}
                </div>
              )}

              {addType === 'file' && (
                <div className="file-upload-section">
                  <div className="upload-area">
                    <input
                      type="file"
                      multiple
                      onChange={handleFileImport}
                      style={{ display: 'none' }}
                      ref={fileInputRef}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="upload-btn"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17,8 12,3 7,8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      Upload Files
                    </button>
                    <p>Upload documents, images, videos, or other files.</p>
                  </div>

                  {attachedFiles.length > 0 && (
                    <div className="file-list">
                      <h4>Selected Files:</h4>
                      {attachedFiles.map((file, index) => (
                        <div key={index} className="file-item">
                          <span>{file.name} ({Math.round(file.size / 1024)} KB)</span>
                          <button
                            onClick={() => removeAttachment(index)}
                            className="remove-file"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {addType === 'notion-list' && (
                <div className="notion-list-section">
                  <Alert severity="info">
                    Notion import feature has been removed. Please use Markdown file upload instead.
                  </Alert>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button onClick={handleCloseModal} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleCreateContent}
                disabled={loading || !newContent.title}
                className="btn-primary"
              >
                {loading ? 'Adding...' : 'Add Content'}
              </button>
            </div>
          </div>
        </div>
      )}
      </Container>
    </Box>
  );
};

export default ContentListPage;