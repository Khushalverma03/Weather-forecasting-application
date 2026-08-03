# Skywatch — Weather Forecast Web App

A weather forecasting web app built with plain HTML, CSS, and JavaScript,
using the OpenWeatherMap API for live data. Built as a final-year internship
project.

## Features

- **Search any city** and get current conditions instantly
- **"Use my location"** button (browser geolocation) for a one-tap local forecast
- **Circular instrument-style gauge** showing the current temperature
- **5-day forecast strip**, built by grouping the API's 3-hour forecast data into daily summaries
- **°C / °F toggle** — converts instantly on the client, no extra API call
- **Humidity, wind (with direction), pressure, visibility, sunrise & sunset** readouts
- Background theme that shifts with conditions (clear / cloudy / rain / thunderstorm / snow / mist, day or night)
- Friendly loading, error, and empty states — including a guided setup screen if the API key hasn't been added yet
- Fully responsive, down to mobile

## Tech stack

| Layer     | Choice                                             |
|-----------|-----------------------------------------------------|
| Structure | HTML5                                                |
| Styling   | CSS3 (custom properties, no framework)               |
| Logic     | Vanilla JavaScript (`fetch`, `async/await`, DOM APIs) |
| Data      | [OpenWeatherMap](https://openweathermap.org/api) — Current Weather Data API + 5 Day / 3 Hour Forecast API (both free tier) |
| Fonts     | Space Grotesk, Inter, JetBrains Mono (Google Fonts) |

No build tools, frameworks, or backend are required — this keeps the project
easy to run and easy to explain in a viva, while still covering a real,
external, authenticated API integration.

## Setup

1. Create a free account at [openweathermap.org/api](https://openweathermap.org/api)
2. Grab your API key from [home.openweathermap.org/api_keys](https://home.openweathermap.org/api_keys)
   (new keys can take up to ~2 hours to activate — this is normal, not a bug)
3. Open `script.js` and paste your key into the constant at the top:
   ```js
   const API_KEY = "YOUR_API_KEY_HERE";
   ```
4. Open `index.html` in any browser. That's it — no server or install step is
   required, though you can also serve the folder with any static server
   (e.g. the VS Code "Live Server" extension) if you prefer.

If you forget to add a key, the app itself will explain what to do —
it doesn't just fail silently.

## Project structure

```
weather-app/
├── index.html   # page structure and layout scaffold
├── style.css    # design system: colors, type, gauge, cards, responsiveness
├── script.js    # API calls, data processing, and rendering logic
└── README.md
```

## How it works (useful for your project report / viva)

- **`fetchJSON()`** wraps the browser `fetch` API and turns HTTP error codes
  (401, 404, etc.) into readable messages.
- **`loadWeatherByCity()` / `loadWeatherByLocation()`** call both the current
  weather endpoint and the 5-day forecast endpoint, always requesting metric
  units — a single source of truth. The °C/°F toggle then just converts
  numbers on the fly (`convertTemp`, `convertSpeed`) so switching units never
  needs a second network round trip.
- **`groupForecastByDay()`** is the most interesting bit of logic: the
  forecast API only returns 3-hour steps for 5 days (40 data points), so this
  function buckets them by calendar day (in the *city's own* timezone, not
  the visitor's browser timezone) and reduces each day to a min/max
  temperature, a rain-chance, and a representative icon (whichever entry
  falls closest to midday).
- **`themeFor()`** maps the API's weather condition + day/night flag to one
  of several background themes, so the page's atmosphere matches the sky.
- The **gauge** is a single SVG circle whose `stroke-dashoffset` is animated
  based on where the current temperature falls in a fixed range — the same
  technique used for circular progress bars, just styled like an instrument
  dial.

## Possible extensions

If you want to extend this further for extra marks:
- Add an hourly forecast view (the 3-hour data is already fetched)
- Cache the last-viewed city so it reloads instantly on repeat visits
- Add weather alerts using OpenWeatherMap's One Call API
- Add a small Node/Express backend to keep the API key server-side instead
  of in client-side JavaScript (currently fine for a demo/project, but not
  how you'd ship a public production app)

## Credits

Weather data and icons: [OpenWeatherMap](https://openweathermap.org/).
