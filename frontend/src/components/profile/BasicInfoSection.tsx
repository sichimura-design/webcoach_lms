import React from 'react';
import { Card, CardContent } from '../ui/card';
import { FormInput } from './FormInput';

interface BasicInfoSectionProps {
  nickName: string;
  bio: string;
  avatarUrl?: string;
  bioCharCount: number;
  onNicknameChange: (value: string) => void;
  onBioChange: (value: string) => void;
}

export function BasicInfoSection({
  nickName,
  bio,
  avatarUrl,
  bioCharCount,
  onNicknameChange,
  onBioChange,
}: BasicInfoSectionProps) {
  const avatarSrc = avatarUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(nickName || 'User')}&background=F3A7A7&color=fff&size=96`;

  return (
    <Card className="border-0">
      <CardContent className="p-8">
        <h3
          className="text-lg font-bold text-gray-800 mb-6"
        >
          基本情報
        </h3>

        <div className="space-y-6">
          {/* Profile Image & Nickname */}
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0">
              <div className="w-24 h-24 rounded-full border-4 border-[#FCE7F3] overflow-hidden">
                <img
                  src={avatarSrc}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div className="flex-1">
              <FormInput
                label="表示名（ニックネーム可）"
                value={nickName}
                onChange={onNicknameChange}
                placeholder="例: Webデザイナー志望のハナコ"
              />
            </div>
          </div>

          {/* Bio */}
          <FormInput
            label="自己紹介"
            value={bio}
            onChange={onBioChange}
            placeholder="例: 未経験からWebデザイナーを目指している高橋ハナコです！FigmaとPhotoshopを独学中。もくもく会で一緒に頑張れる仲間を募集中です"
            multiline
            rows={4}
            maxLength={140}
            showCharCount
            charCount={bioCharCount}
          />
        </div>
      </CardContent>
    </Card>
  );
}
