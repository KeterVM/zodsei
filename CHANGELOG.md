# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0-alpha] - 2025-07-28

### Added

- **defineContract helper function** - New utility for defining contracts with better type inference
- **Comprehensive examples** - Added multiple example files demonstrating different use cases:
  - `examples/basic-usage.ts` - Basic client usage with middleware
  - `examples/adapter-usage.ts` - HTTP adapter comparison and configuration
  - `examples/interceptor-demo.ts` - Axios interceptor demonstrations
  - `examples/axios-interceptors.ts` - Advanced interceptor patterns
  - `examples/contract-definition-comparison.ts` - Different contract definition approaches

### Changed

- **BREAKING: Updated Zod dependency** - Upgraded to Zod v4 with improved API and performance
- **Improved contract definition syntax** - All examples now use `defineContract()` for better developer experience
- **Updated ESLint configuration** - Migrated from `.eslintrc.js` to modern flat config format (`eslint.config.js`)
- **Optimized bundle size** - Reduced package size by 94% (from ~500KB to ~30KB) by properly externalizing dependencies

### Fixed

- **Bundle optimization** - Zod is now correctly treated as external dependency instead of being bundled
- **Dependency management** - Moved Zod from `dependencies` to `peerDependencies` for better version control
- **Type safety improvements** - Enhanced type inference with `defineContract` helper

### Technical Improvements

- **Updated all dependencies** to latest versions
- **Enhanced test coverage** - Added comprehensive middleware and adapter tests
- **Improved documentation** - Updated README with consistent examples using `defineContract`
- **Better TypeScript support** - Enhanced type definitions and inference

### Migration Guide

#### Contract Definition

```typescript
// Old way (still works but not recommended)
const contract = {
  getUser: { ... }
} as const satisfies Contract;

// New way (recommended)
import { defineContract } from 'zodsei';
const contract = defineContract({
  getUser: { ... }
});
```

#### Zod Schema Updates

```typescript
// Old (deprecated in Zod v4)
z.string().uuid()
z.string().email()
z.string().datetime()

// New (Zod v4 recommended)
z.uuidv4()
z.email()
z.iso.datetime()
```

## [0.1.4] - 2025-07-27

### Initial Release

- Contract-first HTTP client with Zod validation
- Support for multiple HTTP adapters (Fetch, Axios, Ky)
- Middleware system (retry, cache)
- Full TypeScript support
- Comprehensive test suite
