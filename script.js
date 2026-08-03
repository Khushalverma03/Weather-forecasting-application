/* =========================================================================
   SKYWATCH — Weather Forecast Web App
   -------------------------------------------------------------------------
   Data source : OpenWeatherMap (Current Weather Data API + 5 Day / 3 Hour
                 Forecast API — both included in OpenWeatherMap's free tier)
   Docs        : https://openweathermap.org/api

   HOW TO RUN THIS PROJECT
   1. Create a free account at https://openweathermap.org/api
   2. Copy your API key from https://home.openweathermap.org/api_keys
   3. Paste it below as API_KEY
   4. Open index.html in a browser (or serve the folder with any static
      server). New API keys can take up to a couple of hours to activate.
   ========================================================================= */

const API_KEY = "c2882251bb295ff0a4006e26fafdead3"; // <-- paste your OpenWeatherMap key here

const BASE_URL = "https://api.openweathermap.org/data/2.5";

/* -------------------------------------------------------------------------
   App state — single source of truth.
   Weather data is always fetched in metric units; the imperial view is
   produced by converting on the client so switching °C/°F never needs a
   second network request.
   ------------------------------------------------------------------------- */
const state = {
  unit: "metric",       // "metric" (°C, m/s) or "imperial" (°F, mph)
  current: null,        // raw current-weather response (metric)
  forecastDays: null,   // processed array of daily forecast summaries
};

/* -------------------------------------------------------------------------
   DOM references
   ------------------------------------------------------------------------- */
const mainContent = document.getElementById("mainContent");
const skyBackdrop = document.getElementById("skyBackdrop");
const searchForm = document.getElementById("searchForm");
const cityInput = document.getElementById("cityInput");
const locateBtn = document.getElementById("locateBtn");
const unitToggle = document.getElementById("unitToggle");

/* =========================================================================
   INIT
   ========================================================================= */
function init() {
  if (!API_KEY || API_KEY === "YOUR_API_KEY_HERE") {
    renderSetupScreen();
    return;
  }
  renderIdleScreen();

  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const city = cityInput.value.trim();
    if (city) loadWeatherByCity(city);
  });

  locateBtn.addEventListener("click", loadWeatherByLocation);

  unitToggle.addEventListener("click", (e) => {
    const btn = e.target.closest(".unit-btn");
    if (!btn || btn.classList.contains("active")) return;
    setUnit(btn.dataset.unit);
  });
}

document.addEventListener("DOMContentLoaded", init);

/* =========================================================================
   DATA FETCHING
   ========================================================================= */
async function loadWeatherByCity(city) {
  renderLoadingScreen();
  try {
    const current = await fetchJSON(
      `${BASE_URL}/weather?q=${encodeURIComponent(city)}&units=metric&appid=${API_KEY}`
    );
    const forecast = await fetchJSON(
      `${BASE_URL}/forecast?q=${encodeURIComponent(city)}&units=metric&appid=${API_KEY}`
    );
    applyWeatherData(current, forecast);
  } catch (err) {
    renderErrorScreen(err);
  }
}

function loadWeatherByLocation() {
  if (!navigator.geolocation) {
    renderErrorScreen(new Error("Geolocation isn't supported by this browser."));
    return;
  }
  renderLoadingScreen();
  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      try {
        const { latitude: lat, longitude: lon } = coords;
        const current = await fetchJSON(
          `${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`
        );
        const forecast = await fetchJSON(
          `${BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`
        );
        applyWeatherData(current, forecast);
      } catch (err) {
        renderErrorScreen(err);
      }
    },
    () => renderErrorScreen(new Error("Location permission was denied.")),
    { timeout: 10000 }
  );
}

/** Wraps fetch with meaningful error messages for the common failure cases. */
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 401) throw new Error("Invalid API key. Double-check the key in script.js.");
    if (res.status === 404) throw new Error("City not found. Check the spelling and try again.");
    throw new Error("The weather service could not be reached. Please try again.");
  }
  return res.json();
}

function applyWeatherData(current, forecast) {
  state.current = current;
  state.forecastDays = groupForecastByDay(forecast.list, current.timezone);
  cityInput.value = "";
  renderWeather();
}

/* =========================================================================
   FORECAST PROCESSING
   The forecast endpoint returns data in 3-hour steps for 5 days (40 items).
   We bucket those by calendar day (in the location's own timezone) and
   reduce each bucket to a single summary: min/max temp, worst-case chance
   of rain, and the icon closest to midday.
   ========================================================================= */
function groupForecastByDay(list, timezoneOffsetSeconds) {
  const buckets = new Map();

  list.forEach((entry) => {
    const localMs = (entry.dt + timezoneOffsetSeconds) * 1000;
    const localDate = new Date(localMs);
    const dayKey = localDate.toISOString().slice(0, 10);
    const hourUTC = localDate.getUTCHours();

    if (!buckets.has(dayKey)) {
      buckets.set(dayKey, { entries: [], dayKey });
    }
    buckets.get(dayKey).entries.push({ ...entry, hourUTC });
  });

  const today = new Date(Date.now() + timezoneOffsetSeconds * 1000).toISOString().slice(0, 10);

  return Array.from(buckets.values())
    .filter((b) => b.dayKey !== today) // today is already shown in the primary card
    .slice(0, 5)
    .map((bucket) => {
      const temps = bucket.entries.map((e) => e.main.temp);
      const pops = bucket.entries.map((e) => e.pop ?? 0);
      // pick the entry nearest midday (12:00) as the representative icon/condition
      const midday = bucket.entries.reduce((closest, e) =>
        Math.abs(e.hourUTC - 12) < Math.abs(closest.hourUTC - 12) ? e : closest
      );
      return {
        date: new Date(bucket.dayKey + "T00:00:00"),
        hi: Math.max(...temps),
        lo: Math.min(...temps),
        pop: Math.max(...pops),
        icon: midday.weather[0].icon,
        description: midday.weather[0].description,
      };
    });
}

/* =========================================================================
   UNIT CONVERSION
   ========================================================================= */
function convertTemp(celsius, unit) {
  return unit === "imperial" ? celsius * 9 / 5 + 32 : celsius;
}
function convertSpeed(metersPerSec, unit) {
  return unit === "imperial" ? metersPerSec * 2.23694 : metersPerSec;
}
function unitSuffix(unit) {
  return unit === "imperial" ? "°F" : "°C";
}
function speedSuffix(unit) {
  return unit === "imperial" ? "mph" : "m/s";
}

function setUnit(unit) {
  state.unit = unit;
  [...unitToggle.querySelectorAll(".unit-btn")].forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.unit === unit)
  );
  if (state.current) renderWeather();
}

/* =========================================================================
   THEME MAPPING — recolors the atmospheric backdrop to match conditions
   ========================================================================= */
function themeFor(weatherMain, icon) {
  const isNight = icon.endsWith("n");
  switch (weatherMain) {
    case "Clear": return isNight ? "clear-night" : "clear-day";
    case "Clouds": return "clouds";
    case "Rain":
    case "Drizzle": return "rain";
    case "Thunderstorm": return "thunder";
    case "Snow": return "snow";
    default: return "mist"; // mist, haze, fog, dust, smoke, etc.
  }
}

/* =========================================================================
   LOCAL TIME HELPERS
   The API gives Unix timestamps in UTC plus a timezone offset (seconds).
   We add the offset to "now" and read the UTC fields back, which sidesteps
   the browser's own local timezone entirely.
   ========================================================================= */
function formatLocalTime(timezoneOffsetSeconds) {
  const d = new Date(Date.now() + timezoneOffsetSeconds * 1000);
  return d.toUTCString().slice(17, 22); // "HH:MM"
}
function formatLocalTimeFromUnix(unixSeconds, timezoneOffsetSeconds) {
  const d = new Date((unixSeconds + timezoneOffsetSeconds) * 1000);
  return d.toUTCString().slice(17, 22);
}

/* =========================================================================
   GAUGE — a circular "instrument dial" for the current temperature
   ========================================================================= */
const GAUGE_CIRCUMFERENCE = 534.07; // 2 * PI * r(85)

function gaugeRangeFor(unit) {
  return unit === "imperial" ? { min: 14, max: 113 } : { min: -10, max: 45 };
}

function gaugeMarkup() {
  return `
    <svg class="gauge" viewBox="0 0 200 200" role="img" aria-label="Temperature gauge">
      <circle class="gauge-track" cx="100" cy="100" r="85" />
      <g class="gauge-ticks">
        <line class="tick tick-major" x1="100.00" y1="26.00" x2="100.00" y2="8.00" />
        <line class="tick" x1="139.00" y1="32.45" x2="146.00" y2="20.33" />
        <line class="tick" x1="167.55" y1="61.00" x2="179.67" y2="54.00" />
        <line class="tick tick-major" x1="174.00" y1="100.00" x2="192.00" y2="100.00" />
        <line class="tick" x1="167.55" y1="139.00" x2="179.67" y2="146.00" />
        <line class="tick" x1="139.00" y1="167.55" x2="146.00" y2="179.67" />
        <line class="tick tick-major" x1="100.00" y1="174.00" x2="100.00" y2="192.00" />
        <line class="tick" x1="61.00" y1="167.55" x2="54.00" y2="179.67" />
        <line class="tick" x1="32.45" y1="139.00" x2="20.33" y2="146.00" />
        <line class="tick tick-major" x1="26.00" y1="100.00" x2="8.00" y2="100.00" />
        <line class="tick" x1="32.45" y1="61.00" x2="20.33" y2="54.00" />
        <line class="tick" x1="61.00" y1="32.45" x2="54.00" y2="20.33" />
      </g>
      <circle class="gauge-fill" cx="100" cy="100" r="85"
        stroke-dasharray="${GAUGE_CIRCUMFERENCE}" stroke-dashoffset="${GAUGE_CIRCUMFERENCE}"
        transform="rotate(-90 100 100)" />
    </svg>`;
}

function paintGauge(tempDisplayValue) {
  const { min, max } = gaugeRangeFor(state.unit);
  const pct = Math.min(1, Math.max(0, (tempDisplayValue - min) / (max - min)));
  const offset = GAUGE_CIRCUMFERENCE * (1 - pct);
  const fill = document.querySelector(".gauge-fill");
  if (!fill) return;
  fill.style.strokeDashoffset = offset;
  fill.style.stroke = pct < 0.35 ? "var(--teal)" : pct < 0.7 ? "var(--amber)" : "var(--coral)";
}

/* =========================================================================
   RENDER — screen states
   ========================================================================= */
function renderSetupScreen() {
  mainContent.innerHTML = `
    <div class="state-card">
      <svg class="state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
        <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/>
        <circle cx="12" cy="12" r="4"/>
      </svg>
      <div class="state-title">One step left: add your API key</div>
      <p class="state-body">
        This app reads live data from OpenWeatherMap, which needs a free API key.
        Grab one at <a class="state-link" href="https://home.openweathermap.org/users/sign_up" target="_blank" rel="noopener">openweathermap.org</a>,
        then paste it into <strong>script.js</strong>.
      </p>
      <code class="state-code">const API_KEY = "YOUR_API_KEY_HERE";</code>
      <p class="state-body">New keys can take up to a couple of hours to activate — that's normal.</p>
    </div>`;
}

function renderIdleScreen() {
  mainContent.innerHTML = `
    <div class="state-card">
      <svg class="state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
      </svg>
      <div class="state-title">Search a city to get started</div>
      <p class="state-body">Try your own city, or tap the location icon to use where you are right now.</p>
    </div>`;
}

function renderLoadingScreen() {
  mainContent.innerHTML = `
    <div class="state-card loading-card">
      <div class="spinner"></div>
      <div class="loading-text">Reading the instruments…</div>
    </div>`;
}

function renderErrorScreen(err) {
  mainContent.innerHTML = `
    <div class="state-card error">
      <svg class="state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="13"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <div class="state-title">Couldn't load the forecast</div>
      <p class="state-body">${err.message}</p>
      <button class="retry-btn" id="retryBtn" type="button">Try again</button>
    </div>`;
  document.getElementById("retryBtn").addEventListener("click", renderIdleScreen);
}

function renderWeather() {
  const { current, forecastDays } = state;
  const unit = state.unit;
  const [w] = current.weather;

  skyBackdrop.dataset.theme = themeFor(w.main, w.icon);

  const temp = convertTemp(current.main.temp, unit);
  const feelsLike = convertTemp(current.main.feels_like, unit);
  const todayHi = convertTemp(current.main.temp_max, unit);
  const todayLo = convertTemp(current.main.temp_min, unit);
  const humidity = current.main.humidity;
  const wind = convertSpeed(current.wind.speed, unit);
  const pressure = current.main.pressure;
  const visibilityKm = (current.visibility / 1000).toFixed(1);
  const sunrise = formatLocalTimeFromUnix(current.sys.sunrise, current.timezone);
  const sunset = formatLocalTimeFromUnix(current.sys.sunset, current.timezone);
  const localTime = formatLocalTime(current.timezone);
  const uS = unitSuffix(unit);
  const sS = speedSuffix(unit);

  mainContent.innerHTML = `
    <section class="primary-card">
      <div class="gauge-wrap">
        ${gaugeMarkup()}
        <div class="gauge-center">
          <div class="gauge-temp">${Math.round(temp)}°</div>
          <div class="gauge-feels">Feels like ${Math.round(feelsLike)}°</div>
        </div>
      </div>
      <div class="current-details">
        <div class="current-location">${current.name} <span class="country">${current.sys.country}</span></div>
        <div class="current-meta">${localTime} local time</div>
        <div class="current-condition">
          <img class="condition-icon" src="https://openweathermap.org/img/wn/${w.icon}@2x.png" alt="${w.description}" />
          ${w.description}
        </div>
        <div class="hi-lo">
          <span class="hi">H ${Math.round(todayHi)}°</span>
          <span class="lo">L ${Math.round(todayLo)}°</span>
        </div>
      </div>
    </section>

    <section class="tiles-grid">
      <div class="tile">
        <div class="tile-label">${iconDroplet()} Humidity</div>
        <div class="tile-value">${humidity}<span class="unit">%</span></div>
      </div>
      <div class="tile">
        <div class="tile-label">${iconWind()} Wind</div>
        <div class="tile-value">${wind.toFixed(1)}<span class="unit">${sS}</span></div>
        <div class="tile-sub">${iconCompass(current.wind.deg)}</div>
      </div>
      <div class="tile">
        <div class="tile-label">${iconGauge()} Pressure</div>
        <div class="tile-value">${pressure}<span class="unit">hPa</span></div>
      </div>
      <div class="tile">
        <div class="tile-label">${iconEye()} Visibility</div>
        <div class="tile-value">${visibilityKm}<span class="unit">km</span></div>
      </div>
      <div class="tile">
        <div class="tile-label">${iconSunrise()} Sunrise</div>
        <div class="tile-value">${sunrise}</div>
      </div>
      <div class="tile">
        <div class="tile-label">${iconSunset()} Sunset</div>
        <div class="tile-value">${sunset}</div>
      </div>
    </section>

    <section class="forecast-section">
      <div class="section-label">5-Day Forecast</div>
      <div class="forecast-strip">
        ${forecastDays.map((day) => forecastDayMarkup(day, unit)).join("")}
      </div>
    </section>
  `;

  paintGauge(temp);
}

function forecastDayMarkup(day, unit) {
  const hi = Math.round(convertTemp(day.hi, unit));
  const lo = Math.round(convertTemp(day.lo, unit));
  const dayName = day.date.toLocaleDateString(undefined, { weekday: "short" });
  const pop = Math.round(day.pop * 100);
  return `
    <div class="forecast-day">
      <div class="forecast-day-name">${dayName}</div>
      <img class="forecast-icon" src="https://openweathermap.org/img/wn/${day.icon}.png" alt="${day.description}" />
      <div class="forecast-temps"><span class="hi">${hi}°</span><span class="lo">${lo}°</span></div>
      <div class="forecast-pop">${iconDropletSmall()} ${pop}%</div>
    </div>`;
}

/* =========================================================================
   Small inline icon helpers (kept as functions so they can be reused
   inline inside template strings above)
   ========================================================================= */
function iconDroplet() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2s6 7 6 11a6 6 0 1 1-12 0c0-4 6-11 6-11z"/></svg>`;
}
function iconDropletSmall() { return iconDroplet(); }
function iconWind() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8h11a3 3 0 1 0-3-3M3 16h15a3 3 0 1 1-3 3M3 12h8"/></svg>`;
}
function iconGauge() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 12l4-4"/></svg>`;
}
function iconEye() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>`;
}
function iconSunrise() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v5M5.6 10.6L4 9M18.4 10.6L20 9M3 15h18M6 15a6 6 0 0 1 12 0"/></svg>`;
}
function iconSunset() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9V4M5.6 8.6L4 7M18.4 8.6L20 7M3 15h18M6 15a6 6 0 0 1 12 0"/></svg>`;
}
function iconCompass(deg) {
  return `<svg class="compass" style="transform:rotate(${deg}deg)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 4l2.5 7.5L12 20l-2.5-8.5L12 4z"/></svg>`;
}
