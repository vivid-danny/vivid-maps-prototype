import { useState, useRef, useEffect } from 'react';
import type { DisplayMode } from '../model/types';
import type { SeatMapConfig } from '../config/types';
import { THEME_IDS, THEME_LABELS } from '../config/themes';
import type { ThemeId } from '../config/themes';

interface PrototypeControlsProps {
  showControls: boolean;
  currentScale: number;
  displayMode: DisplayMode;
  config: SeatMapConfig;
  resetVersion: number;
  onConfigChange: (updates: Partial<SeatMapConfig>) => void;
  onResetConfig: () => void;
}

function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
  getLabel,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  getLabel?: (v: T) => string;
}) {
  return (
    <div className="flex border border-gray-200 rounded-md overflow-hidden">
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={`flex-1 px-2 py-1.5 text-[11px] font-medium transition-colors duration-150 capitalize ${
            value === option
              ? 'bg-foreground text-white'
              : 'bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700'
          }`}
        >
          {getLabel ? getLabel(option) : option}
        </button>
      ))}
    </div>
  );
}

function parseColor(value: string): { hex: string; alpha: number } {
  const rgba = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (rgba) {
    const r = parseInt(rgba[1]);
    const g = parseInt(rgba[2]);
    const b = parseInt(rgba[3]);
    const a = rgba[4] !== undefined ? parseFloat(rgba[4]) : 1;
    const hex = '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
    return { hex, alpha: a };
  }
  if (value.startsWith('#') && value.length === 9) {
    return { hex: value.slice(0, 7), alpha: parseInt(value.slice(7, 9), 16) / 255 };
  }
  if (value.startsWith('#')) {
    return { hex: value.slice(0, 7), alpha: 1 };
  }
  return { hex: '#000000', alpha: 1 };
}

function buildColor(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (alpha >= 1) return hex;
  return `rgba(${r}, ${g}, ${b}, ${parseFloat(alpha.toFixed(2))})`;
}

function ColorControl({
  label,
  value,
  onChange,
  prodRef,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  prodRef?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { hex, alpha } = parseColor(value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="flex items-center justify-between gap-3" ref={containerRef}>
      <div className="flex flex-col min-w-0">
        <label className="text-xs text-gray-600 capitalize">{label}</label>
        <span className="text-[10px] text-gray-400 font-mono truncate">{value}</span>
        {prodRef && <span className="text-[10px] text-gray-400 font-mono">{prodRef}</span>}
      </div>
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          title={value}
          className="w-7 h-7 rounded-md border border-gray-200 cursor-pointer overflow-hidden relative transition-shadow hover:shadow-sm"
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
              backgroundSize: '6px 6px',
              backgroundPosition: '0 0, 0 3px, 3px -3px, -3px 0',
            }}
          />
          <div className="absolute inset-0" style={{ backgroundColor: value }} />
        </button>

        {open && (
          <div className="absolute right-0 top-9 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 space-y-3 w-52">
            <input
              type="color"
              value={hex}
              onChange={(e) => onChange(buildColor(e.target.value, alpha))}
              className="w-full h-8 cursor-pointer border border-gray-200 rounded-md"
            />
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 font-mono">α</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={alpha}
                onChange={(e) => onChange(buildColor(hex, parseFloat(e.target.value)))}
                className="flex-1"
              />
              <span className="text-[10px] font-mono text-gray-500 w-7 text-right">
                {Math.round(alpha * 100)}%
              </span>
            </div>
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full text-xs px-2 py-1 border border-gray-200 rounded-md font-mono"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ title, prodSource, first }: {
  title: string;
  prodSource?: string;
  first?: boolean;
}) {
  return (
    <div className={first ? 'mb-3' : 'border-t border-gray-100 pt-6 mb-3'}>
      <div className="text-[11px] font-bold text-foreground tracking-wide">{title}</div>
      {prodSource && <div className="text-[10px] text-gray-400 font-mono mt-0.5">{prodSource}</div>}
    </div>
  );
}

const DISPLAY_MODES = ['sections', 'rows', 'seats'] as const;

export function PrototypeControls({
  showControls,
  currentScale,
  displayMode,
  config,
  resetVersion,
  onConfigChange,
  onResetConfig,
}: PrototypeControlsProps) {
  const [activeTab, setActiveTab] = useState<'controls' | 'styles'>('controls');

  useEffect(() => {
    setActiveTab('controls');
  }, [resetVersion]);

  const handleColorChange = (key: keyof SeatMapConfig['seatColors'], value: string) => {
    onConfigChange({
      seatColors: {
        ...config.seatColors,
        [key]: value,
      },
    });
  };

  return (
    <div
      className={`shrink-0 h-full border-r border-gray-200 transition-all duration-300 ${
        showControls ? 'w-96' : 'w-0 overflow-hidden border-r-0'
      }`}
    >
      <div className="flex items-center justify-between h-12 border-b border-gray-200 px-5">
        <h2 className="text-[13px] font-semibold text-foreground">Prototype Controls</h2>
        <button
          onClick={onResetConfig}
          className="text-xs text-gray-400 hover:text-gray-600 underline-offset-2 hover:underline transition-colors cursor-pointer"
        >
          Reset All
        </button>
      </div>
      <div
        className={`px-5 py-5 overflow-y-auto h-[calc(100%-48px)] transition-opacity no-scrollbar ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex border-b border-gray-200 mb-6">
          {([
            { id: 'controls', label: 'Interaction' },
            { id: 'styles', label: 'Styles' },
          ] as const).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-4 py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                activeTab === id
                  ? 'text-foreground border-b-2 border-foreground -mb-px'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'controls' && (
          <>
            <div className="mb-6 p-3 bg-gray-50 rounded-md border border-gray-100 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Zoom:</span>
                <span className="font-mono tabular-nums">
                  {currentScale.toFixed(2)}x
                  <span className="text-gray-400 ml-1">({'\u2248'} prod {(currentScale - 8).toFixed(1)})</span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Mode:</span>
                <span className="font-medium capitalize">{displayMode}</span>
              </div>
            </div>

            <div className="mb-6">
              <div className="text-[11px] font-bold text-foreground mb-3">Display Mode</div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5">Initial Display</label>
                  <ToggleGroup
                    options={DISPLAY_MODES}
                    value={config.initialDisplay}
                    onChange={(initialDisplay) => onConfigChange({ initialDisplay })}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5">Zoomed-In Display</label>
                  <ToggleGroup
                    options={DISPLAY_MODES}
                    value={config.zoomedDisplay}
                    onChange={(zoomedDisplay) => onConfigChange({ zoomedDisplay })}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'styles' && (
          <>
            <div className="mb-6">
              <label className="text-[11px] text-foreground font-bold block mb-2">Theme</label>
              <ToggleGroup
                options={THEME_IDS}
                value={config.theme}
                onChange={(theme: ThemeId) => onConfigChange({ theme })}
                getLabel={(t) => THEME_LABELS[t]}
              />
            </div>

            <div className="mb-6">
              <SectionHeader
                title="DEFAULT_COLORS"
                prodSource="Mapbox/constants.ts"
                first
              />
              <div className="space-y-3">
                <ColorControl
                  label="Section Label"
                  value={config.seatColors.labelDefault}
                  onChange={(value) => handleColorChange('labelDefault', value)}
                  prodRef="textColor"
                />
                <ColorControl
                  label="Section Stroke"
                  value={config.sectionStroke}
                  onChange={(value) => onConfigChange({ sectionStroke: value })}
                  prodRef="sectionStrokeColor"
                />
                <ColorControl
                  label="Row Stroke"
                  value={config.rowStrokeColor}
                  onChange={(value) => onConfigChange({ rowStrokeColor: value })}
                  prodRef="sectionNoInventoryFill"
                />
                <ColorControl
                  label="Unavailable Inventory"
                  value={config.seatColors.unavailable}
                  onChange={(value) => handleColorChange('unavailable', value)}
                />
              </div>
            </div>

            <div className="mb-6">
              <SectionHeader title="Selection Overlays" />
              <div className="space-y-3">
                {(['section', 'row', 'seat'] as const).map((level) => (
                  <div key={level}>
                    <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">{level}</div>
                    <div className="space-y-2 ml-2">
                      <ColorControl
                        label="Muted"
                        value={config.overlays[level].muted}
                        onChange={(value) => onConfigChange({
                          overlays: { ...config.overlays, [level]: { ...config.overlays[level], muted: value } },
                        })}
                      />
                      <ColorControl
                        label="Selected"
                        value={config.overlays[level].selected}
                        onChange={(value) => onConfigChange({
                          overlays: { ...config.overlays, [level]: { ...config.overlays[level], selected: value } },
                        })}
                      />
                      <ColorControl
                        label="Hover"
                        value={config.overlays[level].hover}
                        onChange={(value) => onConfigChange({
                          overlays: { ...config.overlays, [level]: { ...config.overlays[level], hover: value } },
                        })}
                      />
                      <ColorControl
                        label="Outline"
                        value={config.overlays[level].selectedOutline}
                        onChange={(value) => onConfigChange({
                          overlays: { ...config.overlays, [level]: { ...config.overlays[level], selectedOutline: value } },
                        })}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Row (in Seats Mode)</div>
                <div className="space-y-2 ml-2">
                  <ColorControl
                    label="Row Fill"
                    value={config.rowFillColor}
                    onChange={(value) => onConfigChange({ rowFillColor: value })}
                  />
                  <ColorControl
                    label="Row Hover Override"
                    value={config.overlays.row.hoverInSeats ?? config.overlays.row.hover}
                    onChange={(value) => onConfigChange({
                      overlays: { ...config.overlays, row: { ...config.overlays.row, hoverInSeats: value } },
                    })}
                  />
                  <ColorControl
                    label="Row Selected Override"
                    value={config.overlays.row.selectedInSeats ?? config.overlays.row.selected}
                    onChange={(value) => onConfigChange({
                      overlays: { ...config.overlays, row: { ...config.overlays.row, selectedInSeats: value } },
                    })}
                  />
                  <ColorControl
                    label="Row Outline Selected"
                    value={config.overlays.row.selectedOutlineInSeats ?? config.overlays.row.selectedOutline}
                    onChange={(value) => onConfigChange({
                      overlays: { ...config.overlays, row: { ...config.overlays.row, selectedOutlineInSeats: value } },
                    })}
                  />
                </div>
              </div>
            </div>

            <div className="mb-6">
              <SectionHeader
                title="Theme Tokens"
                prodSource="useVSTheme"
              />
              <div className="space-y-3">
                <ColorControl
                  label="Background"
                  value={config.mapBackground}
                  onChange={(value) => onConfigChange({ mapBackground: value })}
                  prodRef="neutral[50]"
                />
                <ColorControl
                  label="Venue Fill"
                  value={config.venueFill}
                  onChange={(value) => onConfigChange({ venueFill: value })}
                  prodRef="onPrimary"
                />
                <ColorControl
                  label="Venue Stroke"
                  value={config.venueStroke}
                  onChange={(value) => onConfigChange({ venueStroke: value })}
                  prodRef="onSurfaceDisabled"
                />
                <ColorControl
                  label="Section Base"
                  value={config.sectionBase}
                  onChange={(value) => onConfigChange({ sectionBase: value })}
                  prodRef="neutral[100]"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
