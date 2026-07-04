import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  CardMedia,
  CardActionArea,
  IconButton,
  Button,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  ChevronLeft,
  ChevronRight,
} from '@mui/icons-material';
import WebCoachHeader from './WebCoachHeader';

interface NewsItem {
  id: number;
  title: string;
  image?: string;
}

interface SkillCard {
  id: number;
  title: string;
  subtitle: string;
  image: string;
  category: string;
  color: string;
}

interface WebCoachDashboardProps {
  onLogout: () => void;
  onNavigateToCareerPath: (path: string) => void;
  onNavigateToSkill: (skillId: number) => void;
}

function WebCoachDashboard({
  onLogout,
  onNavigateToCareerPath,
  onNavigateToSkill,
}: WebCoachDashboardProps) {
  const [newsIndex, setNewsIndex] = useState(0);

  // ニュースデータ（サンプル）
  const newsItems: NewsItem[] = [
    { id: 1, title: 'WEBCOACHがもたらすもの' },
    { id: 2, title: 'リファラルキャンペーン' },
    { id: 3, title: '卒業プランの割引キャンペーン' },
  ];

  // スキル別コースデータ
  const skillCards: SkillCard[] = [
    {
      id: 1,
      title: '学習に必要な5段階',
      subtitle: 'Knowledge',
      image: '/images/knowledge.jpg',
      category: 'ソフト・スキル',
      color: '#F5A623',
    },
    {
      id: 2,
      title: 'WEBデザイン',
      subtitle: 'Web Design',
      image: '/images/web-design.jpg',
      category: 'WEBスキル',
      color: '#E91E63',
    },
    {
      id: 3,
      title: 'WEB制作',
      subtitle: 'Website Development',
      image: '/images/web-dev.jpg',
      category: 'WEBスキル',
      color: '#E91E63',
    },
    {
      id: 4,
      title: 'ビジネススキル',
      subtitle: 'Business Skills',
      image: '/images/business.jpg',
      category: 'ソフト・スキル',
      color: '#F5A623',
    },
    {
      id: 5,
      title: 'WEBマーケティング',
      subtitle: 'Web Marketing',
      image: '/images/marketing.jpg',
      category: 'WEBスキル',
      color: '#E91E63',
    },
    {
      id: 6,
      title: '生成AI講座',
      subtitle: 'Introduction to Generative AI',
      image: '/images/ai.jpg',
      category: 'テクノロジー',
      color: '#9C27B0',
    },
    {
      id: 7,
      title: '動画編集',
      subtitle: 'Movie Editing',
      image: '/images/video.jpg',
      category: 'クリエイティブ',
      color: '#E91E63',
    },
  ];

  const handlePrevNews = () => {
    setNewsIndex((prev) => (prev > 0 ? prev - 1 : newsItems.length - 1));
  };

  const handleNextNews = () => {
    setNewsIndex((prev) => (prev < newsItems.length - 1 ? prev + 1 : 0));
  };

  return (
    <Box sx={{ flexGrow: 1, bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      {/* ヘッダー */}
      <WebCoachHeader onLogout={onLogout} />

      {/* My Learning ナビゲーション */}
      <Box
        sx={{
          bgcolor: '#2D2F31',
          color: 'white',
          py: 3,
        }}
      >
        <Container maxWidth="lg">
          <Typography variant="h3" sx={{ fontWeight: 'bold', mb: 2 }}>
            My learning
          </Typography>
          <Box sx={{ borderBottom: 1, borderColor: 'rgba(255, 255, 255, 0.2)' }}>
            <Button
              sx={{
                color: 'white',
                fontSize: '1rem',
                fontWeight: 'bold',
                px: 2,
                py: 1,
                borderBottom: '2px solid white',
                borderRadius: 0,
                textTransform: 'none',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                },
              }}
            >
              All courses
            </Button>
          </Box>
        </Container>
      </Box>

      {/* ヒーローセクション */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #C62828 0%, #EF5350 100%)',
          color: 'white',
          py: 6,
          position: 'relative',
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid size={{ xs: 12, md: 8 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 300 }}>
                Learning Roadmap
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 'bold', mb: 2 }}>
                WEBCOACH監修 学習ロードマップ
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Box
                component="img"
                src={`${process.env.PUBLIC_URL}/images/instructor.jpg`}
                alt="Instructor"
                sx={{
                  width: '100%',
                  maxWidth: 300,
                  borderRadius: 2,
                  boxShadow: 3,
                }}
              />
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* ニュースセクション */}
        <Box sx={{ mb: 6 }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 'bold',
              mb: 3,
              pb: 1,
              borderBottom: '3px solid #C62828',
            }}
          >
            NEWS
          </Typography>
          <Box sx={{ position: 'relative' }}>
            <IconButton
              onClick={handlePrevNews}
              sx={{
                position: 'absolute',
                left: -20,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 1,
                bgcolor: 'white',
                '&:hover': { bgcolor: 'grey.100' },
              }}
            >
              <ChevronLeft />
            </IconButton>
            <Grid container spacing={3}>
              {newsItems.slice(newsIndex, newsIndex + 3).map((item) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.id}>
                  <Card sx={{ height: 200, bgcolor: 'grey.300' }}>
                    <CardActionArea sx={{ height: '100%' }}>
                      <CardContent>
                        <Typography variant="h6" align="center" sx={{ mt: 6 }}>
                          {item.title}
                        </Typography>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
            <IconButton
              onClick={handleNextNews}
              sx={{
                position: 'absolute',
                right: -20,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 1,
                bgcolor: 'white',
                '&:hover': { bgcolor: 'grey.100' },
              }}
            >
              <ChevronRight />
            </IconButton>
          </Box>
        </Box>

        {/* 自習コーナー */}
        <Box sx={{ mb: 6 }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 'bold',
              mb: 3,
              pb: 1,
              borderBottom: '3px solid #C62828',
            }}
          >
            目標オリエンテーションで学ぶ
          </Typography>
          <Card sx={{ height: 200, bgcolor: 'grey.200' }}>
            <CardContent>
              <Typography variant="body1" color="text.secondary">
                目標設定と学習計画のサポート
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* スキル別で学ぶ */}
        <Box sx={{ mb: 6 }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 'bold',
              mb: 3,
              pb: 1,
              borderBottom: '3px solid #C62828',
            }}
          >
            スキル別で学ぶ
          </Typography>
          <Grid container spacing={3}>
            {skillCards.map((card) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={card.id}>
                <Card
                  sx={{
                    height: '100%',
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 6,
                    },
                  }}
                  onClick={() => onNavigateToSkill(card.id)}
                >
                  <Box sx={{ position: 'relative' }}>
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 10,
                        left: 10,
                        bgcolor: card.color,
                        color: 'white',
                        px: 2,
                        py: 0.5,
                        borderRadius: 2,
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                      }}
                    >
                      {card.category}
                    </Box>
                    <CardMedia
                      component="div"
                      sx={{
                        height: 140,
                        bgcolor: 'grey.300',
                      }}
                    />
                  </Box>
                  <CardContent>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                      gutterBottom
                    >
                      {card.subtitle}
                    </Typography>
                    <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                      {card.title}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Container>

      {/* フッター */}
      <Box
        sx={{
          bgcolor: '#C62828',
          color: 'white',
          py: 4,
          mt: 6,
        }}
      >
        <Container maxWidth="lg">
          <Typography variant="h6" gutterBottom>
            WEBCOACH | キャリアチェンジまでの全てを学ぶマンツーマンWEBスクール
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Button color="inherit" sx={{ mr: 2 }}>
              WEBCOACHについて
            </Button>
            <Button color="inherit" sx={{ mr: 2 }}>
              WEBCOACHコンテンツ制作講座
            </Button>
            <Button color="inherit">
              WEBCOACHからのメディア・WEBCOACHcareer
            </Button>
          </Box>
          <Typography variant="body2" sx={{ mt: 3 }}>
            © 2025 by WEBCOACH
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default WebCoachDashboard;
