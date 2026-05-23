import React from 'react';
import { Card, CardContent } from '../ui/card';
import { FormInput } from './FormInput';

interface FutureGoalSectionProps {
  careerGoal: string;
  workStyleGoal: string;
  onCareerGoalChange: (value: string) => void;
  onWorkStyleGoalChange: (value: string) => void;
}

export function FutureGoalSection({
  careerGoal,
  workStyleGoal,
  onCareerGoalChange,
  onWorkStyleGoalChange,
}: FutureGoalSectionProps) {
  return (
    <Card className="border-0 bg-[#FFF9F5]">
      <CardContent className="p-8">
        <h3
          className="text-lg font-bold text-gray-800 mb-2"
        >
          未来のあなた設定
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          ここで設定した内容はマイページに表示されます。あなたのキャリアビジョンをシンプルに。
        </p>

        <div className="space-y-6">
          <FormInput
            label="なりたい職種・職務"
            value={careerGoal}
            onChange={onCareerGoalChange}
            placeholder="例: 売れっ子Webデザイナー"
          />

          <FormInput
            label="理想の働き方"
            value={workStyleGoal}
            onChange={onWorkStyleGoalChange}
            placeholder="例: カフェで自由に働く"
          />
        </div>
      </CardContent>
    </Card>
  );
}
