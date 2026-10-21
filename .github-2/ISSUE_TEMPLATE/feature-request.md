
name: Feature request
description: Suggest an improvement or new capability for MedOrbits
title: “[Feature]: “
labels:
  - enhancement
  - triage
assignees: []

body:
  - type: markdown
    attributes:
      value: |
        Thank you for helping improve MedOrbits.

        Describe the problem, the users affected, and the outcome you want to achieve. Feature requests are reviewed for user value, feasibility, security, accessibility, and alignment with the project roadmap.

  - type: textarea
    id: problem
    attributes:
      label: Problem or opportunity
      description: What problem are you trying to solve, or what opportunity do you see?
      placeholder: |
        Currently, users…
        This creates the following problem or opportunity…
    validations:
      required: true

  - type: textarea
    id: proposed_solution
    attributes:
      label: Proposed solution
      description: Describe the feature, improvement, or behavior you would like to see.
      placeholder: Explain your proposed solution and how it addresses the problem.
    validations:
      required: true

  - type: textarea
    id: intended_users
    attributes:
      label: Intended users and use case
      description: Identify who benefits, when the feature is needed, and the outcome it should enable.
      placeholder: |
        - Intended users:
        - When or why it is needed:
        - Desired outcome:
    validations:
      required: true

  - type: dropdown
    id: affected_area
    attributes:
      label: Affected area
      description: Select all areas relevant to this request.
      multiple: true
      options:
        - Website / user interface
        - Authentication or account
        - Education / admissions
        - Applications or documents
        - Careers / jobs
        - Payments or subscriptions
        - Notifications or email
        - Admin dashboard
        - API / backend
        - Database
        - Deployment / infrastructure
        - Security or privacy
        - Accessibility
        - Other
    validations:
      required: true

  - type: textarea
    id: expected_behavior
    attributes:
      label: Expected behavior
      description: Explain how the feature should work from the user’s perspective.
      placeholder: |
        When a user…
        The system should…
        The user should then be able to…
    validations:
      required: true

  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives considered
      description: Describe alternative solutions, existing tools, or workarounds you have considered.
      placeholder: Explain the alternatives and why they may or may not be suitable.
    validations:
      required: false

  - type: textarea
    id: acceptance_criteria
    attributes:
      label: Acceptance criteria
      description: List observable conditions that must be satisfied for the feature to be considered complete.
      placeholder: |
        - [ ] Criterion 1
        - [ ] Criterion 2
        - [ ] Criterion 3
    validations:
      required: true

  - type: dropdown
    id: priority
    attributes:
      label: Impact and priority
      description: Choose the closest description of the expected user impact.
      options:
        - Critical workflow
        - Significant improvement
        - Quality-of-life improvement
        - Optional enhancement
        - Needs further assessment
    validations:
      required: true

  - type: textarea
    id: expected_impact
    attributes:
      label: Expected impact
      description: Explain the expected benefits for users or the project.
      placeholder: Describe the expected improvement, affected users, or measurable outcome.
    validations:
      required: true

  - type: textarea
    id: additional_context
    attributes:
      label: Additional context
      description: Add mockups, examples, relevant links, related issues, or other useful details. Remove confidential information.
      placeholder: Add supporting context here.
    validations:
      required: false

  - type: textarea
    id: security_privacy_accessibility
    attributes:
      label: Security, privacy, and accessibility considerations
      description: Consider personal data, permissions, payments, document handling, accessibility, and abuse prevention. Enter “None known” if not applicable.
      placeholder: |
        - Personal data or permissions:
        - Payment or document handling:
        - Accessibility:
        - Abuse prevention:
        - Other considerations:
    validations:
      required: true

  - type: checkboxes
    id: contribution
    attributes:
      label: Contribution
      description: Select any options that apply.
      options:
        - label: I am willing to help implement or test this feature.
          required: false
        - label: I may be able to help with design, documentation, or feedback.
          required: false
        - label: I am requesting the feature only.
          required: false

  - type: checkboxes
    id: confirmations
    attributes:
      label: Submission checklist
      options:
        - label: I have searched existing issues for a duplicate request.
          required: true
        - label: I have removed confidential information from this request.
          required: true
