# @lupinum/trellis-eslint

Repository-local ESLint plugin for Trellis app boundaries.

The plugin contains rules that keep examples, starters, and app code aligned
with the Trellis feature layout, MCP safety model, auth conventions, and
isolation checks.

## Usage

```js
import trellis from '@lupinum/trellis-eslint'

export default [trellis.configs.recommended]
```

Use the stricter preset when working on maintained examples or framework code:

```js
import trellis from '@lupinum/trellis-eslint'

export default [trellis.configs.strict]
```

## Presets

- `recommended`: baseline Trellis rules for app and example code.
- `strict`: recommended rules promoted to errors, plus stricter framework
  boundary checks.

## Scope

This package is private to the repository today. It exists to keep Trellis
examples and fixtures honest; app teams normally get these guardrails through
the generated starter shape and `trellis doctor`.
