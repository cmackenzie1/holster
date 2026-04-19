# `gradient`

Deterministic gradient SVGs from any string. Same input always produces the same gradient. Useful for avatars, placeholders, and identicons.

## Usage

```sh
# Get a gradient for any string
curl https://gradient.mirio.dev/username

# Custom size
curl https://gradient.mirio.dev/username?size=256

# Non-square
curl https://gradient.mirio.dev/username?w=200&h=100

# Base color (name or hex)
curl https://gradient.mirio.dev/username?base=blue
curl https://gradient.mirio.dev/username?base=%23ff6600

# Circle shape (for avatars)
curl https://gradient.mirio.dev/username?shape=circle

# Radial gradient
curl https://gradient.mirio.dev/username?type=radial

# Multi-stop gradient
curl https://gradient.mirio.dev/username?stops=3

# Noise texture overlay
curl https://gradient.mirio.dev/username?texture=noise

# Initials (auto-extract from text)
curl https://gradient.mirio.dev/jane+doe?initials=true

# Initials (explicit value)
curl https://gradient.mirio.dev/username?initials=JD

# Combine options
curl https://gradient.mirio.dev/username?shape=circle&size=48&base=indigo&type=radial
```

## HTML

```html
<img src="https://gradient.mirio.dev/username" />
<img src="https://gradient.mirio.dev/username?shape=circle&size=48" />
<img src="https://gradient.mirio.dev/jane+doe?initials=true&shape=circle" />
```

## JavaScript (async/await)

```js
const res = await fetch("https://gradient.mirio.dev/username?size=64");
const svg = await res.text();
document.getElementById("avatar").innerHTML = svg;
```

## JavaScript (.then)

```js
fetch("https://gradient.mirio.dev/username?size=64")
  .then(res => res.text())
  .then(svg => {
    document.getElementById("avatar").innerHTML = svg;
  });
```

## Parameters

| Parameter | Default | Description |
| --- | --- | --- |
| `size` | 128 | Square size in px (1-1024) |
| `w`, `h` | 128 | Width and height separately |
| `base` | auto | Base color — name or hex (`#ff6600`) |
| `shape` | rect | `circle` for round avatars |
| `type` | linear | `radial` for radial gradients |
| `stops` | 2 | Number of color stops (2-5) |
| `texture` | none | `noise` for subtle texture overlay |
| `initials` | none | `true` to auto-extract, or pass value e.g. `JD` (max 4 chars) |

## Colors

red, blue, green, yellow, purple, orange, pink, cyan, magenta, brown, black, white, gray, navy, teal, lime, maroon, olive, aqua, silver, gold, indigo, violet, coral
