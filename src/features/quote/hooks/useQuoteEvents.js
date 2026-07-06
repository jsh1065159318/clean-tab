import { useEffect } from 'react';
import EventBus from 'utils/eventbus';

/**
 * Custom hook for handling quote-related events
 */
export function useQuoteEvents(getQuote, setZoom, onSettingsChange) {
  useEffect(() => {
    const handleRefresh = (data) => {
      switch (data) {
        case 'quote':
          setZoom();
          if (onSettingsChange) {
            onSettingsChange();
          }
          break;
        case 'marketplacequoteuninstall':
        case 'quoterefresh':
          getQuote();
          break;
      }
    };

    EventBus.on('refresh', handleRefresh);
    return () => EventBus.off('refresh', handleRefresh);
  }, [getQuote, setZoom, onSettingsChange]);
}
