import React from 'react';
import { ActionItem } from '../../types/mypage';
import { Button } from '../ui/button';

interface ActionMenuItemProps {
  item: ActionItem;
  onClick?: () => void;
}

export const ActionMenuItem: React.FC<ActionMenuItemProps> = ({ item, onClick }) => {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className="w-full justify-start gap-2 sm:gap-3 p-2.5 sm:p-3 h-auto hover:bg-gray-50"
    >
      <div
        className="w-5 h-5 sm:w-6 sm:h-6 rounded flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: item.iconColor }}
      >
        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-white rounded-sm"></div>
      </div>
      <span className="text-xs sm:text-sm text-gray-700">
        {item.text}
      </span>
    </Button>
  );
};
