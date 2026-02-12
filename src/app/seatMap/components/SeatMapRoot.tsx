import { useMemo, useRef, useState } from 'react';
import { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { RotateCcw } from 'lucide-react';
import { Section } from '../../components/Section';
import { Venue } from '../../components/Venue';
import { Stage } from '../../components/Stage';
import { ListingsPanel } from '../../components/ListingsPanel';
import { DEFAULT_SEAT_MAP_CONFIG } from '../config/defaults';
import { useSeatMapConfig } from '../state/useSeatMapConfig';
import { createMockSeatMapModel, STAGE_CONFIG } from '../mock/createMockSeatMapModel';
import { useSeatMapController } from '../state/useSeatMapController';
import { useSeatMapPrototypeViewState } from '../state/useSeatMapPrototypeViewState';
import { PrototypeControls } from './PrototypeControls';
import { MapContainer } from './MapContainer';
import { EMPTY_SELECTION } from '../model/types';

export function SeatMapRoot() {
  const transformRef = useRef<ReactZoomPanPinchRef>(null);

  const model = useMemo(() => createMockSeatMapModel(), []);
  const { config, updateConfig, resetConfig } = useSeatMapConfig(DEFAULT_SEAT_MAP_CONFIG);
  const [currentScale, setCurrentScale] = useState(DEFAULT_SEAT_MAP_CONFIG.desktopInitialScale);

  const controller = useSeatMapController({
    model,
    config,
    currentScale,
  });

  const viewState = useSeatMapPrototypeViewState({
    model,
    config,
    controller,
    currentScale,
    setCurrentScale,
    transformRef,
  });

  const isMobile = config.layoutMode === 'mobile';

  return (
    <div className="size-full flex">
      <PrototypeControls
        showControls={viewState.showControls}
        onToggleControls={() => viewState.setShowControls(!viewState.showControls)}
        currentScale={viewState.currentScale}
        displayMode={controller.displayMode}
        config={config}
        onConfigChange={updateConfig}
        onResetConfig={resetConfig}
      />

      <div
        className={`flex-1 min-w-0 flex bg-gray-100 ${
          config.layoutMode === 'desktop' ? '' : 'items-center justify-center p-5'
        }`}
      >
        <div
          className={`flex bg-white ${
            config.layoutMode === 'desktop' ? 'flex-row w-full h-full overflow-hidden' : 'w-[390px] flex-col h-[812px] overflow-hidden border border-gray-300'
          }`}
        >
          {config.layoutMode === 'desktop' && (
            <ListingsPanel
              className="w-[450px] shrink-0"
              listings={viewState.listings}
              selection={viewState.selection}
              hoverState={viewState.hoverState}
              onSelectListing={viewState.handleSelectFromPanel}
              onHoverListing={viewState.handleHoverFromPanel}
              selectedColor={config.seatColors.selected}
              hoverColor={config.seatColors.hover}
              pressedColor={config.seatColors.pressed}
              disableHover={isMobile}
            />
          )}

          <div
            className={`flex items-center justify-center ${
              config.layoutMode === 'desktop' ? 'flex-1 min-w-0 h-full' : 'h-[200px] shrink-0'
            }`}
          >
            <div className={`relative ${config.layoutMode === 'desktop' ? 'w-full h-full' : ''}`}>
              <MapContainer
                ref={transformRef}
                model={model}
                controller={controller}
                config={config}
                onScaleChange={setCurrentScale}
                wheelStep={0.2}
              >
                <Venue boundary={model.boundary}>
                  <Stage
                    x={STAGE_CONFIG.x}
                    y={STAGE_CONFIG.y}
                    width={STAGE_CONFIG.width}
                    height={STAGE_CONFIG.height}
                  />
                  {controller.sections.map((sectionConfig) => {
                    const sectionPins = viewState.pinsBySection.get(sectionConfig.sectionId) || [];
                    return (
                      <Section
                        key={sectionConfig.sectionId}
                        config={sectionConfig}
                        sectionData={model.sectionDataById.get(sectionConfig.sectionId)!}
                        seatColors={config.seatColors}
                        displayMode={controller.displayMode}
                        selection={viewState.selection}
                        onSelect={viewState.handleSelect}
                        hoverState={viewState.hoverState}
                        onHover={viewState.handleHoverFromMap}
                        connectorWidth={config.connectorWidth}
                        pins={isMobile ? sectionPins.slice(0, Math.ceil(sectionPins.length / 2)) : sectionPins}
                        currentScale={viewState.currentScale}
                        selectedListing={viewState.selectedListing}
                        sectionListings={viewState.listingsBySection.get(sectionConfig.sectionId) || []}
                        disableHover={isMobile}
                      />
                    );
                  })}
                </Venue>
              </MapContainer>
              <button
                onClick={() => {
                  transformRef.current?.centerView(controller.initialScale, 300, 'easeOut');
                  viewState.setSelection(EMPTY_SELECTION);
                  setCurrentScale(controller.initialScale);
                }}
                className="absolute top-2 left-2 flex items-center gap-2 bg-white hover:bg-gray-100 active:bg-gray-200 text-gray-700 text-sm font-medium rounded shadow-sm cursor-pointer transition-opacity duration-200"
                style={{
                  padding: '6px 8px',
                  opacity: viewState.currentScale >= controller.zoomThreshold ? 1 : 0,
                  pointerEvents: viewState.currentScale >= controller.zoomThreshold ? 'auto' : 'none',
                }}
              >
                Reset Map <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {config.layoutMode === 'mobile' && (
            <ListingsPanel
              className="flex-1"
              listings={viewState.listings}
              selection={viewState.selection}
              hoverState={viewState.hoverState}
              onSelectListing={viewState.handleSelectFromPanel}
              onHoverListing={viewState.handleHoverFromPanel}
              selectedColor={config.seatColors.selected}
              hoverColor={config.seatColors.hover}
              pressedColor={config.seatColors.pressed}
              disableHover={isMobile}
            />
          )}
        </div>
      </div>
    </div>
  );
}
