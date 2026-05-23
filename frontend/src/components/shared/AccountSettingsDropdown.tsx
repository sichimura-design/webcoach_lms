import React from 'react';
import { useNavigate } from 'react-router-dom';

interface AccountSettingsDropdownProps {
  userName: string;
  avatarSrc: string;
}

export function AccountSettingsDropdown({ userName, avatarSrc }: AccountSettingsDropdownProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate('/account-settings')}
      className="flex items-center cursor-pointer border-0 bg-transparent"
      style={{ gap: '4px' }}
    >
      <div className="rounded-full overflow-hidden" style={{ width: '36px', height: '36px' }}>
        <img src={avatarSrc} alt="Profile" className="w-full h-full object-cover" />
      </div>
    </button>
  );
}
