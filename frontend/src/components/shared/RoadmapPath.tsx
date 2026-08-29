export interface RoadmapStep {
  label: string;
  status: 'done' | 'current' | 'todo';
  hint: string; // '' の場合は非表示（ただし高さは確保する）
  onClick?: () => void;
  /** 'goal' の場合、ロードマップ最終地点として金色の旗マーカーで表示する（statusは接続線の判定にのみ使う） */
  variant?: 'goal';
}

interface RoadmapPathProps {
  steps: RoadmapStep[];
}

// design_handoff_lms_app の「ロードマップ道UI」を移植。
// 完了=赤グラデ丸+✓、現在=白地3px赤枠+パルス、未到達=白地破線丸、ゴール=金色丸+🏁。
// 接続線は「1つ前のステップが完了しているか」で赤グラデ/破線を切り替える。
function RoadmapPath({ steps }: RoadmapPathProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
      {steps.map((step, i) => {
        const prevDone = i > 0 && steps[i - 1].status === 'done';
        const clickable = !!step.onClick;
        const isGoal = step.variant === 'goal';
        return (
          <div
            key={i}
            onClick={step.onClick}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              position: 'relative', cursor: clickable ? 'pointer' : undefined,
            }}
          >
            {i > 0 && (
              <div
                style={
                  prevDone
                    ? { position: 'absolute', top: 16, left: '-50%', width: '100%', height: 6, borderRadius: 999, background: 'linear-gradient(90deg,#E5103C,#D60934)', boxShadow: '0 3px 8px rgba(214,9,52,.18)' }
                    : { position: 'absolute', top: 18, left: '-50%', width: '100%', height: 0, borderTop: '3px dashed #EAD0D5' }
                }
              />
            )}
            {isGoal ? (
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#FBEACD', border: '2px solid #EFC978', color: '#B98A16', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, position: 'relative', zIndex: 1 }}>
                🏁
              </div>
            ) : step.status === 'done' ? (
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(120deg,#E5103C,#D60934)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, boxShadow: '0 6px 14px rgba(214,9,52,.3)', position: 'relative', zIndex: 1 }}>
                ✓
              </div>
            ) : step.status === 'current' ? (
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fff', border: '3px solid #D60934', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(214,9,52,.25)', position: 'relative', zIndex: 1, animation: 'wcPulse 3s ease-in-out infinite' }} />
            ) : (
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', border: '2px dashed #E4C7CC', boxSizing: 'border-box', position: 'relative', zIndex: 1 }} />
            )}
            <div
              style={
                isGoal
                  ? { fontSize: 11, fontWeight: 900, color: '#B98A16', textAlign: 'center' }
                  : step.status === 'current'
                    ? { fontSize: 11, fontWeight: 900, color: '#D60934', textAlign: 'center' }
                    : step.status === 'done'
                      ? { fontSize: 11, fontWeight: 700, color: '#3A2F35', textAlign: 'center' }
                      : { fontSize: 11, color: '#C4ACB3', textAlign: 'center' }
              }
            >
              {step.label}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: step.status === 'current' ? '#D60934' : '#B7A0A7', minHeight: 13 }}>{step.hint}</div>
          </div>
        );
      })}
    </div>
  );
}

export default RoadmapPath;
