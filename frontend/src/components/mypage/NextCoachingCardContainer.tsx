/**
 * マイページ（ダッシュボード）に置く次回コーチングカード。
 *
 * カード本体は /coaching と共通（coaching/NextCoachingCard）。
 * ここはデータ取得と、モーダル・遷移の配線だけを担う。
 * ダッシュボードから直接コーチングに参加できるようにするのが目的。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import bffClient from '../../services/bffClient';
import { useToast } from '../../contexts/ToastContext';
import ConsentModal from '../coaching/ConsentModal';
import MeetingLinkModal from '../coaching/MeetingLinkModal';
import NextCoachingCard from '../coaching/NextCoachingCard';
import type { AutoImportReadiness, CoachingSessions, MeetingLink } from '../../types/coaching';

interface NextCoachingCardContainerProps {
  userId: number | undefined;
}

export function NextCoachingCardContainer({ userId }: NextCoachingCardContainerProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [sessions, setSessions] = useState<CoachingSessions | null>(null);
  const [readiness, setReadiness] = useState<AutoImportReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  const reload = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      const [list, ready] = await Promise.all([
        bffClient.getCoachingSessions(userId),
        bffClient.getAutoImportReadiness(userId),
      ]);
      setSessions(list);
      setReadiness(ready);
    } catch {
      /* ダッシュボードの1カードなので、失敗しても静かに隠す */
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const startSession = async () => {
    if (!userId || starting) return;
    setStarting(true);
    try {
      const session = await bffClient.startCoachingSession(userId);
      setConsentModalOpen(false);
      if (session.meetingLink) {
        window.open(session.meetingLink.url, '_blank', 'noopener,noreferrer');
      }
      // 記録中以降の操作は /coaching に任せる
      navigate('/coaching');
    } catch {
      showToast('コーチングを開始できませんでした', 'error');
    } finally {
      setStarting(false);
    }
  };

  const registerLink = async (link: MeetingLink) => {
    if (!userId) return;
    await bffClient.registerMeetingLink(userId, link);
    await reload();
  };

  if (loading || !sessions?.next) return null;

  return (
    <>
      <NextCoachingCard
        next={sessions.next}
        readiness={readiness}
        onRegisterLink={() => setLinkModalOpen(true)}
        onChangeLink={() => setLinkModalOpen(true)}
        onStart={() => {
          if (sessions.consent?.agreed) void startSession();
          else setConsentModalOpen(true);
        }}
        onOpenSession={() => navigate('/coaching')}
        starting={starting}
      />

      {linkModalOpen && (
        <MeetingLinkModal
          coachName={sessions.next.coach}
          currentLink={sessions.next.meetingLink}
          readiness={readiness}
          onRegister={registerLink}
          onClose={() => setLinkModalOpen(false)}
        />
      )}

      {consentModalOpen && (
        <ConsentModal
          onAgree={async () => {
            if (!userId) return;
            await bffClient.setCoachingConsent(userId);
            await startSession();
          }}
          onClose={() => setConsentModalOpen(false)}
        />
      )}
    </>
  );
}

export default NextCoachingCardContainer;
