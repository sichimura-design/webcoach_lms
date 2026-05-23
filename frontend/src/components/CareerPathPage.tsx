import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  AppBar,
  Toolbar,
  IconButton,
  Button,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Drawer,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  ArrowBack,
  FiberManualRecord,
  Menu as MenuIcon,
} from '@mui/icons-material';

interface CareerPathPageProps {
  careerPath: string;
  onBack: () => void;
}

function CareerPathPage({ careerPath, onBack }: CareerPathPageProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 職種別カリキュラムデータ
  const careerData = {
    'web-designer': {
      title: 'WEBデザイナー',
      subtitle: 'Web Designer',
      color: '#E91E63',
      steps: [
        {
          id: 1,
          title: 'デザインの基礎を学ぶ',
          description: '色彩理論、タイポグラフィ、レイアウトの基本を学習',
          tools: [],
        },
        {
          id: 2,
          title: '実際に手を動かしてつくる',
          description: 'Figma、Canvaなどのツールを使って実践',
          tools: ['Canva', 'Wix'],
        },
        {
          id: 3,
          title: 'デザイン実践を深める',
          description: 'より高度なデザイン技術を習得',
          tools: [],
        },
        {
          id: 4,
          title: '実務課題・演習課題',
          description: '実際のプロジェクトに近い課題に取り組む',
          tools: [],
        },
      ],
      curriculum: {
        roadmap: [
          'デザインの基礎から学ぶ',
          '実際に手を動かしてつくる',
          'ツールに慣れてスキルアップをする',
          '実務課題・演習課題',
        ],
        goal: 'デザインの理論・デザインツールを習得しよう！',
        tools: [
          { name: 'Canva', type: '伝書' },
          { name: 'Wix', type: '伝書' },
        ],
        designBasics: [
          { name: 'Canva', type: '伝書' },
          { name: 'Wix', type: '伝書' },
        ],
        designTools: [
          { name: 'Canva', type: '伝書' },
          { name: 'Wix', type: '伝書' },
        ],
      },
    },
    'web-developer': {
      title: 'WEB制作',
      subtitle: 'Web Development',
      color: '#2196F3',
      steps: [
        {
          id: 1,
          title: 'HTML/CSSの基礎',
          description: 'ウェブページの構造とスタイリングを学習',
          tools: [],
        },
        {
          id: 2,
          title: 'JavaScriptプログラミング',
          description: 'インタラクティブな機能の実装',
          tools: [],
        },
        {
          id: 3,
          title: 'レスポンシブデザイン',
          description: 'モバイル対応のサイト制作',
          tools: [],
        },
        {
          id: 4,
          title: '実務プロジェクト',
          description: 'ポートフォリオサイトの制作',
          tools: [],
        },
      ],
      curriculum: {
        roadmap: ['HTML/CSS基礎', 'JavaScript', 'レスポンシブ', '実務課題'],
        goal: 'モダンなWEBサイトを制作できるようになろう！',
        tools: [],
        designBasics: [],
        designTools: [],
      },
    },
  };

  const currentCareer = careerData[careerPath as keyof typeof careerData] || careerData['web-designer'];

  const menuItems = [
    '学習の心得',
    'WEBデザイン',
    'WEB制作・デザイナー',
    'WEB制作',
    '動画編集',
    '生成AI講座',
    'ビジネススキル',
  ];

  return (
    <Box sx={{ flexGrow: 1, bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      {/* サイドバー */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: 240,
            bgcolor: 'white',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ color: '#C62828', fontWeight: 'bold', mb: 2 }}>
            WEBCOACH
          </Typography>
          <List>
            {menuItems.map((item, index) => (
              <ListItem key={index} sx={{ py: 1.5, cursor: 'pointer', '&:hover': { bgcolor: 'grey.100' } }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <FiberManualRecord sx={{ fontSize: 8, color: index === 1 ? '#C62828' : 'grey.400' }} />
                </ListItemIcon>
                <ListItemText
                  primary={item}
                  primaryTypographyProps={{
                    fontWeight: index === 1 ? 'bold' : 'normal',
                    color: index === 1 ? '#C62828' : 'text.primary',
                  }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      {/* ヘッダー */}
      <AppBar position="static" sx={{ bgcolor: 'white', color: 'text.primary' }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => setDrawerOpen(true)} sx={{ mr: 2 }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, color: '#C62828', fontWeight: 'bold' }}>
            WEBCOACH
          </Typography>
          <IconButton color="inherit" onClick={onBack}>
            <ArrowBack />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* ヒーローセクション */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${currentCareer.color} 0%, ${currentCareer.color}CC 100%)`,
          color: 'white',
          py: 6,
        }}
      >
        <Container maxWidth="lg">
          <Typography variant="body1" gutterBottom sx={{ fontWeight: 300 }}>
            {currentCareer.subtitle}
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
            {currentCareer.title}
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* キャリアロードマップ */}
        <Card sx={{ mb: 4 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 3 }}>
              {currentCareer.title}キャリアロードマップ
            </Typography>
            <Grid container spacing={2}>
              {currentCareer.steps.map((step, index) => (
                <Grid size={{ xs: 12, sm: 6, md: 3 }} key={step.id}>
                  <Box
                    sx={{
                      p: 2,
                      border: '1px solid',
                      borderColor: 'grey.300',
                      borderRadius: 1,
                      height: '100%',
                      bgcolor: activeStep === index ? 'grey.100' : 'white',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'grey.50' },
                    }}
                    onClick={() => setActiveStep(index)}
                  >
                    <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                      STEP {step.id}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', minHeight: 48 }}>
                      {step.title}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>

        {/* STEP詳細 */}
        <Card sx={{ mb: 4, bgcolor: 'grey.100' }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
              STEP{activeStep + 1}詳細を見る
            </Typography>
            <Box
              sx={{
                p: 3,
                bgcolor: 'white',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'grey.300',
              }}
            >
              <Typography variant="h6" gutterBottom>
                {currentCareer.curriculum.goal}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {currentCareer.steps[activeStep].description}
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* 学習の目標 */}
        {currentCareer.curriculum.tools.length > 0 && (
          <Card sx={{ mb: 4 }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
                学習の目標
              </Typography>
              <Grid container spacing={2}>
                {currentCareer.curriculum.tools.map((tool, index) => (
                  <Grid size={{ xs: 12, sm: 6 }} key={index}>
                    <Box
                      sx={{
                        p: 2,
                        height: 100,
                        bgcolor: 'grey.200',
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography variant="body1">
                        【{tool.type}】{tool.name}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* デザイン基礎 */}
        {currentCareer.curriculum.designBasics.length > 0 && (
          <Card sx={{ mb: 4 }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
                デザイン基礎
              </Typography>
              <Grid container spacing={2}>
                {currentCareer.curriculum.designBasics.map((tool, index) => (
                  <Grid size={{ xs: 12, sm: 6 }} key={index}>
                    <Box
                      sx={{
                        p: 2,
                        height: 100,
                        bgcolor: 'grey.200',
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography variant="body1">
                        【{tool.type}】{tool.name}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* デザインツール */}
        {currentCareer.curriculum.designTools.length > 0 && (
          <Card sx={{ mb: 4 }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>
                デザインツール
              </Typography>
              <Grid container spacing={2}>
                {currentCareer.curriculum.designTools.map((tool, index) => (
                  <Grid size={{ xs: 12, sm: 6 }} key={index}>
                    <Box
                      sx={{
                        p: 2,
                        height: 100,
                        bgcolor: 'grey.200',
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography variant="body1">
                        【{tool.type}】{tool.name}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* ナビゲーションボタン */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
          <Button
            variant="outlined"
            onClick={onBack}
            sx={{ minWidth: 120 }}
          >
            戻る
          </Button>
          <Button
            variant="contained"
            sx={{
              minWidth: 120,
              bgcolor: currentCareer.color,
              '&:hover': { bgcolor: currentCareer.color },
            }}
          >
            STEPへ進む
          </Button>
        </Box>
      </Container>
    </Box>
  );
};

export default CareerPathPage;
