# Accessibility Requirements

## 1. Baseline

Target WCAG 2.2 AA principles where applicable, plus the accessibility guidance for each supported mobile platform. Validate against real assistive technologies; automated checks alone are insufficient.

## 2. Semantics

- Use native semantic controls when possible.
- Provide accessible names for icon-only controls.
- Associate form labels, helper text, and errors with their fields.
- Expose meaningful headings and screen titles.
- Announce status changes such as upload progress, submission success, and validation errors.

## 3. Visual design

- Maintain readable contrast for text and controls.
- Do not communicate status using color alone.
- Support text resizing and dynamic type without clipping.
- Ensure touch targets meet platform guidance.
- Avoid essential content conveyed only through animation or imagery.
- Respect reduced-motion preferences.

## 4. Forms

- Identify required fields clearly.
- Provide specific error messages and correction guidance.
- Preserve entered values after recoverable errors.
- Move focus appropriately after validation failure.
- Do not rely on placeholder text as the only label.

## 5. Navigation and dialogs

- Support keyboard and assistive-technology navigation where applicable.
- Keep focus order logical.
- Return focus after closing a dialog.
- Provide accessible loading and empty states.
- Avoid unexpected focus changes or auto-navigation.

## 6. Documents and charts

- Provide text equivalents for meaningful images.
- Provide accessible labels for document status and upload progress.
- Do not require color perception to distinguish accepted, rejected, and pending states.

## 7. Testing

Test screen readers, large text, contrast, switch/keyboard navigation where supported, reduced motion, and error flows on supported platforms. Record known exceptions and remediation plans.
