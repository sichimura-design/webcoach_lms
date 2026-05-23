import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';

interface CardProps {
  onClick?: () => void;
  minHeight?: string;
  children: React.ReactNode;
  className?: string;
}

export function Card({ onClick, minHeight = '192px', children, className = '' }: CardProps) {
  return (
    <div
      className={`bg-[#FFFEFE] border border-brand-border flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow ${className}`}
      style={{ borderRadius: '24px', padding: '24px', minHeight }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

Card.Button = function CardButton({ label = '学習ページへ' }: { label?: string }) {
  return (
    <Button
      variant="brand-ghost"
      size="pill"
      className="mt-3 flex items-center gap-2"
      style={{ fontSize: '12px', fontWeight: 700, lineHeight: '16px', padding: '8px 16px' }}
    >
      <span>{label}</span>
      <ChevronRight className="w-[18px] h-[18px] text-brand-muted" />
    </Button>
  );
};
