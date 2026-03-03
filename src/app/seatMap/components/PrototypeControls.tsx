import { useState } from 'react';
import type { DisplayMode } from '../model/types';
import type { SeatMapConfig } from '../config/types';
import { THEME_IDS, THEME_LABELS } from '../config/themes';
import type { ThemeId } from '../config/themes';
import { ChevronDown } from 'lucide-react';

interface PrototypeControlsProps {
  showControls: boolean;
  currentScale: number;
  displayMode: DisplayMode;
  config: SeatMapConfig;
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
    <div className="flex border border-gray-300 rounded overflow-hidden">
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={`flex-1 px-2 py-1 text-xs font-medium transition-colors capitalize ${
            value === option
              ? 'bg-gray-800 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          {getLabel ? getLabel(option) : option}
        </button>
      ))}
    </div>
  );
}

function SliderControl({
  label,
  value,
  onChange,
  min,
  max,
  step,
  className,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-xs text-gray-600 block mb-2">{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-xs text-gray-600 capitalize">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-6 h-6 rounded cursor-pointer border border-gray-300"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-20 text-xs px-2 py-1 border border-gray-300 rounded font-mono"
        />
      </div>
    </div>
  );
}

function Accordion({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-8">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full text-xs font-bold text-black mb-2 cursor-pointer"
      >
        {label}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? '' : '-rotate-180'}`} />
      </button>
      {open && <div className="space-y-4">{children}</div>}
    </div>
  );
}

const DISPLAY_MODES = ['sections', 'rows', 'seats'] as const;
const LAYOUT_MODE_OVERRIDES = ['auto', 'desktop', 'mobile'] as const;
const ZONE_ROW_DISPLAYS = ['rows', 'seats'] as const;
const PIN_DENSITY_STOPS = [0.00, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90] as const;

export function PrototypeControls({
  showControls,
  currentScale,
  displayMode,
  config,
  onConfigChange,
  onResetConfig,
}: PrototypeControlsProps) {
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
        showControls ? 'w-80' : 'w-0 overflow-hidden border-r-0'
      }`}
    >
      <div className="flex items-center h-12 border-b border-gray-200 px-6">
        <h2 className="text-sm font-semibold text-gray-700">Prototype Controls</h2>
      </div>
      <div
        className={`p-6 overflow-y-auto h-[calc(100%-41px)] transition-opacity no-scrollbar ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Zoom Status */}
        <div className="mb-6 p-3 bg-gray-50 rounded text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-500">Zoom:</span>
            <span className="font-mono">{currentScale.toFixed(2)}x</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Mode:</span>
            <span className="font-medium">{displayMode}</span>
          </div>
        </div>

        {/* Layout Mode Toggle */}
        <div className="mb-6">
          <label className="text-xs text-black font-bold block mb-2">Device</label>
          <ToggleGroup
            options={LAYOUT_MODE_OVERRIDES}
            value={config.layoutModeOverride}
            onChange={(layoutModeOverride) => onConfigChange({ layoutModeOverride })}
          />
        </div>

        {/* Theme */}
        <div className="mb-6">
          <label className="text-xs text-black font-bold block mb-2">Theme</label>
          <ToggleGroup
            options={THEME_IDS}
            value={config.theme}
            onChange={(theme: ThemeId) => onConfigChange({ theme })}
            getLabel={(t) => THEME_LABELS[t]}
          />
        </div>

        <Accordion label="Zoom">
          <div>
            <label className="text-xs text-gray-600 block mb-2">Initial Display</label>
            <ToggleGroup
              options={DISPLAY_MODES}
              value={config.initialDisplay}
              onChange={(initialDisplay) => onConfigChange({ initialDisplay })}
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-2">Zoomed-In Display</label>
            <ToggleGroup
              options={DISPLAY_MODES}
              value={config.zoomedDisplay}
              onChange={(zoomedDisplay) => onConfigChange({ zoomedDisplay })}
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-2">Mixed Inventory Display</label>
            <ToggleGroup
              options={ZONE_ROW_DISPLAYS}
              value={config.zoneRowDisplay}
              onChange={(zoneRowDisplay) => onConfigChange({ zoneRowDisplay })}
            />
          </div>
          <SliderControl
            label={`Desktop Initial Scale: ${config.desktopInitialScale}`}
            value={config.desktopInitialScale}
            onChange={(desktopInitialScale) => onConfigChange({ desktopInitialScale })}
            min={0.5} max={3} step={0.1}
          />
          <SliderControl
            label={`Desktop Zoom Threshold: ${config.desktopZoomThreshold}x`}
            value={config.desktopZoomThreshold}
            onChange={(desktopZoomThreshold) => onConfigChange({ desktopZoomThreshold })}
            min={2} max={15} step={0.5}
          />
          <SliderControl
            label={`Mobile Initial Scale: ${config.mobileInitialScale}`}
            value={config.mobileInitialScale}
            onChange={(mobileInitialScale) => onConfigChange({ mobileInitialScale })}
            min={0.2} max={1.5} step={0.1}
          />
          <SliderControl
            label={`Mobile Zoom Threshold: ${config.mobileZoomThreshold}x`}
            value={config.mobileZoomThreshold}
            onChange={(mobileZoomThreshold) => onConfigChange({ mobileZoomThreshold })}
            min={1} max={10} step={0.5}
          />
        </Accordion>

        <Accordion label="Pin">
          <div className="space-y-3">
            <SliderControl
              label={`Sections: ${Math.round(config.pinDensity.sections * 100)}%`}
              value={PIN_DENSITY_STOPS.includes(config.pinDensity.sections as never)
                ? PIN_DENSITY_STOPS.indexOf(config.pinDensity.sections as never)
                : PIN_DENSITY_STOPS.length - 1}
              onChange={(i) => onConfigChange({ pinDensity: { ...config.pinDensity, sections: PIN_DENSITY_STOPS[Math.round(i)] } })}
              min={0} max={9} step={1}
            />
            <SliderControl
              label={`Rows: ${Math.round(config.pinDensity.rows * 100)}%`}
              value={PIN_DENSITY_STOPS.includes(config.pinDensity.rows as never)
                ? PIN_DENSITY_STOPS.indexOf(config.pinDensity.rows as never)
                : PIN_DENSITY_STOPS.length - 1}
              onChange={(i) => onConfigChange({ pinDensity: { ...config.pinDensity, rows: PIN_DENSITY_STOPS[Math.round(i)] } })}
              min={0} max={9} step={1}
            />
            <SliderControl
              label={`Seats: ${Math.round(config.pinDensity.seats * 100)}%`}
              value={PIN_DENSITY_STOPS.includes(config.pinDensity.seats as never)
                ? PIN_DENSITY_STOPS.indexOf(config.pinDensity.seats as never)
                : PIN_DENSITY_STOPS.length - 1}
              onChange={(i) => onConfigChange({ pinDensity: { ...config.pinDensity, seats: PIN_DENSITY_STOPS[Math.round(i)] } })}
              min={0} max={9} step={1}
            />
          </div>
        </Accordion>

        <Accordion label="Connector">
          <div className="space-y-3">
            <SliderControl
              label={`Connector Width: ${config.connectorWidth}px`}
              value={config.connectorWidth}
              onChange={(connectorWidth) => onConfigChange({ connectorWidth })}
              min={0.5} max={4} step={0.5}
            />
            {(['connector', 'connectorHover', 'connectorPressed'] as const).map((colorKey) => (
              <ColorControl
                key={colorKey}
                label={colorKey}
                value={config.seatColors[colorKey]}
                onChange={(value) => handleColorChange(colorKey, value)}
              />
            ))}
          </div>
          <div className="space-y-3 mt-9">
            <label className="text-xs text-black font-bold block mb-2">Section Fill Colors</label>
            {(['available', 'unavailable', 'selected', 'hover', 'pressed'] as const).map((colorKey) => (
              <ColorControl
                key={colorKey}
                label={colorKey}
                value={config.seatColors[colorKey]}
                onChange={(value) => handleColorChange(colorKey, value)}
              />
            ))}
          </div>
          <div className="space-y-3 mt-9">
            <label className="text-xs text-black font-bold block mb-2">Section Label Colors</label>
            {([
              { key: 'labelDefault' as const, label: 'Available' },
              { key: 'labelUnavailable' as const, label: 'Unavailable' },
              { key: 'labelSelected' as const, label: 'Selected' },
            ]).map(({ key, label }) => (
              <ColorControl
                key={key}
                label={label}
                value={config.seatColors[key]}
                onChange={(value) => handleColorChange(key, value)}
              />
            ))}
          </div>
        </Accordion>

        <div className="mt-6">
          <button
            onClick={onResetConfig}
            className="w-full px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded cursor-pointer transition-colors"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
