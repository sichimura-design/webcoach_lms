import { motion, AnimatePresence } from 'framer-motion';

export type CharacterState = 'idle' | 'thinking' | 'talking';

interface CharacterAvatarProps {
  state: CharacterState;
  size?: number;
}

// AI画像生成で作った仮のテンプレキャラクター（きつね）。/public/mascot 配下のstate別ポーズを
// framer-motionで軽く動かして表現している。本番のキャラクターができたらこのコンポーネントの
// 内部だけ差し替えれば良いように、state('idle'|'thinking'|'talking')を渡すインターフェースは
// そのまま維持する。
const SPRITE_BY_STATE: Record<CharacterState, string> = {
  idle: '/mascot/fox-idle.png',
  thinking: '/mascot/fox-thinking.png',
  talking: '/mascot/fox-talking.png',
};

const MOTION_BY_STATE: Record<CharacterState, { animate: object; transition: object }> = {
  idle: {
    animate: { y: [0, -4, 0], rotate: [0, -2, 0, 2, 0] },
    transition: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' },
  },
  thinking: {
    animate: { rotate: [-3, 3, -3] },
    transition: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' },
  },
  talking: {
    animate: { scale: [1, 1.06, 1] },
    transition: { duration: 0.5, repeat: Infinity, ease: 'easeInOut' },
  },
};

function CharacterAvatar({ state, size = 40 }: CharacterAvatarProps) {
  const motionProps = MOTION_BY_STATE[state];

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <AnimatePresence mode="wait">
        <motion.img
          key={state}
          src={SPRITE_BY_STATE[state]}
          alt=""
          className="w-full h-full object-contain"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1, ...motionProps.animate }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={motionProps.transition}
        />
      </AnimatePresence>
      {state === 'thinking' && (
        <motion.div
          className="absolute flex items-center justify-center rounded-full bg-white"
          style={{
            width: size * 0.4, height: size * 0.4,
            top: -size * 0.08, right: -size * 0.08,
            boxShadow: '0 2px 8px rgba(190,60,70,.25)',
          }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          <span style={{ fontSize: size * 0.2, color: '#D60934', lineHeight: 1 }}>…</span>
        </motion.div>
      )}
    </div>
  );
}

export default CharacterAvatar;
