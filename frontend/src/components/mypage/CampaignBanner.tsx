import React from 'react';
import { Campaign } from '../../types/mypage';
import { Card, CardContent } from '../ui/card';

interface CampaignBannerProps {
  campaign: Campaign;
  onClick?: () => void;
}

export const CampaignBanner: React.FC<CampaignBannerProps> = ({ campaign, onClick }) => {
  return (
    <Card
      className="border-0 cursor-pointer hover:opacity-90 transition-opacity"
      style={{ backgroundColor: campaign.backgroundColor }}
      onClick={onClick}
    >
      <CardContent className="p-4 sm:p-6 text-center">
        <p className="text-xs text-white mb-2">特別キャンペーン</p>
        <h4 className="text-white font-bold text-base sm:text-lg">
          {campaign.title}
        </h4>
      </CardContent>
    </Card>
  );
};
