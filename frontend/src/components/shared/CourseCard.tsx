import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  Box,
  LinearProgress,
  IconButton,
} from '@mui/material';
import { Visibility, MoreVert } from '@mui/icons-material';
import { Course } from '../../types/course';
import { CourseProgress } from '../../types/dashboard';
import { COLORS, SPACING, SHADOWS } from '../../theme';
import { formatDate, getRelativeTime } from '../../utils';
import { getProgressColor } from '../../theme/colors';
import { CourseImage } from './CourseImage';

type CourseData = (Course & {
  progress?: number;
  instructor?: string;
  lastAccessed?: string | number;
}) | (CourseProgress & {
  progress?: number;
  instructor?: string;
  lastAccessed?: string | number;
});

interface CourseCardProps {
  course: CourseData;
  variant?: 'default' | 'modern' | 'compact';
  onClick?: () => void;
  onViewContent?: () => void;
  showProgress?: boolean;
  showAction?: boolean;
}

/**
 * Unified CourseCard component
 * Consolidates 4 different implementations into one reusable component
 */
function CourseCard({
  course,
  variant = 'default',
  onClick,
  onViewContent,
  showProgress = false,
  showAction = true,
}: CourseCardProps) {
  const progress = course.progress || 0;
  const instructor = course.instructor || course.categoryname || '講師未設定';

  // Calculate last accessed text
  const lastAccessedText = course.lastAccessed
    ? typeof course.lastAccessed === 'number'
      ? getRelativeTime(course.lastAccessed)
      : course.lastAccessed
    : '未アクセス';

  // Default variant - Used in ContentListPage
  if (variant === 'default') {
    return (
      <Card
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          cursor: onClick ? 'pointer' : 'default',
          transition: 'box-shadow 0.2s ease',
          '&:hover': onClick ? {
            boxShadow: SHADOWS.hover,
          } : {},
        }}
        onClick={onClick}
      >
        <CardContent sx={{ flexGrow: 1 }}>
          <Typography variant="h6" component="h3" gutterBottom>
            {course.fullname}
          </Typography>
          <Chip label={course.shortname} size="small" sx={{ mb: 1 }} />
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {course.categoryname}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              開始: {formatDate(course.startdate)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              終了: {formatDate(course.enddate)}
            </Typography>
          </Box>
        </CardContent>
        {showAction && (
          <CardActions>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onViewContent?.();
              }}
              variant="contained"
              color="primary"
              fullWidth
              startIcon={<Visibility />}
            >
              コンテンツを表示
            </Button>
          </CardActions>
        )}
      </Card>
    );
  }

  // Modern variant - Used in ModernContentListPage
  if (variant === 'modern') {
    return (
      <Card
        sx={{
          height: '100%',
          minWidth: 240,
          maxWidth: 380,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          cursor: onClick ? 'pointer' : 'default',
          border: `1px solid ${COLORS.borderLight}`,
          borderRadius: SPACING.md,
          overflow: 'hidden',
          transition: 'all 0.2s ease',
          '&:hover': onClick ? {
            transform: 'translateY(-4px)',
            boxShadow: SHADOWS.md,
          } : {},
        }}
        onClick={onClick}
      >
        {/* Thumbnail */}
        <Box
          sx={{
            position: 'relative',
            paddingTop: '56.25%', // 16:9 aspect ratio
            backgroundColor: COLORS.lightBg,
            backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            overflow: 'hidden',
          }}
        >
          {'overviewfiles' in course && course.overviewfiles?.[0]?.fileurl && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            >
              <CourseImage
                imageUrl={course.overviewfiles[0].fileurl}
                alt={course.fullname}
                fallbackColor="#667eea"
                className="w-full h-full"
              />
            </Box>
          )}
          <IconButton
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              backgroundColor: 'white',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.9)' },
            }}
            size="small"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVert fontSize="small" />
          </IconButton>
        </Box>

        <CardContent sx={{ flexGrow: 1, p: SPACING.md }}>
          <Typography
            variant="h6"
            component="h3"
            sx={{
              fontSize: '1rem',
              lineHeight: 1.4,
              mb: 1,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {course.fullname}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {instructor}
          </Typography>

          {showProgress && (
            <Box sx={{ mt: 'auto' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.primary" fontWeight="medium">
                  {progress}%完了
                </Typography>
                <Typography variant="caption" color="text.secondary" fontSize="0.7rem">
                  {lastAccessedText}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: COLORS.borderLight,
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: getProgressColor(progress),
                    borderRadius: 3,
                  },
                }}
              />
            </Box>
          )}
        </CardContent>
      </Card>
    );
  }

  // Compact variant - Used in dashboard/grid views
  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: onClick ? 'pointer' : 'default',
        border: `1px solid ${COLORS.borderLight}`,
        transition: 'all 0.2s ease',
        '&:hover': onClick ? {
          boxShadow: SHADOWS.card,
        } : {},
      }}
      onClick={onClick}
    >
      <CardContent sx={{ p: SPACING.md }}>
        <Typography variant="subtitle1" component="h3" gutterBottom>
          {course.fullname}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {course.categoryname}
        </Typography>

        {showProgress && progress !== undefined && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 4,
                borderRadius: 2,
                '& .MuiLinearProgress-bar': {
                  backgroundColor: getProgressColor(progress),
                },
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {progress}% 完了
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default CourseCard;
