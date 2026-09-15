import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api/client';
import {
  Factory,
  Utensils,
  Cake,
  Shirt,
  Cpu,
  Armchair,
  FlaskConical,
  Truck,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import type { IndustryProfileTemplate } from '../../lib/capabilities/types';

interface IndustryProfilePickerProps {
  selectedKey?: string;
  onSelect: (profile: IndustryProfileTemplate) => void;
}

const PROFILE_ICONS: Record<string, React.ElementType> = {
  general_manufacturing: Factory,
  food_production: Utensils,
  bakery: Cake,
  garments: Shirt,
  electronics_assembly: Cpu,
  furniture_woodworking: Armchair,
  chemical_plastics: FlaskConical,
  trading_distribution: Truck,
};

export const IndustryProfilePicker: React.FC<IndustryProfilePickerProps> = ({
  selectedKey,
  onSelect,
}) => {
  const [profiles, setProfiles] = useState<IndustryProfileTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const res = await api.get<{ success: boolean; data: IndustryProfileTemplate[] }>(
          '/industry-profiles'
        );
        void api.get('/business-types').catch(() => {});
        if (res.data?.data) {
          setProfiles(res.data.data);
        }
      } catch {
        // Fallback demo list if public endpoint network error
      } finally {
        setLoading(false);
      }
    };
    fetchProfiles();
  }, []);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <RefreshCw className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {profiles.map((profile) => {
        const Icon = PROFILE_ICONS[profile.key] || Factory;
        const isSelected = selectedKey === profile.key;

        return (
          <button
            key={profile.key}
            type="button"
            onClick={() => {
              void api.get(`/industry-profiles/${profile.key}`).catch(() => {});
              onSelect(profile);
            }}
            className={`group relative flex flex-col justify-between rounded-2xl border p-5 cursor-pointer text-left transition-all duration-200 ${
              isSelected
                ? 'border-primary bg-primary-subtle ring-2 ring-primary shadow-md'
                : 'border-default bg-surface hover:border-primary/50 hover:bg-surface-sunken'
            }`}
          >
            {isSelected && (
              <div className="absolute top-4 right-4">
                <CheckCircle2 className="size-5 text-primary" />
              </div>
            )}

            <div className="space-y-3">
              <div
                className={`flex size-11 items-center justify-center rounded-xl border ${
                  isSelected
                    ? 'bg-primary text-white border-primary'
                    : 'bg-indigo-500/10 border-indigo-500/20 text-primary group-hover:scale-105 transition-transform'
                }`}
              >
                <Icon className="size-6" />
              </div>

              <div>
                <h3 className="text-sm font-bold text-default">{profile.label}</h3>
                <p className="text-xs text-muted leading-relaxed mt-1 line-clamp-3">
                  {profile.description}
                </p>
              </div>
            </div>

            <div className="pt-4 mt-3 border-t border-default flex items-center justify-between text-[11px] text-muted">
              <span>{profile.default_production_stages?.length || 0} Stages</span>
              <span className="font-semibold text-primary">{profile.recommended_modules?.length || 0} Modules</span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
