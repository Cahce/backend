# Path Alias Configuration

This project uses TypeScript path aliases for cleaner imports across module boundaries.

## Configured Aliases

Defined in `tsconfig.json`:

```json
{
  "@modules/*": ["src/modules/*"],
  "@shared/*": ["src/shared/*"],
  "@config": ["src/config/index.ts"]
}
```

## Usage Examples

```typescript
// Instead of:
import { UserRepoPrisma } from "../../../modules/auth/infra/UserRepoPrisma.js";

// Use:
import { UserRepoPrisma } from "@modules/auth/infra/UserRepoPrisma.js";
```

## Runtime Resolution

### Development (`npm run dev`)
- `tsx` v4+ resolves path aliases automatically
- No additional configuration needed

### Production Build (`npm run build:aliases`)
- TypeScript compiles to `dist/`
- `tsc-alias` rewrites path aliases to relative paths in compiled output
- Use `npm run build:aliases` instead of `npm run build` when using path aliases

### Production Runtime (`npm start`)
- Runs compiled JavaScript from `dist/`
- Path aliases already resolved by `tsc-alias`

## Important Notes

1. **Always use `.js` extensions** in imports (ESM requirement):
   ```typescript
   import { config } from "@config"; // ❌ Wrong
   import { config } from "@config.js"; // ✅ Correct (for @config alias)
   
   import { UserRepo } from "@modules/auth/domain/UserRepo"; // ❌ Wrong
   import { UserRepo } from "@modules/auth/domain/UserRepo.js"; // ✅ Correct
   ```

2. **Path aliases are optional** — relative imports still work:
   ```typescript
   // Both are valid:
   import { config } from "@config.js";
   import { config } from "../config/index.js";
   ```

3. **Use aliases for cross-module imports only** — within a module, prefer relative imports for better locality.

## Migration Strategy

The current codebase uses relative imports. Path aliases can be adopted incrementally:
- Foundation code (plugins, config) → keep relative imports
- Cross-module imports → migrate to aliases as modules are implemented
- Intra-module imports → keep relative imports
