import React, { useMemo, useState } from 'react';
import {
  WiDaySunny,
  WiDaySunnyOvercast,
  WiDayCloudy,
  WiDayCloudyHigh,
  WiDayShowers,
  WiDayThunderstorm,
  WiDayHaze,
  WiCloudy,
  WiFog,
  WiShowers,
  WiThunderstorm,
  WiSnow,
  WiSleet,
  WiRainMix,
  WiHot,
  WiSnowWind,
  WiWindy,
  WiNightClear,
  WiNightAltPartlyCloudy,
  WiNightAltCloudy,
  WiNightAltShowers,
  WiNightAltThunderstorm,
  WiNightAltSnow,
  WiNightAltSnowWind,
} from 'react-icons/wi';

// AccuWeather WeatherIcon codes 1–44.
// We keep the mapping simple and consistent; some codes are close variants.
const MAP = {
  1: WiDaySunny,
  2: WiDaySunny,
  3: WiDayCloudyHigh,
  4: WiDayCloudy,
  5: WiDayHaze,
  6: WiDaySunnyOvercast,
  7: WiCloudy,
  8: WiCloudy,
  9: WiFog,
  10: WiFog,
  11: WiShowers,
  12: WiShowers,
  13: WiDayShowers,
  14: WiDayThunderstorm,
  15: WiThunderstorm,
  16: WiThunderstorm,
  17: WiSleet,
  18: WiSleet,
  19: WiSnowWind,
  20: WiSnow,
  21: WiSnow,
  22: WiSnow,
  23: WiSleet,
  24: WiSleet,
  25: WiRainMix,
  26: WiCloudy,
  27: WiHot,
  28: WiWindy,
  29: WiRainMix,
  30: WiHot,
  31: WiWindy,
  32: WiWindy,
  33: WiNightClear,
  34: WiNightClear,
  35: WiNightAltPartlyCloudy,
  36: WiNightAltCloudy,
  37: WiNightAltCloudy,
  38: WiNightAltCloudy,
  39: WiNightAltShowers,
  40: WiNightAltShowers,
  41: WiNightAltThunderstorm,
  42: WiNightAltThunderstorm,
  43: WiNightAltSnow,
  44: WiNightAltSnowWind,
};

export default function AccuWeatherIcon({ code, className, title }) {
  const n = Number(code);
  const Icon = MAP[n] || WiCloudy;
  const [useFallback, setUseFallback] = useState(false);

  const src = useMemo(() => {
    if (!Number.isFinite(n) || n <= 0) return null;
    return `${process.env.PUBLIC_URL || ''}/weather-icons/accu/${n}.svg`;
  }, [n]);

  if (!useFallback && src) {
    return (
      <img
        src={src}
        alt={title || ''}
        className={className}
        onError={() => setUseFallback(true)}
        draggable={false}
      />
    );
  }

  return <Icon className={className} title={title} aria-hidden={title ? undefined : true} />;
}

