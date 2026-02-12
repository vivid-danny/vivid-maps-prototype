import type { DisplayMode } from '../model/types';
import type { SeatMapConfig } from '../config/types';
import { PanelLeftClose } from 'lucide-react';
import { PanelLeftOpen } from 'lucide-react';

interface PrototypeControlsProps {
  showControls: boolean;
  onToggleControls: () => void;
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
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
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
          {option}
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

const DISPLAY_MODES = ['sections', 'rows', 'seats'] as const;
const LAYOUT_MODES = ['desktop', 'mobile'] as const;

export function PrototypeControls({
  showControls,
  onToggleControls,
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
        showControls ? 'w-80' : 'w-12'
      }`}
    >
      <div className={`flex items-center justify-between h-12 border-b border-gray-200
        ${ showControls ? 'px-6' : 'px-3'}`}>
        <h2
          className={`text-sm font-semibold text-gray-700 transition-opacity 
            ${ showControls ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}
        >
          Prototype Controls
        </h2>
        <button
          onClick={onToggleControls}
          className="hover:bg-gray-100 rounded text-gray-500 cursor-pointer"
          title={showControls ? 'Hide controls' : 'Show controls'}
        >
          {showControls ? <PanelLeftClose /> : <PanelLeftOpen />}
        </button>
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
            options={LAYOUT_MODES}
            value={config.layoutMode}
            onChange={(layoutMode) => onConfigChange({ layoutMode })}
          />
        </div>

        <div className="mb-6">
          <button
            onClick={onResetConfig}
            className="w-full px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded cursor-pointer transition-colors"
          >
            Reset
          </button>
        </div>

        {/* Map Settings */}
        <div className="mb-6 space-y-4">
          <label className="text-xs text-black font-bold block mb-2">Map Settings</label>
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

          <SliderControl
            className="mt-6"
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
          <SliderControl
            label={`Connector Width: ${config.connectorWidth}px`}
            value={config.connectorWidth}
            onChange={(connectorWidth) => onConfigChange({ connectorWidth })}
            min={0.5} max={4} step={0.5}
          />
        </div>

        {/* Section Fill Colors */}
        <div className="space-y-3 mt-8">
          <label className="text-xs text-black font-bold block mb-2">Section Fill Colors</label>
          {(['available', 'unavailable', 'selected', 'hover', 'pressed', 'connector'] as const).map((colorKey) => (
            <ColorControl
              key={colorKey}
              label={colorKey}
              value={config.seatColors[colorKey]}
              onChange={(value) => handleColorChange(colorKey, value)}
            />
          ))}
        </div>

        {/* Section Label Colors */}
        <div className="space-y-3 mt-6">
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
      </div>
    </div>
  );
}
