import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Button,
  Drawer,
  Box,
  TextField,
  Avatar,
  Paper,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Logout,
  Home,
  School,
  Work,
  SmartToy,
  Send,
  Person,
  Close,
  Source,
} from '@mui/icons-material';
import { bffClient } from '../services/bffClient';
import MarkdownRenderer from './MarkdownRenderer';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Array<{
    chunk_index: number;
    module_name: string;
    filename: string;
    section_name: string;
    similarity: number;
  }>;
}

interface WebCoachHeaderProps {
  onLogout?: () => void;
  onNavigateToCareerPath?: () => void;
  onNavigateToSkill?: () => void;
  showButtons?: boolean;
}

function WebCoachHeader({
  onLogout,
  onNavigateToCareerPath,
  onNavigateToSkill,
  showButtons = true,
}: WebCoachHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // AI Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'こんにちは！WEBCOACH AI学習アシスタントです。学習に関する質問や、コースのおすすめ、キャリアパスについてなど、お気軽にご相談ください。',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isHomePage = location.pathname === '/home' || location.pathname === '/';
  const isCoursesPage = location.pathname === '/courses';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setLoading(true);

    try {
      const result = await bffClient.sendAIMessage({
        message: currentInput,
      });

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.message || '回答を取得できませんでした',
        timestamp: new Date(),
        sources: (result.sources || []).map(s => ({
          chunk_index: s.chunk_index || 0,
          module_name: s.module_name || '',
          filename: s.filename || '',
          section_name: s.section_name || '',
          similarity: s.similarity || 0
        })),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('AI response error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '申し訳ございません。一時的なエラーが発生しました。しばらく時間をおいてから、もう一度お試しください。',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const isDevPreview = process.env.PUBLIC_URL?.startsWith('/branches/');

  return (
    <AppBar position="static" sx={{ bgcolor: '#C62828' }}>
      {isDevPreview && (
        <Box sx={{ bgcolor: '#F57F17', textAlign: 'center', py: 0.5, fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: 1 }}>
          ⚠️ DEV PREVIEW — {process.env.PUBLIC_URL}
        </Box>
      )}
      <Toolbar>
        <Typography
          variant="h6"
          component="div"
          sx={{ flexGrow: 1, fontWeight: 'bold', cursor: 'pointer' }}
          onClick={() => navigate('/home')}
        >
          WEBCOACH
        </Typography>
        {showButtons && (
          <>
            <Button
              color="inherit"
              startIcon={<Home />}
              sx={{
                mr: 2,
                bgcolor: isHomePage ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
              }}
              onClick={() => navigate('/home')}
            >
              ホーム
            </Button>
            <Button
              color="inherit"
              startIcon={<School />}
              sx={{
                mr: 2,
                bgcolor: isCoursesPage ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
              }}
              onClick={() => navigate('/courses')}
            >
              コース
            </Button>
            <Button color="inherit" startIcon={<Work />} sx={{ mr: 2 }}>
              キャリアパス
            </Button>
            <Button
              color="inherit"
              startIcon={<SmartToy />}
              onClick={() => setChatOpen(true)}
              sx={{ mr: 2 }}
            >
              AIアシスタント
            </Button>
          </>
        )}
        {onLogout && (
          <IconButton color="inherit" onClick={onLogout}>
            <Logout />
          </IconButton>
        )}
      </Toolbar>

      {/* AI Chat Drawer */}
      <Drawer
        anchor="right"
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        hideBackdrop
        PaperProps={{
          sx: { width: { xs: '100%', sm: 400 } },
        }}
      >
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <Box
            sx={{
              p: 2,
              bgcolor: '#C62828',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SmartToy />
              <Typography variant="h6">AI学習アシスタント</Typography>
            </Box>
            <IconButton onClick={() => setChatOpen(false)} sx={{ color: 'white' }}>
              <Close />
            </IconButton>
          </Box>

          <Divider />

          {/* Messages Area */}
          <Box
            sx={{
              flexGrow: 1,
              overflowY: 'auto',
              p: 2,
              bgcolor: '#f5f5f5',
            }}
          >
            {messages.map((message) => (
              <Box
                key={message.id}
                sx={{
                  display: 'flex',
                  gap: 2,
                  mb: 2,
                  flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
                }}
              >
                <Avatar
                  sx={{
                    bgcolor: message.role === 'user' ? '#1976d2' : '#C62828',
                    width: 36,
                    height: 36,
                  }}
                >
                  {message.role === 'user' ? <Person /> : <SmartToy />}
                </Avatar>
                <Box sx={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Paper
                    elevation={1}
                    sx={{
                      p: 2,
                      bgcolor: message.role === 'user' ? '#e3f2fd' : 'white',
                    }}
                  >
                    {message.role === 'assistant' ? (
                      <MarkdownRenderer content={message.content} compact />
                    ) : (
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {message.content}
                      </Typography>
                    )}
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 1, display: 'block' }}
                    >
                      {message.timestamp.toLocaleTimeString('ja-JP', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Typography>
                  </Paper>

                  {/* 参照元情報 */}
                  {message.sources && message.sources.length > 0 && (
                    <Box sx={{ pl: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                        <Source fontSize="small" sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary" fontWeight="bold">
                          参照元
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {message.sources.map((source, index) => (
                          <Paper
                            key={index}
                            elevation={0}
                            sx={{
                              p: 1,
                              bgcolor: '#f5f5f5',
                              border: '1px solid #e0e0e0',
                              borderRadius: 1,
                            }}
                          >
                            <Typography variant="caption" fontWeight="bold" display="block">
                              {source.module_name}
                              {source.filename && ` - ${source.filename}`}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                              {source.section_name} | 類似度: {(source.similarity * 100).toFixed(1)}%
                            </Typography>
                          </Paper>
                        ))}
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>
            ))}
            {loading && (
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Avatar sx={{ bgcolor: '#C62828', width: 36, height: 36 }}>
                  <SmartToy />
                </Avatar>
                <Paper elevation={1} sx={{ p: 2 }}>
                  <CircularProgress size={16} />
                  <Typography variant="body2" sx={{ ml: 1, display: 'inline' }}>
                    考え中...
                  </Typography>
                </Paper>
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Box>

          <Divider />

          {/* Input Area */}
          <Box sx={{ p: 2, bgcolor: 'white' }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                multiline
                maxRows={3}
                size="small"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="質問を入力してください..."
                variant="outlined"
                disabled={loading}
              />
              <IconButton
                onClick={handleSendMessage}
                disabled={!input.trim() || loading}
                sx={{
                  bgcolor: '#C62828',
                  color: 'white',
                  '&:hover': { bgcolor: '#8B1A1A' },
                  '&:disabled': { bgcolor: '#ccc' },
                }}
              >
                <Send />
              </IconButton>
            </Box>
          </Box>
        </Box>
      </Drawer>
    </AppBar>
  );
}

export default WebCoachHeader;
