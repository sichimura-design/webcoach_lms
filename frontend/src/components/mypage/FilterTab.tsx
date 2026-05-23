import React from 'react';
import { Button } from '../ui/button';

interface FilterTabProps {
  filters: string[];
  selectedFilter: string;
  onFilterClick: (filter: string) => void;
}

export function FilterTab({ filters, selectedFilter, onFilterClick }: FilterTabProps) {
  return (
    <div className="flex flex-wrap gap-2 sm:gap-3 mb-6">
      {filters.map((filter) => (
        <Button
          key={filter}
          variant={selectedFilter === filter ? 'default' : 'outline'}
          onClick={() => onFilterClick(filter)}
          className={`
            rounded-full text-sm font-medium
            ${
              selectedFilter === filter
                ? 'bg-gray-900 text-white hover:bg-gray-800'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }
          `}
        >
          {filter}
        </Button>
      ))}
    </div>
  );
}
