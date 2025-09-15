# Contributing to JiraMCP

We welcome contributions to the JiraMCP project! This document provides guidelines for contributing to ensure a smooth collaboration process.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Security Guidelines](#security-guidelines)
- [Submitting Changes](#submitting-changes)
- [Release Process](#release-process)

## Code of Conduct

This project adheres to a professional code of conduct. We expect all contributors to:

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Focus on what is best for the community
- Show empathy towards other community members
- Maintain professional communication standards

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Git for version control
- Access to a Jira Cloud instance for testing
- GitHub account for submitting pull requests

### Development Setup

1. **Fork the repository:**
```bash
git clone https://github.com/YOUR_USERNAME/JiraMCP.git
cd JiraMCP
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment:**
```bash
cp .env.example .env.development
# Edit .env.development with your test credentials
```

4. **Build and test:**
```bash
npm run build
npm test
npm run typecheck
npm run lint
```

5. **Test connection:**
```bash
node test-connection.js
```

## Development Process

### Branch Strategy

- **main**: Production-ready code
- **develop**: Integration branch for features
- **feature/**: Feature development branches
- **fix/**: Bug fix branches
- **security/**: Security-related fixes

### Workflow

1. **Create a feature branch:**
```bash
git checkout -b feature/your-feature-name
```

2. **Make your changes** following coding standards

3. **Test thoroughly:**
```bash
npm test
npm run test:coverage
npm run lint
npm run typecheck
```

4. **Commit with conventional format:**
```bash
git commit -m "feat: add new feature description"
```

5. **Push and create pull request:**
```bash
git push origin feature/your-feature-name
```

## Coding Standards

### TypeScript Guidelines

- **Strict Mode**: All code must pass TypeScript strict mode
- **Explicit Types**: Avoid `any` types, use explicit interfaces
- **Function Return Types**: Always specify return types for functions
- **Null Safety**: Handle null/undefined cases explicitly

### Code Style

- **ESLint**: All code must pass ESLint validation
- **Prettier**: Use consistent formatting (run `npm run format`)
- **Naming**: Use descriptive names for variables, functions, and classes
- **Comments**: Document complex logic and security-related code

### File Organization

```
src/
├── __tests__/          # Test files
├── notifiers/          # Notification implementations
├── validators.ts       # Input validation
├── rate-limiter.ts     # Security controls
├── jira-client-secure.ts # API client
└── index.ts           # Main server
```

### Security Requirements

- **Input Validation**: All user inputs must be validated
- **Error Handling**: Sanitize error messages to prevent information disclosure
- **Rate Limiting**: Implement appropriate rate limiting for new endpoints
- **Authentication**: Secure API access patterns
- **Logging**: No sensitive data in logs

## Testing Requirements

### Test Coverage

- **Minimum Coverage**: 80% line coverage required
- **Unit Tests**: All new functions must have unit tests
- **Integration Tests**: End-to-end workflow testing
- **Security Tests**: Validation and injection prevention tests

### Test Structure

```typescript
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should handle valid input correctly', () => {
      // Test implementation
    });

    it('should reject invalid input', () => {
      // Test validation
    });

    it('should handle edge cases', () => {
      // Test edge cases
    });
  });
});
```

### Running Tests

```bash
# Unit tests
npm test

# Coverage report
npm run test:coverage

# Watch mode for development
npm run test:watch

# Integration tests
npm run test:integration
```

## Security Guidelines

### Security Review Process

All contributions undergo security review:

1. **Automated Scanning**: CI/CD pipeline runs security scans
2. **Manual Review**: Security-sensitive changes require manual review
3. **Penetration Testing**: Critical features require security testing

### Security Checklist

- [ ] Input validation implemented
- [ ] Error messages sanitized
- [ ] Rate limiting considered
- [ ] Authentication/authorization verified
- [ ] No secrets in code
- [ ] Secure coding practices followed

### Reporting Security Issues

**Do not create public issues for security vulnerabilities.**

Email security issues to: security@your-domain.com

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Suggested remediation

## Submitting Changes

### Pull Request Process

1. **Update Documentation**: Ensure docs reflect your changes
2. **Add Tests**: Include appropriate test coverage
3. **Update Changelog**: Add entry to CHANGELOG.md
4. **Security Review**: Complete security checklist
5. **Performance Impact**: Document any performance implications

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Security enhancement
- [ ] Documentation update
- [ ] Performance improvement

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Security testing performed

## Security Checklist
- [ ] Input validation implemented
- [ ] Error handling reviewed
- [ ] No sensitive data exposed
- [ ] Rate limiting considered

## Documentation
- [ ] README updated
- [ ] API documentation updated
- [ ] Deployment guide updated
- [ ] Changelog updated
```

### Review Process

1. **Automated Checks**: CI/CD pipeline must pass
2. **Code Review**: Minimum 2 approvals required
3. **Security Review**: Required for security-sensitive changes
4. **Integration Testing**: Full test suite execution
5. **Deployment Testing**: Staging environment validation

## Release Process

### Version Strategy

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Workflow

1. **Version Bump**: Update package.json version
2. **Changelog Update**: Document all changes
3. **Security Scan**: Final security validation
4. **Tag Release**: Create git tag
5. **GitHub Release**: Automated release notes
6. **NPM Publish**: Package distribution

### Changelog Format

```markdown
## [1.2.0] - 2024-01-15

### Added
- New notification system for Teams integration

### Changed
- Improved error handling in Jira client

### Fixed
- Fixed rate limiting edge case

### Security
- Enhanced input validation for board IDs
```

## Development Guidelines

### Performance Considerations

- **Async Operations**: Use proper async/await patterns
- **Memory Usage**: Avoid memory leaks in long-running processes
- **Rate Limiting**: Respect Jira API rate limits
- **Caching**: Implement appropriate caching strategies

### Error Handling

- **Graceful Degradation**: Handle API failures gracefully
- **User Feedback**: Provide meaningful error messages
- **Logging**: Log errors for debugging without exposing sensitive data
- **Recovery**: Implement retry mechanisms where appropriate

### Documentation Standards

- **Code Comments**: Document complex algorithms and security decisions
- **API Documentation**: Keep API docs synchronized with code
- **README Updates**: Update setup instructions for new features
- **Architecture Decisions**: Document significant design choices

## Getting Help

### Resources

- **Documentation**: Check `/docs` directory
- **Issues**: Search existing GitHub issues
- **Discussions**: Use GitHub Discussions for questions
- **Security**: Email security@your-domain.com for security issues

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and discussions
- **Pull Requests**: Code review and collaboration
- **Security Email**: Confidential security matters

Thank you for contributing to JiraMCP! Your contributions help make this project better for everyone.