import { useState } from 'react';
import type { DisplayMode } from '../model/types';
import type { SeatMapConfig } from '../config/types';
import { THEME_IDS, THEME_LABELS } from '../config/themes';
import type { ThemeId } from '../config/themes';
import { STYLE_COLORS, THEME_TOKENS } from '../maplibre/constants';

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
  prodRef,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  prodRef?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-col">
        <label className="text-xs text-gray-600 capitalize">{label}</label>
        {prodRef && <span className="text-[10px] text-gray-400 font-mono">{prodRef}</span>}
      </div>
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

function SectionHeader({ title, prodSource }: {
  title: string;
  prodSource?: string;
}) {
  return (
    <div className="mb-4">
      <div className="text-xs font-bold text-black">{title}</div>
      {prodSource && <div className="text-[10px] text-gray-400 font-mono">{prodSource}</div>}
    </div>
  );
}


const DISPLAY_MODES = ['sections', 'rows', 'seats'] as const;
const ZONE_ROW_DISPLAYS = ['rows', 'seats'] as const;
const LISTING_CARD_SIZES = ['dense', 'standard', 'spacious'] as const;
const PIN_DENSITY_STOPS = [0.00, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90] as const;

export function PrototypeControls({
  showControls,
  currentScale,
  displayMode,
  config,
  onConfigChange,
  onResetConfig,
}: PrototypeControlsProps) {
  const [activeTab, setActiveTab] = useState<'controls' | 'styles'>('controls');

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
      <div className="flex items-center justify-between h-12 border-b border-gray-200 px-4">
        <h2 className="text-sm font-semibold text-gray-700">Prototype Controls</h2>
        <button
          onClick={onResetConfig}
          className="px-2 py-1 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded cursor-pointer transition-colors"
        >
          Reset All
        </button>
      </div>
      <div
        className={`px-6 py-6 overflow-y-auto h-[calc(100%-77px)] transition-opacity no-scrollbar ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
      <div className="flex border-b border-gray-200 mb-8">
        {([
          { id: 'controls', label: 'Interaction' },
          { id: 'styles', label: 'Styles' },
        ] as const).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 py-2 text-xs font-medium transition-colors cursor-pointer ${
              activeTab === id
                ? 'text-gray-900 border-b-2 border-gray-900 -mb-px'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'controls' && (
        <>
          {/* Zoom Status */}
          <div className="mb-6 p-3 bg-gray-50 rounded text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Zoom:</span>
              <span className="font-mono">
                {currentScale.toFixed(2)}x
                <span className="text-gray-400 ml-1">({'\u2248'} prod {(currentScale - 8).toFixed(1)})</span>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Mode:</span>
              <span className="font-medium">{displayMode}</span>
            </div>
          </div>

          {/* Listing Card Size Toggle */}
          <div className="mb-6">
            <label className="text-xs text-black font-bold block mb-2">Listing Card</label>
            <ToggleGroup
              options={LISTING_CARD_SIZES}
              value={config.listingCardSize}
              onChange={(listingCardSize) => onConfigChange({ listingCardSize })}
            />
          </div>

          <div className="mb-6">
            <div className="text-xs font-bold text-black mb-2">Zoom</div>

            <div className="space-y-3">
              {/* Initial Display */}
              <div className="mb-4">
                <label className="text-xs text-gray-600 block mb-2">Initial Display</label>
                <ToggleGroup
                  options={DISPLAY_MODES}
                  value={config.initialDisplay}
                  onChange={(initialDisplay) => onConfigChange({ initialDisplay })}
                />
              </div>

              {/* Zoomed-In Display */}
              <div className="mb-4">
                <label className="text-xs text-gray-600 block mb-2">Zoomed-In Display</label>
                <ToggleGroup
                  options={DISPLAY_MODES}
                  value={config.zoomedDisplay}
                  onChange={(zoomedDisplay) => onConfigChange({ zoomedDisplay })}
                />
              </div>

              {/* Mixed Inventory Display */}
              <div className="mb-4">
                <label className="text-xs text-gray-600 block mb-2">Mixed Inventory Display</label>
                <ToggleGroup
                  options={ZONE_ROW_DISPLAYS}
                  value={config.zoneRowDisplay}
                  onChange={(zoneRowDisplay) => onConfigChange({ zoneRowDisplay })}
                />
              </div>
            </div>
          </div>

          {/* Initial Scales */}
          <div className="mb-6">
            <div className="text-xs font-bold text-black mb-2">Initial Scales</div>

            <div className="space-y-3">
              <SliderControl
                label={`Desktop Initial Scale: ${config.desktopInitialScale}`}
                value={config.desktopInitialScale}
                onChange={(desktopInitialScale) => onConfigChange({ desktopInitialScale })}
                min={0.02} max={0.25} step={0.01}
              />
              <SliderControl
                label={`Desktop Zoom Threshold: ${config.desktopZoomThreshold}x`}
                value={config.desktopZoomThreshold}
                onChange={(desktopZoomThreshold) => onConfigChange({ desktopZoomThreshold })}
                min={0.1} max={1.0} step={0.05}
              />
              <SliderControl
                label={`Mobile Initial Scale: ${config.mobileInitialScale}`}
                value={config.mobileInitialScale}
                onChange={(mobileInitialScale) => onConfigChange({ mobileInitialScale })}
                min={0.01} max={0.1} step={0.005}
              />
              <SliderControl
                label={`Mobile Zoom Threshold: ${config.mobileZoomThreshold}x`}
                value={config.mobileZoomThreshold}
                onChange={(mobileZoomThreshold) => onConfigChange({ mobileZoomThreshold })}
                min={0.05} max={0.5} step={0.05}
              />
              </div>
          </div>

          {/* Pin Density */}
          <div className="mb-6">
            <div className="text-xs font-bold text-black mb-2">Pin</div>
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
          </div>
        </>
      )}

      {activeTab === 'styles' && (
        <>
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

          {/* DEFAULT_COLORS — production static map constants */}
          <div className="mb-8">
            <SectionHeader
              title="DEFAULT_COLORS"
              prodSource="Mapbox/constants.ts"
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
                value={config.seatColors.sectionStroke}
                onChange={(value) => handleColorChange('sectionStroke', value)}
                prodRef="sectionStrokeColor"
              />
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs text-gray-600">Muted Overlay</label>
                    <div className="text-[10px] text-gray-400 font-mono">muted</div>
                  </div>
                  <span className="text-xs font-mono text-gray-400">{STYLE_COLORS.muted}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs text-gray-600">Selected Overlay</label>
                    <div className="text-[10px] text-gray-400 font-mono">selected</div>
                  </div>
                  <span className="text-xs font-mono text-gray-400">{STYLE_COLORS.selected}</span>
                </div>
                <ColorControl
                  label="Row Stroke"
                  value={config.rowStrokeColor}
                  onChange={(value) => onConfigChange({ rowStrokeColor: value })}
                  prodRef="sectionNoInventoryFill"
                />
              </div>
            </div>
          </div>

          {/* Theme Tokens — production design system */}
          <div className="mb-8">
            <SectionHeader
              title="Theme Tokens"
              prodSource="useVSTheme"
            />
            <div className="space-y-3">
              <ColorControl
                label="Background"
                value={config.seatColors.mapBackground}
                onChange={(value) => handleColorChange('mapBackground', value)}
                prodRef="neutral[50]"
              />
              <ColorControl
                label="Venue Fill"
                value={config.seatColors.venueFill}
                onChange={(value) => handleColorChange('venueFill', value)}
                prodRef="onPrimary"
              />
              <ColorControl
                label="Venue Stroke"
                value={config.seatColors.venueStroke}
                onChange={(value) => handleColorChange('venueStroke', value)}
                prodRef="onSurfaceDisabled"
              />
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs text-gray-600">Section Base</label>
                  <div className="text-[10px] text-gray-400 font-mono">neutral[100]</div>
                </div>
                <span className="text-xs font-mono text-gray-400">{THEME_TOKENS.sectionBase}</span>
              </div>
            </div>
          </div>

          {/* Dynamic Colors — per-section, runtime */}
          <div className="mb-8">
            <SectionHeader
              title="Dynamic Colors"
              prodSource="API / runtime"
            />
            <div className="space-y-3">
              {(['available', 'unavailable', 'hover'] as const)
                .filter((k) => !((config.theme === 'zone' || config.theme === 'deal') && k === 'available'))
                .map((colorKey) => (
                <ColorControl
                  key={colorKey}
                  label={colorKey}
                  value={config.seatColors[colorKey]}
                  onChange={(value) => handleColorChange(colorKey, value)}
                  prodRef={colorKey === 'available' ? 'sectionColorExpression' : undefined}
                />
              ))}
            </div>
          </div>

          {/* Labels */}
          <div className="mb-8">
            <SectionHeader title="Labels" />
            <div className="space-y-3">
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
          </div>

          {/* Pins */}
          <div className="mb-8">
            <SectionHeader title="Pins" prodSource="TooltipStack" />
            <div className="space-y-3">
              {([
                { key: 'pinDefault' as const, label: 'Default' },
                { key: 'pinHovered' as const, label: 'Hovered' },
                { key: 'pinPressed' as const, label: 'Pressed' },
                { key: 'pinSelected' as const, label: 'Selected' },
              ]).map(({ key, label }) => (
                <ColorControl
                  key={key}
                  label={label}
                  value={config.seatColors[key]}
                  onChange={(value) => handleColorChange(key, value)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  </div>
  );
}
